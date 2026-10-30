# Push EXPO_PUBLIC_FIREBASE_* from local .env to EAS "preview" (for APK builds).
# Run once before: npm run build

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  Write-Host "Missing .env — copy .env.example and fill Firebase keys first." -ForegroundColor Red
  exit 1
}

$names = @()
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -match '^\s*#' -or $line -eq "") { return }
  if ($line -notmatch '^(EXPO_PUBLIC_FIREBASE_\w+)\s*=\s*(.+)$') { return }
  $name = $Matches[1]
  $value = $Matches[2].Trim().Trim('"').Trim("'")
  if (-not $value) { return }
  $names += $name
  Write-Host "EAS preview: $name"
  npx eas env:create --environment preview --name $name --value $value --visibility plaintext --force
}

if ($names.Count -eq 0) {
  Write-Host "No EXPO_PUBLIC_FIREBASE_* lines in .env" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Done. Rebuild APK: npm run build" -ForegroundColor Green
Write-Host "Then reinstall on the phone (old APK had no Firebase)." -ForegroundColor Yellow
