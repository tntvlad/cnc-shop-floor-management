#!/usr/bin/env bash
# Multi-Operator Job Assignment System - Quick Deploy Script
# This is a reference showing the deployment steps

# =============================================================================
# STEP 1: BACKUP YOUR DATABASE (CRITICAL!)
# =============================================================================
echo "=== STEP 1: BACKUP DATABASE ==="
echo "Creating backup of your PostgreSQL database..."

# Replace these with your actual values
DB_USER="your_username"
DB_NAME="your_database"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "❌ Backup failed! Do not proceed!"
    exit 1
fi

# =============================================================================
# STEP 2: UPDATE DATABASE SCHEMA
# =============================================================================
echo ""
echo "=== STEP 2: UPDATE DATABASE SCHEMA ==="
echo "Running schema migration..."

psql -U $DB_USER -d $DB_NAME -f backend/db/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema updated successfully"
else
    echo "❌ Schema update failed! Rolling back..."
    psql -U $DB_USER -d $DB_NAME -c "DROP TABLE IF EXISTS job_assignments;"
    exit 1
fi

# =============================================================================
# STEP 3: VERIFY DATABASE CHANGES
# =============================================================================
echo ""
echo "=== STEP 3: VERIFY DATABASE CHANGES ==="
echo "Verifying new table exists..."

psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM job_assignments;"

if [ $? -eq 0 ]; then
    echo "✅ Database verification passed"
else
    echo "❌ Database verification failed!"
    exit 1
fi

# =============================================================================
# STEP 4: RESTART BACKEND
# =============================================================================
echo ""
echo "=== STEP 4: RESTART BACKEND ==="
echo "Restarting Node.js backend..."

# Stop backend
npm stop 2>/dev/null || kill $(lsof -t -i:5000) 2>/dev/null

# Wait for graceful shutdown
sleep 2

# Start backend
npm start &
BACKEND_PID=$!

sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend started successfully (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start!"
    exit 1
fi

# =============================================================================
# STEP 5: VERIFY API ENDPOINTS
# =============================================================================
echo ""
echo "=== STEP 5: VERIFY API ENDPOINTS ==="
echo "Testing API endpoints..."

# Test health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed (HTTP $HTTP_CODE)"
    exit 1
fi

# =============================================================================
# STEP 6: POST-DEPLOYMENT CHECKLIST
# =============================================================================
echo ""
echo "=== STEP 6: POST-DEPLOYMENT CHECKLIST ==="
echo ""
echo "Please complete the following manual steps:"
echo ""
echo "  [ ] Clear your browser cache (Ctrl+Shift+Del)"
echo "  [ ] Refresh page (Ctrl+F5)"
echo "  [ ] Login as Supervisor"
echo "  [ ] Test: Can you click 'Assign to Users'?"
echo "  [ ] Login as CNC Operator"
echo "  [ ] Test: Do you see only your jobs?"
echo "  [ ] Login as Cutting Operator"
echo "  [ ] Test: Do you see different jobs?"
echo ""

# =============================================================================
# DEPLOYMENT COMPLETE
# =============================================================================
echo ""
echo "╔═════════════════════════════════════════════════════════════════╗"
echo "║                                                                 ║"
echo "║        ✅ DEPLOYMENT COMPLETE - SYSTEM IS LIVE!               ║"
echo "║                                                                 ║"
echo "║  Your multi-operator job assignment system is ready!          ║"
echo "║                                                                 ║"
echo "║  Backup file: $BACKUP_FILE"
echo "║  Backend PID: $BACKEND_PID"
echo "║                                                                 ║"
echo "║  Next steps:                                                    ║"
echo "║  1. Complete manual checks above                              ║"
echo "║  2. Have users clear browser cache                            ║"
echo "║  3. Monitor logs for errors                                   ║"
echo "║  4. Train team on new features                                ║"
echo "║                                                                 ║"
echo "║  Documentation:                                                ║"
echo "║  • SUMMARY_SHEET.md - Quick overview                          ║"
echo "║  • SETUP_GUIDE.md - Detailed guide                            ║"
echo "║  • DEPLOYMENT_CHECKLIST.md - Full checklist                   ║"
echo "║                                                                 ║"
echo "╚═════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# ROLLBACK INSTRUCTIONS (IF NEEDED)
# =============================================================================
echo ""
echo "If you need to rollback:"
echo ""
echo "  npm stop"
echo "  psql -U $DB_USER -d $DB_NAME < $BACKUP_FILE"
echo "  npm start"
echo ""

exit 0
