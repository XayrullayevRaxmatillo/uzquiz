# UZQUIZ one-shot setup for Windows PowerShell. Run from the project root:  .\setup.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not (Test-Path "$root\server\.env")) { Copy-Item "$root\server\.env.example" "$root\server\.env"; Write-Host "Created server\.env (edit MONGODB_URI if you use Atlas)" }
foreach ($d in 'server', 'client') {
  Write-Host "`n== npm install ($d) ==" -ForegroundColor Cyan
  Push-Location "$root\$d"; npm install; if ($LASTEXITCODE) { throw "npm install failed in $d" }; Pop-Location
}
Write-Host "`n== typecheck ==" -ForegroundColor Cyan
Push-Location "$root\server"; npm run typecheck; Pop-Location
Push-Location "$root\client"; npm run typecheck; Pop-Location
Write-Host "`n== seed ==" -ForegroundColor Cyan
Push-Location "$root\server"; npm run seed; Pop-Location
Write-Host "`nDone. Start with:  .\start.ps1" -ForegroundColor Green
