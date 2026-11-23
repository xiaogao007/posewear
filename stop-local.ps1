$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.local/server-process.json'
if (!(Test-Path -LiteralPath $statePath)) {
    Write-Host 'No background launcher recorded. Use Ctrl+C in the running terminal.'
    exit 0
}
$serviceState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$servicePid = [int]$serviceState.pid
$serviceProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $servicePid"
if (!$serviceProcess) {
    Write-Host 'The recorded background launcher has already stopped.'
    exit 0
}
$expectedScript = Join-Path $PSScriptRoot 'start-local.ps1'
if ($serviceProcess.Name -notin @('powershell.exe', 'pwsh.exe') -or
    !$serviceProcess.CommandLine -or
    $serviceProcess.CommandLine.IndexOf($expectedScript, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw 'The recorded PID belongs to a different process; nothing was stopped.'
}
& taskkill.exe /PID $servicePid /T /F
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the background service.' }
