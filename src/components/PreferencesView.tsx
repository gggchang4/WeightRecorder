import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Check, Download, Laptop, LoaderCircle, Moon, Sun, Upload } from 'lucide-react';
import type { Settings, Theme, Unit } from '../../shared/types.ts';
import { formatWeight, toDisplay, toKg } from '../../shared/domain.ts';

type Section = 'personal' | 'appearance' | 'data' | 'integrations';
const sections = [
  { id: 'personal', label: '个人' },
  { id: 'appearance', label: '外观' },
  { id: 'data', label: '数据' },
  { id: 'integrations', label: '接口' },
] as const;

export function PreferencesView({ settings, demo, onSave, onExport, onImport, onAbout }: {
  settings: Settings;
  demo: boolean;
  onSave: (settings: Settings) => Promise<void>;
  onExport: (format: 'json' | 'csv') => void;
  onImport: () => void;
  onAbout: () => void;
}) {
  const [section, setSection] = useState<Section>('personal');
  const [name, setName] = useState(settings.displayName);
  const [height, setHeight] = useState(settings.heightCm?.toString() ?? '');
  const [target, setTarget] = useState(settings.targetWeightKg == null ? '' : formatWeight(settings.targetWeightKg, settings.unit));
  const [targetKg, setTargetKg] = useState(settings.targetWeightKg);
  const [unit, setUnit] = useState<Unit>(settings.unit);
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(settings.displayName);
    setHeight(settings.heightCm?.toString() ?? '');
    setTarget(settings.targetWeightKg == null ? '' : formatWeight(settings.targetWeightKg, settings.unit));
    setTargetKg(settings.targetWeightKg);
    setUnit(settings.unit);
  }, [settings.displayName, settings.heightCm, settings.targetWeightKg, settings.unit]);
  useEffect(() => { setTheme(settings.theme); }, [settings.theme]);

  function changeUnit(value: Unit) {
    if (targetKg != null && Number.isFinite(targetKg)) setTarget(toDisplay(targetKg, value).toFixed(1));
    setUnit(value);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await onSave(section === 'appearance' ? { ...settings, theme } : {
        displayName: name.trim(), heightCm: height ? Number(height) : null,
        targetWeightKg: targetKg, unit, theme: settings.theme,
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }

  return <div className="secondary-page preferences-page">
    <header className="page-heading"><div><h1>偏好</h1><p>个人设置与数据</p></div></header>
    <div className="preferences-layout">
      <div className="preference-nav" role="tablist" aria-label="偏好分区" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = sections.findIndex(item => item.id === section);
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + sections.length) % sections.length;
        const next = sections[nextIndex].id;
        setSection(next); setError('');
        document.getElementById(`tab-${next}`)?.focus();
      }}>{sections.map(item => <button key={item.id} id={`tab-${item.id}`} role="tab" tabIndex={section === item.id ? 0 : -1} aria-selected={section === item.id} aria-controls={`panel-${item.id}`} className={section === item.id ? 'selected' : ''} onClick={() => { setSection(item.id); setError(''); }}>{item.label}</button>)}</div>
      <section className="preference-panel" role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>
        {(section === 'personal' || section === 'appearance') && <form onSubmit={event => void save(event)}>
          {section === 'personal' ? <>
            <div className="preference-title"><h2>个人</h2><p>调整单位和你自己的目标。</p></div>
            <div className="preferences-fields"><label className="field"><span>称呼</span><input value={name} onChange={event => setName(event.target.value)} maxLength={30} required/></label><label className="field"><span>身高 <small>选填</small></span><div className="input-with-suffix"><input aria-label="身高" type="number" min="50" max="260" step="0.1" value={height} onChange={event => setHeight(event.target.value)} placeholder="175"/><span>cm</span></div></label></div>
            <div className="preference-row"><div><h3>显示单位</h3><p>切换显示单位不会改变实测记录。</p></div><div className="segmented">{(['kg', 'lb'] as const).map(value => <button type="button" key={value} aria-pressed={unit === value} className={unit === value ? 'active' : ''} onClick={() => changeUnit(value)}>{value === 'kg' ? '公斤 kg' : '磅 lb'}</button>)}</div></div>
            <div className="preference-row goal-preference"><div><h3>目标体重</h3><p>留空则不设定目标，可随时调整。</p></div><label className="field"><span className="sr-only">目标体重</span><div className="input-with-suffix"><input aria-label="目标体重" type="number" step="0.1" min={unit === 'kg' ? 1 : 2.2} max={unit === 'kg' ? 500 : 1102.3} value={target} onChange={event => { setTarget(event.target.value); setTargetKg(event.target.value ? toKg(Number(event.target.value), unit) : null); }} placeholder="未设置"/><span>{unit}</span></div></label></div>
          </> : <>
            <div className="preference-title"><h2>外观</h2><p>选择浅色、深色，或跟随设备。</p></div>
            <div className="theme-options">{([{ value: 'light', label: '浅色', Icon: Sun }, { value: 'dark', label: '深色', Icon: Moon }, { value: 'system', label: '跟随系统', Icon: Laptop }] as const).map(({ value, label, Icon }) => <button type="button" key={value} className={`theme-option ${theme === value ? 'selected' : ''}`} aria-pressed={theme === value} onClick={() => setTheme(value)}><div className={`theme-preview ${value}`}><i/><svg viewBox="0 0 140 64" aria-hidden="true"><path d="M8 20C24 20 22 43 40 35S68 42 81 41 105 49 132 48" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div><span><Icon size={14}/>{label}{theme === value && <Check size={13}/>}</span></button>)}</div>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="preference-save"><span>{demo ? '示例空间的设置不会写入个人数据库' : '保存在这台设备上'}</span><button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : null}{busy ? '保存中…' : '保存设置'}</button></div>
        </form>}
        {section === 'data' && <>
          <div className="preference-title"><h2>数据</h2><p>{demo ? '当前为示例空间，刷新会重置示例数据。' : '记录保存在这台电脑，无需账号。'}</p></div>
          <div className="data-file"><span className="local-dot"/><span>本地数据库</span><code>data/weight-recorder.sqlite</code></div>
          <div className="data-actions"><button className="data-action" onClick={() => onExport('json')}><span><strong>导出完整备份</strong><small>JSON，包含记录和个人设置</small></span><Download size={18}/></button><button className="data-action" onClick={() => onExport('csv')}><span><strong>导出体重表格</strong><small>CSV，可用 Excel 或 Numbers 打开</small></span><Download size={18}/></button><button className="data-action" onClick={onImport}><span><strong>导入记录</strong><small>{demo ? '请先切换到个人空间' : '轻迹 JSON 备份或标准 CSV'}</small></span><Upload size={18}/></button></div>
          <p className="preference-note">导入前会展示新增和重复数量。同一天的记录保留本地版本。建议定期导出备份。</p><button className="text-button about-link" onClick={onAbout}>关于轻迹</button>
        </>}
        {section === 'integrations' && <>
          <div className="preference-title"><h2>接口</h2><p>为后续 iOS 客户端和 Agent 保留的本地接口。</p></div>
          <div className="api-links"><a href="/api/v1/openapi.json" target="_blank" rel="noreferrer"><span>OpenAPI 3.1 定义</span><ArrowUpRight size={16}/></a><a href="/api/v1/agent/context" target="_blank" rel="noreferrer"><span>Agent 只读上下文</span><ArrowUpRight size={16}/></a></div><code className="api-address">/api/v1/entries</code><code className="api-address">/api/v1/summary</code><p className="preference-note">当前未接入云端服务或大模型。接口仅供本机访问。</p>
        </>}
      </section>
    </div>
  </div>;
}
