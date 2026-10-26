import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleHelp, Plus } from 'lucide-react';
import type { Snapshot, Unit } from '../../shared/types.ts';
import { chartData, formatWeight, localDate, shiftDate, toDisplay } from '../../shared/domain.ts';
import { formatDay } from './ui.tsx';

type Period = 7 | 30 | 90 | 'all';

function useCanvasSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 470 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

function TrendTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown }[];
  label?: string | number;
  unit: Unit;
}) {
  if (!active || !payload?.length || typeof label !== 'string') return null;
  const weight = payload.find(item => item.dataKey === 'weight')?.value;
  const mean = payload.find(item => item.dataKey === 'average')?.value;
  return <div className="chart-tooltip"><p>{formatDay(label, { month: 'long', day: 'numeric', weekday: 'short' })}</p>{typeof weight === 'number' && <div><span className="legend-dot"/>体重<strong>{weight.toFixed(1)} <small>{unit}</small></strong></div>}{typeof mean === 'number' && <div><span className="legend-dot mean"/>7 日均值<strong>{mean.toFixed(1)} <small>{unit}</small></strong></div>}</div>;
}

function ReadingMark({ cx, cy, payload, lastDate, unit, compact, height, manyPoints }: {
  cx?: number;
  cy?: number;
  payload?: { date?: string; weight?: number | null };
  lastDate: string | undefined;
  unit: Unit;
  compact: boolean;
  height: number;
  manyPoints: boolean;
}) {
  if (cx == null || cy == null || payload?.weight == null) return <g />;
  if (payload.date !== lastDate) return <circle cx={cx} cy={cy} r={manyPoints ? 0 : 2} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.2} />;
  const value = payload.weight.toFixed(1);
  const labelSize = value.length > 5 ? 72 : value.length > 4 ? 84 : 104;
  return <g className="reading-mark" pointerEvents="none"><circle cx={cx} cy={cy} r={13} fill="var(--accent)" fillOpacity={.08}/><circle cx={cx} cy={cy} r={4.5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2}/>{!compact && <foreignObject x={cx + 35} y={Math.max(10, Math.min(cy - 78, height - 162))} width={285} height={160} overflow="visible"><div className="endpoint-reading"><div className="endpoint-number" style={{ fontSize: labelSize }}>{value}<span>{unit}</span></div><p><span>最近记录</span>{lastDate === localDate() ? '今天' : lastDate && formatDay(lastDate)}</p></div></foreignObject>}</g>;
}

export default function TrendCanvas({ snapshot, onAdd, onHistory, onInsights, onSettings }: {
  snapshot: Snapshot;
  onAdd: () => void;
  onHistory: () => void;
  onInsights: () => void;
  onSettings: () => void;
}) {
  const { entries, settings } = snapshot;
  const [period, setPeriod] = useState<Period>(30);
  const [showAverage, setShowAverage] = useState(true);
  const [showGoal, setShowGoal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const today = localDate();
  const start = period === 'all' ? entries[0]?.date ?? shiftDate(today, -29) : shiftDate(today, -(period - 1));
  const data = useMemo(() => chartData(entries, start, today).map(row => ({ ...row, weight: row.weight == null ? null : toDisplay(row.weight, settings.unit), average: row.average == null ? null : toDisplay(row.average, settings.unit) })), [entries, start, today, settings.unit]);
  const measured = data.filter(row => row.weight != null);
  const latest = measured.at(-1);
  const values = measured.flatMap(row => [row.weight!, ...(showAverage && row.average != null ? [row.average] : [])]);
  if (showGoal && settings.targetWeightKg != null) values.push(toDisplay(settings.targetWeightKg, settings.unit));
  const padding = toDisplay(.4, settings.unit);
  const min = values.length ? Math.floor((Math.min(...values) - padding) * 2) / 2 : 60;
  const max = values.length ? Math.ceil((Math.max(...values) + padding) * 2) / 2 : 80;
  const ticks = [...new Set([0, .25, .5, .75, 1].map(ratio => data[Math.round((data.length - 1) * ratio)]?.date).filter(Boolean))];
  const rangeChange = measured.length > 1 ? latest!.weight! - measured[0].weight! : null;
  const { ref, width, height } = useCanvasSize();
  const compact = width < 980;
  const rangeLabel = period === 'all' ? '全部记录' : `近 ${period} 天`;
  return <section className="trend-canvas" aria-label="体重趋势图">
    <header className="canvas-heading"><div><h1>体重</h1><p>{formatDay(start, period === 'all' ? { year: 'numeric', month: 'long', day: 'numeric' } : undefined)} — {formatDay(today)}</p></div><div className="segmented range-picker" aria-label="图表时间范围">{([7, 30, 90, 'all'] as const).map(value => <button key={value} aria-pressed={period === value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value === 'all' ? '全部' : `${value}天`}</button>)}</div></header>
    <div className="canvas-context"><div className="range-summary" aria-label="区间变化"><strong>{rangeChange == null ? '—' : `${rangeChange > 0 ? '+' : rangeChange < 0 ? '−' : ''}${Math.abs(rangeChange).toFixed(1)}`}<span>{settings.unit}</span></strong><p>{rangeLabel}的变化</p></div><div className={`compact-reading ${compact ? 'visible' : ''}`} aria-label="最近体重"><strong>{latest?.weight?.toFixed(1) ?? '—'}<span>{settings.unit}</span></strong><p>{latest ? `最近记录 ${formatDay(latest.date)}` : '暂无记录'}</p></div></div>
    <div className="trend-plot" ref={ref}>{measured.length ? <>
      <p className="sr-only" aria-live="polite">{rangeLabel}共有 {measured.length} 次实测，最近体重 {latest?.weight?.toFixed(1)} {settings.unit}。{rangeChange != null ? `区间变化 ${rangeChange.toFixed(1)} ${settings.unit}。` : ''}详细数据可在记录页面查看。</p>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1200, height: 470 }}><ComposedChart data={data} margin={{ top: 28, right: compact ? 20 : 310, left: 0, bottom: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)"/>
        <XAxis dataKey="date" ticks={ticks} tickFormatter={date => `${Number(String(date).slice(5, 7))}/${Number(String(date).slice(8))}`} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickMargin={22} minTickGap={30} height={47} padding={{ left: 7, right: 8 }}/>
        <YAxis domain={[min, max]} tickCount={4} tickFormatter={value => Number(value).toFixed(1)} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={40} tickMargin={10}/>
        <Tooltip content={<TrendTooltip unit={settings.unit}/>} cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeOpacity: .35, strokeDasharray: '3 6' }}/>
        {showGoal && settings.targetWeightKg != null && <ReferenceLine y={toDisplay(settings.targetWeightKg, settings.unit)} stroke="var(--accent)" strokeOpacity={.4} strokeDasharray="3 5" label={{ value: `目标 ${formatWeight(settings.targetWeightKg, settings.unit)}`, fill: 'var(--accent)', fontSize: 11, position: 'insideTopRight' }}/>}
        {showAverage && <Line type="monotone" dataKey="average" stroke="var(--mean-line)" strokeWidth={1.2} strokeDasharray="4 6" dot={false} activeDot={false} connectNulls={false} isAnimationActive={false}/>}<Area type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2.4} fill="none" connectNulls={false} isAnimationActive={false} activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }} dot={<ReadingMark lastDate={latest?.date} unit={settings.unit} compact={compact} height={height} manyPoints={measured.length > 100}/>}/>
      </ComposedChart></ResponsiveContainer>
    </> : <div className="canvas-empty"><h2>{entries.length ? '这段时间没有记录' : '记录第一笔体重'}</h2><p>{entries.length ? '可以查看全部时间范围，或记录今天的体重。' : '保存一次测量，开始查看你的体重变化。'}</p><button className="button primary" onClick={entries.length ? () => setPeriod('all') : onAdd}>{entries.length ? '查看全部时间' : <><Plus size={16}/>记录体重</>}</button></div>}</div>
    <footer className="canvas-footer"><div className="canvas-legend"><span><i className="legend-dot"/>实测体重</span><button aria-pressed={showAverage} className={!showAverage ? 'inactive' : ''} onClick={() => setShowAverage(value => !value)}><i className="legend-dash"/>7日均值</button>{settings.targetWeightKg != null && <button aria-pressed={showGoal} className={`goal-toggle ${showGoal ? 'selected' : ''}`} onClick={() => setShowGoal(value => !value)}>目标线</button>}<button className="chart-help-toggle" aria-label="图表说明" aria-expanded={showInfo} onClick={() => setShowInfo(value => !value)}><CircleHelp size={14}/></button></div><button className="entry-count" onClick={onHistory}>{entries.length} 次记录</button><div className="canvas-links"><button onClick={onInsights}>记录概况</button><button onClick={onSettings}>调整目标</button></div>{showInfo && <aside className="chart-help" role="note"><strong>关于这条曲线</strong><p>圆点代表实测记录，缺失日期保留断点。虚线是当天及之前 6 个自然日内实测值的平均数。</p><p>图表纵轴会随范围调整，请结合刻度观察。可以在图上移动鼠标，或用方向键查看每次测量。</p></aside>}</footer>
  </section>;
}
