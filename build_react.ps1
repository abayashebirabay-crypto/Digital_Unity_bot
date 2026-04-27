Write-Host "Building React app..." -ForegroundColor Cyan

# Build React
Set-Location frontend
npm run build
Set-Location ..

Write-Host "✅ React build complete" -ForegroundColor Green
Write-Host "Now run: .\run.ps1 -UseNgrok" -ForegroundColor Yellow