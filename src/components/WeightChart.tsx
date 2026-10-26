import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined, CircleHelp } from 'lucide-react';
import type { Settings, WeightEntry } from '../../shared/types.ts';
import { chartData, formatWeight, localDate, shiftDate, toDisplay } from '../../shared/domain.ts';
import { EmptyState, formatDay } from './ui.tsx';

type Period = 7 | 30 | 90 | 'all';

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: readonly { dataKey?: unknown; value?: unknown }[]; label?: string | number; unit: Settings['unit'] }) {
  if (!active || !payload?.length || typeof label !== 'string') return null;
  const weight = payload.find(item => item.dataKey === 'weight')?.value;
  const avg = payload.find(item => item.dataKey === 'average')?.value;
  return <div className="chart-tooltip"><p>{formatDay(label, { month: 'long', day: 'numeric', weekday: 'short' })}</p>{typeof weight === 'number' && <div><i className="legend-dot blue" />实测体重<strong>{weight.toFixed(1)} <small>{unit}</small></strong></div>}{typeof avg === 'number' && <div><i className="legend-dot green" />7 日均值<strong>{avg.toFixed(1)} <small>{unit}</small></strong></div>}</div>;
}

export default function WeightChart({ entries, settings, onAdd }: { entries: WeightEntry[]; settings: Settings; onAdd: () => void }) {
  const [period, setPeriod] = useState<Period>(30);
  const [showAverage, setShowAverage] = useState(true);
  const [showGoal, setShowGoal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const today = localDate();
  const start = period === 'all' ? entries[0]?.date ?? shiftDate(today, -29) : shiftDate(today, -(period - 1));
  const data = useMemo(() => chartData(entries, start, today).map(row => ({ ...row, weight: row.weight == null ? null : toDisplay(row.weight, settings.unit), average: row.average == null ? null : toDisplay(row.average, settings.unit) })), [entries, start, today, settings.unit]);
  const measured = data.filter(row => row.weight != null);
  const values = measured.flatMap(row => [row.weight!, ...(showAverage && row.average != null ? [row.average] : [])]);
  if (showGoal && settings.targetWeightKg != null) values.push(toDisplay(settings.targetWeightKg, settings.unit));
  const min = values.length ? Math.floor((Math.min(...values) - 0.5) * 2) / 2 : 60;
  const max = values.length ? Math.ceil((Math.max(...values) + 0.5) * 2) / 2 : 80;
  const ticks = [...new Set([0, .25, .5, .75, 1].map(ratio => data[Math.round((data.length - 1) * ratio)]?.date).filter(Boolean))];
  const rangeChange = measured.length > 1 ? measured.at(-1)!.weight! - measured[0].weight! : null;
  return <section className="card chart-card" aria-label="体重趋势图">
    <div className="card-heading chart-heading"><div><h2>体重趋势 <span className="tiny-unit">{settings.unit}</span></h2><p>{formatDay(start)} — {formatDay(today)}</p></div><div className="segmented period-selector" aria-label="图表时间范围">{([7, 30, 90, 'all'] as const).map(value => <button key={value} className={period === value ? 'active' : ''} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'all' ? '全部' : `${value} 天`}</button>)}</div></div>
    {measured.length ? <>
      <div className="chart-summary"><span><strong>{formatWeight(entries.at(-1)?.weightKg, settings.unit)}</strong> {settings.unit}</span><div>{rangeChange != null && <span className="period-change">{rangeChange > 0 ? '+' : rangeChange < 0 ? '−' : ''}{Math.abs(rangeChange).toFixed(1)} {settings.unit}<small>区间变化</small></span>}</div></div>
      <div className="chart-wrap" role="img" aria-label={`从 ${start} 至 ${today}，${measured.length} 次实测记录。详细数据可在全部记录中查看。`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 760, height: 250 }}>
          <ComposedChart data={data} margin={{ top: 18, right: 12, left: -18, bottom: 0 }} accessibilityLayer>
            <defs><linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b88e6" stopOpacity={0.16} /><stop offset="95%" stopColor="#3b88e6" stopOpacity={0.005} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
            <XAxis dataKey="date" ticks={ticks} tickFormatter={date => `${Number(String(date).slice(5, 7))}/${Number(String(date).slice(8))}`} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickMargin={13} minTickGap={20} />
            <YAxis domain={[min, max]} tickCount={5} tickFormatter={value => Number(value).toFixed(1)} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={59} />
            <Tooltip content={<ChartTooltip unit={settings.unit} />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 4', strokeOpacity: .5 }} />
            {showGoal && settings.targetWeightKg != null && <ReferenceLine y={toDisplay(settings.targetWeightKg, settings.unit)} stroke="#5eaa8d" strokeDasharray="5 5" label={{ value: `目标 ${formatWeight(settings.targetWeightKg, settings.unit)}`, fill: '#5eaa8d', fontSize: 10, position: 'insideTopRight' }} />}
            <Area type="monotone" dataKey="weight" stroke="#3b88e6" strokeWidth={2.5} fill="url(#weight-fill)" connectNulls={false} isAnimationActive={false} dot={{ r: measured.length > 100 ? 0 : 2.5, fill: '#3b88e6', stroke: 'var(--card)', strokeWidth: 1.5 }} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 3 }} />
            {showAverage && <Line type="monotone" dataKey="average" stroke="#69ab98" strokeWidth={1.8} dot={false} strokeDasharray="5 5" connectNulls={false} isAnimationActive={false} activeDot={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend"><span><i className="legend-dot blue" />实测体重</span><button className={!showAverage ? 'inactive' : ''} aria-pressed={showAverage} onClick={() => setShowAverage(value => !value)}><i className="legend-line" />7 日移动均值</button><div className="legend-spacer" /><button aria-expanded={showInfo} onClick={() => setShowInfo(value => !value)} title="查看图表与均值的计算说明" className="subtle-help"><CircleHelp size={13} /><span>关于趋势</span></button>{settings.targetWeightKg != null && <label className="mini-switch"><input type="checkbox" checked={showGoal} onChange={event => setShowGoal(event.target.checked)} /><span />目标线</label>}</div>
      {showInfo && <p className="chart-info">蓝点为当天实测体重；缺失日不补值，曲线会保留空白。虚线使用当天及之前 6 个自然日内的实测记录求平均，只用于辅助观察趋势。</p>}
    </> : <EmptyState icon={<ChartNoAxesCombined size={30} />} title={entries.length ? '这段时间，留白也没关系' : '第一笔记录，是变化的起点'} description={entries.length ? '换一个时间范围，或记录一下今天的体重。' : '记下今天的体重，趋势会在一次次记录中慢慢出现。'} action={<button className="button primary" onClick={onAdd}>记录一次体重</button>} />}
  </section>;
}
