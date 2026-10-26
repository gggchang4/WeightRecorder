import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';
import { createApiApp, apiErrorHandler } from './app.ts';
import { SqliteStore } from './store.ts';

const isDev = process.argv.includes('--dev');
const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
const store = new SqliteStore(process.env.WEIGHT_DB_PATH ?? resolve(root, 'data', 'weight-recorder.sqlite'));
const app = createApiApp(store);
const server = createServer(app);
let closeVite: (() => Promise<void>) | undefined;

if (isDev) {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    root,
    server: { middlewareMode: true, hmr: { server }, watch: { ignored: ['**/data/**', '**/test-results/**'] } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  closeVite = () => vite.close();
} else {
  const dist = resolve(root, 'dist');
  try { await stat(resolve(dist, 'index.html')); }
  catch { console.error('请先运行 pnpm build，或双击「启动轻迹.cmd」。'); store.close(); process.exit(1); }
  app.use(express.static(dist, { index: false }));
  app.get('/{*path}', async (_req, res) => {
    res.type('html').send(await readFile(resolve(dist, 'index.html'), 'utf-8'));
  });
}
app.use(apiErrorHandler);

server.on('error', error => {
  console.error(error instanceof Error && 'code' in error && error.code === 'EADDRINUSE'
    ? `端口 ${port} 已被占用。请打开 http://127.0.0.1:${port}，或通过 PORT 设置其他端口。` : error);
  store.close();
  void closeVite?.();
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`\n  轻迹 · 体重日记\n  Local: http://127.0.0.1:${port}\n  Data:  ${process.env.WEIGHT_DB_PATH ?? resolve(root, 'data', 'weight-recorder.sqlite')}\n  Mode:  ${isDev ? 'development' : 'production'}\n`);
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await closeVite?.();
  server.close(() => { store.close(); process.exit(0); });
  server.closeIdleConnections();
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
