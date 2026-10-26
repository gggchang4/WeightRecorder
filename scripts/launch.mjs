import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 3210);
const noOpen = process.argv.includes('--no-open');
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('轻迹需要 Node.js 24 或更新版本：https://nodejs.org/'); process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT 应为 1–65535 的整数'); process.exit(1); }
const url = `http://127.0.0.1:${port}`;

function openBrowser() {
  if (noOpen) return;
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`请在浏览器中打开 ${url}`));
  child.unref();
}

async function running() {
  try {
    const response = await fetch(`${url}/api/v1/health`, { signal: AbortSignal.timeout(1200) });
    const result = await response.json();
    return response.ok && result.data?.app === 'qingji';
  } catch { return false; }
}

if (await running()) {
  console.log(`轻迹已经在运行：${url}`); openBrowser(); process.exit(0);
}
if (!existsSync(resolve(root, 'node_modules/tsx/dist/cli.mjs'))) {
  console.error('请先运行 pnpm install，或在 Windows 上双击「启动轻迹.cmd」。'); process.exit(1);
}

function latestChange(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(stat.mtimeMs, ...readdirSync(path).map(name => latestChange(resolve(path, name))));
}
const indexPath = resolve(root, 'dist/index.html');
const lastBuild = existsSync(indexPath) ? statSync(indexPath).mtimeMs : 0;
const sourceTime = Math.max(...['src', 'shared', 'server', 'public', 'index.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'pnpm-lock.yaml'].map(path => latestChange(resolve(root, path))));
if (!lastBuild || sourceTime > lastBuild) {
  console.log('正在准备轻迹（首次启动或源码更新后构建一次）…');
  for (const args of [['node_modules/typescript/bin/tsc', '--noEmit'], ['node_modules/vite/bin/vite.js', 'build']]) {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) { console.error(result.error ?? '构建失败，请检查上方输出。'); process.exit(1); }
  }
}
const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: root, stdio: 'inherit', windowsHide: true });
let exited = false;
child.on('error', error => { exited = true; console.error(error); process.exitCode = 1; });
child.on('exit', code => { exited = true; process.exitCode = code ?? 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
for (let attempt = 0; attempt < 40 && !exited; attempt += 1) {
  if (await running()) {
    console.log('关闭此窗口或按 Ctrl+C 可停止本地服务。数据会保留。\n');
    openBrowser(); break;
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}
