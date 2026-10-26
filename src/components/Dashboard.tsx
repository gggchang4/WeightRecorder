import { lazy, Suspense } from 'react';
import { Activity, ArrowDownUp, ArrowRight, ArrowUpRight, CalendarCheck2, ChevronRight, Flag, Flame, Leaf, Plus, Scale, Sparkles, Target } from 'lucide-react';
import type { Snapshot, WeightEntry } from '../../shared/types.ts';
import { formatWeight, localDate, shiftDate, summarize, toDisplay } from '../../shared/domain.ts';
import { Change, formatDay } from './ui.tsx';
import { RecordsTable } from './RecordsTable.tsx';

const WeightChart = lazy(() => import('./WeightChart.tsx'));

function Sparkline({ values }: { values: number[] }) {
  const width = 88; const height = 29;
  if (values.length < 2) return <svg width={width} height={height} className="sparkline" aria-hidden="true"><path d="M2 23H86" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 4" /></svg>;
  const min = Math.min(...values) - .15; const max = Math.max(...values) + .15;
  const points = values.map((value, index) => `${index / (values.length - 1) * (width - 4) + 2},${height - 3 - (value - min) / (max - min) * (height - 5)}`).join(' ');
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function GoalCard({ snapshot, onSettings }: { snapshot: Snapshot; onSettings: () => void }) {
  const { entries, settings } = snapshot;
  const stats = summarize(entries, settings, localDate());
  const target = settings.targetWeightKg;
  const progress = Math.round(stats.progress);
  const circumference = 2 * Math.PI * 68;
  return <section className="card goal-card"><div className="card-heading"><h2><span className="heading-icon mint"><Target size={17} /></span>我的目标</h2><button className="text-button muted" onClick={onSettings}>编辑 <ChevronRight size={13} /></button></div>
    <div className="goal-ring"><svg width="174" height="174" viewBox="0 0 174 174" aria-hidden="true"><defs><linearGradient id="goal-gradient"><stop stopColor="#7bc7ad" /><stop offset="1" stopColor="#409e84" /></linearGradient></defs><circle cx="87" cy="87" r="68" fill="none" stroke="var(--ring-track)" strokeWidth="10" /><circle cx="87" cy="87" r="68" fill="none" stroke="url(#goal-gradient)" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} transform="rotate(-90 87 87)" /></svg><div><Flag size={18} /><strong>{target == null ? '—' : progress}<span>{target != null ? '%' : ''}</span></strong><small>{target == null ? '等待一个小目标' : '已走过的进度'}</small></div></div>
    <div className="goal-endpoints"><div><span>起点体重</span><strong>{formatWeight(stats.first?.weightKg, settings.unit)} <small>{settings.unit}</small></strong></div><span className="goal-path">······<ArrowRight size={14} />······</span><div><span>目标体重</span><strong>{formatWeight(target, settings.unit)} <small>{settings.unit}</small></strong></div></div>
    <div className="goal-bottom">{target == null ? <button className="text-button" onClick={onSettings}><Plus size={14} />设定我的目标</button> : stats.distance != null ? <p>{progress >= 100 ? '你已走到设定的目标，记录仍可继续。' : <>距离目标还有 <strong>{formatWeight(stats.distance, settings.unit)} {settings.unit}</strong></>}</p> : <p>留下一次记录，让目标开始有迹可循。</p>}</div>
  </section>;
}

function ConsistencyCard({ entries, onDate }: { entries: WeightEntry[]; onDate: (date: string) => void }) {
  const today = localDate();
  const startDate = shiftDate(today, -84);
  const weekday = (new Date(`${startDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = shiftDate(startDate, -weekday);
  const dates = Array.from({ length: 91 }, (_, index) => shiftDate(start, index));
  const byDate = new Map(entries.map(entry => [entry.date, entry]));
  const count = dates.filter(date => byDate.has(date)).length;
  return <section className="card consistency-card"><div className="card-heading"><div><h2><span className="heading-icon peach"><CalendarCheck2 size={17} /></span>把记录，变成日常</h2><p>最近 13 周，你留下了 <strong>{count}</strong> 个小脚印</p></div></div><div className="heatmap-wrap"><div className="heatmap-weekdays"><span>一</span><span>三</span><span>日</span></div><div className="heatmap">{dates.map(date => <button key={date} disabled={date > today} aria-label={`${date}${byDate.has(date) ? ' 已记录，查看' : ' 未记录，补记'}`} title={`${date} · ${byDate.has(date) ? '已记录' : '未记录'}`} className={`heatmap-cell ${byDate.has(date) ? 'recorded' : ''} ${date === today ? 'today' : ''} ${date > today ? 'future' : ''}`} onClick={() => onDate(date)} />)}</div></div><div className="heatmap-legend"><span>每一次出现，都有意义。</span><span><i />未记录 <i className="recorded" />已记录</span></div><div className="soft-insight"><Leaf size={18} /><p>关注长期的变化，也允许日常的起伏。<br /><span>给身体一点时间，给自己一点耐心。</span></p></div></section>;
}

export function Dashboard({ snapshot, onAdd, onEdit, onDelete, onHistory, onSettings, onDate }: { snapshot: Snapshot; onAdd: () => void; onEdit: (entry: WeightEntry) => void; onDelete: (entry: WeightEntry) => void; onHistory: () => void; onSettings: () => void; onDate: (date: string) => void }) {
  const { entries, settings } = snapshot;
  const stats = summarize(entries, settings, localDate());
  const unit = settings.unit;
  const latest = stats.latest;
  const values = entries.slice(-18).map(entry => toDisplay(entry.weightKg, unit));
  const weekly = stats.weeklyChange;
  return <div className="dashboard page-enter">
    <section className="page-heading"><div><p className="eyebrow">A LITTLE LIGHTER, A LITTLE CLOSER</p><h1>看见变化，慢慢来。</h1><p className="page-description">每一次认真记录，都是在好好关照自己。</p></div><button className="button primary add-record-button" onClick={onAdd}><Plus size={18} />记录体重<span className="keycap">N</span></button></section>
    <div className="overview-label"><h2>身体的小小近况</h2><span><i />{formatDay(localDate(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span></div>
    <section className="stats-grid" aria-label="体重统计">
      <article className="stat-card"><div className="stat-heading"><span className="stat-icon blue"><Scale size={18} /></span><span>最近体重</span><span className="stat-meta">{latest ? formatDay(latest.date) : '等待记录'}</span></div><div className="stat-number">{formatWeight(latest?.weightKg, unit)}<span>{unit}</span><Sparkline values={values} /></div><div className="stat-foot"><Change value={stats.recentChange} unit={unit} color /><span>{stats.previous ? '较上次记录' : '从今天开始'}</span></div></article>
      <article className="stat-card"><div className="stat-heading"><span className="stat-icon violet"><Activity size={18} /></span><span>近 7 日均值</span><span className="stat-meta">平稳看趋势</span></div><div className="stat-number">{formatWeight(stats.latestAvg, unit)}<span>{unit}</span></div><div className="stat-foot"><Change value={weekly} unit={unit} /><span>{weekly == null ? `${stats.last7.length} 次实测` : '较前 7 日均值'}</span></div></article>
      <article className="stat-card"><div className="stat-heading"><span className="stat-icon mint"><ArrowDownUp size={18} /></span><span>累计变化</span></div><div className="stat-number">{stats.totalChange != null ? `${stats.totalChange > 0 ? '+' : stats.totalChange < 0 ? '−' : ''}${formatWeight(Math.abs(stats.totalChange), unit)}` : '—'}<span>{unit}</span></div><div className="stat-foot"><span className="small-dot mint-dot" /><span>{stats.first ? `从 ${formatDay(stats.first.date)} 的第一笔开始` : '每条轨迹，都有一个起点'}</span></div></article>
      <article className="stat-card"><div className="stat-heading"><span className="stat-icon peach"><Flame size={18} /></span><span>连续记录</span><span className="stat-meta">小小的坚持</span></div><div className="stat-number">{stats.streak}<span>天</span><div className="streak-bars" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} className={stats.streak > 6 - i ? 'filled' : ''} style={{ height: 9 + i * 3 }} />)}</div></div><div className="stat-foot"><span className="small-dot peach-dot" /><span>最近 30 天已记录 {stats.coverage} 天</span></div></article>
    </section>
    <div className="dashboard-main-grid"><Suspense fallback={<section className="card chart-card chart-loading"><div className="skeleton" /></section>}><WeightChart entries={entries} settings={settings} onAdd={onAdd} /></Suspense><GoalCard snapshot={snapshot} onSettings={onSettings} /></div>
    <div className="dashboard-bottom-grid"><section className="card recent-card"><div className="card-heading"><div><h2>最近记录 <span className="count-badge">{entries.length}</span></h2><p>留住数字，也留住生活里的细节。</p></div><button className="text-button" onClick={onHistory}>查看全部 <ArrowUpRight size={15} /></button></div><RecordsTable entries={entries.slice(-4).reverse()} allEntries={entries} unit={unit} onEdit={onEdit} onDelete={onDelete} compact /></section><ConsistencyCard entries={entries} onDate={onDate} /></div>
    <div className="dashboard-note"><Sparkles size={13} /><span>变化不必每天发生，记录可以。所有数据只留在你的电脑里。</span></div>
  </div>;
}
