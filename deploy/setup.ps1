#Requires -RunAsAdministrator
param(
    [string]$NodeVersion = "20.18.0",
    [string]$RepoUrl = "https://github.com/tu-usuario/nova-saas.git",
    [string]$Branch = "main",
    [string]$InstallDir = "C:\nova-saas",
    [string]$WebhookSecret = "",
    [string]$ViteApiUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================"
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# ============================================
# 1. Install Node.js via fnm (Fast Node Manager)
# ============================================
Write-Step "1. Installing Node.js $NodeVersion"

if (-not (Test-Command "fnm")) {
    Write-Host "Installing fnm (Fast Node Manager)..."
    $fnmZip = "$env:TEMP\fnm.zip"
    Invoke-WebRequest -Uri "https://github.com/Schniz/fnm/releases/latest/download/fnz-windows.zip" -OutFile $fnmZip
    Expand-Archive -Path $fnmZip -DestinationPath "$env:ProgramFiles\fnm" -Force
    [Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:ProgramFiles\fnm", "Machine")
    $env:Path += ";$env:ProgramFiles\fnm"
    Remove-Item $fnmZip -Force
}

fnm install $NodeVersion
fnm use $NodeVersion
fnm default $NodeVersion

node -v
npm -v

# ============================================
# 2. Install PM2 globally
# ============================================
Write-Step "2. Installing PM2 process manager"

npm install -g pm2
npm install -g serve

pm2 --version

# ============================================
# 3. Clone / Pull repository
# ============================================
Write-Step "3. Cloning repository"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

if (Test-Path "$InstallDir\.git") {
    Set-Location $InstallDir
    git fetch origin
    git reset --hard origin/$Branch
} else {
    git clone --branch $Branch $RepoUrl $InstallDir
}

Set-Location $InstallDir

# Create log directories
New-Item -ItemType Directory -Path "$InstallDir\server\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\dte-api\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\client\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\logs" -Force | Out-Null

# Create certificate directories
New-Item -ItemType Directory -Path "$InstallDir\server\certificados-p12pfx" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\server\certificados-crt" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\server\uploads" -Force | Out-Null

# ============================================
# 4. Configure environment variables
# ============================================
Write-Step "4. Configuring .env files"

# Copy .env files from templates (you need to manually edit these with real secrets)
if (-not (Test-Path "$InstallDir\server\.env")) {
    Copy-Item "$InstallDir\server\.env.tmp" "$InstallDir\server\.env" -ErrorAction SilentlyContinue
}

# Update DTE_API_URL in server .env
$serverEnv = "$InstallDir\server\.env"
if (Test-Path $serverEnv) {
    (Get-Content $serverEnv) -replace 'DTE_API_URL=.*', 'DTE_API_URL=http://localhost:5000/api' | Set-Content $serverEnv
}

# ============================================
# 5. Install dependencies
# ============================================
Write-Step "5. Installing npm dependencies"

Write-Host "Server dependencies..."
Set-Location "$InstallDir\server"
npm install

Write-Host "DTE API dependencies..."
Set-Location "$InstallDir\dte-api"
npm install

Write-Host "Client dependencies..."
Set-Location "$InstallDir\client"
npm install

Write-Host "Database dependencies..."
Set-Location "$InstallDir\database"
npm install

# Build client
Write-Host "Building client..."
$env:VITE_API_URL = $ViteApiUrl
Set-Location "$InstallDir\client"
npm run build

# ============================================
# 6. Create PM2 startup script
# ============================================
Write-Step "6. Creating PM2 startup"

Set-Location $InstallDir
pm2 start ecosystem.config.js
pm2 save

# Configure PM2 to start on boot (Windows)
pm2 startup

# ============================================
# 7. Configure Windows Firewall
# ============================================
Write-Step "7. Configuring Windows Firewall"

$ports = @(3000, 4000, 5000, 7777)
foreach ($port in $ports) {
    $ruleName = "nova-saas-port-$port"
    $exists = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $exists) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
        Write-Host "  Opened port $port"
    }
}

# ============================================
# 8. Configure webhook secret
# ============================================
Write-Step "8. Configuring webhook"

if ($WebhookSecret -ne "" -and (Test-Path "$InstallDir\ecosystem.config.js")) {
    $config = Get-Content "$InstallDir\ecosystem.config.js" -Raw
    $config = $config -replace "WEBHOOK_SECRET: 'mi-secreto-cambiame'", "WEBHOOK_SECRET: '$WebhookSecret'"
    Set-Content "$InstallDir\ecosystem.config.js" $config
    pm2 restart webhook
}

# ============================================
Write-Step "SETUP COMPLETE"
Write-Host "Services running:" -ForegroundColor Green
pm2 status
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Edit server/.env and dte-api/.env with your production secrets" -ForegroundColor Yellow
Write-Host "  2. Restart services: pm2 restart all" -ForegroundColor Yellow
Write-Host "  3. Configure GitHub webhook -> http://SERVER_IP:7777/webhook" -ForegroundColor Yellow
Write-Host "  4. Set WEBHOOK_SECRET in GitHub repo settings" -ForegroundColor Yellow
