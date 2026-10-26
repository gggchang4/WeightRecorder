import { useState } from 'react';
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, Download, ListFilter, Plus, Search, X } from 'lucide-react';
import type { Snapshot, WeightEntry } from '../../shared/types.ts';
import { localDate } from '../../shared/domain.ts';
import { IconButton } from './ui.tsx';
import { RecordsTable } from './RecordsTable.tsx';

const PAGE_SIZE = 12;
export function HistoryView({ snapshot, onEdit, onDelete, onAdd, onExport }: { snapshot: Snapshot; onEdit: (entry: WeightEntry) => void; onDelete: (entry: WeightEntry) => void; onAdd: () => void; onExport: () => void }) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState(false);
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const filtered = snapshot.entries.filter(entry => (!from || entry.date >= from) && (!to || entry.date <= to) && (!search || `${entry.date} ${entry.note} ${entry.weightKg}`.toLowerCase().includes(search.toLowerCase())));
  const sorted = ascending ? filtered : [...filtered].reverse();
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const records = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  return <div className="page-enter"><section className="page-heading"><div><p className="eyebrow">EVERY ENTRY HAS A STORY</p><h1>你的每一笔，都在这里。</h1><p className="page-description">整理数字、回看随记，也可以随时把数据带走。</p></div><button className="button primary" onClick={onAdd}><Plus size={18} />添加记录</button></section><section className="card history-card"><div className="history-toolbar"><h2>全部记录 <span className="count-badge">{snapshot.entries.length}</span></h2><div className="history-tools"><label className="search-input"><Search size={16} /><input aria-label="搜索记录" placeholder="搜索日期、体重或随记" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />{search && <button aria-label="清除搜索" onClick={() => setSearch('')}><X size={13} /></button>}</label><button className={`button secondary small ${filters ? 'selected' : ''}`} aria-expanded={filters} onClick={() => setFilters(value => !value)}><ListFilter size={15} /><span>筛选</span></button><IconButton label={ascending ? '切换为最新在前' : '切换为最早在前'} onClick={() => { setAscending(value => !value); setPage(0); }}><ArrowDownWideNarrow size={17} /></IconButton><button className="button secondary small" onClick={onExport}><Download size={15} /><span>导出 CSV</span></button></div></div>
    {filters && <div className="filter-bar"><label>从 <input type="date" aria-label="起始日期" value={from} max={to || localDate()} onChange={event => { setFrom(event.target.value); setPage(0); }} /></label><span>至</span><label><span className="sr-only">结束日期</span><input type="date" aria-label="结束日期" value={to} min={from} max={localDate()} onChange={event => { setTo(event.target.value); setPage(0); }} /></label><button className="text-button" onClick={() => { setFrom(''); setTo(''); setSearch(''); setPage(0); }}>重置条件</button><span className="filter-result">找到 {filtered.length} 条记录</span></div>}
    {!records.length && snapshot.entries.length > 0 ? <div className="empty-state"><span className="empty-icon"><Search size={28} /></span><h3>没有找到匹配的记录</h3><p>试试其他关键词，或调整日期范围。</p><button className="button secondary" onClick={() => { setFrom(''); setTo(''); setSearch(''); }}>清除筛选</button></div> : <RecordsTable entries={records} allEntries={snapshot.entries} unit={snapshot.settings.unit} onEdit={onEdit} onDelete={onDelete} />}
    <div className="pagination"><span>{filtered.length ? `显示 ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} 条，共 ${filtered.length} 条` : '还没有记录'}</span><div><IconButton label="上一页" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></IconButton><span>{currentPage + 1} / {pageCount}</span><IconButton label="下一页" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></IconButton></div></div>
  </section><p className="page-footnote">所有体重以公斤精确存储，展示时按你的单位偏好换算。CSV 导出的单位始终为 kg。</p></div>;
}
