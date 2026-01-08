# CNC Shop Floor Management - Setup Guide

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git installed
- Linux/macOS/WSL environment

### Installation

```bash
# Clone the repository
git clone https://github.com/tntvlad/cnc-shop-floor-management.git
cd cnc-shop-floor-management

# Run the setup script
bash setup.sh
```

The setup script will:
1. Check for Docker and Docker Compose
2. Let you choose between `main` (stable) and `beta` (development) branches
3. Configure your installation (ports, passwords)
4. Build and start the Docker containers

### Default Access

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

**Default Login:**
- Employee ID: `ADMIN001`
- Password: `admin123`

⚠️ **Change the default password after first login!**

---

## Managing Your Installation

Run `bash setup.sh` again to access the management menu:

1. **Reinstall** - Stop, rebuild, and start containers
2. **Uninstall** - Remove containers (optionally delete data)
3. **Load test data** - Add sample materials and orders
4. **View status** - Check container health

---

## Configuration

### Environment Variables

Configuration is stored in `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PASSWORD` | changeme | PostgreSQL password |
| `JWT_SECRET` | (generated) | JWT signing secret |
| `FRONTEND_PORT` | 3000 | Frontend web port |
| `BACKEND_PORT` | 5000 | API port |
| `DB_PORT` | 5432 | Database port |

### Docker Compose Commands

```bash
# View logs
docker compose logs -f

# Stop services
docker compose down

# Start services
docker compose up -d

# Rebuild after code changes
docker compose up --build -d

# View container status
docker compose ps
```

---

## User Roles & Permissions

| Level | Role | Permissions |
|-------|------|-------------|
| 500 | Admin | Full system access, git operations, user management |
| 400 | Supervisor | Create orders, assign jobs, create users (up to 400) |
| 300 | QC Inspector | Approve/reject completed jobs |
| 200 | Cutting Operator | Material cutting operations |
| 100 | CNC Operator | Machine operation, job completion |
| 50 | Customer | View own orders (future feature) |

---

## Troubleshooting

### Backend/Database shows "Error" in Admin Settings
1. Check if containers are running: `docker compose ps`
2. View backend logs: `docker compose logs backend`
3. Rebuild containers: `docker compose up --build -d`

### Can't connect to the application
1. Verify ports are not in use: `netstat -tuln | grep -E '3000|5000'`
2. Check Docker is running: `docker info`
3. Restart containers: `docker compose restart`

### Database reset (fresh start)
```bash
docker compose down -v  # Removes volumes (all data)
docker compose up -d    # Starts fresh
```

---

## Updating

### Via Web UI (Admin Panel)
1. Go to Admin Settings
2. Click "Pull from Git"
3. Click "Rebuild & Restart"

### Via Command Line
```bash
git pull origin beta    # or main
docker compose up --build -d
```

---

## Backup & Restore

### Backup Database
```bash
# From Admin Settings page, click "Download Backup"
# Or manually:
docker exec cnc-postgres pg_dump -U postgres cnc_shop_floor > backup.sql
```

### Restore Database
```bash
# From Admin Settings page, upload backup file
# Or manually:
docker exec -i cnc-postgres psql -U postgres cnc_shop_floor < backup.sql
```
