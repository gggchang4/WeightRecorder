import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Database, LoaderCircle, Moon, Plus, ShieldCheck, Sun, Upload, X } from 'lucide-react';
import type { Backup, EntryInput, Settings, Snapshot, WeightEntry, WeightRepository } from '../shared/types.ts';
import { formatWeight, localDate } from '../shared/domain.ts';
import { csvToEntries, entriesToCsv } from '../shared/csv.ts';
import { DemoRepository, downloadText, localRepository } from './repository.ts';
import { TrendView } from './components/TrendView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { PreferencesView } from './components/PreferencesView.tsx';
import { InsightsView } from './components/InsightsView.tsx';
import { EntryModal } from './components/EntryModal.tsx';
import { formatDay, IconButton, Modal } from './components/ui.tsx';

type View = 'dashboard' | 'calendar' | 'history' | 'insights' | 'settings';
type EntryEditor = { entry?: WeightEntry; date?: string } | null;
const navItems = [
  { key: 'dashboard', label: '趋势' },
  { key: 'calendar', label: '日历' },
  { key: 'history', label: '记录' },
  { key: 'settings', label: '偏好' },
] as const;
const titles: Record<View, string> = { dashboard: '体重趋势', calendar: '记录日历', history: '全部记录', insights: '记录概况', settings: '偏好' };
const routes: Record<View, string> = { dashboard: '/', calendar: '/calendar', history: '/entries', insights: '/insights', settings: '/settings' };
function currentView(): View {
  const hash = window.location.hash.slice(1);
  if (['calendar', 'history', 'insights', 'settings'].includes(hash)) return hash as View;
  return (Object.entries(routes).find(([, path]) => path === window.location.pathname.replace(/\/$/, '') || path === window.location.pathname)?.[0] as View) ?? 'dashboard';
}
function safeRead(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function safeWrite(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* optional preference cache */ } }

export default function App() {
  const [view, setView] = useState<View>(currentView);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EntryEditor>(null);
  const [deleting, setDeleting] = useState<WeightEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const [importing, setImporting] = useState<{ backup: Backup; filename: string; isCsv: boolean } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [pendingFile, setPendingFile] = useState(false);
  const repo = useRef<WeightRepository>(localRepository);
  const demoRepo = useRef<DemoRepository | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const modeEpoch = useRef(0);

  const notify = useCallback((message: string) => { setToast(message); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);

  const load = useCallback(async () => {
    const epoch = ++modeEpoch.current;
    setError('');
    try {
      const personal = await localRepository.read();
      if (epoch !== modeEpoch.current) return;
      const mode = safeRead('qingji-space');
      const useDemo = mode === 'demo' || (mode == null && personal.entries.length === 0);
      if (useDemo) {
        demoRepo.current ??= new DemoRepository();
        repo.current = demoRepo.current;
        setSnapshot(await demoRepo.current.read());
        setDemo(true);
      } else { repo.current = localRepository; setSnapshot(personal); setDemo(false); }
    } catch (cause) { if (epoch === modeEpoch.current) setError(cause instanceof Error ? cause.message : '加载失败'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!snapshot) return;
    const theme = snapshot.settings.theme;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'dark' || (theme === 'system' && media.matches) ? 'dark' : 'light'; };
    apply(); safeWrite('qingji-theme', theme);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [snapshot?.settings.theme]);

  useEffect(() => {
    function locationChange() { setView(currentView()); }
    if (window.location.hash) window.history.replaceState(null, '', routes[currentView()]);
    window.addEventListener('popstate', locationChange);
    window.addEventListener('hashchange', locationChange);
    return () => { window.removeEventListener('popstate', locationChange); window.removeEventListener('hashchange', locationChange); };
  }, []);
  useEffect(() => { document.title = `${titles[view]} · 轻迹`; }, [view]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) {
        event.preventDefault(); setEditor({});
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  function navigate(next: View) {
    setView(next);
    if (window.location.pathname !== routes[next]) window.history.pushState(null, '', routes[next]);
    document.querySelector('.main-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function switchSpace(nextDemo: boolean, begin = false) {
    const epoch = ++modeEpoch.current;
    try {
      const nextRepo = nextDemo ? demoRepo.current ??= new DemoRepository() : localRepository;
      const nextSnapshot = await nextRepo.read();
      if (epoch !== modeEpoch.current) return;
      repo.current = nextRepo; setSnapshot(nextSnapshot); setDemo(nextDemo); safeWrite('qingji-space', nextDemo ? 'demo' : 'personal');
      setEditor(null); setDeleting(null); setImporting(null); setError(''); navigate('dashboard');
      if (begin) setEditor({});
      notify(nextDemo ? '已进入示例空间，改动仅在本次体验有效' : '已切换到个人记录');
    } catch (cause) { notify(cause instanceof Error ? cause.message : '切换失败'); }
  }
  async function refresh() { setSnapshot(await repo.current.read()); }
  async function saveEntry(input: EntryInput, id?: string) {
    if (id) await repo.current.updateEntry(id, input); else await repo.current.createEntry(input);
    await refresh(); notify(demo ? '示例记录已保存' : id ? '记录已更新' : '记录已保存');
  }
  async function saveSettings(settings: Settings) {
    await repo.current.updateSettings(settings); await refresh(); notify(demo ? '示例偏好已更新，本次体验有效' : '偏好已保存');
  }
  async function toggleTheme() {
    if (!snapshot) return;
    const currentDark = document.documentElement.dataset.theme === 'dark';
    try { await saveSettings({ ...snapshot.settings, theme: currentDark ? 'light' : 'dark' }); }
    catch (cause) { notify(cause instanceof Error ? cause.message : '外观切换失败'); }
  }
  async function removeEntry() {
    if (!deleting) return; setDeleteBusy(true);
    try { await repo.current.deleteEntry(deleting.id); await refresh(); setDeleting(null); notify('这条记录已删除'); }
    catch (cause) { notify(cause instanceof Error ? cause.message : '删除失败'); }
    finally { setDeleteBusy(false); }
  }
  function exportData(format: 'json' | 'csv') {
    if (!snapshot) return;
    const filename = `qingji-${demo ? 'demo-' : ''}${localDate()}.${format}`;
    const backup: Backup = { format: 'qingji-backup', version: 1, exportedAt: new Date().toISOString(), ...snapshot };
    downloadText(format === 'json' ? JSON.stringify(backup, null, 2) : entriesToCsv(snapshot.entries), filename, format === 'json' ? 'application/json' : 'text/csv;charset=utf-8');
    notify(demo ? '已导出示例数据，文件名已标注 demo' : format === 'json' ? '备份已下载，请妥善保管' : 'CSV 已导出，体重单位为 kg');
  }
  function chooseImport() {
    if (demo) { notify('请先退出示例空间，再导入个人数据'); return; }
    fileInput.current?.click();
  }
  async function readImport(file?: File) {
    if (!file || !snapshot) return; setPendingFile(true);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('导入文件最多 8 MB');
      const text = await file.text(); const isCsv = file.name.toLowerCase().endsWith('.csv');
      const backup = isCsv ? { format: 'qingji-backup', version: 1, exportedAt: new Date().toISOString(), settings: snapshot.settings, entries: csvToEntries(text) } : JSON.parse(text);
      if (backup.format !== 'qingji-backup' || backup.version !== 1 || !Array.isArray(backup.entries) || !backup.settings) throw new Error('这不是轻迹 v1 备份。也可导入含 date、weight_kg 列的 CSV 文件。');
      if (backup.entries.length > 20_000) throw new Error('单次最多导入 20,000 条记录');
      if (backup.entries.some((entry: EntryInput) => !entry || typeof entry.date !== 'string' || typeof entry.weightKg !== 'number')) throw new Error('备份记录格式不正确，请检查日期和体重字段');
      setImportError(''); setImporting({ backup, filename: file.name, isCsv });
    } catch (cause) { notify(cause instanceof SyntaxError ? '文件不是有效的 JSON，请选择轻迹导出的备份' : cause instanceof Error ? cause.message : '读取文件失败'); }
    finally { setPendingFile(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function confirmImport() {
    if (!importing) return; setImportBusy(true); setImportError('');
    try {
      const result = await repo.current.importBackup(importing.backup); await refresh(); setImporting(null);
      notify(`导入完成：新增 ${result.imported} 条，跳过 ${result.skipped} 条重复日期`);
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : '导入失败'); }
    finally { setImportBusy(false); }
  }
  const conflicts = importing && snapshot ? importing.backup.entries.length - new Set(importing.backup.entries.map(entry => entry.date).filter(date => !snapshot.entries.some(entry => entry.date === date))).size : 0;
  return <div className="app-shell" data-view={view}>
    <a className="skip-link" href="#main-content">跳转到内容</a>
    <header className="masthead">
      <a className="brand" href="/" aria-label="轻迹，返回体重趋势" onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('dashboard'); } }}>
        <svg width="44" height="30" viewBox="0 0 56 36" fill="none" aria-hidden="true"><path d="M2 20c8 0 9-17 17-17s10 29 19 29 9-15 15-15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="53" cy="17" r="2.8" fill="currentColor"/></svg><span>轻迹</span>
      </a>
      <nav className="primary-nav" aria-label="主导航">{navItems.map(({ key, label }) => <a key={key} href={routes[key]} className={view === key || (key === 'dashboard' && view === 'insights') ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(key); } }}>{label}</a>)}</nav>
      <div className="header-actions">
        {snapshot && <button className="space-switch" aria-label={demo ? '退出示例，开始我的记录' : '浏览示例数据'} title={demo ? '示例改动不会写入个人数据库，点击开始自己的记录' : '体验独立的示例数据'} onClick={() => void switchSpace(!demo, demo)}><span className={demo ? 'demo-dot' : 'local-dot'} />{demo ? '示例' : '本机'}</button>}
        <IconButton label="切换浅色或深色外观" onClick={() => void toggleTheme()}><Sun size={17} className="show-in-dark" /><Moon size={17} className="show-in-light" /></IconButton>
        <button className="button primary header-record" aria-label="记录体重" disabled={!snapshot} onClick={() => setEditor({})}><Plus size={16}/><span>记录体重</span></button>
      </div>
    </header>
    <main id="main-content" className="main-scroll" aria-label={titles[view]}><div className={`content-container ${view === 'dashboard' ? 'home-container' : ''}`}>
      {error ? <div className="connection-error"><Database size={35} /><h1>暂时没有连接到本地服务</h1><p>{error}</p><button className="button primary" onClick={() => void load()}>重新连接</button><small>运行「启动轻迹.cmd」或 pnpm start 后，再试一次。</small></div> : !snapshot ? <div className="app-loading"><LoaderCircle size={26} className="spin" /><p>正在打开你的私人记录空间…</p></div> : <>
        {view === 'dashboard' && <TrendView snapshot={snapshot} onAdd={() => setEditor({})} onInsights={() => navigate('insights')} onHistory={() => navigate('history')} onSettings={() => navigate('settings')} />}
        {view === 'calendar' && <CalendarView snapshot={snapshot} onDate={date => setEditor({ date })} onEdit={entry => setEditor({ entry })} onDelete={setDeleting} />}
        {view === 'history' && <HistoryView snapshot={snapshot} onAdd={() => setEditor({})} onEdit={entry => setEditor({ entry })} onDelete={setDeleting} onExport={() => exportData('csv')} />}
        {view === 'insights' && <InsightsView snapshot={snapshot} onDate={date => setEditor({ date })} onSettings={() => navigate('settings')} />}
        {view === 'settings' && <PreferencesView key={demo ? 'demo' : 'personal'} settings={snapshot.settings} demo={demo} onSave={saveSettings} onExport={exportData} onImport={chooseImport} onAbout={() => setHelp(true)} />}
      </>}</div></main>
    {editor && snapshot && <EntryModal {...editor} entries={snapshot.entries} unit={snapshot.settings.unit} onSave={saveEntry} onClose={() => setEditor(null)} />}
    {deleting && snapshot && <Modal title="删除这条记录？" onClose={() => { if (!deleteBusy) setDeleting(null); }} className="small-modal"><p className="confirmation-text">将删除 <strong>{formatDay(deleting.date, { year: 'numeric', month: 'long', day: 'numeric' })}</strong> 的 <strong>{formatWeight(deleting.weightKg, snapshot.settings.unit)} {snapshot.settings.unit}</strong> 记录及随记。趋势会同步更新。</p><div className="modal-actions"><button className="button secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>保留记录</button><button className="button danger" disabled={deleteBusy} onClick={() => void removeEntry()}>{deleteBusy ? <LoaderCircle size={16} className="spin" /> : <X size={16} />}确认删除</button></div></Modal>}
    {importing && <Modal title="导入记录" onClose={() => { if (!importBusy) setImporting(null); }} className="small-modal"><p className="confirmation-text">即将从 <strong>{importing.filename}</strong> 导入数据。</p><div className="import-preview"><div><strong>{importing.backup.entries.length}</strong><span>文件内记录</span></div><div><strong>{importing.backup.entries.length - conflicts}</strong><span>将新增记录</span></div><div><strong>{conflicts}</strong><span>重复日期跳过</span></div></div><p className="inline-note"><ShieldCheck size={17} />同日期保留已有记录。{importing.isCsv ? 'CSV 导入会保留当前个人设置。' : '导入后恢复备份中的个人偏好。'}全部数据通过校验后才会写入。</p>{importError && <p className="form-error" role="alert">{importError}</p>}<div className="modal-actions"><button className="button secondary" disabled={importBusy} onClick={() => setImporting(null)}>取消</button><button className="button primary" disabled={importBusy} onClick={() => void confirmImport()}>{importBusy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{importBusy ? '正在导入…' : '确认导入'}</button></div></Modal>}
    {help && <Modal title="关于轻迹" onClose={() => setHelp(false)} className="small-modal"><div className="about-content"><img src="/favicon.svg" alt="轻迹标志" /><p>本地体重记录工具。记录保存在 <code>data/weight-recorder.sqlite</code> 中，与浏览器缓存无关。</p><p>按 <kbd>N</kbd> 记录体重，按 <kbd>Esc</kbd> 关闭弹窗。图表的虚线是过去 7 个自然日内实测值的平均数，缺失日期不补值。</p><p>示例空间的数据仅存在内存，刷新会重置。个人记录会持续保存，可在“偏好”的数据分区导出和导入备份。</p><button className="button primary" onClick={() => setHelp(false)}>完成</button></div></Modal>}
    <input className="sr-only" tabIndex={-1} type="file" ref={fileInput} accept=".json,.csv,application/json,text/csv" aria-label="导入轻迹备份或 CSV" onChange={event => void readImport(event.target.files?.[0])} />
    {pendingFile && <div className="toast" role="status"><LoaderCircle className="spin" size={16} />正在读取文件…</div>}
    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={13} /></span><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>;
}
