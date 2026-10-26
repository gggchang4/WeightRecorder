import type { Settings, Snapshot, Unit, WeightEntry } from './types.ts';

export const KG_TO_LB = 2.2046226218;
export const DAY_MS = 86_400_000;

/** Dates are local calendar dates. UTC is used only for calendar arithmetic. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dayDistance(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function toDisplay(kg: number, unit: Unit): number {
  return unit === 'lb' ? kg * KG_TO_LB : kg;
}

export function toKg(value: number, unit: Unit): number {
  return Math.round((unit === 'lb' ? value / KG_TO_LB : value) * 1000) / 1000;
}

export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  return kg == null ? '—' : toDisplay(kg, unit).toFixed(1);
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarize(entries: WeightEntry[], settings: Settings, today: string) {
  const sorted = [...entries].filter(entry => entry.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;
  const first = sorted[0] ?? null;
  const last7 = sorted.filter(entry => entry.date >= shiftDate(today, -6));
  const prior7 = sorted.filter(entry => entry.date >= shiftDate(today, -13) && entry.date <= shiftDate(today, -7));
  const last30 = sorted.filter(entry => entry.date >= shiftDate(today, -29));
  const latestAvg = average(last7.map(entry => entry.weightKg));
  const previousAvg = average(prior7.map(entry => entry.weightKg));
  const dates = new Set(sorted.map(entry => entry.date));
  let streak = 0;
  let cursor = dates.has(today) ? today : shiftDate(today, -1);
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  const goal = settings.targetWeightKg;
  const totalDistance = first && goal != null ? goal - first.weightKg : null;
  const progress = latest && first && totalDistance != null && totalDistance !== 0
    ? Math.max(0, Math.min(100, (latest.weightKg - first.weightKg) / totalDistance * 100))
    : latest && goal != null && latest.weightKg === goal ? 100 : 0;
  return {
    latest, previous, first, streak, last7, last30, latestAvg, previousAvg,
    weeklyChange: latestAvg != null && previousAvg != null ? latestAvg - previousAvg : null,
    totalChange: latest && first ? latest.weightKg - first.weightKg : null,
    recentChange: latest && previous ? latest.weightKg - previous.weightKg : null,
    bmi: latest && settings.heightCm ? latest.weightKg / (settings.heightCm / 100) ** 2 : null,
    progress,
    distance: latest && goal != null ? Math.abs(latest.weightKg - goal) : null,
    coverage: last30.length,
  };
}

export function chartData(entries: WeightEntry[], start: string, end: string) {
  const byDate = new Map(entries.map(entry => [entry.date, entry]));
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const length = dayDistance(start, end) + 1;
  let left = 0;
  let right = 0;
  let sum = 0;
  return Array.from({ length: Math.max(0, length) }, (_, index) => {
    const date = shiftDate(start, index);
    const windowStart = shiftDate(date, -6);
    while (right < sorted.length && sorted[right].date <= date) { sum += sorted[right].weightKg; right += 1; }
    while (left < right && sorted[left].date < windowStart) { sum -= sorted[left].weightKg; left += 1; }
    return {
      date,
      weight: byDate.get(date)?.weightKg ?? null,
      // Only show a rolling mean where that day was actually measured; do not invent readings.
      average: byDate.has(date) && right > left ? sum / (right - left) : null,
      note: byDate.get(date)?.note ?? '',
    };
  });
}

export function createDemoSnapshot(today = localDate()): Snapshot {
  const entries: WeightEntry[] = [];
  const notes = ['晨起，早餐前', '', '散步后感觉不错', '', '今天状态很好', '', ''];
  for (let i = 0; i < 83; i += 1) {
    if (i % 17 === 8 || i % 23 === 11) continue;
    const date = shiftDate(today, i - 83);
    const weightKg = Math.round((76.7 - i * 0.046 + Math.sin(i * 1.32) * 0.23 + Math.cos(i * 0.34) * 0.24) * 10) / 10;
    entries.push({
      id: `demo-${i}`, date, weightKg, note: notes[i % 7],
      mood: i % 8 === 0 ? 'tired' : i % 3 === 0 ? 'neutral' : 'good',
      createdAt: `${date}T00:20:00.000Z`, updatedAt: `${date}T00:20:00.000Z`,
    });
  }
  return {
    entries,
    settings: { displayName: '我的', heightCm: 175, targetWeightKg: 70, unit: 'kg', theme: 'light' },
  };
}
