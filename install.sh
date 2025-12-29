#!/bin/bash
# CNC Shop Floor Management - Installation Script
# Bash installation script for Linux/macOS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================"
echo -e "CNC Shop Floor Management - Installer"
echo -e "========================================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
echo ""

# Check Docker
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker found: $DOCKER_VERSION${NC}"
else
    echo -e "${RED}✗ Docker not found. Please install Docker.${NC}"
    echo -e "${YELLOW}  Visit: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

# Check Docker Compose
if command_exists docker-compose; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓ Docker Compose found: $COMPOSE_VERSION${NC}"
else
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}✗ Docker daemon is not running. Please start Docker.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker daemon is running${NC}"

echo ""
echo -e "${CYAN}========================================"
echo -e "Branch Selection"
echo -e "========================================${NC}"
echo ""

# Detect available branches from remote
echo -e "${YELLOW}Fetching available branches...${NC}"
git fetch origin --quiet 2>/dev/null || true

# Get list of remote branches
BRANCHES=$(git branch -r 2>/dev/null | grep -E 'origin/(main|beta)' | sed 's/origin\///' | tr -d ' ' | sort -u)

if [ -z "$BRANCHES" ]; then
    echo -e "${YELLOW}Could not detect remote branches. Using current branch.${NC}"
    SELECTED_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
else
    echo -e "${GREEN}Available branches:${NC}"
    i=1
    for branch in $BRANCHES; do
        echo -e "  ${CYAN}$i) $branch${NC}"
        i=$((i + 1))
    done
    echo ""
    
    # Get current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    echo -e "${YELLOW}Current branch: $CURRENT_BRANCH${NC}"
    echo ""
    
    read -p "Select branch to install (1=main, 2=beta, Enter=keep $CURRENT_BRANCH): " BRANCH_CHOICE
    
    case "$BRANCH_CHOICE" in
        1) SELECTED_BRANCH="main" ;;
        2) SELECTED_BRANCH="beta" ;;
        *) SELECTED_BRANCH="$CURRENT_BRANCH" ;;
    esac
    
    # Switch branch if different
    if [ "$SELECTED_BRANCH" != "$CURRENT_BRANCH" ]; then
        echo -e "${YELLOW}Switching to branch: $SELECTED_BRANCH${NC}"
        git checkout "$SELECTED_BRANCH" 2>/dev/null || git checkout -b "$SELECTED_BRANCH" "origin/$SELECTED_BRANCH" 2>/dev/null
        git pull origin "$SELECTED_BRANCH" --no-edit 2>/dev/null || true
        echo -e "${GREEN}✓ Switched to $SELECTED_BRANCH${NC}"
    else
        echo -e "${GREEN}✓ Staying on $SELECTED_BRANCH${NC}"
    fi
fi

echo ""
echo -e "${CYAN}========================================"
echo -e "Configuration Setup"
echo -e "========================================${NC}"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Found existing .env file.${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created new .env file from template${NC}"
    else
        echo -e "${GREEN}Using existing .env file.${NC}"
    fi
else
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file from template${NC}"
fi

echo ""

# Prompt for custom configuration
echo -e "${YELLOW}Configure your installation (press Enter to use defaults):${NC}"
echo ""

# Database password
read -p "Database Password (default: changeme): " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-changeme}

# JWT Secret
echo ""
read -p "JWT Secret (default: random generated): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    echo -e "${CYAN}Generated JWT Secret: $JWT_SECRET${NC}"
fi

# Frontend Port
echo ""
read -p "Frontend Port (default: 3000): " FRONTEND_PORT
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# Backend Port
echo ""
read -p "Backend Port (default: 5000): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-5000}

# Database Port
echo ""
read -p "Database Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

# Update .env file
echo ""
echo -e "${YELLOW}Updating configuration...${NC}"

sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
sed -i.bak "s/FRONTEND_PORT:-3000/FRONTEND_PORT:-$FRONTEND_PORT/" .env
sed -i.bak "s/BACKEND_PORT:-5000/BACKEND_PORT:-$BACKEND_PORT/" .env
sed -i.bak "s/DB_PORT:-5432/DB_PORT:-$DB_PORT/" .env
rm .env.bak 2>/dev/null || true

echo -e "${GREEN}✓ Configuration updated${NC}"
echo ""

# Check if containers are already running
if docker ps --filter "name=cnc-" --format "{{.Names}}" | grep -q cnc; then
    echo -e "${YELLOW}Found running CNC containers. Stopping them...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ Stopped existing containers${NC}"
    echo ""
fi

echo -e "${CYAN}========================================"
echo -e "Building Application"
echo -e "========================================${NC}"
echo ""

echo -e "${YELLOW}Building Docker images (this may take a few minutes)...${NC}"
if ! docker-compose build; then
    echo ""
    echo -e "${RED}✗ Build failed. Please check the error messages above.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""

echo -e "${CYAN}========================================"
echo -e "Starting Services"
echo -e "========================================${NC}"
echo ""

echo -e "${YELLOW}Starting containers...${NC}"
if ! docker-compose up -d; then
    echo ""
    echo -e "${RED}✗ Failed to start services. Please check the error messages above.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Services started successfully${NC}"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Run users table migration for backup compatibility
echo ""
echo -e "${YELLOW}Running database migrations...${NC}"

DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
fi

if [ -n "$DB_CONTAINER" ] && [ -f "backend/db/migration-users-v2.sql" ]; then
    docker cp backend/db/migration-users-v2.sql "$DB_CONTAINER:/tmp/migration-users-v2.sql"
    if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/migration-users-v2.sql >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database migrations applied (users table V2 compatible)${NC}"
    else
        echo -e "${YELLOW}⚠ Migration had warnings (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping migrations (container or file not found)${NC}"
fi

echo ""
echo -e "${YELLOW}Checking service status...${NC}"
docker-compose ps

echo ""
echo -e "${CYAN}========================================"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${NC}Access your application at:"
echo -e "  ${CYAN}Frontend: http://localhost:$FRONTEND_PORT${NC}"
echo -e "  ${CYAN}Backend API: http://localhost:$BACKEND_PORT${NC}"
echo ""

echo -e "${NC}Default Login Credentials:"
echo -e "  ${CYAN}Employee ID: ADMIN001${NC}"
echo -e "  ${CYAN}Password: admin123${NC}"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT: Change the default password after first login!${NC}"
echo ""

echo -e "${NC}Useful Commands:"
echo -e "  ${CYAN}View logs:        docker-compose logs -f${NC}"
echo -e "  ${CYAN}Stop services:    docker-compose down${NC}"
echo -e "  ${CYAN}Start services:   docker-compose up -d${NC}"
echo -e "  ${CYAN}Restart services: docker-compose restart${NC}"
echo -e "  ${CYAN}Check status:     docker-compose ps${NC}"
echo ""

echo -e "${NC}For more information, see README.md"
echo ""

echo -e "${GREEN}Installation script completed successfully!${NC}"
