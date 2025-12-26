# Data Migration Guide - Single Assignment → Multi-Assignment

## ⚠️ IMPORTANT: Backup First!

**Before running any migration:**
```bash
# Create a backup of your database
pg_dump -U your_user your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# If you have the database locally:
psql -U postgres -c "ALTER DATABASE your_database RENAME TO your_database_backup;"
```

---

## Migration Scenarios

### Scenario 1: Brand New Installation
**If this is a fresh deployment with no existing data:**

1. Simply run the new `backend/db/schema.sql`
2. No migration needed - it creates the new schema from scratch
3. Go straight to deployment

---

### Scenario 2: Existing System with Single Assignment

**If you have existing jobs assigned to single operators:**

#### Step 1: Create Backup
```bash
pg_dump -U your_user your_database > before_migration.sql
```

#### Step 2: Run Updated Schema
```bash
psql -U your_user -d your_database -f backend/db/schema.sql
```

**What this does:**
- ✅ Creates new `job_assignments` table
- ✅ Drops old `assigned_to` column from parts
- ❌ **Loses existing single assignments** - you'll need to manually reassign

#### Step 3: Manually Reassign Jobs
Option A - Via Supervisor Dashboard (Easiest):
1. Login as Supervisor
2. Go to Supervisor Dashboard
3. For each job that had an assignment:
   - Click "Assign to Users"
   - Select the original operator
   - Click "Assign Selected"
4. Done!

Option B - Via SQL (Fastest if you have many):
```sql
-- If you saved the old assignments before schema change
-- You can recreate them:

INSERT INTO job_assignments (part_id, user_id, status, assigned_at)
SELECT id, assigned_to, 'pending', assigned_at
FROM old_parts_backup
WHERE assigned_to IS NOT NULL;
```

#### Step 4: Verify Migration
```sql
-- Count assignments
SELECT COUNT(*) FROM job_assignments;

-- Check all jobs have assignments
SELECT p.id, p.name, COUNT(ja.id) as assignment_count
FROM parts p
LEFT JOIN job_assignments ja ON p.id = ja.part_id
GROUP BY p.id, p.name;
```

---

### Scenario 3: Rollback to Previous Version

**If something goes wrong and you need to go back:**

```bash
# Option 1: Restore from backup
psql -U your_user -d your_database < before_migration.sql

# Option 2: If using separate backup database
psql -U postgres -c "DROP DATABASE your_database;"
psql -U postgres -c "ALTER DATABASE your_database_backup RENAME TO your_database;"
```

Then revert source code to previous version and restart backend.

---

## Migration Script (SQL)

**If you're migrating from old system and saved the data:**

```sql
-- Step 1: Backup old assignment data (if needed)
-- This is optional if you already backed up the database

-- Step 2: Drop old schema and recreate
-- (Run the new backend/db/schema.sql)

-- Step 3: Recreate assignments from backup
-- If you saved the old assigned_to data:

CREATE TEMPORARY TABLE old_assignments AS
SELECT id, assigned_to, assigned_at
FROM parts_backup
WHERE assigned_to IS NOT NULL;

INSERT INTO job_assignments (part_id, user_id, status, assigned_at)
SELECT id, assigned_to, 'pending', assigned_at
FROM old_assignments;

-- Step 4: Verify
SELECT COUNT(*) FROM job_assignments;  -- Should show your assignments

-- Step 5: Clean up
DROP TABLE old_assignments;
DROP TABLE parts_backup;
```

---

## Common Migration Issues

### Issue 1: "parts table doesn't have assigned_to column"
**Cause:** Old system had different schema
**Fix:** 
1. Restore from backup
2. Manually re-create jobs in new system OR
3. Check what columns actually exist: `\d parts`

### Issue 2: "ERROR: duplicate key value violates unique constraint"
**Cause:** Trying to assign same user to same part twice
**Fix:**
```sql
-- Use ON CONFLICT to update instead:
INSERT INTO job_assignments (part_id, user_id, status, assigned_at)
VALUES (5, 2, 'pending', NOW())
ON CONFLICT (part_id, user_id) 
DO UPDATE SET status = 'pending', assigned_at = NOW();
```

### Issue 3: Lost old assignment dates
**If assigned_at was not saved:** No way to recover exact dates, but:
```sql
-- Set all to current time:
UPDATE job_assignments 
SET assigned_at = NOW() 
WHERE assigned_at IS NULL;
```

---

## Verification Checklist

After migration, verify everything:

```sql
-- 1. Check new table exists
SELECT * FROM job_assignments LIMIT 1;
✅ Should return a row or show empty table

-- 2. Check parts table structure
\d parts
✅ Should NOT have assigned_to or assigned_at columns

-- 3. Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'job_assignments';
✅ Should show indexes on part_id, user_id, status

-- 4. Check data integrity
SELECT COUNT(*) FROM parts WHERE id IN (SELECT DISTINCT part_id FROM job_assignments);
✅ All part_ids in job_assignments should exist in parts

-- 5. Check user references
SELECT COUNT(*) FROM users WHERE id IN (SELECT DISTINCT user_id FROM job_assignments);
✅ All user_ids should exist in users table
```

---

## Performance Optimization

After migration, optimize database:

```sql
-- Analyze and vacuum (cleanup after large changes)
VACUUM ANALYZE;

-- Reindex (sometimes helps after major schema changes)
REINDEX DATABASE your_database;

-- Check query plans
EXPLAIN SELECT * FROM parts p
  LEFT JOIN job_assignments ja ON p.id = ja.part_id
  WHERE ja.user_id = 2;
✅ Should use index on job_assignments(user_id)
```

---

## Deployment Order

### For Fresh Installation (Easiest)
```
1. Run new schema.sql
2. Deploy backend
3. Deploy frontend
4. Done!
```

### For Migration (Careful)
```
1. Backup database
2. Test migration in dev environment first
3. Run schema.sql on test database
4. Verify data migration works
5. Run migration on production
6. Verify production migration
7. Deploy backend
8. Deploy frontend
9. Monitor logs for errors
10. Have rollback plan ready
```

### Rollback Plan
```
If something fails:
1. Stop backend
2. Restore database from backup
3. Revert source code to previous version
4. Restart backend
5. Investigate issue in dev environment
6. Plan fix
7. Re-deploy when ready
```

---

## Timeline Estimates

| Task | Time |
|------|------|
| Backup | 5-10 min |
| Schema migration | 2-5 min |
| Data migration (0-100 jobs) | 5-10 min |
| Verification | 5-10 min |
| Backend deployment | 5 min |
| Frontend deployment | 5 min |
| Testing | 15-30 min |
| **Total** | **45-70 min** |

---

## Support & Troubleshooting

### If data is corrupted after migration:
1. Restore from backup: `psql < before_migration.sql`
2. Check for errors in console
3. Verify schema was correct: `\d job_assignments`
4. Try migration again with careful steps

### If you can't restore:
1. Contact database administrator
2. Check backup files exist
3. Try oldest available backup
4. Last resort: recreate database from scratch

### If you need help:
- Check `SETUP_GUIDE.md` for deployment help
- Review `WORKFLOW_DIAGRAM.md` for system understanding
- Check `IMPLEMENTATION_SUMMARY.md` for technical details

---

## Post-Migration Checklist

After successful migration:

- [ ] Database backup completed
- [ ] New schema deployed
- [ ] Data migrated and verified
- [ ] Backend restarted
- [ ] Frontend redeployed
- [ ] Test account can login
- [ ] Supervisor can see jobs
- [ ] Supervisor can assign jobs
- [ ] Operator sees only their jobs
- [ ] Operator can complete jobs
- [ ] Next job unlocks correctly
- [ ] Time tracking works
- [ ] No errors in backend logs
- [ ] User confirmed system works

---

**Important:** Always test in development environment first!

**Migration Date:** [YOUR DATE]  
**Operator:** [YOUR NAME]  
**Database:** [YOUR DB NAME]  
**Backup Location:** [BACKUP PATH]  
**Status:** [SUCCESS/ROLLBACK]  
**Notes:** [ANY ISSUES/SOLUTIONS]

---

Last Updated: December 26, 2025
