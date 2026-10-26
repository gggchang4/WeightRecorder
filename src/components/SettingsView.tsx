import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Check, Code2, Database, Download, HardDrive, Laptop, LoaderCircle, Moon, ShieldCheck, Sun, Target, Upload, UserRound } from 'lucide-react';
import type { Settings, Theme, Unit } from '../../shared/types.ts';
import { formatWeight, toDisplay, toKg } from '../../shared/domain.ts';

export function SettingsView({ settings, demo, onSave, onExport, onImport }: { settings: Settings; demo: boolean; onSave: (settings: Settings) => Promise<void>; onExport: (format: 'json' | 'csv') => void; onImport: () => void }) {
  const [name, setName] = useState(settings.displayName);
  const [height, setHeight] = useState(settings.heightCm?.toString() ?? '');
  const [target, setTarget] = useState(settings.targetWeightKg == null ? '' : formatWeight(settings.targetWeightKg, settings.unit));
  const [targetKg, setTargetKg] = useState(settings.targetWeightKg);
  const [unit, setUnit] = useState<Unit>(settings.unit);
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function changeUnit(value: Unit) {
    if (targetKg != null && Number.isFinite(targetKg)) setTarget(toDisplay(targetKg, value).toFixed(1));
    setUnit(value);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await onSave({ displayName: name.trim(), heightCm: height ? Number(height) : null, targetWeightKg: targetKg, unit, theme });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }
  return <div className="page-enter"><section className="page-heading"><div><p className="eyebrow">MAKE THIS SPACE YOURS</p><h1>按自己的节奏，轻一点。</h1><p className="page-description">关于目标、习惯，以及只属于你的数据。</p></div><span className="privacy-pill"><ShieldCheck size={15} />你的数据，由你掌握</span></section>
    <div className="settings-layout"><form className="settings-form" onSubmit={event => void save(event)}><section className="card settings-section"><div className="settings-section-title"><span className="heading-icon blue"><UserRound size={19} /></span><div><h2>个人偏好</h2><p>让这个小空间，更像你。</p></div></div><div className="settings-fields"><label className="field"><span>你的称呼</span><input value={name} onChange={event => setName(event.target.value)} maxLength={30} placeholder="怎么称呼你？" required /></label><label className="field"><span>身高 <small>选填</small></span><div className="input-with-suffix"><input aria-label="身高" type="number" min="50" max="260" step="0.1" value={height} onChange={event => setHeight(event.target.value)} placeholder="例如 175" /><span>cm</span></div></label></div><div className="settings-row"><div><h3>体重单位</h3><p>切换单位会换算显示，原始数据保持精度。</p></div><div className="segmented">{(['kg', 'lb'] as const).map(value => <button type="button" key={value} aria-pressed={unit === value} className={unit === value ? 'active' : ''} onClick={() => changeUnit(value)}>{value === 'kg' ? '公斤 kg' : '磅 lb'}</button>)}</div></div></section>
    <section className="card settings-section"><div className="settings-section-title"><span className="heading-icon mint"><Target size={19} /></span><div><h2>一个属于你的目标</h2><p>方向由你决定，也可以随时调整。</p></div></div><label className="field target-field"><span>目标体重 <small>选填，留空则不设置目标</small></span><div className="input-with-suffix"><input aria-label="目标体重" type="number" min={unit === 'kg' ? 1 : 2.2} max={unit === 'kg' ? 500 : 1102.3} step="0.1" value={target} onChange={event => { setTarget(event.target.value); setTargetKg(event.target.value ? toKg(Number(event.target.value), unit) : null); }} placeholder={unit === 'kg' ? '例如 70.0' : '例如 154.3'} /><span>{unit}</span></div></label><p className="settings-tip">进度从第一条记录计算，支持增重或减重目标。这里只呈现你的记录，不自动推荐目标。</p></section>
    <section className="card settings-section"><div className="settings-section-title"><span className="heading-icon violet"><Sun size={19} /></span><div><h2>喜欢的外观</h2><p>明亮的白天，或安静的夜晚。</p></div></div><div className="theme-options">{([{ value: 'light', name: '浅色', Icon: Sun }, { value: 'dark', name: '深色', Icon: Moon }, { value: 'system', name: '跟随系统', Icon: Laptop }] as const).map(({ value, name: label, Icon }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)} className={`theme-option ${theme === value ? 'selected' : ''}`}><div className={`theme-preview ${value}`}><i /><span><b /><b /><b /></span></div><span><Icon size={14} />{label}{theme === value && <Check size={14} />}</span></button>)}</div></section>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="settings-save"><span>{demo ? '示例模式下的调整仅在本次体验生效' : '偏好与记录一起，安全保存在本机'}</span><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy ? '正在保存…' : '保存设置'}</button></div></form>
    <aside className="settings-aside"><section className="card data-card"><span className="large-feature-icon"><HardDrive size={25} /></span><h2>数据，始终属于你。</h2><p>记录保存在这台电脑的 SQLite 数据库中，关闭浏览器也不会丢失。无需账号，无需联网。</p><div className="data-location"><span className="status-dot" /><span>本地存储 · {demo ? '示例空间' : '个人空间'}</span><ShieldCheck size={15} /></div><h3>导出与备份</h3><button className="data-action" onClick={() => onExport('json')}><span className="heading-icon blue"><Database size={17} /></span><span><strong>完整备份</strong><small>JSON · 包含记录和个人设置</small></span><Download size={17} /></button><button className="data-action" onClick={() => onExport('csv')}><span className="heading-icon mint"><Download size={17} /></span><span><strong>导出表格</strong><small>CSV · 可用 Excel / Numbers 打开</small></span><Download size={17} /></button><h3>恢复与迁移</h3><button className="data-action" onClick={onImport}><span className="heading-icon violet"><Upload size={17} /></span><span><strong>导入记录</strong><small>支持轻迹 JSON 或标准 CSV</small></span><ArrowUpRight size={17} /></button><p className="data-import-note">导入前会预览记录数量；相同日期保留本地记录。建议定期把备份保存在其他位置。</p></section>
    <details className="card integration-card"><summary><Code2 size={18} /><span>扩展与开放接口</span><span className="count-badge">v1</span></summary><p>本地 API 已为未来的 iOS 客户端和 Agent 预留。当前未接入大模型或云端服务。</p><a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">查看 OpenAPI 接口定义 <ArrowUpRight size={13} /></a><a href="/api/v1/agent/context" target="_blank" rel="noreferrer">查看只读 Agent 数据上下文 <ArrowUpRight size={13} /></a><code>/api/v1/entries</code><code>/api/v1/summary</code></details></aside></div>
  </div>;
}
