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

function Update-EnvFile {
    param([string]$ApiUrl)
    $envPath = Join-Path $PWD "frontend\.env"
    $content = "REACT_APP_API_URL=$ApiUrl`n"
    Set-Content $envPath $content -NoNewline
    Write-Host "✅ Created frontend/.env with REACT_APP_API_URL = $ApiUrl" -ForegroundColor Green
}

function Get-NgrokUrl {
    param([int]$TargetPort)
    $maxAttempts = 30
    $attempt = 0
    
    Write-Host "Waiting for ngrok to start on port $TargetPort..." -ForegroundColor Yellow
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction SilentlyContinue
            # Get ALL tunnels and find the one for our port
            $tunnels = $response.tunnels | Where-Object { $_.config.addr -like "*$TargetPort*" -and $_.proto -eq "https" }
            if ($tunnels) {
                # Return the most recent one
                $tunnel = $tunnels | Select-Object -First 1
                if ($tunnel -and $tunnel.public_url) {
                    return $tunnel.public_url
                }
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
    
    # Start ngrok for Backend API FIRST (port 8000)
    Write-Host "Starting ngrok for Backend API on port $Port..." -ForegroundColor Green
    $ngrokBackendCmd = "ngrok http $Port"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokBackendCmd
    
    Start-Sleep -Seconds 5
    
    # Get backend ngrok URL
    $backendNgrokUrl = Get-NgrokUrl -TargetPort $Port
    
    if ($backendNgrokUrl) {
        Write-Host "✅ Backend API accessible at: $backendNgrokUrl" -ForegroundColor Green
        
        # Create .env file for React with BACKEND URL
        Update-EnvFile -ApiUrl $backendNgrokUrl
        
        # Start ngrok for React port (different subdomain will be assigned)
        Write-Host "Starting ngrok for React on port $ReactPort..." -ForegroundColor Green
        $ngrokReactCmd = "ngrok http $ReactPort"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokReactCmd
        
        Start-Sleep -Seconds 5
        
        # Get React ngrok URL (this will be a DIFFERENT URL)
        $reactNgrokUrl = Get-NgrokUrl -TargetPort $ReactPort
        
        if ($reactNgrokUrl) {
            $WebAppUrl = $reactNgrokUrl
            Write-Host "✅ React accessible at: $WebAppUrl" -ForegroundColor Green
            Write-Host ""
            Write-Host "⚠️ TWO DIFFERENT URLs:" -ForegroundColor Yellow
            Write-Host "   🌐 REACT APP URL (share this): $WebAppUrl" -ForegroundColor Cyan
            Write-Host "   🔌 BACKEND API URL (internal): $backendNgrokUrl" -ForegroundColor Cyan
            Write-Host ""
            
            # Update config.py with React URL (for bot's WebApp button)
            Update-ConfigUrl -Url $WebAppUrl
        } else {
            Write-Host "⚠️ Could not auto-detect React ngrok URL." -ForegroundColor Yellow
            $WebAppUrl = Read-Host "Enter React ngrok HTTPS URL"
            Update-ConfigUrl -Url $WebAppUrl
        }
    } else {
        Write-Host "⚠️ Could not auto-detect Backend ngrok URL." -ForegroundColor Yellow
        $WebAppUrl = "http://localhost:3000"
        Write-Host "Using localhost for React" -ForegroundColor Yellow
    }
} else {
    $WebAppUrl = "http://localhost:3000"
    Write-Host "Using React dev server at: $WebAppUrl (local only)" -ForegroundColor Yellow
}

# Set environment variable for web_server to detect dev mode
$env:WEB_APP_URL = $WebAppUrl

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BACKEND API: http://localhost:$Port" -ForegroundColor Yellow
Write-Host "REACT DEV: http://localhost:$ReactPort" -ForegroundColor Yellow
if ($UseNgrok) {
    Write-Host ""
    Write-Host "🌐 SHARE REACT URL WITH OTHER USERS:" -ForegroundColor Green
    Write-Host "   $WebAppUrl" -ForegroundColor Yellow
    Write-Host ""
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
Write-Host "⚡ React hot reload enabled" -ForegroundColor Yellow
Write-Host "⚡ Backend auto-reload enabled" -ForegroundColor Yellow
Write-Host "⚡ Bot auto-reload enabled" -ForegroundColor Yellow
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