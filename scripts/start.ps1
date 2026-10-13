# One-command start for Windows PowerShell.  Usage:  .\scripts\start.ps1  [-Demo]
param([switch]$Demo)
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
if ($Demo) { docker compose --profile demo up -d --build --wait } else { docker compose up -d --build --wait }
Write-Host ""
Write-Host "  App ........ http://localhost:8080   (admin@resourcehub.com / Admin@123)"
Write-Host "  API ........ http://localhost:5000/api/health"
Write-Host "  Prometheus . http://localhost:9090/targets"
Write-Host "  Grafana .... http://localhost:3000   (admin / admin)"
Start-Process "http://localhost:8080"
Start-Process "http://localhost:3000/d/resourcehub-overview"
