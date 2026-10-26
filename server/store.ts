import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EntryInput, Settings, Snapshot, WeightEntry } from '../shared/types.ts';
import { DEFAULT_SETTINGS } from '../shared/types.ts';
import { AppError, settingsSchema } from './validation.ts';

/** SQLite is confined to this adapter; UI and domain logic have no SQL dependency. */
export class SqliteStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        weightKg REAL NOT NULL CHECK(weightKg >= 1 AND weightKg <= 500),
        note TEXT NOT NULL DEFAULT '',
        mood TEXT NOT NULL DEFAULT 'neutral' CHECK(mood IN ('good', 'neutral', 'tired')),
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        value TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
    this.db.prepare('INSERT OR IGNORE INTO preferences (id, value) VALUES (1, ?)').run(JSON.stringify(DEFAULT_SETTINGS));
  }

  listEntries(): WeightEntry[] {
    return this.db.prepare('SELECT * FROM entries ORDER BY date ASC').all() as unknown as WeightEntry[];
  }

  getSettings(): Settings {
    const row = this.db.prepare('SELECT value FROM preferences WHERE id = 1').get() as { value: string };
    return settingsSchema.parse(JSON.parse(row.value));
  }

  snapshot(): Snapshot {
    return { entries: this.listEntries(), settings: this.getSettings() };
  }

  createEntry(input: Required<EntryInput>): WeightEntry {
    this.checkDateConflict(input.date);
    const now = new Date().toISOString();
    const entry: WeightEntry = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.db.prepare('INSERT INTO entries (id, date, weightKg, note, mood, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(entry.id, entry.date, entry.weightKg, entry.note, entry.mood, entry.createdAt, entry.updatedAt);
    return entry;
  }

  updateEntry(id: string, input: Required<EntryInput>): WeightEntry {
    const existing = this.db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as unknown as WeightEntry | undefined;
    if (!existing) throw new AppError(404, 'NOT_FOUND', '这条记录不存在或已被删除');
    this.checkDateConflict(input.date, id);
    const entry = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.db.prepare('UPDATE entries SET date = ?, weightKg = ?, note = ?, mood = ?, updatedAt = ? WHERE id = ?')
      .run(entry.date, entry.weightKg, entry.note, entry.mood, entry.updatedAt, id);
    return entry;
  }

  deleteEntry(id: string): void {
    const result = this.db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    if (Number(result.changes) === 0) throw new AppError(404, 'NOT_FOUND', '这条记录不存在或已被删除');
  }

  updateSettings(settings: Settings): Settings {
    this.db.prepare('UPDATE preferences SET value = ? WHERE id = 1').run(JSON.stringify(settings));
    return settings;
  }

  importData(entries: Required<EntryInput>[], settings: Settings): { imported: number; skipped: number } {
    let imported = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = new Set(this.listEntries().map(entry => entry.date));
      for (const entry of entries) {
        if (existing.has(entry.date)) continue;
        this.createEntry(entry);
        existing.add(entry.date);
        imported += 1;
      }
      this.updateSettings(settings);
      this.db.exec('COMMIT');
      return { imported, skipped: entries.length - imported };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void { this.db.close(); }

  private checkDateConflict(date: string, exceptId?: string) {
    const found = this.db.prepare('SELECT id FROM entries WHERE date = ?').get(date) as { id: string } | undefined;
    if (found && found.id !== exceptId) throw new AppError(409, 'DATE_CONFLICT', '这一天已有记录，请编辑已有记录');
  }
}
