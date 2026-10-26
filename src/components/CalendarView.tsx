import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import type { Snapshot, WeightEntry } from '../../shared/types.ts';
import { formatWeight, localDate, shiftDate } from '../../shared/domain.ts';
import { formatDay, IconButton, MoodIcon, moodLabels } from './ui.tsx';

function moveMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function CalendarView({ snapshot, onDate, onEdit, onDelete }: { snapshot: Snapshot; onDate: (date: string) => void; onEdit: (entry: WeightEntry) => void; onDelete: (entry: WeightEntry) => void }) {
  const today = localDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const lastDay = shiftDate(`${moveMonth(month, 1)}-01`, -1);
  const cellCount = Math.ceil((offset + Number(lastDay.slice(8))) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, i) => shiftDate(first, i - offset));
  const byDate = new Map(snapshot.entries.map(entry => [entry.date, entry]));
  const selectedEntry = byDate.get(selected);
  const monthCount = snapshot.entries.filter(entry => entry.date.startsWith(month)).length;
  function navigate(amount: number) { const next = moveMonth(month, amount); setMonth(next); setSelected(`${next}-01` > today ? today : `${next}-01`); }
  return <div className="secondary-page"><section className="page-heading"><div><h1>日历</h1><p>按日期查看与补记</p></div><button className="button secondary" onClick={() => onDate(today)}><Plus size={16} />记录今天</button></section>
    <div className="calendar-layout"><section className="card calendar-card"><div className="card-heading"><div><h2>{Number(month.slice(0, 4))} 年 {Number(month.slice(5))} 月</h2><p>这个月，留下了 {monthCount} 次记录</p></div><div className="calendar-controls"><button className="button secondary small" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>今天</button><IconButton label="上个月" disabled={month <= '1900-01'} onClick={() => navigate(-1)}><ChevronLeft size={18} /></IconButton><IconButton label="下个月" disabled={month >= today.slice(0, 7)} onClick={() => navigate(1)}><ChevronRight size={18} /></IconButton></div></div>
      <div className="calendar-weekdays">{['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map(date => { const entry = byDate.get(date); return <button key={date} aria-label={`${date}${entry ? `，${formatWeight(entry.weightKg, snapshot.settings.unit)} ${snapshot.settings.unit}` : '，未记录'}`} aria-pressed={selected === date} disabled={date > today || date < '1900-01-01'} onClick={() => setSelected(date)} className={`calendar-day ${date.slice(0, 7) !== month ? 'outside' : ''} ${selected === date ? 'selected' : ''} ${date === today ? 'today' : ''} ${entry ? 'has-record' : ''}`}><span>{Number(date.slice(8))}{date === today && <small>今天</small>}</span>{entry ? <><strong>{formatWeight(entry.weightKg, snapshot.settings.unit)}</strong><i /></> : <small className="calendar-empty-mark">—</small>}</button>; })}</div>
      <div className="calendar-foot"><span><i className="legend-dot blue" />已记录</span><span>点击日期，在右侧查看或添加记录</span></div>
    </section><aside className="card day-detail"><div className="day-detail-date"><CalendarDays size={20} /><span>{formatDay(selected, { year: 'numeric', month: 'long', day: 'numeric' })}</span><small>{formatDay(selected, { weekday: 'long' })}</small></div>{selectedEntry ? <><div className="day-weight">{formatWeight(selectedEntry.weightKg, snapshot.settings.unit)}<span>{snapshot.settings.unit}</span></div><div className="day-mood"><MoodIcon mood={selectedEntry.mood} size={19} />{moodLabels[selectedEntry.mood]}</div><div className="day-note"><h3>随记</h3><p>{selectedEntry.note || '没有随记'}</p></div><div className="day-detail-actions"><button className="button primary" onClick={() => onEdit(selectedEntry)}><Pencil size={16} />编辑记录</button><IconButton label="删除这一天的记录" onClick={() => onDelete(selectedEntry)}><Trash2 size={17} /></IconButton></div></> : <div className="day-empty"><Scale size={30} /><h3>这天没有记录</h3><p>选择补记，添加这一天的体重。</p><button className="button primary" onClick={() => onDate(selected)}><Plus size={17} />{selected === today ? '记录今天' : '补记这一天'}</button></div>}</aside></div>
  </div>;
}
