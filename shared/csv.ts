import { isValidDate } from './domain.ts';
import type { EntryInput, WeightEntry } from './types.ts';

function escapeCell(value: string): string {
  // Neutralize spreadsheet formulas in free text when opened by Excel/Numbers.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function entriesToCsv(entries: WeightEntry[]): string {
  return '\uFEFFdate,weight_kg,note,mood\r\n' + entries.map(entry =>
    [entry.date, entry.weightKg, escapeCell(entry.note), entry.mood].join(',')).join('\r\n');
}

/** RFC 4180 parser: quoted commas, escaped quotes, multiline notes and BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (quoted || field === '') quoted = !quoted;
      else throw new Error('CSV 引号格式不正确');
    } else if (char === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV 存在未闭合的引号');
  row.push(field);
  if (row.some(cell => cell !== '')) rows.push(row);
  return rows;
}

export function csvToEntries(text: string): EntryInput[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('CSV 文件为空');
  const columns = header.map(value => value.trim().toLowerCase());
  const dateIndex = columns.indexOf('date');
  const weightIndex = columns.indexOf('weight_kg');
  const noteIndex = columns.indexOf('note');
  const moodIndex = columns.indexOf('mood');
  if (dateIndex < 0 || weightIndex < 0) throw new Error('CSV 需要 date 和 weight_kg 两列，体重单位为公斤');
  if (rows.length > 20_000) throw new Error('单次最多导入 20,000 条记录');
  return rows.map((row, index) => {
    const date = row[dateIndex]?.trim();
    const rawWeight = row[weightIndex]?.trim();
    const weightKg = rawWeight ? Number(rawWeight) : NaN;
    const mood = moodIndex < 0 || !row[moodIndex] ? 'neutral' : row[moodIndex].trim();
    if (!date || !isValidDate(date) || !Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) {
      throw new Error(`CSV 第 ${index + 2} 行的日期或体重无效`);
    }
    if (!['good', 'neutral', 'tired'].includes(mood)) throw new Error(`CSV 第 ${index + 2} 行的状态应为 good、neutral 或 tired`);
    let note = noteIndex < 0 ? '' : row[noteIndex] ?? '';
    // Undo only the formula protection prefix emitted by this exporter.
    if (/^'[=+\-@\t\r]/.test(note)) note = note.slice(1);
    return { date, weightKg, note, mood: mood as EntryInput['mood'] };
  });
}
