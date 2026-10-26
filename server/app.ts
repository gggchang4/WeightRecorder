import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { localDate, summarize } from '../shared/domain.ts';
import { entriesToCsv } from '../shared/csv.ts';
import type { Backup } from '../shared/types.ts';
import { SqliteStore } from './store.ts';
import { AppError, backupSchema, dateSchema, entrySchema, settingsSchema } from './validation.ts';
import { openapi } from './openapi.ts';

export function createApiApp(store: SqliteStore) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const host = req.headers.host;
    if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) {
      return next(new AppError(403, 'LOCAL_ONLY', '仅允许通过 localhost 或 127.0.0.1 访问'));
    }
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const origin = req.headers.origin;
      if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
        return next(new AppError(403, 'ORIGIN_REJECTED', '不接受其他网站发起的请求'));
      }
      if (!['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method) && !req.is('application/json')) {
        return next(new AppError(415, 'JSON_REQUIRED', '请使用 application/json'));
      }
    }
    next();
  });
  app.use(express.json({ limit: '8mb' }));

  const router = express.Router();
  router.get('/', (_req, res) => res.json({ data: { name: '轻迹 API', version: '1.0.0', schema: '/api/v1/openapi.json', context: '/api/v1/agent/context' } }));
  router.get('/health', (_req, res) => res.json({ data: { app: 'qingji', version: '1.0.0', status: 'ok', storage: 'sqlite', scope: 'loopback' } }));
  router.get('/openapi.json', (_req, res) => res.json(openapi));
  router.get('/snapshot', (_req, res) => res.json({ data: store.snapshot() }));
  router.get('/entries', (req, res) => {
    const from = req.query.from === undefined ? null : dateSchema.parse(req.query.from);
    const to = req.query.to === undefined ? null : dateSchema.parse(req.query.to);
    if (from && to && from > to) throw new AppError(400, 'INVALID_RANGE', '起始日期不能晚于结束日期');
    res.json({ data: store.listEntries().filter(entry => (!from || entry.date >= from) && (!to || entry.date <= to)) });
  });
  router.post('/entries', (req, res) => res.status(201).json({ data: store.createEntry(entrySchema.parse(req.body)) }));
  router.put('/entries/:id', (req, res) => res.json({ data: store.updateEntry(req.params.id, entrySchema.parse(req.body)) }));
  router.delete('/entries/:id', (req, res) => { store.deleteEntry(req.params.id); res.status(204).end(); });
  router.patch('/settings', (req, res) => {
    const patch = settingsSchema.partial().parse(req.body);
    res.json({ data: store.updateSettings(settingsSchema.parse({ ...store.getSettings(), ...patch })) });
  });
  router.get('/summary', (req, res) => {
    const today = req.query.asOf === undefined ? localDate() : dateSchema.parse(req.query.asOf);
    res.json({ data: summarize(store.listEntries(), store.getSettings(), today) });
  });
  router.get('/export', (req, res) => {
    if (req.query.format && !['json', 'csv'].includes(String(req.query.format))) throw new AppError(400, 'INVALID_FORMAT', '导出格式应为 json 或 csv');
    const csv = req.query.format === 'csv';
    res.setHeader('Content-Disposition', `attachment; filename="qingji-${localDate()}.${csv ? 'csv' : 'json'}"`);
    if (csv) return res.type('text/csv; charset=utf-8').send(entriesToCsv(store.listEntries()));
    const backup: Backup = { format: 'qingji-backup', version: 1, exportedAt: new Date().toISOString(), ...store.snapshot() };
    res.json(backup);
  });
  router.post('/import', (req, res) => {
    const backup = backupSchema.parse(req.body);
    res.json({ data: store.importData(backup.entries, backup.settings) });
  });
  router.get('/agent/context', (_req, res) => {
    const snapshot = store.snapshot();
    const today = localDate();
    res.json({ data: {
      schemaVersion: 1, asOf: today, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canonicalWeightUnit: 'kg', summary: summarize(snapshot.entries, snapshot.settings, today),
      recentEntries: snapshot.entries.slice(-30),
      interpretation: ['Descriptive measurements only; not medical advice.', 'A missing date means no measurement.', 'Short-term changes do not establish fat loss or gain.', 'No forecast or model inference has been performed.'],
      capabilities: { modelConnected: false, toolsContract: '/api/v1/openapi.json' },
    } });
  });
  app.use('/api/v1', router);
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', '接口不存在')));
  return app;
}

export const apiErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? '输入无效', details: error.issues.map(issue => ({ path: issue.path, message: issue.message })) } });
  } else if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
  } else if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413)) {
    res.status(error.status).json({ error: { code: 'INVALID_BODY', message: error.status === 413 ? '导入文件过大，最多 8 MB' : 'JSON 格式不正确' } });
  } else {
    console.error(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '保存失败，请稍后重试；已有数据仍保存在本机' } });
  }
};
