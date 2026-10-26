import { Pencil, Trash2, NotebookPen } from 'lucide-react';
import type { Unit, WeightEntry } from '../../shared/types.ts';
import { formatWeight, localDate } from '../../shared/domain.ts';
import { Change, EmptyState, formatDay, IconButton, MoodIcon } from './ui.tsx';

export function RecordsTable({ entries, allEntries, unit, onEdit, onDelete, compact = false }: {
  entries: WeightEntry[]; allEntries: WeightEntry[]; unit: Unit; onEdit: (entry: WeightEntry) => void; onDelete: (entry: WeightEntry) => void; compact?: boolean;
}) {
  const changes = new Map(allEntries.map((entry, index) => [entry.id, index > 0 ? entry.weightKg - allEntries[index - 1].weightKg : null]));
  if (!entries.length) return <EmptyState icon={<NotebookPen size={28} />} title="还没有记录" description="保存一次测量后，会显示在这里。" />;
  return <div className="table-wrap"><table className={`records-table ${compact ? 'compact' : ''}`}>
    <thead><tr><th>日期</th><th>体重 <span>({unit})</span></th><th>较上次</th><th className="note-column">生活随记</th><th><span className="sr-only">操作</span></th></tr></thead>
    <tbody>{entries.map(entry => <tr key={entry.id}>
      <td><button className="date-cell" onClick={() => onEdit(entry)}><span className="date-icon">{Number(entry.date.slice(8))}</span><span><strong>{formatDay(entry.date, { month: 'long', day: 'numeric' })}{entry.date === localDate() && <i className="today-label">今天</i>}</strong><small>{formatDay(entry.date, { year: 'numeric', weekday: 'long' })}</small></span></button></td>
      <td className="weight-cell">{formatWeight(entry.weightKg, unit)}</td>
      <td><Change value={changes.get(entry.id) ?? null} unit={unit} /></td>
      <td className="note-column"><div className="table-note"><MoodIcon mood={entry.mood} /><span title={entry.note}>{entry.note || '—'}</span></div></td>
      <td><div className="row-actions"><IconButton label={`编辑 ${entry.date} 的记录`} onClick={() => onEdit(entry)}><Pencil size={15} /></IconButton>{!compact && <IconButton label={`删除 ${entry.date} 的记录`} onClick={() => onDelete(entry)}><Trash2 size={15} /></IconButton>}</div></td>
    </tr>)}</tbody>
  </table></div>;
}
