# Multi-Assignment Job System - Setup & Deployment Guide

## Quick Summary of Changes

Your CNC Shop Floor Management system now supports:
✅ Assigning the same job to multiple operators (CNC and Cutting)
✅ Operators see only their own assigned jobs
✅ Jobs stay pending until cutting operator marks completion
✅ Proper status tracking: pending → in_progress → completed

## Files Modified

### Backend
1. **backend/db/schema.sql** - New `job_assignments` table, updated indexes
2. **backend/controllers/partsController.js** - Updated for multi-assignment logic
3. **backend/server.js** - Added new API endpoints

### Frontend
1. **frontend/js/api.js** - New API methods for assignments
2. **frontend/js/dashboard.js** - Show only operator's jobs
3. **frontend/js/supervisor.js** - Multi-select assignment UI
4. **frontend/supervisor.html** - Updated table headers

## Deployment Steps

### 1. Database Migration
```bash
# Connect to your PostgreSQL database and run:
psql -U your_user -d your_database -f backend/db/schema.sql
```

**What this does:**
- Creates the new `job_assignments` table
- Drops old `assigned_to` and `assigned_at` columns from `parts` table
- Creates proper indexes for performance
- Keeps existing user and part data intact

### 2. Backend Deployment
```bash
# Stop current backend
npm stop  # or your deployment method

# Install/update dependencies (if needed)
npm install

# Restart backend
npm start
```

**No additional configuration needed** - API routes are automatically registered

### 3. Frontend Deployment
Simply redeploy the updated frontend files. The JavaScript files already contain:
- Cache busting query parameters (v=20251225)
- Updated API calls
- New UI components

### 4. Clear Browser Cache (Important!)
Users should clear their browser cache or do a hard refresh:
- **Windows/Linux**: Ctrl + Shift + Del, then clear cache
- **Mac**: Cmd + Shift + Del, then clear cache
- Or: Ctrl/Cmd + Shift + R to hard refresh

## Testing the Implementation

### Test 1: Supervisor Assignment
1. Login as Supervisor (level 400+)
2. Go to Supervisor Dashboard
3. Click "Assign to Users" on any job
4. Select multiple operators (e.g., CNC Operator + Cutting Operator)
5. Click "Assign Selected"
✅ Should see all selected operators in the "Assignments" column

### Test 2: Operator View
1. Login as CNC Operator (level 100)
2. Go to Dashboard
3. Should see ONLY jobs assigned to them
4. Job status should show as "Pending"
5. Click job to open it
✅ Should be able to start and complete the job

### Test 3: Cutting Operator View
1. Login as Cutting Operator (level 200)
2. Go to Dashboard
3. Should see ONLY jobs assigned to them (different from CNC operator)
4. Once CNC operator completes, cutting operator marks theirs as done
✅ Once both complete, job should be marked as "Completed"

### Test 4: Job Progression
1. Assign job to both CNC Operator and Cutting Operator
2. Have CNC Operator complete it (status → completed)
3. Supervisor should see CNC operator with "completed" status
4. Have Cutting Operator complete it
5. Both should show "completed", main job should unlock next
✅ Next job in order should become available

## Troubleshooting

### Issue: "My Jobs" returns empty even though assigned
**Solution:** 
- Clear browser cache
- Check database: `SELECT * FROM job_assignments WHERE user_id = X;`
- Verify assignments were created: `SELECT * FROM job_assignments;`

### Issue: Jobs still show "Locked" instead of "Pending"
**Solution:**
- Old data might not have assignments
- Manually create job_assignments records or reassign jobs
- Verify schema migration ran successfully

### Issue: Supervisor can't assign to multiple users
**Solution:**
- Ensure modal appears with checkboxes
- Check browser console for errors (F12)
- Verify API endpoint is accessible: `POST /api/parts/:id/assign`

### Issue: Operator can still see other operators' jobs
**Solution:**
- Hard refresh (Ctrl+Shift+R)
- Check that `getOperatorJobs()` endpoint is working
- Verify user's level is correct in database

## API Reference

### Get Operator's Jobs
```
GET /api/parts/my-jobs
Headers: Authorization: Bearer <token>
Response: Array of parts assigned to current user with assignment status
```

### Assign Job to Multiple Users
```
POST /api/parts/:id/assign
Headers: Authorization: Bearer <token>
Body: { "userIds": [1, 2, 3] }
Response: { message: "Part assigned successfully", assignments: [...] }
```

### Start Job
```
POST /api/parts/:id/start
Headers: Authorization: Bearer <token>
Response: { message: "Job started", assignment: {...} }
```

### Complete Job
```
POST /api/parts/:id/complete
Headers: Authorization: Bearer <token>
Body: { "actualTime": 45 }
Response: { message: "Job marked as completed successfully" }
```

## Database Queries for Monitoring

### View all assignments for a job
```sql
SELECT ja.*, u.name, u.employee_id 
FROM job_assignments ja
JOIN users u ON ja.user_id = u.id
WHERE ja.part_id = 1
ORDER BY ja.assigned_at;
```

### View all pending assignments
```sql
SELECT ja.*, p.name, u.name as operator_name
FROM job_assignments ja
JOIN parts p ON ja.part_id = p.id
JOIN users u ON ja.user_id = u.id
WHERE ja.status = 'pending'
ORDER BY ja.assigned_at;
```

### View jobs waiting for completion
```sql
SELECT p.*, 
  (SELECT count(*) FROM job_assignments ja WHERE ja.part_id = p.id AND ja.status != 'completed') as pending_count
FROM parts p
WHERE p.completed = FALSE
ORDER BY p.order_position;
```

## Performance Considerations

- Created indexes on: part_id, user_id, status in job_assignments
- `getAllParts()` aggregates assignments per part efficiently
- `getOperatorJobs()` filters by user_id with indexed query
- Consider adding database connection pooling if many concurrent users

## Rollback Instructions (if needed)

If you need to rollback to single-assignment:

```bash
# 1. Restore database from backup
psql -U your_user -d your_database < backup.sql

# 2. Restore original source files
git checkout backend/db/schema.sql backend/controllers/partsController.js backend/server.js

# 3. Restart backend
npm restart
```

## Support & Questions

For issues or questions about the implementation:
1. Check the troubleshooting section above
2. Review IMPLEMENTATION_SUMMARY.md for detailed technical info
3. Check API logs for error messages
4. Verify database migrations completed successfully

---

**Implementation Date:** December 26, 2025
**System:** CNC Shop Floor Management
**Feature:** Multi-Operator Job Assignment
