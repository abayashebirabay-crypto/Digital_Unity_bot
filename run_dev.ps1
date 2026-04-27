param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000,
    [int]$ReactPort = 3000,
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
    param([int]$TargetPort)
    $maxAttempts = 30
    $attempt = 0
    
    Write-Host "Waiting for ngrok to start on port $TargetPort..." -ForegroundColor Yellow
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction SilentlyContinue
            $tunnels = $response.tunnels | Where-Object { $_.proto -eq "https" -and $_.config.addr -like "*$TargetPort*" }
            if ($tunnels -and $tunnels.public_url) {
                return $tunnels.public_url
            }
            # Also try without port filter
            $anyTunnel = $response.tunnels | Where-Object { $_.proto -eq "https" }
            if ($anyTunnel -and $anyTunnel.public_url) {
                return $anyTunnel.public_url
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

Write-Host "=== Digital Unity Development Mode (Hot Reload) ===" -ForegroundColor Cyan

if (-not (Test-Path ".\main.py")) {
    Write-Host "Error: run this script from project root (main.py not found)." -ForegroundColor Red
    exit 1
}

if (-not (Test-CommandExists "python")) {
    Write-Host "Error: python is not available in PATH." -ForegroundColor Red
    exit 1
}

# Check if React frontend exists
if (-not (Test-Path ".\frontend")) {
    Write-Host "Error: frontend folder not found." -ForegroundColor Red
    exit 1
}

# Start ngrok if requested
if ($UseNgrok) {
    if (-not (Test-CommandExists "ngrok")) {
        Write-Host "Error: ngrok not found in PATH. Please install ngrok first." -ForegroundColor Red
        exit 1
    }
    
    # Start ngrok for React port (so external users can access)
    Write-Host "Starting ngrok for React on port $ReactPort..." -ForegroundColor Green
    $ngrokReactCmd = "ngrok http $ReactPort"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokReactCmd
    
    Start-Sleep -Seconds 3
    
    # Get React ngrok URL
    $reactNgrokUrl = Get-NgrokUrl -TargetPort $ReactPort
    
    if ($reactNgrokUrl) {
        $WebAppUrl = $reactNgrokUrl
        Write-Host ""
        Write-Host "✅ React accessible at: $WebAppUrl" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "⚠️ Could not auto-detect React ngrok URL." -ForegroundColor Yellow
        $WebAppUrl = Read-Host "Enter React ngrok HTTPS URL"
    }
} else {
    $WebAppUrl = "http://localhost:3000"
    Write-Host "Using React dev server at: $WebAppUrl (local only)" -ForegroundColor Yellow
}

# Update config.py with the URL
Update-ConfigUrl -Url $WebAppUrl

# Set environment variable for web_server to detect dev mode
$env:WEB_APP_URL = $WebAppUrl

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BACKEND API: http://localhost:$Port" -ForegroundColor Yellow
Write-Host "REACT DEV: http://localhost:$ReactPort" -ForegroundColor Yellow
if ($UseNgrok) {
    Write-Host "🌐 PUBLIC REACT URL: $WebAppUrl" -ForegroundColor Green
    Write-Host "   (Share this with other users)" -ForegroundColor Cyan
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting services with HOT RELOAD..." -ForegroundColor Green

# Start FastAPI backend with auto-reload
Write-Host "🔥 Starting FastAPI backend (auto-reload on code change)..." -ForegroundColor Yellow
$backendCmd = "cd `"$PWD`"; python -m uvicorn web_server:app --host 0.0.0.0 --port $Port --reload"
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -PassThru

Start-Sleep -Seconds 2

# Start React dev server on all network interfaces (so ngrok can access it)
Write-Host "🔥 Starting React dev server on 0.0.0.0 (accessible via ngrok)..." -ForegroundColor Yellow
$reactCmd = "cd `"$PWD\frontend`"; `$env:HOST='0.0.0.0'; npm start"
$reactProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $reactCmd -PassThru

# Start bot (auto-reload with watchfiles)
Write-Host "🔥 Starting Telegram bot (auto-reload on code change)..." -ForegroundColor Yellow
$botCmd = "cd `"$PWD`"; watchfiles 'python main.py' ."
$botProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd -PassThru

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "ALL SERVICES STARTED WITH HOT RELOAD!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 React App (local): http://localhost:$ReactPort" -ForegroundColor Cyan
Write-Host "🔌 Backend API (local): http://localhost:$Port" -ForegroundColor Cyan
if ($UseNgrok) {
    Write-Host ""
    Write-Host "🌐 SHARE THIS URL WITH OTHER USERS:" -ForegroundColor Green
    Write-Host "   $WebAppUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  Make sure to update your bot's WEB_APP_URL in config.py" -ForegroundColor Cyan
    Write-Host "   Current URL: $WebAppUrl" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "⚡ Changes to React code will auto-refresh the browser" -ForegroundColor Yellow
Write-Host "⚡ Changes to Python code will auto-restart the backend" -ForegroundColor Yellow
Write-Host "⚡ Changes to bot code will auto-restart the bot" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Wait for user to press Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($backendProcess) { $backendProcess.Kill() }
    if ($reactProcess) { $reactProcess.Kill() }
    if ($botProcess) { $botProcess.Kill() }
}