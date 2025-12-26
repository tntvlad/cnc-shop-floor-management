#!/usr/bin/env bash
# Multi-Operator Job Assignment System - Docker Deployment Script
# Run this from the project root directory

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Multi-Operator Job Assignment - Docker Deployment          ║${NC}"
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
# STEP 4: UPDATE DATABASE SCHEMA
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 5: UPDATE DATABASE SCHEMA ===${NC}"
echo "Running schema migration (preserving existing data)..."

# Check if migration file exists
if [ -f "backend/db/migration-add-sequence.sql" ]; then
    echo -e "${CYAN}Using migration script to preserve users and data...${NC}"
    # Copy migration to container and execute
    docker cp backend/db/migration-add-sequence.sql "$DB_CONTAINER:/tmp/migration.sql"
    
    if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/migration.sql; then
        echo -e "${GREEN}✅ Migration completed successfully (data preserved)${NC}"
    else
        echo -e "${RED}❌ Migration failed!${NC}"
        echo -e "${YELLOW}Rolling back is available. To restore:${NC}"
        echo -e "${CYAN}  cat $BACKUP_DIR/$BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d cnc_shop_floor${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Migration script not found. Using full schema (will recreate tables)...${NC}"
    # Copy schema to container and execute
    docker cp backend/db/schema.sql "$DB_CONTAINER:/tmp/schema.sql"
    
    if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/schema.sql; then
        echo -e "${GREEN}✅ Schema updated successfully${NC}"
    else
        echo -e "${RED}❌ Schema update failed!${NC}"
        echo -e "${YELLOW}Rolling back is available. To restore:${NC}"
        echo -e "${CYAN}  cat $BACKUP_DIR/$BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d cnc_shop_floor${NC}"
        exit 1
    fi
fi

# =============================================================================
# STEP 5: VERIFY DATABASE CHANGES
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 6: VERIFY DATABASE CHANGES ===${NC}"
echo "Verifying new table exists..."

if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -c "SELECT COUNT(*) FROM job_assignments;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database verification passed - job_assignments table exists${NC}"
else
    echo -e "${RED}❌ Database verification failed!${NC}"
    exit 1
fi

# =============================================================================
# STEP 6: RESTART BACKEND
# =============================================================================
echo ""
echo -e "${YELLOW}=== STEP 7: REBUILD AND RESTART CONTAINERS ===${NC}"
echo "Rebuilding and restarting containers with new code..."

if docker-compose up -d --build; then
    echo -e "${GREEN}✅ Containers rebuilt and restarted successfully${NC}"
    sleep 5
else
    echo -e "${RED}❌ Container rebuild failed!${NC}"
    exit 1
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
echo -e "${GREEN}║  Your multi-operator job assignment system is ready!          ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  Backup file: $BACKUP_DIR/$BACKUP_FILE${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  Next steps:                                                    ║${NC}"
echo -e "${GREEN}║  [ ] Clear browser cache (Ctrl+Shift+Del)                     ║${NC}"
echo -e "${GREEN}║  [ ] Hard refresh (Ctrl+F5)                                   ║${NC}"
echo -e "${GREEN}║  [ ] Login as Supervisor and test assignment                  ║${NC}"
echo -e "${GREEN}║  [ ] Login as CNC Operator and verify isolation              ║${NC}"
echo -e "${GREEN}║  [ ] Login as Cutting Operator and verify jobs               ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  Documentation:                                                ║${NC}"
echo -e "${GREEN}║  • START_HERE.md - Quick overview                             ║${NC}"
echo -e "${GREEN}║  • SUMMARY_SHEET.md - One-page summary                        ║${NC}"
echo -e "${GREEN}║  • DEPLOYMENT_CHECKLIST.md - Full checklist                   ║${NC}"
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
