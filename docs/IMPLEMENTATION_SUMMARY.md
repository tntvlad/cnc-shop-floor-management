# Multi-Assignment Job System Implementation

## Overview
This implementation allows supervisors to assign the same job to multiple operators (CNC operators and cutting operators). Each operator sees only their assigned jobs, and jobs remain in "pending" status until completed by all assigned operators.

## Database Changes

### New Table: `job_assignments`
```sql
CREATE TABLE job_assignments (
    id SERIAL PRIMARY KEY,
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    actual_time INTEGER, -- in minutes
    UNIQUE(part_id, user_id)
);
```

### Modified Tables
- **parts**: Removed `assigned_to` and `assigned_at` columns (no longer single assignment)
- Added indexes for `job_assignments` table for performance

## Backend Changes

### API Endpoints

#### New Endpoints
- `GET /api/parts/my-jobs` - Get operator's assigned jobs (filtered by current user)
- `POST /api/parts/:id/assign` - Assign job to multiple users (accepts `userIds` array)
- `POST /api/parts/:id/start` - Start a job assignment (updates status to 'in_progress')

#### Modified Endpoints
- `GET /api/parts` - Now returns `assignments` array instead of `assigned_user`
- `GET /api/parts/:id` - Now returns `assignments` array
- `POST /api/parts/:id/complete` - Now marks user's assignment as completed

### Controller Changes (`partsController.js`)

#### Updated Functions
- **getAllParts()** - Returns all parts with their assignments (multiple per part)
- **getPart()** - Returns part with all assignments
- **assignPart()** - Now accepts `userIds` array and creates multiple assignments
- **completePart()** - Marks operator's specific assignment as completed
- **getStatistics()** - Calculates stats from job_assignments table

#### New Functions
- **getOperatorJobs()** - Returns only jobs assigned to current user
- **startJob()** - Updates job assignment status to 'in_progress'

## Frontend Changes

### API Module (`api.js`)
Added new methods to `parts` object:
- `assignMultiple(id, userIds)` - Assign to multiple operators
- `getOperatorJobs()` - Fetch operator's assigned jobs
- `startJob(id)` - Start a job assignment

### Dashboard (`dashboard.js`)
- **loadParts()** - Now loads operator's jobs if user level ≤ 300, otherwise all jobs
- **createPartCard()** - Shows assignment status (pending/in_progress/completed) instead of locked/unlocked
- Operators can only click on their assigned jobs with pending or in_progress status

### Supervisor Dashboard (`supervisor.js`)
- **loadJobs()** - Shows all parts with their current assignments
- **openAssignmentModal()** - New modal to select multiple operators for assignment
- Table now shows "Assignments" column listing all assigned operators and their status

### Supervisor HTML (`supervisor.html`)
- Updated table header from "Assigned To" to "Assignments"

## Job Status Flow

### For Operators
1. **Pending** - Job assigned but not started
2. **In Progress** - Operator has started working on the job
3. **Completed** - Operator has marked their part complete

### For Jobs
- A job remains locked until ALL assigned operators mark it as completed
- Once all assignments are completed, the part is marked as completed and next part is unlocked

## Key Features

### Multi-Assignment
- Same job can be assigned to multiple operators simultaneously
- Each operator tracks their own progress independently
- No conflicts or timing issues

### Operator View
- Operators see only their assigned jobs
- Job status shows: Pending → In Progress → Completed
- Can't see other operators' jobs

### Supervisor Control
- Supervisor can assign job to multiple operators at once via modal
- Can see all jobs and their current assignments
- Can see which operators are assigned and their status per job

### Status Management
- Each assignment tracks: status, assigned_at, started_at, completed_at, actual_time
- Job is considered complete only when all assignments are complete
- Proper cascading: part unlock happens after all assignments complete

## Database Schema Updates Required

Run the updated `backend/db/schema.sql` to:
1. Drop and recreate the job_assignments table
2. Update indexes
3. Update sample data if needed

## Testing Checklist

- [ ] Supervisor can assign same job to multiple operators
- [ ] Each operator sees only their assigned jobs
- [ ] Jobs show correct status (pending/in_progress/completed)
- [ ] Job marked complete only when all operators complete
- [ ] Next job unlocks after all assignments complete
- [ ] CNC operators can't see cutting operators' jobs and vice versa
- [ ] Time tracking works per operator per job
- [ ] Statistics show correct completed jobs count
- [ ] Supervisor can see all assignments in table

## Migration Notes

If migrating from old single-assignment system:
- Old `assigned_to` field in parts table will be dropped
- All existing assignments need to be migrated to job_assignments table
- Recommend backing up database before migration
