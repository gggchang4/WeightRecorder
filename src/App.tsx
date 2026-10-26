import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp, Database, Download, FlaskConical, LayoutDashboard, List, LoaderCircle, Menu, Moon, Settings2, ShieldCheck, Sun, Upload, X } from 'lucide-react';
import type { Backup, EntryInput, Settings, Snapshot, WeightEntry, WeightRepository } from '../shared/types.ts';
import { formatWeight, localDate } from '../shared/domain.ts';
import { csvToEntries, entriesToCsv } from '../shared/csv.ts';
import { DemoRepository, downloadText, localRepository } from './repository.ts';
import { Dashboard } from './components/Dashboard.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { EntryModal } from './components/EntryModal.tsx';
import { formatDay, IconButton, Modal } from './components/ui.tsx';

type View = 'dashboard' | 'calendar' | 'history' | 'settings';
type EntryEditor = { entry?: WeightEntry; date?: string } | null;
const navItems = [
  { key: 'dashboard', label: '趋势总览', Icon: LayoutDashboard },
  { key: 'calendar', label: '记录日历', Icon: CalendarDays },
  { key: 'history', label: '全部记录', Icon: List },
] as const;
const titles: Record<View, string> = { dashboard: '趋势总览', calendar: '记录日历', history: '全部记录', settings: '目标与偏好' };
function safeRead(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function safeWrite(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* optional preference cache */ } }

export default function App() {
  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash.slice(1);
    return ['calendar', 'history', 'settings'].includes(hash) ? hash as View : 'dashboard';
  });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EntryEditor>(null);
  const [deleting, setDeleting] = useState<WeightEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    function hashChange() { const hash = window.location.hash.slice(1); setView(['calendar', 'history', 'settings'].includes(hash) ? hash as View : 'dashboard'); }
    window.addEventListener('hashchange', hashChange);
    return () => window.removeEventListener('hashchange', hashChange);
  }, []);
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
    setView(next); window.location.hash = next; setSidebarOpen(false);
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
      notify(nextDemo ? '已进入示例空间；改动不会写入个人数据库' : '欢迎来到你的个人空间，记录只保存在这台电脑');
    } catch (cause) { notify(cause instanceof Error ? cause.message : '切换失败'); }
  }
  async function refresh() { setSnapshot(await repo.current.read()); }
  async function saveEntry(input: EntryInput, id?: string) {
    if (id) await repo.current.updateEntry(id, input); else await repo.current.createEntry(input);
    await refresh(); notify(demo ? '已保存到示例空间，本次体验有效' : id ? '记录已更新，变化都替你记住了' : '已记下今天的你');
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
    if (demo) { notify('请先点击「开始我的记录」退出示例模式，再导入个人数据'); return; }
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
  const currentTitle = titles[view];

  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="收起导航" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><a className="brand" href="#dashboard" onClick={() => navigate('dashboard')}><img src="/favicon.svg" alt="" /><span>轻迹<small>WEIGHT JOURNAL</small></span></a><div className="workspace-label"><span className={`workspace-avatar ${demo ? 'demo-avatar' : ''}`}>{demo ? <FlaskConical size={17} /> : '我'}</span><div><strong>{demo ? '示例空间' : `${snapshot?.settings.displayName ?? '我的'}${snapshot?.settings.displayName === '我的' || !snapshot ? '' : '的'}空间`}</strong><small>{demo ? '先体验，再开始' : '只属于你的身体日记'}</small></div><ChevronRight size={14} /></div>
      <div className="nav-section-label">日常记录</div><nav aria-label="主导航">{navItems.map(({ key, label, Icon }) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{key === 'history' && snapshot && snapshot.entries.length > 0 && <small>{snapshot.entries.length}</small>}</button>)}</nav><div className="nav-section-label personal-label">为你而设</div><button className={`nav-item ${view === 'settings' ? 'active' : ''}`} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}><Settings2 size={19} strokeWidth={1.7} /><span>目标与偏好</span></button>
      <div className="sidebar-space" /><div className="sidebar-quote"><span className="quote-line" /><p>不赶时间，<br />只记录自己的节奏。</p><small>A LITTLE, EVERY DAY.</small></div><button className="sidebar-backup" onClick={() => exportData('json')} disabled={!snapshot}><span className="backup-icon"><Download size={17} /></span><span><strong>为记录留一份备份</strong><small>随时带走，安心保存</small></span><ChevronRight size={13} /></button><div className="sidebar-footer"><div><span className="status-dot" /><span>{error ? '等待连接' : demo ? '示例数据 · 独立体验' : '数据仅存于本机'}</span><ShieldCheck size={12} /></div><button onClick={() => setHelp(true)} aria-label="关于轻迹"><CircleHelp size={16} /></button></div>
    </aside>
    <main className="main-panel"><header className="topbar"><div className="breadcrumbs"><IconButton label="展开导航" onClick={() => setSidebarOpen(true)}><Menu size={18} /></IconButton><span>{demo ? '示例空间' : '个人空间'}</span><ChevronRight size={12} /><strong>{currentTitle}</strong></div><div className="topbar-actions"><span className="local-badge"><ShieldCheck size={13} />本地优先，安心记录</span><span className="topbar-divider" /><IconButton label="切换浅色或深色外观" onClick={() => void toggleTheme()}><Sun size={17} className="show-in-dark" /><Moon size={17} className="show-in-light" /></IconButton><button className="profile-avatar" aria-label="打开个人偏好" onClick={() => navigate('settings')}>{demo ? '轻' : snapshot?.settings.displayName === '我的' ? '我' : snapshot?.settings.displayName.slice(0, 1) ?? '我'}</button></div></header>
      <div className="main-scroll"><div className="content-container">{snapshot && <div className={`space-banner ${demo ? 'demo-banner' : 'personal-banner'}`}><div>{demo ? <FlaskConical size={15} /> : <ShieldCheck size={15} />}<span>{demo ? <><strong>先感受一下，记录的样子。</strong><span className="banner-detail"> 你正在浏览独立示例，数据不会混入个人记录。</span></> : <><strong>这是你的私人记录空间。</strong><span className="banner-detail"> 一点点积累，慢慢看见变化。</span></>}</span></div><button onClick={() => void switchSpace(!demo, demo)}>{demo ? '开始我的记录' : '体验示例'}<ArrowRight size={14} /></button></div>}
      {error ? <div className="connection-error"><Database size={35} /><h1>暂时没有连接到本地服务</h1><p>{error}</p><button className="button primary" onClick={() => void load()}>重新连接</button><small>运行「启动轻迹.cmd」或 pnpm start 后，再试一次。</small></div> : !snapshot ? <div className="app-loading"><LoaderCircle size={26} className="spin" /><p>正在打开你的私人记录空间…</p></div> : <>
        {view === 'dashboard' && <Dashboard snapshot={snapshot} onAdd={() => setEditor({})} onEdit={entry => setEditor({ entry })} onDelete={setDeleting} onHistory={() => navigate('history')} onSettings={() => navigate('settings')} onDate={date => setEditor({ date })} />}
        {view === 'calendar' && <CalendarView snapshot={snapshot} onDate={date => setEditor({ date })} onEdit={entry => setEditor({ entry })} onDelete={setDeleting} />}
        {view === 'history' && <HistoryView snapshot={snapshot} onAdd={() => setEditor({})} onEdit={entry => setEditor({ entry })} onDelete={setDeleting} onExport={() => exportData('csv')} />}
        {view === 'settings' && <SettingsView key={`${demo}-${snapshot.settings.theme}-${snapshot.settings.unit}`} settings={snapshot.settings} demo={demo} onSave={saveSettings} onExport={exportData} onImport={chooseImport} />}
      </>}<footer className="main-footer"><span>轻迹 <span>·</span> 让变化，有迹可循。</span><span>LOCAL FIRST <i /> MADE FOR YOU</span></footer></div></div>
    </main>
    {editor && snapshot && <EntryModal {...editor} entries={snapshot.entries} unit={snapshot.settings.unit} onSave={saveEntry} onClose={() => setEditor(null)} />}
    {deleting && snapshot && <Modal title="删除这条记录？" eyebrow="A SMALL CHANGE TO YOUR JOURNAL" onClose={() => { if (!deleteBusy) setDeleting(null); }} className="small-modal"><p className="confirmation-text">将删除 <strong>{formatDay(deleting.date, { year: 'numeric', month: 'long', day: 'numeric' })}</strong> 的 <strong>{formatWeight(deleting.weightKg, snapshot.settings.unit)} {snapshot.settings.unit}</strong> 记录及随记。趋势会同步更新。</p><div className="modal-actions"><button className="button secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>保留记录</button><button className="button danger" disabled={deleteBusy} onClick={() => void removeEntry()}>{deleteBusy ? <LoaderCircle size={16} className="spin" /> : <X size={16} />}确认删除</button></div></Modal>}
    {importing && <Modal title="把记录带回轻迹" eyebrow="IMPORT YOUR JOURNAL" onClose={() => { if (!importBusy) setImporting(null); }} className="small-modal"><p className="confirmation-text">即将从 <strong>{importing.filename}</strong> 导入数据。</p><div className="import-preview"><div><strong>{importing.backup.entries.length}</strong><span>文件内记录</span></div><div><strong>{importing.backup.entries.length - conflicts}</strong><span>将新增记录</span></div><div><strong>{conflicts}</strong><span>重复日期跳过</span></div></div><p className="inline-note"><ShieldCheck size={17} />同日期保留已有记录。{importing.isCsv ? 'CSV 导入会保留当前个人设置。' : '导入后恢复备份中的个人偏好。'}全部数据通过校验后才会写入。</p>{importError && <p className="form-error" role="alert">{importError}</p>}<div className="modal-actions"><button className="button secondary" disabled={importBusy} onClick={() => setImporting(null)}>取消</button><button className="button primary" disabled={importBusy} onClick={() => void confirmImport()}>{importBusy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{importBusy ? '正在导入…' : '确认导入'}</button></div></Modal>}
    {help && <Modal title="轻迹，陪你慢慢记录。" eyebrow="QINGJI · VERSION 1.0" onClose={() => setHelp(false)} className="small-modal"><div className="about-content"><img src="/favicon.svg" alt="轻迹标志" /><p>一个安静、私密的本地体重日记。记录保存在项目的 <code>data/weight-recorder.sqlite</code> 中，与浏览器缓存无关。</p><p>按 <kbd>N</kbd> 快速记录体重，按 <kbd>Esc</kbd> 关闭弹窗。图表的虚线是过去 7 个自然日内实测值的平均数，缺失日期不补值。</p><p>示例空间的数据仅存在内存，刷新会重置。个人空间的数据会持续保存；完整备份可以在「目标与偏好」中导入。</p><button className="button primary" onClick={() => setHelp(false)}>知道了 <Check size={16} /></button></div></Modal>}
    <input className="sr-only" tabIndex={-1} type="file" ref={fileInput} accept=".json,.csv,application/json,text/csv" aria-label="导入轻迹备份或 CSV" onChange={event => void readImport(event.target.files?.[0])} />
    {pendingFile && <div className="toast" role="status"><LoaderCircle className="spin" size={16} />正在读取文件…</div>}
    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={13} /></span><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>;
}
