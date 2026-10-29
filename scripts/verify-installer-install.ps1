param(
    [string]$Setup = "",
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Setup) {
    $Setup = Join-Path $root "..\Tauri Notes Setup.exe"
}
if (-not $Target) {
    $Target = Join-Path $root ".tmp\installer-verify"
}
$release = Join-Path $root "src-tauri\target\release\tauri-notes.exe"
$help = Join-Path $root "help.note"

if (-not (Test-Path $Setup)) { throw "Missing installer: $Setup" }
if (-not (Test-Path $release)) { throw "Missing release app: $release" }
if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }

$env:TAURI_SETUP = (Resolve-Path $Setup).Path
$env:TAURI_TARGET = $Target
try {
    $installerPid = & python -c "import os, subprocess; p=subprocess.Popen([os.environ['TAURI_SETUP'], '/S', '/D='+os.environ['TAURI_TARGET'], '/NOASSOC', '/NODESKTOP', '/NOSTARTMENU', '/NOREG', '/NOLAUNCH'], close_fds=True); print(p.pid)"
    if ($LASTEXITCODE -ne 0) { throw "Failed to launch installer" }
    $deadline = (Get-Date).AddSeconds(30)
    $app = Join-Path $Target "Tauri Notes.exe"
    $uninstaller = Join-Path $Target "Uninstall.exe"
    $helpTarget = Join-Path $Target "help.note"
    while ((Get-Date) -lt $deadline) {
        if ((Test-Path $app) -and (Test-Path $uninstaller) -and (Test-Path $helpTarget)) { break }
        Start-Sleep -Milliseconds 300
    }
    if (-not (Test-Path $app)) { throw "Installer did not extract the app" }
    if (-not (Test-Path $uninstaller)) { throw "Installer did not extract the uninstaller" }
    if (-not (Test-Path $helpTarget)) { throw "Installer did not extract the help knowledge base" }
    if ((Get-FileHash $app).Hash -ne (Get-FileHash $release).Hash) {
        throw "Extracted app does not match release build"
    }
    if ((Get-FileHash $helpTarget).Hash -ne (Get-FileHash $help).Hash) {
        throw "Extracted help does not match source"
    }
    Write-Host "Installer extraction verified: $app" -ForegroundColor Green
}
finally {
    if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
}
