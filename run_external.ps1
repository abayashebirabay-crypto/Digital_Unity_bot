# run_external.ps1 - For external users to access the bot (Production Mode - No Build)
param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$UseNgrok
)

$ErrorActionPreference = "Stop"

function Test-CommandExists {
    param([string]$CommandName)
    return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Update-ConfigUrl {
    param([string]$Url)
    $configPath = Join-Path $PWD "config.py"
    if (Test-Path $configPath) {
        $content = Get-Content $configPath -Raw
        $content = $content -replace 'WEB_APP_URL = ".*?"', "WEB_APP_URL = `"$Url`""
        Set-Content $configPath $content -NoNewline
        Write-Host "✅ Updated config.py with WEB_APP_URL = $Url" -ForegroundColor Green
    }
}

function Get-NgrokUrl {
    $maxAttempts = 30
    $attempt = 0
    
    Write-Host "Waiting for ngrok to start..." -ForegroundColor Yellow
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction SilentlyContinue
            $tunnel = $response.tunnels | Where-Object { $_.proto -eq "https" }
            if ($tunnel -and $tunnel.public_url) {
                return $tunnel.public_url
            }
        } catch {
            # ngrok API not ready yet
        }
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    Write-Host ""
    return $null
}

Write-Host "=== Digital Unity Production Mode (For External Users) ===" -ForegroundColor Cyan

if (-not (Test-Path ".\main.py")) {
    Write-Host "Error: run this script from project root (main.py not found)." -ForegroundColor Red
    exit 1
}

if (-not (Test-CommandExists "python")) {
    Write-Host "Error: python is not available in PATH." -ForegroundColor Red
    exit 1
}

# Check if React build exists
$reactBuildPath = Join-Path $PWD "frontend\build\index.html"
if (-not (Test-Path $reactBuildPath)) {
    Write-Host "⚠️ Warning: React build not found at: $reactBuildPath" -ForegroundColor Yellow
    Write-Host "   Make sure you have built React first with: cd frontend; npm run build" -ForegroundColor Yellow
    Write-Host ""
}

# Start ngrok for backend on port 8000 (single tunnel)
if ($UseNgrok) {
    if (-not (Test-CommandExists "ngrok")) {
        Write-Host "Error: ngrok not found in PATH. Please install ngrok first." -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "🔗 Starting ngrok on port $Port..." -ForegroundColor Green
    $ngrokCmd = "ngrok http $Port"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokCmd
    
    Write-Host "Waiting for ngrok to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    $detectedUrl = Get-NgrokUrl
    
    if ($detectedUrl) {
        $WebAppUrl = $detectedUrl
        Write-Host ""
        Write-Host "✅ Ngrok URL detected: $WebAppUrl" -ForegroundColor Green
        
        # Update config.py with the ngrok URL
        Update-ConfigUrl -Url $WebAppUrl
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "🌐 SHARE THIS URL WITH YOUR USERS:" -ForegroundColor Green
        Write-Host "   $WebAppUrl" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "⚠️ Could not auto-detect ngrok URL." -ForegroundColor Yellow
        $manualUrl = Read-Host "Enter ngrok HTTPS URL manually"
        if ($manualUrl) {
            Update-ConfigUrl -Url $manualUrl
            $WebAppUrl = $manualUrl
        }
    }
} else {
    $WebAppUrl = "http://localhost:$Port"
    Write-Host "⚠️ Ngrok not enabled. Only local access: $WebAppUrl" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green

# Start FastAPI backend (this will serve React build + API)
Write-Host "🚀 Starting FastAPI server (serving React build + API)..." -ForegroundColor Yellow
$backendCmd = "cd `"$PWD`"; python -m uvicorn web_server:app --host $HostAddress --port $Port --reload"
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -PassThru

Start-Sleep -Seconds 3

# Start bot
Write-Host "🤖 Starting Telegram bot..." -ForegroundColor Yellow
$botCmd = "cd `"$PWD`"; python main.py"
$botProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd -PassThru

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ ALL SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 React App + API: http://localhost:$Port" -ForegroundColor Cyan
if ($UseNgrok -and $WebAppUrl) {
    Write-Host ""
    Write-Host "🌐 SHARE THIS URL WITH EXTERNAL USERS:" -ForegroundColor Green
    Write-Host "   $WebAppUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  Make sure your bot's WEB_APP_URL in config.py is set to:" -ForegroundColor Cyan
    Write-Host "   $WebAppUrl" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Wait for user to press Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($backendProcess) { $backendProcess.Kill() }
    if ($botProcess) { $botProcess.Kill() }
}