param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000,
    [string]$WebAppUrl = "",
    [switch]$UseNgrok,
    [switch]$UseBore
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

function Get-BoreUrl {
    $maxAttempts = 35
    $attempt = 0
    
    Write-Host "Waiting for bore to start..." -ForegroundColor Yellow
    
    while ($attempt -lt $maxAttempts) {
        # Check for bore process and try to find the URL from the window title or ask user
        $boreProcess = Get-Process -Name "bore*" -ErrorAction SilentlyContinue
        if ($boreProcess) {
            # Give it a moment to fully start
            Start-Sleep -Seconds 2
            Write-Host ""
            Write-Host "⚠️  Check the bore window that just opened" -ForegroundColor Yellow
            Write-Host "Look for: listening at bore.pub:XXXXX" -ForegroundColor Cyan
            Write-Host ""
            $portNumber = Read-Host "Enter the port number from bore (e.g., 33963)"
            if ($portNumber -match '^\d+$') {
                return "https://bore.pub:$portNumber"
            }
        }
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    Write-Host ""
    return $null
}

Write-Host "=== Digital Unity Local Runner ===" -ForegroundColor Cyan

if (-not (Test-Path ".\main.py")) {
    Write-Host "Error: run this script from project root (main.py not found)." -ForegroundColor Red
    exit 1
}

if (-not (Test-CommandExists "python")) {
    Write-Host "Error: python is not available in PATH." -ForegroundColor Red
    exit 1
}

# Start tunnel and auto-detect URL
if ($UseNgrok) {
    if (-not (Test-CommandExists "ngrok")) {
        Write-Host "Error: ngrok not found in PATH. Please install ngrok first." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Starting ngrok on port $Port..." -ForegroundColor Green
    $ngrokCmd = "cd `"$PWD`"; ngrok http $Port"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokCmd
    
    Write-Host "Waiting for ngrok to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    $detectedUrl = Get-NgrokUrl
    
    if ($detectedUrl) {
        $WebAppUrl = $detectedUrl
        Write-Host ""
        Write-Host "✅ Auto-detected ngrok URL: $WebAppUrl" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "⚠️ Could not auto-detect ngrok URL." -ForegroundColor Yellow
        $WebAppUrl = Read-Host "Enter ngrok HTTPS URL"
    }
}
elseif ($UseBore) {
    $boreCommand = ".\bore.exe"
    if (-not (Test-Path $boreCommand)) {
        $boreInPath = Test-CommandExists "bore"
        if (-not $boreInPath) {
            Write-Host "Error: bore.exe not found. Place bore.exe in project root." -ForegroundColor Red
            exit 1
        }
        $boreCommand = "bore"
    }

    Write-Host "Starting bore tunnel on port $Port..." -ForegroundColor Green
    $boreCmd = "cd `"$PWD`"; $boreCommand local $Port --to bore.pub"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $boreCmd
    
    Start-Sleep -Seconds 3
    $detectedUrl = Get-BoreUrl
    
    if ($detectedUrl) {
        $WebAppUrl = $detectedUrl
        Write-Host ""
        Write-Host "✅ Auto-detected bore URL: $WebAppUrl" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "⚠️ Could not auto-detect bore URL." -ForegroundColor Yellow
        $WebAppUrl = Read-Host "Enter bore HTTPS URL (e.g. https://bore.pub:12345)"
    }
}

# If still no URL, use localhost
if ([string]::IsNullOrWhiteSpace($WebAppUrl)) {
    $WebAppUrl = "http://127.0.0.1:$Port"
    Write-Host "⚠️ Using local HTTP URL. Will NOT work in Telegram Mini App!" -ForegroundColor Red
}

# Update config.py with the URL
Update-ConfigUrl -Url $WebAppUrl

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WEB_APP_URL = $WebAppUrl" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting services..." -ForegroundColor Green

# Start FastAPI web server
$webCmd = "cd `"$PWD`"; python -m uvicorn web_server:app --host $HostAddress --port $Port --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd
Write-Host "✅ Web server started on port $Port" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start bot
Write-Host "Starting bot..." -ForegroundColor Green
python main.py

Write-Host "All services stopped." -ForegroundColor Yellow