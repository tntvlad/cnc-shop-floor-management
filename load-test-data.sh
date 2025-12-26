#!/usr/bin/env bash
# Load test data into CNC Shop Floor database

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Load Test Data into V2 Database      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Find database container
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$DB_CONTAINER" ]; then
    echo "Error: Could not find database container!"
    exit 1
fi

echo -e "${GREEN}✓ Found database container: $DB_CONTAINER${NC}"
echo ""

# Copy test data file to container
echo -e "${YELLOW}Loading test data...${NC}"
docker cp backend/db/test-data.sql "$DB_CONTAINER:/tmp/test-data.sql"

# Execute test data
if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/test-data.sql; then
    echo -e "${GREEN}✅ Test data loaded successfully!${NC}"
    echo ""
    echo -e "${CYAN}Materials added:${NC}"
    echo "  • Aluminum 6061 (150 meters in stock)"
    echo "  • Steel Mild (200 kg in stock)"
    echo "  • Brass Rod (80 meters in stock)"
    echo "  • Plastic Acrylic (120 sheets in stock)"
    echo "  • Copper Pipe (60 meters in stock)"
    echo "  • Stainless 316 (100 kg in stock)"
    echo "  • Titanium Grade 5 (25 kg in stock)"
    echo "  • Aluminum 7075 (110 kg in stock)"
    echo ""
    echo -e "${CYAN}You can now:${NC}"
    echo "  1. Go to create-order.html"
    echo "  2. Create a new order"
    echo "  3. Add parts and select materials"
    echo "  4. Materials will show in dropdown with stock levels"
    echo ""
else
    echo -e "${RED}❌ Failed to load test data!${NC}"
    exit 1
fi
