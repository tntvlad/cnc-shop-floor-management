# CNC Shop Floor Management - Uninstall Script (Windows)
# This script removes the Docker containers, volumes, and application data

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "CNC Shop Floor Management - Uninstall Script" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Check if docker-compose.yml exists
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "Error: docker-compose.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory."
    exit 1
}

Write-Host "WARNING: This will remove all Docker containers and optionally delete data." -ForegroundColor Yellow
Write-Host ""

# Confirm uninstall
$confirm = Read-Host "Do you want to continue with the uninstall? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Uninstall cancelled."
    exit 0
}

Write-Host ""
Write-Host "Stopping and removing Docker containers..."
docker-compose down

Write-Host "✓ Containers stopped and removed" -ForegroundColor Green
Write-Host ""

# Ask about removing volumes
$removeVolumes = Read-Host "Do you want to remove all data volumes? (yes/no)"
if ($removeVolumes -eq "yes") {
    Write-Host "Removing volumes..."
    docker-compose down -v
    Write-Host "✓ Volumes removed" -ForegroundColor Green
} else {
    Write-Host "Keeping data volumes for potential recovery."
}

Write-Host ""

# Ask about removing images
$removeImages = Read-Host "Do you want to remove Docker images? (yes/no)"
if ($removeImages -eq "yes") {
    Write-Host "Removing Docker images..."
    docker image rm cnc-backend cnc-frontend 2>$null | Out-Null
    docker image rm "postgres:15-alpine" 2>$null | Out-Null
    docker image rm "nginx:alpine" 2>$null | Out-Null
    Write-Host "✓ Images removed" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Uninstall Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To completely remove the installation on Linux/Mac:"
Write-Host "  rm -rf /DATA/AppData/cnc-shop-floor-management"
Write-Host ""
Write-Host "To reinstall, run:"
Write-Host "  git clone https://github.com/tntvlad/cnc-shop-floor-management.git"
Write-Host "  cd cnc-shop-floor-management"
Write-Host "  bash install.sh"
