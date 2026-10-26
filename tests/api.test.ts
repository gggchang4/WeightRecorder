import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiApp, apiErrorHandler } from '../server/app.ts';
import { SqliteStore } from '../server/store.ts';
import { DEFAULT_SETTINGS } from '../shared/types.ts';
import { localDate, shiftDate } from '../shared/domain.ts';

test('complete API flow: validation → SQLite → edit → backup → atomic import → persistence → delete', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qingji-api-'));
  const path = join(dir, 'test.sqlite');
  const store = new SqliteStore(path);
  const app = createApiApp(store); app.use(apiErrorHandler);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, method = 'GET', body?: unknown, headers?: Record<string, string>) => fetch(`${base}/api/v1${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } });
  const today = localDate(); const yesterday = shiftDate(today, -1);
  try {
    assert.equal((await call('/health')).status, 200);
    assert.deepEqual((await (await call('/snapshot')).json()).data.entries, []);
    assert.equal((await call('/entries', 'POST', { date: today, weightKg: 0 })).status, 400);
    assert.equal((await call('/entries', 'POST', { date: '2025-02-29', weightKg: 70 })).status, 400);
    assert.equal((await call('/entries', 'POST', { date: shiftDate(today, 1), weightKg: 70 })).status, 400);
    assert.equal((await call('/entries', 'POST', { date: today, weightKg: 70 }, { Origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await call('/entries', 'POST', { date: today, weightKg: 70 }, { 'Content-Type': 'text/plain' })).status, 415);
    const createdResponse = await call('/entries', 'POST', { date: today, weightKg: 72.5, note: '初次记录', mood: 'good' });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal((await call('/entries', 'POST', { date: today, weightKg: 99 })).status, 409);
    const updated = (await (await call(`/entries/${created.id}`, 'PUT', { date: today, weightKg: 72.3, note: '更新记录' })).json()).data;
    assert.equal(updated.weightKg, 72.3); assert.equal(updated.createdAt, created.createdAt);
    assert.equal((await call('/settings', 'PATCH', { targetWeightKg: 70, unit: 'lb', heightCm: 175 })).status, 200);
    assert.equal((await call('/settings', 'PATCH', { targetWeightKg: 0 })).status, 400);
    const backup = await (await call('/export')).json();
    assert.equal(backup.format, 'qingji-backup'); assert.equal(backup.entries[0].weightKg, 72.3);
    const csvResponse = await call('/export?format=csv');
    assert.match(csvResponse.headers.get('content-type')!, /text\/csv/); assert.match(await csvResponse.text(), /72.3/);
    const invalid = { ...backup, entries: [{ date: yesterday, weightKg: 73 }, { date: today, weightKg: -1 }] };
    assert.equal((await call('/import', 'POST', invalid)).status, 400);
    assert.equal(store.listEntries().length, 1, 'An invalid import must not partially commit');
    const merged = await (await call('/import', 'POST', { ...backup, entries: [{ date: yesterday, weightKg: 73 }, { date: yesterday, weightKg: 88 }, { date: today, weightKg: 99 }] })).json();
    assert.deepEqual(merged.data, { imported: 1, skipped: 2 });
    assert.equal(store.listEntries()[1].weightKg, 72.3, 'Existing local date must win');
    assert.equal((await call(`/entries/${created.id}`, 'PUT', { date: yesterday, weightKg: 72 })).status, 409);
    const filtered = await (await call(`/entries?from=${today}&to=${today}`)).json();
    assert.equal(filtered.data.length, 1);
    const context = await (await call('/agent/context')).json();
    assert.equal(context.data.capabilities.modelConnected, false);
    assert.equal(context.data.summary.latest.weightKg, 72.3);
    assert.equal((await (await call('/openapi.json')).json()).openapi, '3.1.0');
    assert.equal((await call('/unknown')).status, 404);
    const reopened = new SqliteStore(path);
    assert.equal(reopened.listEntries().length, 2); assert.equal(reopened.getSettings().unit, 'lb'); reopened.close();
    assert.equal((await call(`/entries/${created.id}`, 'DELETE')).status, 204);
    assert.equal((await call(`/entries/${created.id}`, 'DELETE')).status, 404);
    assert.equal(store.listEntries().length, 1);
    assert.equal(store.db.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
    const cleanupPath = relative(tmpdir(), dir);
    assert.ok(!isAbsolute(cleanupPath) && !cleanupPath.startsWith('..') && basename(dir).startsWith('qingji-api-'));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('imports roll back writes and settings together if the storage operation fails', () => {
  const store = new SqliteStore(':memory:');
  try {
    assert.throws(() => store.importData([{ date: '2026-10-20', weightKg: 70, note: '', mood: 'neutral' }, { date: '2026-10-21', weightKg: -1, note: '', mood: 'neutral' }], { ...DEFAULT_SETTINGS, unit: 'lb' }));
    assert.equal(store.listEntries().length, 0);
    assert.equal(store.getSettings().unit, 'kg');
  } finally { store.close(); }
});
