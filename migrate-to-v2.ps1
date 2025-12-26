# CNC Shop Floor Management - Schema Migration to V2 (PowerShell)
# This script applies the new comprehensive schema

$ErrorActionPreference = "Stop"

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  CNC Shop Floor Management - Schema Migration to V2      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Find database container
$DB_CONTAINER = docker ps --filter "name=db" --format "{{.Names}}" | Select-Object -First 1
if (-not $DB_CONTAINER) {
    $DB_CONTAINER = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
}

if (-not $DB_CONTAINER) {
    Write-Host "❌ Could not find database container!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found database container: $DB_CONTAINER" -ForegroundColor Green
Write-Host ""

# Backup current database
$BACKUP_DIR = ".\backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "backup_before_v2_$timestamp.sql"

if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

Write-Host "Creating backup..." -ForegroundColor Yellow
docker exec $DB_CONTAINER pg_dump -U postgres cnc_shop_floor | Out-File -FilePath "$BACKUP_DIR\$BACKUP_FILE" -Encoding utf8

if (Test-Path "$BACKUP_DIR\$BACKUP_FILE") {
    $size = (Get-Item "$BACKUP_DIR\$BACKUP_FILE").Length / 1KB
    Write-Host "✓ Backup created: $BACKUP_DIR\$BACKUP_FILE ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "❌ Backup failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⚠️  WARNING: This will DROP ALL EXISTING TABLES and create new schema" -ForegroundColor Yellow
Write-Host "   Your test data will be lost (but backed up above)" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Continue with migration? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Migration cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Applying new schema..." -ForegroundColor Yellow

# Copy new schema to container
docker cp backend/db/schema-v2-complete.sql "${DB_CONTAINER}:/tmp/schema-v2.sql"

# Apply schema
$result = docker exec $DB_CONTAINER psql -U postgres -d cnc_shop_floor -f /tmp/schema-v2.sql 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Schema V2 applied successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Schema migration failed!" -ForegroundColor Red
    Write-Host "To rollback:" -ForegroundColor Yellow
    Write-Host "  Get-Content $BACKUP_DIR\$BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d cnc_shop_floor" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ MIGRATION COMPLETE                                     ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "New features available:" -ForegroundColor Green
Write-Host "  • Orders with customer management"
Write-Host "  • Material stock & ordering system"
Write-Host "  • 6 Machines tracked (5 mills, 1 lathe)"
Write-Host "  • Quality control checklists"
Write-Host "  • Operator skills/certifications"
Write-Host "  • Tool inventory management"
Write-Host "  • Scrap tracking"
Write-Host "  • Notifications system"
Write-Host "  • Shipment tracking"
Write-Host "  • Cost tracking per part"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart backend: docker-compose restart backend"
Write-Host "  2. Clear browser cache (Ctrl+Shift+Delete)"
Write-Host "  3. Hard refresh (Ctrl+F5)"
Write-Host "  4. Login with: ADMIN001 / admin123"
Write-Host ""
Write-Host "Backup location: $BACKUP_DIR\$BACKUP_FILE" -ForegroundColor Yellow
Write-Host ""
