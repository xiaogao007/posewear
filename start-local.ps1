param(
    [ValidateRange(1, 65535)][int]$Port = 8787,
    [switch]$Rebuild,
    [switch]$FetchAssets
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONUTF8 = '1'
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_LOG_PATH = Join-Path $PSScriptRoot '.local/wrangler.log'
$env:XDG_CONFIG_HOME = Join-Path $PSScriptRoot '.local/config'
New-Item -ItemType Directory -Force -Path '.local' | Out-Null

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $Executable"
    }
}

$pythonPath = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) {
    Invoke-Checked -Executable 'python' -Arguments @('-m', 'venv', '.venv')
}
& $pythonPath -c "import importlib.util, sys; sys.exit(importlib.util.find_spec('PIL') is None)"
if ($LASTEXITCODE -ne 0) {
    Invoke-Checked -Executable $pythonPath -Arguments @('-m', 'pip', 'install', '-r', 'requirements.txt')
}
if (!(Test-Path -LiteralPath 'node_modules/better-auth/package.json')) {
    Invoke-Checked -Executable 'npm.cmd' -Arguments @('ci', '--no-fund', '--no-audit')
}
$buildReady = Test-Path -LiteralPath 'dist/.build-ready'
if ($FetchAssets -or !$buildReady) {
    Invoke-Checked -Executable $pythonPath -Arguments @('-X', 'utf8', 'scripts/fetch-assets.py')
}
if ($Rebuild -or $FetchAssets -or !$buildReady) {
    $env:POSEWEAR_SITE = "http://localhost:$Port"
    Invoke-Checked -Executable $pythonPath -Arguments @('-X', 'utf8', 'build.py')
}
Write-Host "PoseWear: http://localhost:$Port (Ctrl+C to stop)"
Invoke-Checked -Executable 'node' -Arguments @('server/local.mjs', '--port', "$Port")
