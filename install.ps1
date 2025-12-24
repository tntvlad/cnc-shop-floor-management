# CNC Shop Floor Management - Installation Script
# PowerShell installation script for Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CNC Shop Floor Management - Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Docker
if (Test-CommandExists docker) {
    $dockerVersion = docker --version
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Docker not found. Please install Docker Desktop." -ForegroundColor Red
    Write-Host "  Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check Docker Compose
if (Test-CommandExists docker-compose) {
    $composeVersion = docker-compose --version
    Write-Host "✓ Docker Compose found: $composeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Compose not found." -ForegroundColor Red
    exit 1
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (Test-Path ".env") {
    Write-Host "Found existing .env file." -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Using existing .env file." -ForegroundColor Green
    } else {
        Copy-Item ".env.example" ".env" -Force
        Write-Host "✓ Created new .env file from template" -ForegroundColor Green
    }
} else {
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
}

Write-Host ""

# Prompt for custom configuration
Write-Host "Configure your installation (press Enter to use defaults):" -ForegroundColor Yellow
Write-Host ""

# Database password
$dbPassword = Read-Host "Database Password (default: changeme)"
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    $dbPassword = "changeme"
}

# JWT Secret
Write-Host ""
$jwtSecret = Read-Host "JWT Secret (default: random generated)"
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Write-Host "Generated JWT Secret: $jwtSecret" -ForegroundColor Gray
}

# Frontend Port
Write-Host ""
$frontendPort = Read-Host "Frontend Port (default: 3000)"
if ([string]::IsNullOrWhiteSpace($frontendPort)) {
    $frontendPort = "3000"
}

# Backend Port
Write-Host ""
$backendPort = Read-Host "Backend Port (default: 5000)"
if ([string]::IsNullOrWhiteSpace($backendPort)) {
    $backendPort = "5000"
}

# Database Port
Write-Host ""
$dbPort = Read-Host "Database Port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($dbPort)) {
    $dbPort = "5432"
}

# Update .env file
Write-Host ""
Write-Host "Updating configuration..." -ForegroundColor Yellow

$envContent = Get-Content ".env" -Raw
$envContent = $envContent -replace 'DB_PASSWORD=.*', "DB_PASSWORD=$dbPassword"
$envContent = $envContent -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret"
$envContent = $envContent -replace 'FRONTEND_PORT:-3000', "FRONTEND_PORT:-$frontendPort"
$envContent = $envContent -replace 'BACKEND_PORT:-5000', "BACKEND_PORT:-$backendPort"
$envContent = $envContent -replace 'DB_PORT:-5432', "DB_PORT:-$dbPort"
Set-Content ".env" $envContent

Write-Host "✓ Configuration updated" -ForegroundColor Green
Write-Host ""

# Check if containers are already running
$runningContainers = docker ps --filter "name=cnc-" --format "{{.Names}}"
if ($runningContainers) {
    Write-Host "Found running CNC containers. Stopping them..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "✓ Stopped existing containers" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Building Docker images (this may take a few minutes)..." -ForegroundColor Yellow
docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Build failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build completed successfully" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting containers..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Failed to start services. Please check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Services started successfully" -ForegroundColor Green
Write-Host ""

# Wait for services to be healthy
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Checking service status..." -ForegroundColor Yellow
docker-compose ps

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Access your application at:" -ForegroundColor White
Write-Host "  Frontend: http://localhost:$frontendPort" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:$backendPort" -ForegroundColor Cyan
Write-Host ""

Write-Host "Default Login Credentials:" -ForegroundColor White
Write-Host "  Employee ID: ADMIN001" -ForegroundColor Cyan
Write-Host "  Password: admin123" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  IMPORTANT: Change the default password after first login!" -ForegroundColor Yellow
Write-Host ""

Write-Host "Useful Commands:" -ForegroundColor White
Write-Host "  View logs:        docker-compose logs -f" -ForegroundColor Gray
Write-Host "  Stop services:    docker-compose down" -ForegroundColor Gray
Write-Host "  Start services:   docker-compose up -d" -ForegroundColor Gray
Write-Host "  Restart services: docker-compose restart" -ForegroundColor Gray
Write-Host "  Check status:     docker-compose ps" -ForegroundColor Gray
Write-Host ""

Write-Host "For more information, see README.md" -ForegroundColor White
Write-Host ""

# Ask if user wants to open the application
$openBrowser = Read-Host "Open application in browser? (Y/n)"
if ($openBrowser -ne "n" -and $openBrowser -ne "N") {
    Start-Process "http://localhost:$frontendPort"
}

Write-Host "Installation script completed successfully!" -ForegroundColor Green
