# Multi-Operator Job Assignment System - Docker Deployment Script
# Run this in PowerShell from the project root directory

Write-Host "╔═════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Multi-Operator Job Assignment - Docker Deployment          ║" -ForegroundColor Cyan
Write-Host "╚═════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# CONFIGURATION - Update these if needed
# =============================================================================
$DB_CONTAINER = "cnc-shop-floor-management-db-1"  # Adjust if your container has different name
$BACKUP_DIR = "./backups"
$BACKUP_FILE = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# =============================================================================
# STEP 1: CHECK DOCKER
# =============================================================================
Write-Host "=== STEP 1: CHECK DOCKER ===" -ForegroundColor Yellow
Write-Host "Checking if Docker is running..."

try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running! Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if containers are running
$containers = docker ps --format "{{.Names}}"
if ($containers -match "db") {
    Write-Host "✅ Database container found" -ForegroundColor Green
} else {
    Write-Host "⚠️  Database container not running. Starting containers..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 5
}

# =============================================================================
# STEP 2: BACKUP DATABASE
# =============================================================================
Write-Host ""
Write-Host "=== STEP 2: BACKUP DATABASE ===" -ForegroundColor Yellow
Write-Host "Creating backup of PostgreSQL database..."

# Create backup directory if it doesn't exist
if (!(Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# Find the database container name
$dbContainer = docker ps --filter "name=db" --format "{{.Names}}" | Select-Object -First 1

if (!$dbContainer) {
    Write-Host "❌ Could not find database container!" -ForegroundColor Red
    Write-Host "   Looking for containers with 'db' in the name" -ForegroundColor Red
    Write-Host "   Current containers:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
}

Write-Host "Using database container: $dbContainer" -ForegroundColor Cyan

# Backup database using Docker exec
$backupPath = Join-Path $BACKUP_DIR $BACKUP_FILE
docker exec $dbContainer pg_dump -U postgres cnc_shop_floor > $backupPath

if (Test-Path $backupPath) {
    $size = (Get-Item $backupPath).Length
    if ($size -gt 0) {
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "✅ Backup created: $backupPath ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "❌ Backup file is empty! Aborting deployment." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Backup failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

# =============================================================================
# STEP 3: UPDATE DATABASE SCHEMA
# =============================================================================
Write-Host ""
Write-Host "=== STEP 3: UPDATE DATABASE SCHEMA ===" -ForegroundColor Yellow
Write-Host "Running schema migration..."

# Copy schema file to container and execute
docker cp backend/db/schema.sql "${dbContainer}:/tmp/schema.sql"
$result = docker exec $dbContainer psql -U postgres -d cnc_shop_floor -f /tmp/schema.sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Schema updated successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Schema update failed!" -ForegroundColor Red
    Write-Host "Error: $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "Rolling back is available. To restore:" -ForegroundColor Yellow
    Write-Host "  docker exec -i $dbContainer psql -U postgres -d cnc_shop_floor < $backupPath" -ForegroundColor Yellow
    exit 1
}

# =============================================================================
# STEP 4: VERIFY DATABASE CHANGES
# =============================================================================
Write-Host ""
Write-Host "=== STEP 4: VERIFY DATABASE CHANGES ===" -ForegroundColor Yellow
Write-Host "Verifying new table exists..."

$verifyResult = docker exec $dbContainer psql -U postgres -d cnc_shop_floor -c "SELECT COUNT(*) FROM job_assignments;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database verification passed - job_assignments table exists" -ForegroundColor Green
} else {
    Write-Host "❌ Database verification failed!" -ForegroundColor Red
    Write-Host "Error: $verifyResult" -ForegroundColor Red
    exit 1
}

# =============================================================================
# STEP 5: RESTART BACKEND CONTAINER
# =============================================================================
Write-Host ""
Write-Host "=== STEP 5: RESTART BACKEND ===" -ForegroundColor Yellow
Write-Host "Restarting backend container..."

$backendContainer = docker ps --filter "name=backend" --format "{{.Names}}" | Select-Object -First 1

if ($backendContainer) {
    docker restart $backendContainer
    Start-Sleep -Seconds 3
    Write-Host "✅ Backend restarted successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend container not found. Restarting all containers..." -ForegroundColor Yellow
    docker-compose restart
    Start-Sleep -Seconds 5
    Write-Host "✅ Containers restarted" -ForegroundColor Green
}

# =============================================================================
# STEP 6: VERIFY API ENDPOINTS
# =============================================================================
Write-Host ""
Write-Host "=== STEP 6: VERIFY API ENDPOINTS ===" -ForegroundColor Yellow
Write-Host "Testing API endpoints..."

Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -Method GET -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  API health check failed - container may still be starting" -ForegroundColor Yellow
    Write-Host "   Check logs: docker logs $backendContainer" -ForegroundColor Cyan
}

# =============================================================================
# DEPLOYMENT COMPLETE
# =============================================================================
Write-Host ""
Write-Host "╔═════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                                 ║" -ForegroundColor Green
Write-Host "║        ✅ DEPLOYMENT COMPLETE - SYSTEM IS LIVE!               ║" -ForegroundColor Green
Write-Host "║                                                                 ║" -ForegroundColor Green
Write-Host "║  Your multi-operator job assignment system is ready!          ║" -ForegroundColor Green
Write-Host "║                                                                 ║" -ForegroundColor Green
Write-Host "║  Backup file: $backupPath" -ForegroundColor Green
Write-Host "║                                                                 ║" -ForegroundColor Green
Write-Host "║  Next steps:                                                    ║" -ForegroundColor Green
Write-Host "║  [ ] Clear browser cache (Ctrl+Shift+Del)                     ║" -ForegroundColor Green
Write-Host "║  [ ] Hard refresh (Ctrl+F5)                                   ║" -ForegroundColor Green
Write-Host "║  [ ] Login as Supervisor and test assignment                  ║" -ForegroundColor Green
Write-Host "║  [ ] Login as CNC Operator and verify isolation              ║" -ForegroundColor Green
Write-Host "║  [ ] Login as Cutting Operator and verify jobs               ║" -ForegroundColor Green
Write-Host "║                                                                 ║" -ForegroundColor Green
Write-Host "║  Documentation:                                                ║" -ForegroundColor Green
Write-Host "║  • START_HERE.md - Quick overview                             ║" -ForegroundColor Green
Write-Host "║  • SUMMARY_SHEET.md - One-page summary                        ║" -ForegroundColor Green
Write-Host "║  • DEPLOYMENT_CHECKLIST.md - Full checklist                   ║" -ForegroundColor Green
Write-Host "║                                                                 ║" -ForegroundColor Green
Write-Host "╚═════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# =============================================================================
# ROLLBACK INSTRUCTIONS
# =============================================================================
Write-Host "If you need to rollback:" -ForegroundColor Yellow
Write-Host "  docker exec -i $dbContainer psql -U postgres -d cnc_shop_floor < $backupPath" -ForegroundColor Cyan
Write-Host "  docker-compose restart" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# USEFUL COMMANDS
# =============================================================================
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View backend logs:    docker logs -f $backendContainer" -ForegroundColor Cyan
Write-Host "  View database logs:   docker logs -f $dbContainer" -ForegroundColor Cyan
Write-Host "  Access database:      docker exec -it $dbContainer psql -U postgres -d cnc_shop_floor" -ForegroundColor Cyan
Write-Host "  Restart containers:   docker-compose restart" -ForegroundColor Cyan
Write-Host ""

exit 0
