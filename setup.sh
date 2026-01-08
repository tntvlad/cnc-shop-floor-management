#!/bin/bash
# CNC Shop Floor Management - Unified Setup Script
# Handles installation, uninstallation, and management
# Version: 1.2-beta

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_compose_command() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command_exists docker-compose; then
        echo "docker-compose"
    else
        echo ""
    fi
}

check_installation() {
    # Check if CNC containers exist (running or stopped)
    if docker ps -a --filter "name=cnc-" --format "{{.Names}}" 2>/dev/null | grep -q "cnc-"; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

show_header() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       CNC Shop Floor Management - Setup Utility              ║${NC}"
    echo -e "${CYAN}║       Version: 1.2-beta                                       ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# =============================================================================
# UNINSTALL FUNCTION
# =============================================================================

do_uninstall() {
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                    UNINSTALL MODE                             ║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    COMPOSE_CMD=$(get_compose_command)
    
    echo -e "${RED}WARNING: This will remove CNC Shop Floor containers.${NC}"
    echo ""
    
    read -p "Do you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Uninstall cancelled."
        exit 0
    fi
    
    echo ""
    echo -e "${YELLOW}Stopping and removing containers...${NC}"
    $COMPOSE_CMD down 2>/dev/null || docker stop cnc-backend cnc-frontend cnc-postgres 2>/dev/null || true
    docker rm cnc-backend cnc-frontend cnc-postgres 2>/dev/null || true
    echo -e "${GREEN}✓ Containers removed${NC}"
    
    echo ""
    read -p "Remove database volumes (ALL DATA WILL BE LOST)? (yes/no): " remove_volumes
    if [ "$remove_volumes" = "yes" ]; then
        echo -e "${YELLOW}Removing volumes...${NC}"
        $COMPOSE_CMD down -v 2>/dev/null || true
        docker volume rm cnc-shop-floor-management_postgres_data 2>/dev/null || true
        docker volume rm cnc-shop-floor-management_uploads_data 2>/dev/null || true
        echo -e "${GREEN}✓ Volumes removed${NC}"
    fi
    
    echo ""
    read -p "Remove Docker images? (yes/no): " remove_images
    if [ "$remove_images" = "yes" ]; then
        echo -e "${YELLOW}Removing images...${NC}"
        docker rmi cnc-shop-floor-management-backend cnc-shop-floor-management-frontend 2>/dev/null || true
        docker rmi cnc-backend cnc-frontend 2>/dev/null || true
        echo -e "${GREEN}✓ Images removed${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                 Uninstall Complete!                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "To reinstall, run: bash setup.sh"
    echo ""
}

# =============================================================================
# INSTALL FUNCTION
# =============================================================================

do_install() {
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    INSTALL MODE                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check prerequisites
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    echo ""
    
    # Check Docker
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version)
        echo -e "${GREEN}✓ Docker: $DOCKER_VERSION${NC}"
    else
        echo -e "${RED}✗ Docker not found!${NC}"
        echo -e "${YELLOW}  Install: https://docs.docker.com/get-docker/${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    COMPOSE_CMD=$(get_compose_command)
    if [ -n "$COMPOSE_CMD" ]; then
        echo -e "${GREEN}✓ Docker Compose: $($COMPOSE_CMD version 2>/dev/null | head -1)${NC}"
    else
        echo -e "${RED}✗ Docker Compose not found!${NC}"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker daemon not running!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker daemon running${NC}"
    
    echo ""
    
    # Branch selection
    echo -e "${CYAN}=== Branch Selection ===${NC}"
    git fetch origin --quiet 2>/dev/null || true
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    echo -e "Current branch: ${CYAN}$CURRENT_BRANCH${NC}"
    echo ""
    echo "  1) main  - Stable release"
    echo "  2) beta  - Development/testing"
    echo ""
    read -p "Select branch (1/2, Enter=keep $CURRENT_BRANCH): " BRANCH_CHOICE
    
    case "$BRANCH_CHOICE" in
        1) SELECTED_BRANCH="main" ;;
        2) SELECTED_BRANCH="beta" ;;
        *) SELECTED_BRANCH="$CURRENT_BRANCH" ;;
    esac
    
    if [ "$SELECTED_BRANCH" != "$CURRENT_BRANCH" ]; then
        echo -e "${YELLOW}Switching to $SELECTED_BRANCH...${NC}"
        git checkout "$SELECTED_BRANCH" 2>/dev/null || git checkout -b "$SELECTED_BRANCH" "origin/$SELECTED_BRANCH" 2>/dev/null
        git pull origin "$SELECTED_BRANCH" --no-edit 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Using branch: $SELECTED_BRANCH${NC}"
    
    echo ""
    
    # Configuration
    echo -e "${CYAN}=== Configuration ===${NC}"
    
    if [ -f ".env" ]; then
        read -p "Found existing .env. Overwrite? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp .env.example .env 2>/dev/null || true
        fi
    else
        cp .env.example .env 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${YELLOW}Configure installation (Enter=use defaults):${NC}"
    echo ""
    
    read -p "Database Password (default: changeme): " DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-changeme}
    
    read -p "Frontend Port (default: 3000): " FRONTEND_PORT
    FRONTEND_PORT=${FRONTEND_PORT:-3000}
    
    read -p "Backend Port (default: 5000): " BACKEND_PORT
    BACKEND_PORT=${BACKEND_PORT:-5000}
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null | tr -d "=+/" | cut -c1-32 || echo "change-this-secret-key-now")
    
    # Update .env
    if [ -f ".env" ]; then
        sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env 2>/dev/null || true
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env 2>/dev/null || true
        # Set FRONTEND_URL to * to allow access from any IP (CORS)
        sed -i.bak "s|FRONTEND_URL=.*|FRONTEND_URL=*|" .env 2>/dev/null || true
        rm -f .env.bak 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ Configuration saved${NC}"
    echo ""
    
    # Build and start
    echo -e "${CYAN}=== Building Application ===${NC}"
    echo -e "${YELLOW}Building Docker images (this may take a few minutes)...${NC}"
    
    if ! $COMPOSE_CMD build; then
        echo -e "${RED}✗ Build failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Build complete${NC}"
    
    echo ""
    echo -e "${CYAN}=== Starting Services ===${NC}"
    
    # Remove old network if it exists with wrong labels
    docker network rm cnc-network 2>/dev/null || true
    
    if ! $COMPOSE_CMD up -d; then
        echo -e "${RED}✗ Failed to start services!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Services started${NC}"
    echo ""
    
    # Wait for health
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    sleep 8
    
    # Show status
    $COMPOSE_CMD ps
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                 Installation Complete!                        ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Access your application:"
    echo -e "  ${CYAN}Frontend: http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  ${CYAN}Backend:  http://localhost:$BACKEND_PORT${NC}"
    echo ""
    echo -e "Default Login:"
    echo -e "  ${CYAN}Employee ID: ADMIN001${NC}"
    echo -e "  ${CYAN}Password:    admin123${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Change the default password after first login!${NC}"
    echo ""
    echo -e "Commands:"
    echo -e "  ${CYAN}View logs:    $COMPOSE_CMD logs -f${NC}"
    echo -e "  ${CYAN}Stop:         $COMPOSE_CMD down${NC}"
    echo -e "  ${CYAN}Start:        $COMPOSE_CMD up -d${NC}"
    echo -e "  ${CYAN}Uninstall:    bash setup.sh${NC}"
    echo ""
}

# =============================================================================
# LOAD TEST DATA FUNCTION
# =============================================================================

do_load_test_data() {
    echo -e "${CYAN}=== Loading Test Data ===${NC}"
    
    DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
    if [ -z "$DB_CONTAINER" ]; then
        DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
    fi
    
    if [ -z "$DB_CONTAINER" ]; then
        echo -e "${RED}✗ Database container not found!${NC}"
        return 1
    fi
    
    if [ -f "backend/db/test-data.sql" ]; then
        docker cp backend/db/test-data.sql "$DB_CONTAINER:/tmp/test-data.sql"
        if docker exec "$DB_CONTAINER" psql -U postgres -d cnc_shop_floor -f /tmp/test-data.sql >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Test data loaded successfully${NC}"
        else
            echo -e "${RED}✗ Failed to load test data${NC}"
        fi
    else
        echo -e "${RED}✗ test-data.sql not found${NC}"
    fi
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

show_header

# Check if installation exists
if check_installation; then
    echo -e "${YELLOW}Existing installation detected!${NC}"
    echo ""
    echo "What would you like to do?"
    echo ""
    echo "  1) Reinstall (stop, rebuild, start)"
    echo "  2) Uninstall (remove containers & optionally data)"
    echo "  3) Load test data"
    echo "  4) View status"
    echo "  5) Exit"
    echo ""
    read -p "Select option (1-5): " CHOICE
    
    COMPOSE_CMD=$(get_compose_command)
    
    case "$CHOICE" in
        1)
            echo ""
            $COMPOSE_CMD down 2>/dev/null || true
            do_install
            ;;
        2)
            echo ""
            do_uninstall
            ;;
        3)
            echo ""
            do_load_test_data
            ;;
        4)
            echo ""
            echo -e "${CYAN}=== Container Status ===${NC}"
            $COMPOSE_CMD ps
            echo ""
            echo -e "${CYAN}=== Health Check ===${NC}"
            curl -s http://localhost:5000/health 2>/dev/null && echo "" || echo -e "${RED}Backend not responding${NC}"
            ;;
        5)
            echo "Exiting."
            exit 0
            ;;
        *)
            echo "Invalid option."
            exit 1
            ;;
    esac
else
    echo -e "${GREEN}No existing installation found.${NC}"
    echo ""
    read -p "Install CNC Shop Floor Management? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        do_install
    else
        echo "Installation cancelled."
    fi
fi
