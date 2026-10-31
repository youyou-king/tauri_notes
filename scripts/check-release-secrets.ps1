param(
  [switch]$RequireSigning
)

$ErrorActionPreference = "Stop"
$required = @(
  @{ Name = "TAURI_SIGNING_PRIVATE_KEY"; Purpose = "updater signature" },
  @{ Name = "APPLE_CERTIFICATE"; Purpose = "macOS code signing" },
  @{ Name = "APPLE_CERTIFICATE_PASSWORD"; Purpose = "macOS certificate password" },
  @{ Name = "APPLE_SIGNING_IDENTITY"; Purpose = "macOS signing identity" },
  @{ Name = "APPLE_ID"; Purpose = "macOS notarization" },
  @{ Name = "APPLE_PASSWORD"; Purpose = "macOS app-specific password" },
  @{ Name = "APPLE_TEAM_ID"; Purpose = "macOS team id" }
)

$missing = @()
foreach ($entry in $required) {
  $value = [Environment]::GetEnvironmentVariable($entry.Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $entry
    Write-Host ("MISSING  {0,-28} {1}" -f $entry.Name, $entry.Purpose) -ForegroundColor Yellow
  } else {
    Write-Host ("SET      {0,-28} {1}" -f $entry.Name, $entry.Purpose) -ForegroundColor Green
  }
}

if ($RequireSigning -and $missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Signing/updater secrets are incomplete." -ForegroundColor Red
  Write-Host "See docs/发布签名与更新.md for the required GitHub secrets." -ForegroundColor Red
  exit 1
}

if ($missing.Count -eq 0) {
  Write-Host ""
  Write-Host "Signing/updater secrets look complete." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Unsigned build path: local builds and unsigned releases remain valid." -ForegroundColor Cyan
}
