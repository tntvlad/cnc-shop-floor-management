# Docker Deployment Guide

## Quick Start

Your system uses Docker containers. Use the correct deployment script:

### On Linux/Mac:
```bash
chmod +x deploy-docker.sh
./deploy-docker.sh
```

### On Windows PowerShell:
```powershell
.\deploy-docker.ps1
```

---

## What These Scripts Do

1. ✅ **Check Docker** - Verify Docker is running
2. ✅ **Backup Database** - Create backup using Docker exec
3. ✅ **Update Schema** - Apply schema changes to database container
4. ✅ **Verify Changes** - Confirm job_assignments table exists
5. ✅ **Restart Backend** - Restart backend container
6. ✅ **Test API** - Verify system is responding

---

## Manual Deployment (If Scripts Fail)

### Step 1: Find Your Containers
```bash
docker ps
```

Look for containers with names like:
- `*-db-*` or `*-postgres-*` (database)
- `*-backend-*` or `*-server-*` (backend)

### Step 2: Backup Database
```bash
# Replace 'db-container-name' with your actual container name
docker exec db-container-name pg_dump -U postgres cnc_shop_floor > backup.sql
```

### Step 3: Apply Schema
```bash
# Copy schema to container
docker cp backend/db/schema.sql db-container-name:/tmp/schema.sql

# Execute schema
docker exec db-container-name psql -U postgres -d cnc_shop_floor -f /tmp/schema.sql
```

### Step 4: Verify
```bash
docker exec db-container-name psql -U postgres -d cnc_shop_floor -c "SELECT COUNT(*) FROM job_assignments;"
```

Should return: `0` (or more if you have data)

### Step 5: Restart Backend
```bash
docker-compose restart
# or
docker restart backend-container-name
```

### Step 6: Test
```bash
curl http://localhost:5000/health
```

Should return: `{"status":"OK"}`

---

## Troubleshooting

### "Docker is not running"
- **Windows:** Start Docker Desktop
- **Linux:** `sudo systemctl start docker`
- **Mac:** Start Docker Desktop

### "Container not found"
List all containers:
```bash
docker ps -a
```

Start containers:
```bash
docker-compose up -d
```

### "Backup file is empty"
Check database name:
```bash
docker exec db-container-name psql -U postgres -l
```

Adjust database name in commands if different from `cnc_shop_floor`

### "Schema update failed"
Check database logs:
```bash
docker logs db-container-name
```

### "API health check failed"
Check backend logs:
```bash
docker logs backend-container-name
```

Wait a few seconds and try again - container may still be starting.

---

## Rollback

If something goes wrong:

```bash
# Restore database
docker exec -i db-container-name psql -U postgres -d cnc_shop_floor < backup.sql

# Restart containers
docker-compose restart
```

---

## Database Access

Access PostgreSQL directly:
```bash
docker exec -it db-container-name psql -U postgres -d cnc_shop_floor
```

Useful queries:
```sql
-- Check new table
\d job_assignments

-- Count assignments
SELECT COUNT(*) FROM job_assignments;

-- View all assignments
SELECT * FROM job_assignments;

-- Exit
\q
```

---

## Common Docker Commands

```bash
# View all containers
docker ps

# View all containers (including stopped)
docker ps -a

# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# Restart containers
docker-compose restart

# View logs
docker logs -f container-name

# Execute command in container
docker exec -it container-name bash

# Copy files to/from container
docker cp local-file container-name:/path/to/file
docker cp container-name:/path/to/file local-file
```

---

## Environment Configuration

Check your `docker-compose.yml` for:
- Database name (default: `cnc_shop_floor`)
- Database user (default: `postgres`)
- Exposed ports (default: 5000 for backend)

If your setup is different, adjust the scripts accordingly.

---

## After Deployment

1. **Clear browser cache** - Users must do this! (Ctrl+Shift+Del)
2. **Hard refresh** - Ctrl+F5 on the page
3. **Test as each role:**
   - Supervisor → Can assign to multiple users
   - CNC Operator → Sees only their jobs
   - Cutting Operator → Sees different jobs

---

## Getting Help

- Deployment issues: See [SETUP_GUIDE.md](SETUP_GUIDE.md)
- Docker issues: See [docker-compose.yml](docker-compose.yml) configuration
- General questions: See [START_HERE.md](START_HERE.md)

---

**Your database is containerized, so always use Docker commands (not direct psql/pg_dump)!**
