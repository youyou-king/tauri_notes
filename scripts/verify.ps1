$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Invoke-Step "TypeScript + unit tests" { npm run check }
Invoke-Step "Frontend production build" { npm run build }
Invoke-Step "Tauri release build" { npm run tauri build -- --no-bundle }

Write-Host "Verification completed." -ForegroundColor Green
