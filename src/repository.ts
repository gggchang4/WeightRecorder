import type { Backup, EntryInput, Settings, Snapshot, WeightEntry, WeightRepository } from '../shared/types.ts';
import { createDemoSnapshot } from '../shared/domain.ts';

export class ApiError extends Error {
  constructor(message: string, public code = 'NETWORK_ERROR') { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch { throw new ApiError('无法连接本地服务，请检查轻迹是否正在运行'); }
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error?.message ?? '操作失败，请重试', result.error?.code);
  return result.data as T;
}

export const localRepository: WeightRepository = {
  read: () => request<Snapshot>('/snapshot'),
  createEntry: input => request<WeightEntry>('/entries', { method: 'POST', body: JSON.stringify(input) }),
  updateEntry: (id, input) => request<WeightEntry>(`/entries/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteEntry: id => request<void>(`/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateSettings: settings => request<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(settings) }),
  importBackup: backup => request<{ imported: number; skipped: number }>('/import', { method: 'POST', body: JSON.stringify(backup) }),
};

/** A separate in-memory adapter. Demo entries are never written to the user's SQLite file. */
export class DemoRepository implements WeightRepository {
  private snapshot: Snapshot = createDemoSnapshot();
  async read() { return structuredClone(this.snapshot); }
  async createEntry(input: EntryInput) {
    if (this.snapshot.entries.some(entry => entry.date === input.date)) throw new ApiError('这一天已有记录，请编辑已有记录', 'DATE_CONFLICT');
    const now = new Date().toISOString();
    const entry: WeightEntry = { ...input, note: input.note ?? '', mood: input.mood ?? 'neutral', id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.snapshot.entries.push(entry);
    this.snapshot.entries.sort((a, b) => a.date.localeCompare(b.date));
    return structuredClone(entry);
  }
  async updateEntry(id: string, input: EntryInput) {
    if (this.snapshot.entries.some(entry => entry.date === input.date && entry.id !== id)) throw new ApiError('这一天已有记录，请更换日期', 'DATE_CONFLICT');
    const index = this.snapshot.entries.findIndex(entry => entry.id === id);
    if (index < 0) throw new ApiError('记录不存在');
    this.snapshot.entries[index] = { ...this.snapshot.entries[index], ...input, note: input.note ?? '', mood: input.mood ?? 'neutral', updatedAt: new Date().toISOString() };
    this.snapshot.entries.sort((a, b) => a.date.localeCompare(b.date));
    return structuredClone(this.snapshot.entries.find(entry => entry.id === id)!);
  }
  async deleteEntry(id: string) { this.snapshot.entries = this.snapshot.entries.filter(entry => entry.id !== id); }
  async updateSettings(settings: Settings) { this.snapshot.settings = structuredClone(settings); return settings; }
  async importBackup(_backup: Backup): Promise<{ imported: number; skipped: number }> { throw new ApiError('请先退出示例模式，再导入个人数据'); }
}

export function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
