# run_external.ps1 - For external users to access the bot (Development Mode with Hot Reload)
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

Write-Host "=== Digital Unity Development Mode (Hot Reload Enabled) ===" -ForegroundColor Cyan

if (-not (Test-Path ".\main.py")) {
    Write-Host "Error: run this script from project root (main.py not found)." -ForegroundColor Red
    exit 1
}

if (-not (Test-CommandExists "python")) {
    Write-Host "Error: python is not available in PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-CommandExists "npm")) {
    Write-Host "Error: npm is not available in PATH." -ForegroundColor Red
    exit 1
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
    $WebAppUrl = "http://localhost:5173"
    Write-Host "⚠️ Ngrok not enabled. Using Vite dev server on port 5173" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting services with hot reload..." -ForegroundColor Green

# Start Vite frontend dev server (hot reload enabled)
Write-Host "🎨 Starting React frontend (Vite - Hot Reload)..." -ForegroundColor Yellow
$frontendCmd = "cd `"$PWD\frontend`"; npm run dev"
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -PassThru

Start-Sleep -Seconds 2

# Start FastAPI backend with --reload for auto-restart on Python changes
Write-Host "🚀 Starting FastAPI backend (--reload enabled)..." -ForegroundColor Yellow
$backendCmd = "cd `"$PWD`"; python -m uvicorn web_server:app --host $HostAddress --port $Port --reload"
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -PassThru

Start-Sleep -Seconds 3

# Start bot with --reload flag if supported
Write-Host "🤖 Starting Telegram bot (with auto-restart)..." -ForegroundColor Yellow
$botCmd = "cd `"$PWD`"; python -m watchdog auto-restart --pattern `"*.py`" --recursive -- python main.py"
if (-not (Test-CommandExists "watchdog")) {
    Write-Host "⚠️ watchdog not installed. Bot will NOT auto-reload on changes." -ForegroundColor Yellow
    Write-Host "   Install with: pip install watchdog" -ForegroundColor Yellow
    $botCmd = "cd `"$PWD`"; python main.py"
}
$botProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd -PassThru

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ ALL SERVICES STARTED WITH HOT RELOAD!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend (React): http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔌 Backend API: http://localhost:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚡ HOT RELOAD ACTIVE:" -ForegroundColor Green
Write-Host "   • Frontend changes → Browser auto-refreshes instantly" -ForegroundColor Yellow
Write-Host "   • Backend Python changes → Server auto-restarts" -ForegroundColor Yellow
Write-Host "   • Bot changes → Auto-restarts (if watchdog installed)" -ForegroundColor Yellow
Write-Host ""
if ($UseNgrok -and $WebAppUrl) {
    Write-Host "🌐 EXTERNAL ACCESS URL: $WebAppUrl" -ForegroundColor Green
    Write-Host "   NOTE: For external access, frontend at $WebAppUrl must be built" -ForegroundColor Yellow
    Write-Host "   Run 'npm run build' in frontend folder first" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Wait for user to press Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($frontendProcess) { $frontendProcess.Kill() }
    if ($backendProcess) { $backendProcess.Kill() }
    if ($botProcess) { $botProcess.Kill() }
}