param(
    [string]$Setup = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Setup) {
    $Setup = Join-Path $root "..\Tauri Notes Setup.exe"
}
$app = Join-Path $root "src-tauri\target\release\tauri-notes.exe"
$uninstaller = Join-Path $root "installer\custom\Uninstall.exe"
$icon = Join-Path $root "src-tauri\icons\icon.png"

if (-not (Test-Path $Setup)) { throw "Missing installer: $Setup" }
if (-not (Test-Path $app)) { throw "Missing app: $app" }

$assembly = [System.Reflection.Assembly]::Load(
    [System.IO.File]::ReadAllBytes((Resolve-Path $Setup))
)
$names = $assembly.GetManifestResourceNames()
Write-Host "Resources: $($names -join ', ')"

function Get-ResourceHash([string]$name) {
    $stream = $assembly.GetManifestResourceStream($name)
    if ($null -eq $stream) { throw "Missing installer resource: $name" }
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { return ([BitConverter]::ToString($sha.ComputeHash($stream)) -replace '-', '').ToLowerInvariant() }
        finally { $sha.Dispose() }
    }
    finally { $stream.Dispose() }
}

function Get-FileHashLower([string]$path) {
    (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$appHash = Get-FileHashLower $app
$resourceHash = Get-ResourceHash "AppExe"
if ($appHash -ne $resourceHash) {
    throw "Installer AppExe does not match release app"
}

if (Test-Path $uninstaller) {
    if ((Get-FileHashLower $uninstaller) -ne (Get-ResourceHash "Uninstaller")) {
        throw "Installer Uninstaller does not match"
    }
}

if (Test-Path $icon) {
    if ((Get-FileHashLower $icon) -ne (Get-ResourceHash "AppIcon")) {
        throw "Installer AppIcon does not match"
    }
}

Write-Host "Installer payload verified against latest build." -ForegroundColor Green
