[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [ValidateRange(1, 65535)][int]$Port = 3210
)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory

try {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $bundledNodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if ($nodeCommand) { $nodeExecutable = $nodeCommand.Source }
  elseif (Test-Path -LiteralPath $bundledNodePath) { $nodeExecutable = $bundledNodePath }
  else { throw 'Node.js 24+ is required. Install it from https://nodejs.org/ and run this launcher again.' }

  $nodeMajorVersion = & $nodeExecutable -p "Number(process.versions.node.split('.')[0])"
  if ([int]$nodeMajorVersion -lt 24) { throw 'Node.js 24+ is required. Please update Node.js at https://nodejs.org/.' }

  $env:PATH = "$(Split-Path -Parent $nodeExecutable);$env:PATH"
  if (!(Test-Path -LiteralPath 'node_modules\tsx\dist\cli.mjs') -or !(Test-Path -LiteralPath 'node_modules\vite\bin\vite.js')) {
    Write-Host 'Installing project dependencies (first launch only)...'
    $packageManagerCommand = Get-Command pnpm.cmd,pnpm,npm.cmd,npm -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($packageManagerCommand) {
      if ($packageManagerCommand.Name -like 'pnpm*') { & $packageManagerCommand.Source install --frozen-lockfile }
      else { & $packageManagerCommand.Source install }
    } else {
      $bundledPnpmPath = Join-Path (Split-Path -Parent (Split-Path -Parent $nodeExecutable)) 'node_modules\pnpm\bin\pnpm.mjs'
      if (!(Test-Path -LiteralPath $bundledPnpmPath)) { throw 'Please install pnpm or use a standard Node.js installation with npm.' }
      & $nodeExecutable $bundledPnpmPath install --frozen-lockfile
    }
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the network connection and try again.' }
  }

  $env:PORT = $Port.ToString()
  $launchArguments = @('scripts\launch.mjs')
  if ($NoBrowser) { $launchArguments += '--no-open' }
  & $nodeExecutable @launchArguments
  exit $LASTEXITCODE
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
