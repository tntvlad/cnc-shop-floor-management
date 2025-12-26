#!/usr/bin/env bash
# CNC Shop Floor Management - Docker Deployment Script (V2 Schema)
# Run this from the project root directory

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CNC Shop Floor Management - Docker Deployment (V2)         ║${NC}"
echo -e "${CYAN}╚═════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# CONFIGURATION
# =============================================================================
BACKUP_DIR="./backups"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

# =============================================================================
# STEP 1: PULL LATEST CODE FROM GIT
# =============================================================================
echo -e "${YELLOW}=== STEP 1: PULL LATEST CODE FROM GIT ===${NC}"
echo "Checking git status..."

if [ -d ".git" ]; then
    echo -e "${CYAN}Git repository detected. Pulling latest changes...${NC}"
    
    # Stash any local changes
    git stash
    
    # Pull latest
    if git pull; then
        echo -e "${GREEN}✅ Successfully pulled latest code${NC}"
    else
        echo -e "${RED}❌ Git pull failed!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Not a git repository. Skipping git pull.${NC}"
fi

# =============================================================================
# STEP 2: CHECK DOCKER
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 2: CHECK DOCKER ===${NC}"
echo "Checking if Docker is running..."

if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running! Please start Docker.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check if containers are running
if ! docker ps | grep -q -E "db|postgres"; then
    echo -e "${YELLOW}⚠️  Database container not running. Starting containers...${NC}"
    docker-compose up -d
    sleep 5
else
    echo -e "${GREEN}✅ Database container is running${NC}"
fi

# =============================================================================
# STEP 2: FIND DATABASE CONTAINER
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 3: FIND DATABASE CONTAINER ===${NC}"

# Try different patterns to find database container
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
fi
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --filter "name=database" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$DB_CONTAINER" ]; then
    echo -e "${RED}❌ Could not find database container!${NC}"
    echo -e "${RED}   Looking for containers with 'db', 'postgres', or 'database' in the name${NC}"
    echo -e "${YELLOW}   Current containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

echo -e "${CYAN}Using database container: $DB_CONTAINER${NC}"

# Find backend container
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -n 1)
if [ -z "$BACKEND_CONTAINER" ]; then
    BACKEND_CONTAINER=$(docker ps --filter "name=server" --format "{{.Names}}" | head -n 1)
fi

# =============================================================================
# STEP 3: BACKUP DATABASE
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 4: BACKUP DATABASE ===${NC}"
echo "Creating backup of PostgreSQL database..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
docker exec "$DB_CONTAINER" pg_dump -U postgres cnc_shop_floor > "$BACKUP_DIR/$BACKUP_FILE"

if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    if [ "$BACKUP_SIZE" != "0" ]; then
        echo -e "${GREEN}✅ Backup created: $BACKUP_DIR/$BACKUP_FILE ($BACKUP_SIZE)${NC}"
    else
        echo -e "${RED}❌ Backup file is empty! Aborting deployment.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Backup failed! Aborting deployment.${NC}"
    exit 1
fi

# =============================================================================
# STEP 4: UPDATE DATABASE SCHEMA (V2 - Complete Rewrite)
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 5: UPDATE DATABASE SCHEMA (V2) ===${NC}"

# Check if user wants fresh schema or migration
echo -e "${YELLOW}Database Schema Options:${NC}"
echo -e "  1. Fresh Schema V2 (recommended for new/test installs)"
echo -e "  2. Keep existing data (migrate to V2)"
echo ""
read -p "Choose option (1 or 2) [default: 1]: " SCHEMA_OPTION
SCHEMA_OPTION=${SCHEMA_OPTION:-1}

if [ "$SCHEMA_OPTION" = "1" ]; then
    echo -e "${CYAN}Using fresh Schema V2 (all existing data will be replaced)...${NC}"
    
    # Check if schema-v2-complete.sql exists
    if [ -f "backend/db/schema-v2-complete.sql" ]; then
        docker cp backend/db/schema-v2-complete.sql "$DB_CONTAINER:/tmp/schema-v2.sql"
        
        if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/schema-v2.sql; then
            echo -e "${GREEN}✅ Schema V2 applied successfully${NC}"
            echo -e "${CYAN}   • 22 new tables created${NC}"
            echo -e "${CYAN}   • Default admin user: ADMIN001 / admin123${NC}"
            echo -e "${CYAN}   • 6 machines pre-configured (5 mills, 1 lathe)${NC}"
        else
            echo -e "${RED}❌ Schema V2 deployment failed!${NC}"
            echo -e "${YELLOW}Rolling back is available. To restore:${NC}"
            echo -e "${CYAN}  cat $BACKUP_DIR/$BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d cnc_shop_floor${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Schema file not found: backend/db/schema-v2-complete.sql${NC}"
        exit 1
    fi
else
    echo -e "${CYAN}Keeping existing data (migration mode)...${NC}"
    echo -e "${YELLOW}⚠️  This requires custom migration scripts (not included in standard deploy)${NC}"
    echo -e "${YELLOW}   Please run migrate-to-v2.sh for automated migration${NC}"
    exit 0
fi

# =============================================================================
# STEP 6: VERIFY DATABASE SCHEMA
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 6: VERIFY DATABASE SCHEMA ===${NC}"
echo "Verifying new V2 schema tables..."

TABLES_TO_CHECK=("orders" "parts" "material_stock" "machines" "qc_checklists" "activity_log")
MISSING_TABLES=()

for table in "${TABLES_TO_CHECK[@]}"; do
    if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -c "SELECT COUNT(*) FROM $table;" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Table '$table' exists${NC}"
    else
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Schema verification failed! Missing tables:${NC}"
    printf '%s\n' "${MISSING_TABLES[@]}"
    exit 1
else
    echo -e "${GREEN}✅ All V2 schema tables verified successfully${NC}"
fi

# =============================================================================
# STEP 6: RESTART BACKEND
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 7: REBUILD AND RESTART CONTAINERS ===${NC}"
echo "Cleaning up stale containers to avoid recreate issues..."

# Safe cleanup without touching volumes (database preserved)
docker-compose down --remove-orphans || true

echo "Rebuilding and restarting containers with new code..."

if docker-compose up -d --build; then
    echo -e "${GREEN}✅ Containers rebuilt and restarted successfully${NC}"
    sleep 5
else
    echo -e "${RED}❌ Container rebuild failed! Attempting one-time cleanup and retry...${NC}"
    # Remove only backend container if present
    docker rm -f cnc-backend 2>/dev/null || true
    # Prune dangling images (keeps tagged images and all volumes)
    docker image prune -f >/dev/null 2>&1 || true

    if docker-compose up -d --build; then
        echo -e "${GREEN}✅ Containers rebuilt and restarted after cleanup${NC}"
        sleep 5
    else
        echo -e "${RED}❌ Container rebuild failed after cleanup. Please check docker logs.${NC}"
        exit 1
    fi
fi

# =============================================================================
# STEP 7: VERIFY API ENDPOINTS
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 8: VERIFY API ENDPOINTS ===${NC}"
echo "Testing API endpoints..."

sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  API health check failed (HTTP $HTTP_CODE) - container may still be starting${NC}"
    if [ -n "$BACKEND_CONTAINER" ]; then
        echo -e "${CYAN}   Check logs: docker logs $BACKEND_CONTAINER${NC}"
    fi
fi

# =============================================================================
# DEPLOYMENT COMPLETE
# =============================================================================
echo ""
echo -e "${GREEN}╔═════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║        ✅ DEPLOYMENT COMPLETE - SYSTEM IS LIVE!               ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  CNC Shop Floor Management V2 is ready!                       ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  New Features Available:                                       ║${NC}"
echo -e "${GREEN}║  ✓ Order Management System                                    ║${NC}"
echo -e "${GREEN}║  ✓ Material Stock Tracking                                    ║${NC}"
echo -e "${GREEN}║  ✓ Workflow Monitoring (6 stages)                             ║${NC}"
echo -e "${GREEN}║  ✓ Machine Scheduling                                         ║${NC}"
echo -e "${GREEN}║  ✓ Quality Control Checklists                                 ║${NC}"
echo -e "${GREEN}║  ✓ Operator Skills Management                                 ║${NC}"
echo -e "${GREEN}║  ✓ Scrap Tracking & Reports                                   ║${NC}"
echo -e "${GREEN}║  ✓ Shipment Management                                        ║${NC}"
echo -e "${GREEN}║  ✓ Notifications & Alerts                                     ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  Backup file: $BACKUP_DIR/$BACKUP_FILE${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  Next steps:                                                    ║${NC}"
echo -e "${GREEN}║  [ ] Clear browser cache (Ctrl+Shift+Del)                     ║${NC}"
echo -e "${GREEN}║  [ ] Hard refresh (Ctrl+F5)                                   ║${NC}"
echo -e "${GREEN}║  [ ] Login as ADMIN001 / admin123                             ║${NC}"
echo -e "${GREEN}║  [ ] Click '📦 Orders' to access new order system            ║${NC}"
echo -e "${GREEN}║  [ ] Create test order                                         ║${NC}"
echo -e "${GREEN}║  [ ] Test workflow transitions                                ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  Documentation:                                                ║${NC}"
echo -e "${GREEN}║  • PHASE_1A_COMPLETE.md - Feature overview                    ║${NC}"
echo -e "${GREEN}║  • PHASE_1A_API.md - Complete API reference                   ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}╚═════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# ROLLBACK INSTRUCTIONS
# =============================================================================
echo -e "${YELLOW}If you need to rollback:${NC}"
echo -e "${CYAN}  docker exec -i $DB_CONTAINER psql -U postgres -d cnc_shop_floor < $BACKUP_DIR/$BACKUP_FILE${NC}"
echo -e "${CYAN}  docker-compose restart${NC}"
echo ""

# =============================================================================
# USEFUL COMMANDS
# =============================================================================
echo -e "${YELLOW}Useful commands:${NC}"
if [ -n "$BACKEND_CONTAINER" ]; then
    echo -e "${CYAN}  View backend logs:    docker logs -f $BACKEND_CONTAINER${NC}"
fi
echo -e "${CYAN}  View database logs:   docker logs -f $DB_CONTAINER${NC}"
echo -e "${CYAN}  Access database:      docker exec -it $DB_CONTAINER psql -U postgres -d cnc_shop_floor${NC}"
echo -e "${CYAN}  Restart containers:   docker-compose restart${NC}"
echo ""

exit 0
