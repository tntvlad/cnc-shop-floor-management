#!/usr/bin/env bash
# CNC Shop Floor Management - Schema Migration to V2
# This script applies the new comprehensive schema

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  CNC Shop Floor Management - Schema Migration to V2      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Find database container
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$DB_CONTAINER" ]; then
    echo -e "${RED}❌ Could not find database container!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found database container: $DB_CONTAINER${NC}"
echo ""

# Backup current database
BACKUP_DIR="./backups"
BACKUP_FILE="backup_before_v2_$(date +%Y%m%d_%H%M%S).sql"

mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Creating backup...${NC}"
docker exec "$DB_CONTAINER" pg_dump -U postgres cnc_shop_floor > "$BACKUP_DIR/$BACKUP_FILE"

if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup created: $BACKUP_DIR/$BACKUP_FILE ($BACKUP_SIZE)${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  WARNING: This will DROP ALL EXISTING TABLES and create new schema${NC}"
echo -e "${YELLOW}   Your test data will be lost (but backed up above)${NC}"
echo ""
read -p "Continue with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Applying new schema...${NC}"

# Copy new schema to container
docker cp backend/db/schema-v2-complete.sql "$DB_CONTAINER:/tmp/schema-v2.sql"

# Apply schema
if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/schema-v2.sql; then
    echo -e "${GREEN}✓ Schema V2 applied successfully${NC}"
else
    echo -e "${RED}❌ Schema migration failed!${NC}"
    echo -e "${YELLOW}To rollback:${NC}"
    echo -e "${CYAN}  cat $BACKUP_DIR/$BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d cnc_shop_floor${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ MIGRATION COMPLETE                                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}New features available:${NC}"
echo -e "  • Orders with customer management"
echo -e "  • Material stock & ordering system"
echo -e "  • 6 Machines tracked (5 mills, 1 lathe)"
echo -e "  • Quality control checklists"
echo -e "  • Operator skills/certifications"
echo -e "  • Tool inventory management"
echo -e "  • Scrap tracking"
echo -e "  • Notifications system"
echo -e "  • Shipment tracking"
echo -e "  • Cost tracking per part"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. Restart backend: docker-compose restart backend"
echo -e "  2. Clear browser cache (Ctrl+Shift+Delete)"
echo -e "  3. Hard refresh (Ctrl+F5)"
echo -e "  4. Login with: ADMIN001 / admin123"
echo ""
echo -e "${YELLOW}Backup location: $BACKUP_DIR/$BACKUP_FILE${NC}"
echo ""
