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