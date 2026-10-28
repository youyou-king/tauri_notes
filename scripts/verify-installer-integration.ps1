param(
    [string]$Setup = "",
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Setup) { $Setup = Join-Path $root "..\Tauri Notes Setup.exe" }
if (-not $Target) { $Target = Join-Path $root ".tmp\installer-integration" }
$target = [System.IO.Path]::GetFullPath($Target)
$app = Join-Path $target "Tauri Notes.exe"
$desktop = [Environment]::GetFolderPath("DesktopDirectory")
$programs = [Environment]::GetFolderPath("Programs")
$shortcuts = @(
    (Join-Path $desktop "Tauri Notes.lnk"),
    (Join-Path $programs "Tauri Notes.lnk")
)
$keys = @(
    "Software\Classes\.note",
    "Software\Classes\TauriNotes.note",
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes"
)
$backup = Join-Path $root ".tmp\installer-integration-backup"
if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
New-Item -ItemType Directory -Path $backup -Force | Out-Null

$existed = @{}
foreach ($key in $keys) {
    $existed[$key] = Test-Path ("Registry::HKEY_CURRENT_USER\" + $key)
    if ($existed[$key]) {
        $file = Join-Path $backup (($key -replace '[\\/:*?"<>|]', '_') + ".reg")
        & reg.exe export ("HKCU\" + $key) $file /y | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to export $key" }
    }
}
foreach ($shortcut in $shortcuts) {
    if (Test-Path $shortcut) {
        Copy-Item $shortcut (Join-Path $backup ("shortcut-" + [IO.Path]::GetFileName($shortcut))) -Force
    }
}

$ws = New-Object -ComObject WScript.Shell
function ShortcutTarget([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    return $ws.CreateShortcut($path).TargetPath
}
$originalDesktopTarget = ShortcutTarget $shortcuts[0]
$originalStartTarget = ShortcutTarget $shortcuts[1]
$originalNote = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\.note" -ErrorAction SilentlyContinue)."(default)"
$originalCommand = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\TauriNotes.note\shell\open\command" -ErrorAction SilentlyContinue)."(default)"
$originalLocation = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes" -ErrorAction SilentlyContinue).InstallLocation

$success = $false
try {
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    $env:TAURI_SETUP = (Resolve-Path $Setup).Path
    $env:TAURI_TARGET = $target
    & python -c "import os, subprocess; p=subprocess.Popen([os.environ['TAURI_SETUP'], '/S', '/D='+os.environ['TAURI_TARGET'], '/NOLAUNCH'], close_fds=True); print(p.pid)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to launch installer" }

    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-Date) -lt $deadline) {
        $command = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\TauriNotes.note\shell\open\command" -ErrorAction SilentlyContinue)."(default)"
        if ((Test-Path $app) -and (Test-Path $shortcuts[0]) -and (Test-Path $shortcuts[1]) -and $command -like "*$target*") { break }
        Start-Sleep -Milliseconds 400
    }

    $errors = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path $app)) { $errors.Add("App not extracted") }
    if (-not (Test-Path $shortcuts[0])) { $errors.Add("Desktop shortcut missing") }
    if (-not (Test-Path $shortcuts[1])) { $errors.Add("Start menu shortcut missing") }
    if ((ShortcutTarget $shortcuts[0]) -ne $app) { $errors.Add("Desktop shortcut target mismatch") }
    if ((ShortcutTarget $shortcuts[1]) -ne $app) { $errors.Add("Start menu shortcut target mismatch") }
    if ((Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\.note" -ErrorAction SilentlyContinue)."(default)" -ne "TauriNotes.note") { $errors.Add(".note association missing") }
    $command = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\TauriNotes.note\shell\open\command" -ErrorAction SilentlyContinue)."(default)"
    if ($command -notlike "*$app*") { $errors.Add(".note command does not point to test app") }
    $location = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes" -ErrorAction SilentlyContinue).InstallLocation
    if ($location -ne $target) { $errors.Add("Uninstall location mismatch") }
    if ((Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes" -ErrorAction SilentlyContinue).UninstallString -notlike "*$target*") { $errors.Add("Uninstall string mismatch") }

    if ($errors.Count -gt 0) {
        throw ("Installer integration check failed: " + ($errors -join "; "))
    }
    $success = $true
    Write-Host "Installer integration verified (shortcuts, .note, uninstall entry)." -ForegroundColor Green
}
finally {
    foreach ($shortcut in $shortcuts) {
        $saved = Join-Path $backup ("shortcut-" + [IO.Path]::GetFileName($shortcut))
        if (Test-Path $saved) {
            Copy-Item $saved $shortcut -Force
        } elseif (Test-Path $shortcut) {
            Remove-Item $shortcut -Force
        }
    }
    foreach ($key in $keys) {
        $file = Join-Path $backup (($key -replace '[\\/:*?"<>|]', '_') + ".reg")
        if ($existed[$key]) {
            & cmd.exe /c "reg.exe delete `"HKCU\$key`" /f >nul 2>nul"
            & cmd.exe /c "reg.exe import `"$file`" >nul 2>nul"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "WARNING: failed to restore $key from $file" -ForegroundColor Red
            }
        } else {
            & cmd.exe /c "reg.exe delete `"HKCU\$key`" /f >nul 2>nul"
        }
    }
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }

    $restoreErrors = New-Object System.Collections.Generic.List[string]
    if ($originalDesktopTarget -and (ShortcutTarget $shortcuts[0]) -ne $originalDesktopTarget) { $restoreErrors.Add("desktop shortcut") }
    if ($originalStartTarget -and (ShortcutTarget $shortcuts[1]) -ne $originalStartTarget) { $restoreErrors.Add("start menu shortcut") }
    $note = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\.note" -ErrorAction SilentlyContinue)."(default)"
    if ($originalNote -and $note -ne $originalNote) { $restoreErrors.Add(".note association") }
    $command = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Classes\TauriNotes.note\shell\open\command" -ErrorAction SilentlyContinue)."(default)"
    if ($originalCommand -and $command -ne $originalCommand) { $restoreErrors.Add(".note command") }
    $location = (Get-ItemProperty "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes" -ErrorAction SilentlyContinue).InstallLocation
    if ($originalLocation -and $location -ne $originalLocation) { $restoreErrors.Add("uninstall location") }

    if ($restoreErrors.Count -gt 0) {
        Write-Host ("RESTORE FAILED: " + ($restoreErrors -join ", ") + ". Backup: " + $backup) -ForegroundColor Red
        exit 2
    }
    if ($success) {
        Remove-Item $backup -Recurse -Force
    } else {
        Write-Host "Backup retained at $backup" -ForegroundColor Yellow
    }
}

if (-not $success) { exit 1 }
