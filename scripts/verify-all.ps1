param(
  [switch]$SkipBuild,
  [switch]$SkipInstaller,
  [string]$Cargo = "cargo"
)

$ErrorActionPreference = "Stop"
$tauri = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $tauri
$srcTauri = Join-Path $tauri "src-tauri"
$temp = Join-Path $tauri ".tmp"
New-Item -ItemType Directory -Path $temp -Force | Out-Null
$env:TEMP = $temp
$env:TMP = $temp

function Invoke-Step([string]$Name, [scriptblock]$Command) {
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Push-Location $tauri
try {
  Invoke-Step "frontend check" { npm run check }
  Invoke-Step "frontend e2e" { npm run e2e }
  Invoke-Step "frontend build" { npm run build }

  Push-Location $srcTauri
  try {
    Invoke-Step "rust clippy" {
      & $Cargo clippy --workspace --all-targets -- -D warnings
    }

    $crates = @(
      "tauri-notes-plugin-api",
      "tauri-notes-plugin-runtime",
      "tauri-notes-platform",
      "tauri-notes-storage",
      "tauri-notes-content",
      "tauri-notes-board",
      "tauri-notes-document"
    )
    foreach ($crate in $crates) {
      Invoke-Step "rust test: $crate" {
        & $Cargo test -p $crate --lib
      }
    }
    Invoke-Step "rust test: tauri-notes" {
      & $Cargo test -p tauri-notes --lib
    }
  } finally {
    Pop-Location
  }

  if (-not $SkipBuild) {
    Invoke-Step "tauri release build" { npm run tauri build -- --no-bundle }
  }

  if (-not $SkipInstaller) {
    $setup = Join-Path $root "Tauri Notes Setup.exe"
    Invoke-Step "build installer" {
      powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $tauri "scripts\build-installer.ps1") -Output $setup
    }
    Invoke-Step "verify installer payload" {
      powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $tauri "scripts\verify-installer.ps1") -Setup $setup
    }
    Invoke-Step "verify installer extraction" {
      powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $tauri "scripts\verify-installer-install.ps1") -Setup $setup
    }
  }

  Write-Host ""
  Write-Host "All checks passed." -ForegroundColor Green
} finally {
  Pop-Location
}
