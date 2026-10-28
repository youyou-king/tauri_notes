param(
    [string]$Output = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$custom = Join-Path $root "installer\custom"
$icons = Join-Path $root "src-tauri\icons"
$app = Join-Path $root "src-tauri\target\release\tauri-notes.exe"
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $app)) {
    throw "Missing release app: $app. Run 'npm run tauri build -- --no-bundle' first."
}
if (-not (Test-Path $csc)) {
    throw "Missing C# compiler: $csc"
}

$uninstaller = Join-Path $custom "Uninstall.exe"
$setup = Join-Path $custom "Tauri Notes Setup.exe"
$icon = Join-Path $icons "icon.ico"
$png = Join-Path $icons "icon.png"

& $csc /nologo /target:winexe /win32icon:$icon /r:System.Drawing.dll `
    /out:$uninstaller (Join-Path $custom "Uninstall.cs")
if ($LASTEXITCODE -ne 0) { throw "Uninstaller build failed" }

& $csc /nologo /target:winexe /win32icon:$icon /r:System.Drawing.dll `
    /out:$setup `
    /resource:$app,AppExe `
    /resource:$uninstaller,Uninstaller `
    /resource:$png,AppIcon `
    (Join-Path $custom "Setup.cs")
if ($LASTEXITCODE -ne 0) { throw "Installer build failed" }

if (-not $Output) {
    $Output = Join-Path $root "..\Tauri Notes Setup.exe"
}
Copy-Item $setup $Output -Force
Write-Host "Installer written to $Output" -ForegroundColor Green
