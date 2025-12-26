# Multi-Assignment System - Quick Reference

## 🚀 Quick Start

### What Changed?
- Jobs can now be assigned to **multiple operators** simultaneously
- Each operator sees **only their assigned jobs**
- Jobs are **pending** until all assigned operators complete them
- Operators work **independently** with their own progress tracking

### New Database Table
```sql
job_assignments(
  id, part_id, user_id, status, 
  assigned_at, started_at, completed_at, actual_time
)
```

### Key Tables Modified
- **parts**: Removed `assigned_to`, `assigned_at` columns
- **job_assignments**: NEW table for multi-assignment tracking

---

## 📱 User Roles & What They See

### 👷 CNC Operator (Level 100)
- Dashboard shows **only jobs assigned to them**
- Each job shows status: `Pending` → `In Progress` → `Completed`
- Can click pending/in-progress jobs to work on them
- Can't see cutting operator's jobs

### ✂️ Cutting Operator (Level 200)
- Dashboard shows **only jobs assigned to them**  
- See jobs as `Pending` until they start
- Can work on the same jobs as CNC operator without conflict
- Can't see CNC operator's jobs

### 👔 Supervisor (Level 400+)
- **Supervisor Dashboard** shows all jobs
- Click "Assign to Users" to open multi-select modal
- Select both CNC and Cutting Operators for same job
- See all assignments and their status in table
- New column: "Assignments" instead of "Assigned To"

---

## 🔌 API Endpoints (New/Modified)

### GET /api/parts/my-jobs
Operator's dashboard loads their jobs
```json
Response: [
  {
    "id": 5,
    "name": "Bracket Mount",
    "assignment": {
      "id": 12,
      "status": "pending",
      "assignedAt": "2025-12-26T10:30:00Z"
    }
  }
]
```

### POST /api/parts/:id/assign
Supervisor assigns to multiple users (NEW!)
```json
Request: { "userIds": [2, 3] }
Response: {
  "message": "Part assigned successfully",
  "assignments": [
    { "id": 12, "part_id": 5, "user_id": 2, "status": "pending" },
    { "id": 13, "part_id": 5, "user_id": 3, "status": "pending" }
  ]
}
```

### POST /api/parts/:id/start
Operator starts a job (NEW!)
```json
Request: {}
Response: {
  "message": "Job started",
  "assignment": {
    "id": 12,
    "status": "in_progress",
    "started_at": "2025-12-26T10:35:00Z"
  }
}
```

### POST /api/parts/:id/complete
Operator marks their assignment complete (MODIFIED)
```json
Request: { "actualTime": 45 }
Response: { "message": "Job marked as completed successfully" }
```

### GET /api/parts
Gets all parts with assignments (MODIFIED)
```json
Response: [
  {
    "id": 5,
    "name": "Bracket Mount",
    "assignments": [
      { "id": 12, "userId": 2, "status": "pending" },
      { "id": 13, "userId": 3, "status": "pending" }
    ]
  }
]
```

---

## 🎨 Frontend Changes Summary

### Dashboard (`dashboard.js`)
```javascript
// NOW: Shows operator's jobs if level ≤ 300
if (isOperator) {
  parts = await API.parts.getOperatorJobs();
} else {
  parts = await API.parts.getAll();
}

// Job status: pending/in_progress/completed (not locked/unlocked)
```

### Supervisor Dashboard (`supervisor.js`)
```javascript
// Open modal to assign to multiple users
openAssignmentModal(partId, part);

// Multi-select checkboxes for operators
// Submit: await API.parts.assignMultiple(id, userIds);
```

### API Wrapper (`api.js`)
```javascript
API.parts.assignMultiple(id, userIds)    // NEW
API.parts.getOperatorJobs()               // NEW
API.parts.startJob(id)                    // NEW
```

---

## 🔄 Job Status Flow

```
┌─────────────────────────────────┐
│ No Assignments                  │
└──────────┬──────────────────────┘
           │ Supervisor assigns
           ▼
┌─────────────────────────────────┐
│ Pending (both operators)        │
│ ✗ CNC Operator: pending         │
│ ✗ Cutting Operator: pending     │
└──────────┬──────────────────────┘
           │ CNC Operator starts
           ▼
┌─────────────────────────────────┐
│ CNC In Progress                 │
│ ▶ CNC Operator: in_progress     │
│ ✗ Cutting Operator: pending     │
└──────────┬──────────────────────┘
           │ CNC Operator completes
           ▼
┌─────────────────────────────────┐
│ Waiting for Cutting Operator    │
│ ✓ CNC Operator: completed       │
│ ✗ Cutting Operator: pending     │
└──────────┬──────────────────────┘
           │ Cutting starts & completes
           ▼
┌─────────────────────────────────┐
│ All Complete - Job Done!        │
│ ✓ CNC Operator: completed       │
│ ✓ Cutting Operator: completed   │
│ ↓ Next job unlocked             │
└─────────────────────────────────┘
```

---

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Operator sees all jobs | Hard refresh (Ctrl+Shift+R), check API endpoint works |
| Supervisor can't assign multiple | Check modal appears with checkboxes, verify `assignMultiple()` API |
| Job doesn't complete | Verify ALL assignments are marked completed |
| Next job doesn't unlock | Check `COUNT(*)` query returns 0 for pending assignments |
| Wrong status showing | Clear cache, check `job_assignments.status` in database |

---

## 📊 Database Queries

### Find all jobs assigned to operator ID=2
```sql
SELECT p.*, ja.status
FROM job_assignments ja
JOIN parts p ON ja.part_id = p.id
WHERE ja.user_id = 2
ORDER BY p.order_position;
```

### Find jobs waiting for completion
```sql
SELECT p.id, p.name, COUNT(*) as pending_count
FROM job_assignments ja
JOIN parts p ON ja.part_id = p.id
WHERE ja.status != 'completed'
GROUP BY p.id, p.name;
```

### Get status of job #5
```sql
SELECT u.name, ja.status, ja.actual_time
FROM job_assignments ja
JOIN users u ON ja.user_id = u.id
WHERE ja.part_id = 5;
```

---

## 🧪 Testing Checklist

- [ ] Supervisor can assign same job to 2+ operators
- [ ] CNC operator sees ONLY their jobs
- [ ] Cutting operator sees DIFFERENT jobs (isolated view)
- [ ] Job shows "Pending" before any work starts
- [ ] Operator can start job (status → "In Progress")
- [ ] Operator can complete job (status → "Completed")
- [ ] Next job unlocks ONLY after ALL operators complete
- [ ] Time tracking works per operator per job
- [ ] Supervisor sees all assignments with statuses
- [ ] Modal has proper checkboxes for multi-select

---

## 💾 Critical Files

### Backend
- `backend/db/schema.sql` - Database structure
- `backend/controllers/partsController.js` - Job assignment logic
- `backend/server.js` - API routes

### Frontend
- `frontend/js/api.js` - API methods
- `frontend/js/dashboard.js` - Operator view
- `frontend/js/supervisor.js` - Supervisor multi-assign UI
- `frontend/supervisor.html` - Table headers

---

## 🚨 Before Going to Production

1. **Backup database** - Critical step!
2. **Test all user roles** - CNC, Cutting, Supervisor, Admin
3. **Test the complete flow** - Assign → Start → Complete
4. **Check next job unlocking** - Verify proper cascading
5. **Test time tracking** - Per operator, per job
6. **Clear all browser caches** - Users must do hard refresh
7. **Monitor logs** - Watch for API errors during initial usage

---

## 📖 Documentation Files

- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `SETUP_GUIDE.md` - Deployment instructions  
- `WORKFLOW_DIAGRAM.md` - Visual flows and examples
- `README.md` - General project info

---

**Version:** 1.0  
**Date:** December 26, 2025  
**Status:** Ready for Deployment
