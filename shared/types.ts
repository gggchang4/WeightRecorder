export type Unit = 'kg' | 'lb';
export type Theme = 'light' | 'dark' | 'system';
export type Mood = 'good' | 'neutral' | 'tired';

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  note: string;
  mood: Mood;
  createdAt: string;
  updatedAt: string;
}

export interface EntryInput {
  date: string;
  weightKg: number;
  note?: string;
  mood?: Mood;
}

export interface Settings {
  displayName: string;
  heightCm: number | null;
  targetWeightKg: number | null;
  unit: Unit;
  theme: Theme;
}

export interface Snapshot {
  entries: WeightEntry[];
  settings: Settings;
}

export interface Backup extends Snapshot {
  format: 'qingji-backup';
  version: 1;
  exportedAt: string;
}

/** Adapter boundary for a future native client or authenticated remote transport. */
export interface WeightRepository {
  read(): Promise<Snapshot>;
  createEntry(input: EntryInput): Promise<WeightEntry>;
  updateEntry(id: string, input: EntryInput): Promise<WeightEntry>;
  deleteEntry(id: string): Promise<void>;
  updateSettings(settings: Settings): Promise<Settings>;
  importBackup(backup: Backup): Promise<{ imported: number; skipped: number }>;
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: '我的',
  heightCm: null,
  targetWeightKg: null,
  unit: 'kg',
  theme: 'light',
};
