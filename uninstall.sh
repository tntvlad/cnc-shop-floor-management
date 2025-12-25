#!/bin/bash

# CNC Shop Floor Management - Uninstall Script
# This script removes the Docker containers, volumes, and application data

set -e

echo "================================================"
echo "CNC Shop Floor Management - Uninstall Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo -e "${YELLOW}WARNING: This will remove all Docker containers and optionally delete data.${NC}"
echo ""

# Confirm uninstall
read -p "Do you want to continue with the uninstall? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""
echo "Stopping and removing Docker containers..."
docker-compose down

echo -e "${GREEN}✓ Containers stopped and removed${NC}"
echo ""

# Ask about removing volumes
read -p "Do you want to remove all data volumes? (yes/no): " remove_volumes
if [ "$remove_volumes" = "yes" ]; then
    echo "Removing volumes..."
    docker-compose down -v
    echo -e "${GREEN}✓ Volumes removed${NC}"
else
    echo "Keeping data volumes for potential recovery."
fi

echo ""

# Ask about removing images
read -p "Do you want to remove Docker images? (yes/no): " remove_images
if [ "$remove_images" = "yes" ]; then
    echo "Removing Docker images..."
    docker image rm cnc-backend cnc-frontend 2>/dev/null || true
    docker image rm postgres:15-alpine 2>/dev/null || true
    docker image rm nginx:alpine 2>/dev/null || true
    echo -e "${GREEN}✓ Images removed${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Uninstall Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "To completely remove the installation:"
echo "  rm -rf /DATA/AppData/cnc-shop-floor-management"
echo ""
echo "To reinstall, run:"
echo "  git clone https://github.com/tntvlad/cnc-shop-floor-management.git"
echo "  cd cnc-shop-floor-management"
echo "  bash install.sh"
