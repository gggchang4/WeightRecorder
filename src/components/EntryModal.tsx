import { useState } from 'react';
import type { FormEvent } from 'react';
import { Minus, Plus, Check, LoaderCircle, Info } from 'lucide-react';
import type { EntryInput, Mood, Unit, WeightEntry } from '../../shared/types.ts';
import { formatWeight, localDate, toDisplay, toKg } from '../../shared/domain.ts';
import { Modal, moodIcons, moodLabels } from './ui.tsx';

export function EntryModal({ entry, date: initialDate, entries, unit: preferredUnit, onSave, onClose }: {
  entry?: WeightEntry; date?: string; entries: WeightEntry[]; unit: Unit;
  onSave: (input: EntryInput, id?: string) => Promise<void>; onClose: () => void;
}) {
  const initial = entry ?? entries.find(item => item.date === (initialDate ?? localDate()));
  const [date, setDate] = useState(initial?.date ?? initialDate ?? localDate());
  const [unit, setUnit] = useState(preferredUnit);
  const [weight, setWeight] = useState(initial ? formatWeight(initial.weightKg, unit) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [mood, setMood] = useState<Mood>(initial?.mood ?? 'neutral');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = entries.find(item => item.date === date);
  const targetId = entry?.id ?? existing?.id;
  const conflict = entry && existing && entry.id !== existing.id;

  function changeDate(value: string) {
    setDate(value); setError('');
    if (entry) return;
    const found = entries.find(item => item.date === value);
    setWeight(found ? formatWeight(found.weightKg, unit) : '');
    setNote(found?.note ?? '');
    setMood(found?.mood ?? 'neutral');
  }
  function changeUnit(next: Unit) {
    if (weight && Number.isFinite(Number(weight))) setWeight(toDisplay(toKg(Number(weight), unit), next).toFixed(1));
    setUnit(next);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const weightKg = toKg(Number(weight), unit);
    if (!weight || !Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) { setError('请输入 1–500 kg 范围内的有效体重'); return; }
    setBusy(true); setError('');
    try { await onSave({ date, weightKg, note, mood }, targetId); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试'); }
    finally { setBusy(false); }
  }
  const last = entries.at(-1);
  return <Modal title={targetId ? '编辑记录' : '记录体重'} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={event => void submit(event)} className="entry-form">
      <label className="field"><span>记录日期</span><input type="date" value={date} max={localDate()} min="1900-01-01" onChange={event => changeDate(event.target.value)} required /></label>
      {existing && <p className={`inline-note ${conflict ? 'danger-text' : ''}`}><Info size={14} />{conflict ? '这一天已有另一条记录，请更换日期。' : '这一天已有记录，保存后将更新该记录。'}</p>}
      <div className="weight-input-block"><div className="weight-input-label"><span>体重</span><div className="segmented small" aria-label="录入单位">{(['kg', 'lb'] as const).map(value => <button type="button" key={value} className={unit === value ? 'active' : ''} aria-pressed={unit === value} onClick={() => changeUnit(value)}>{value}</button>)}</div></div>
        <div className="weight-stepper"><button type="button" aria-label="体重减少 0.1" onClick={() => setWeight(Math.max(unit === 'kg' ? 1 : 2.3, Number(weight || (last ? formatWeight(last.weightKg, unit) : '70')) - 0.1).toFixed(1))}><Minus size={18} /></button><div><input aria-label="体重" type="number" inputMode="decimal" step="0.1" min={unit === 'kg' ? '1' : '2.2'} max={unit === 'kg' ? '500' : '1102.3'} placeholder={last ? formatWeight(last.weightKg, unit) : '70.0'} value={weight} onChange={event => { setWeight(event.target.value); setError(''); }} data-autofocus required /><span>{unit}</span></div><button type="button" aria-label="体重增加 0.1" onClick={() => setWeight(Math.min(unit === 'kg' ? 500 : 1102.3, Number(weight || (last ? formatWeight(last.weightKg, unit) : '70')) + 0.1).toFixed(1))}><Plus size={18} /></button></div>
        <p>建议在相近的时间与条件下测量，让记录更容易比较。</p>
      </div>
      <fieldset className="mood-field"><legend>今天感觉如何 <span>可选</span></legend><div className="mood-options">{(['good', 'neutral', 'tired'] as const).map(value => { const Icon = moodIcons[value]; return <button type="button" key={value} className={mood === value ? 'selected' : ''} aria-pressed={mood === value} onClick={() => setMood(value)}><Icon size={19} /><span>{moodLabels[value]}</span></button>; })}</div></fieldset>
      <label className="field"><span>随记 <small>{note.length}/500</small></span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder="如：晨起空腹" rows={3} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button className="button primary" disabled={busy || !weight || !!conflict}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy ? '保存中…' : targetId ? '更新记录' : '保存记录'}</button></div>
    </form>
  </Modal>;
}
