import test from 'node:test';
import assert from 'node:assert/strict';
import { average, chartData, createDemoSnapshot, dayDistance, formatWeight, isValidDate, localDate, shiftDate, summarize, toDisplay, toKg } from '../shared/domain.ts';
import { DEFAULT_SETTINGS } from '../shared/types.ts';
import type { WeightEntry } from '../shared/types.ts';
import { csvToEntries, entriesToCsv, parseCsv } from '../shared/csv.ts';

const entry = (date: string, weightKg: number, note = ''): WeightEntry => ({ id: date, date, weightKg, note, mood: 'neutral', createdAt: '', updatedAt: '' });

test('calendar arithmetic survives leap days, DST boundaries and year boundaries', () => {
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDate('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftDate('2025-01-01', -1), '2024-12-31');
  assert.equal(dayDistance('2026-03-07', '2026-03-10'), 3);
  assert.equal(isValidDate('2025-02-29'), false);
  assert.equal(isValidDate('2026-04-31'), false);
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2026-1-01'), false);
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('units round-trip without changing canonical kilograms', () => {
  assert.ok(Math.abs(toDisplay(70, 'lb') - 154.32358) < 0.0001);
  assert.equal(toKg(toDisplay(70.123, 'lb'), 'lb'), 70.123);
  assert.equal(formatWeight(null, 'kg'), '—');
  assert.equal(average([]), null);
});

test('seven-day averages use calendar days, not the last seven measurements', () => {
  const entries = [entry('2026-09-28', 90), entry('2026-10-10', 80), entry('2026-10-16', 78), entry('2026-10-17', 77), entry('2026-10-22', 75), entry('2026-10-23', 74), entry('2026-10-24', 1)];
  const stats = summarize(entries, DEFAULT_SETTINGS, '2026-10-23');
  assert.equal(stats.latest?.weightKg, 74);
  assert.equal(stats.last7.length, 3);
  assert.equal(stats.latestAvg, (77 + 75 + 74) / 3);
  assert.equal(stats.previousAvg, 79);
  assert.equal(stats.streak, 2);
  assert.equal(stats.coverage, 6);
});

test('a streak can include yesterday before today is logged, but stops across missing days', () => {
  assert.equal(summarize([entry('2026-10-21', 70), entry('2026-10-22', 70)], DEFAULT_SETTINGS, '2026-10-23').streak, 2);
  assert.equal(summarize([entry('2026-10-20', 70), entry('2026-10-21', 70)], DEFAULT_SETTINGS, '2026-10-23').streak, 0);
});

test('goal progress works for gain, loss, crossing target and maintaining a target', () => {
  const gain = summarize([entry('2026-10-01', 60), entry('2026-10-23', 65)], { ...DEFAULT_SETTINGS, targetWeightKg: 70 }, '2026-10-23');
  const loss = summarize([entry('2026-10-01', 80), entry('2026-10-23', 75)], { ...DEFAULT_SETTINGS, targetWeightKg: 70 }, '2026-10-23');
  assert.equal(gain.progress, 50); assert.equal(loss.progress, 50);
  assert.equal(summarize([entry('2026-10-01', 80), entry('2026-10-23', 69)], { ...DEFAULT_SETTINGS, targetWeightKg: 70 }, '2026-10-23').progress, 100);
  assert.equal(summarize([entry('2026-10-23', 70)], { ...DEFAULT_SETTINGS, targetWeightKg: 70 }, '2026-10-23').progress, 100);
  assert.equal(summarize([], DEFAULT_SETTINGS, '2026-10-23').progress, 0);
});

test('chart keeps missing dates empty and computes its rolling mean from a true calendar window', () => {
  const data = chartData([entry('2026-10-01', 100), entry('2026-10-15', 76), entry('2026-10-21', 74), entry('2026-10-23', 72)], '2026-10-20', '2026-10-23');
  assert.equal(data.length, 4);
  assert.equal(data[0].weight, null); assert.equal(data[0].average, null);
  assert.equal(data[1].average, 75);
  assert.equal(data[2].weight, null); assert.equal(data[3].average, 73);
});

test('CSV preserves Unicode, commas, escaped quotes, multiline notes and protects spreadsheet formulas', () => {
  const entries = [entry('2026-10-22', 70, '晨起,"早餐前"\n心情不错'), entry('2026-10-23', 69.8, '=1+1')];
  const csv = entriesToCsv(entries);
  assert.ok(csv.startsWith('\uFEFFdate,weight_kg'));
  assert.ok(csv.includes("'=1+1"));
  const parsed = csvToEntries(csv);
  assert.equal(parsed[0].note, entries[0].note);
  assert.equal(parsed[1].note, '=1+1');
  assert.equal(parsed[1].weightKg, 69.8);
  assert.deepEqual(parseCsv('a,b\r\n"c,d","e""f"'), [['a', 'b'], ['c,d', 'e"f']]);
  assert.throws(() => parseCsv('a\n"bad'), /未闭合/);
  assert.throws(() => csvToEntries('date,weight_kg\n2026-10-23,'), /无效/);
});

test('demo readings stop yesterday and are generated independently', () => {
  const one = createDemoSnapshot('2026-10-23'); const two = createDemoSnapshot('2026-10-23');
  assert.equal(one.entries.at(-1)?.date, '2026-10-22');
  one.entries.length = 0;
  assert.ok(two.entries.length > 60);
});

test('the all-time chart does not truncate a valid date range longer than one hundred years', () => {
  const entries = [entry('1900-01-01', 70), entry('2026-10-23', 72)];
  const data = chartData(entries, '1900-01-01', '2026-10-23');
  assert.equal(data[0].date, '1900-01-01');
  assert.equal(data.at(-1)?.date, '2026-10-23');
  assert.equal(data.at(-1)?.weight, 72);
});
