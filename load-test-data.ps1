# Load test data into CNC Shop Floor database (Windows PowerShell)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Load Test Data into V2 Database      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Find database container
$DB_CONTAINER = docker ps --filter "name=db" --format "{{.Names}}" | Select-Object -First 1
if (-not $DB_CONTAINER) {
    $DB_CONTAINER = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
}

if (-not $DB_CONTAINER) {
    Write-Host "Error: Could not find database container!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found database container: $DB_CONTAINER" -ForegroundColor Green
Write-Host ""

# Copy test data file to container
Write-Host "Loading test data..." -ForegroundColor Yellow
docker cp backend/db/test-data.sql "${DB_CONTAINER}:/tmp/test-data.sql"

# Execute test data
$result = docker exec $DB_CONTAINER psql -U postgres -d cnc_shop_floor -f /tmp/test-data.sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Test data loaded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Materials added:" -ForegroundColor Cyan
    Write-Host "  • Aluminum 6061 (150 meters in stock)"
    Write-Host "  • Steel Mild (200 kg in stock)"
    Write-Host "  • Brass Rod (80 meters in stock)"
    Write-Host "  • Plastic Acrylic (120 sheets in stock)"
    Write-Host "  • Copper Pipe (60 meters in stock)"
    Write-Host "  • Stainless 316 (100 kg in stock)"
    Write-Host "  • Titanium Grade 5 (25 kg in stock)"
    Write-Host "  • Aluminum 7075 (110 kg in stock)"
    Write-Host ""
    Write-Host "You can now:" -ForegroundColor Cyan
    Write-Host "  1. Go to create-order.html"
    Write-Host "  2. Create a new order"
    Write-Host "  3. Add parts and select materials"
    Write-Host "  4. Materials will show in dropdown with stock levels"
    Write-Host ""
} else {
    Write-Host "❌ Failed to load test data!" -ForegroundColor Red
    Write-Host $result
    exit 1
}
