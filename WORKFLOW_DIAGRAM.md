# Multi-Assignment Job System - Visual Flow Diagram

## Database Relationship Diagram

```
┌─────────────────────────────────────────────────────┐
│                    PARTS TABLE                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ id (PK)                                      │   │
│  │ name, material, quantity, target_time        │   │
│  │ order_position, completed, locked            │   │
│  │ created_at                                   │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ 1..* (one part has many assignments)
                       │
┌──────────────────────▼──────────────────────────────┐
│              JOB_ASSIGNMENTS TABLE (NEW)            │
│  ┌──────────────────────────────────────────────┐   │
│  │ id (PK)                                      │   │
│  │ part_id (FK) → PARTS.id                      │   │
│  │ user_id (FK) → USERS.id                      │   │
│  │ status: 'pending'|'in_progress'|'completed'  │   │
│  │ assigned_at, started_at, completed_at        │   │
│  │ actual_time (minutes)                        │   │
│  │ UNIQUE(part_id, user_id)                     │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ 1..* (one user has many assignments)
                       │
┌──────────────────────▼──────────────────────────────┐
│                   USERS TABLE                        │
│  ┌──────────────────────────────────────────────┐   │
│  │ id (PK)                                      │   │
│  │ employee_id, name, password_hash             │   │
│  │ level: 100=CNC, 200=Cutting, 300=QC,        │   │
│  │        400=Supervisor, 500=Admin            │   │
│  │ created_at                                   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Job Assignment Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPERVISOR ACTION                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Selects job in Supervisor Dashboard
                              │ Clicks "Assign to Users"
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            ASSIGNMENT MODAL APPEARS                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ☑ CNC Operator 1 (ID: 2)                               │    │
│  │ ☑ Cutting Operator 1 (ID: 3)                           │    │
│  │ ☐ QC Inspector 1 (ID: 4)                               │    │
│  │ ┌──────────────┐ ┌──────────────────────┐              │    │
│  │ │ Cancel       │ │ Assign Selected      │              │    │
│  │ └──────────────┘ └──────────────────────┘              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/parts/:id/assign
                              │ { userIds: [2, 3] }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            CREATE TWO ASSIGNMENTS                                │
│                                                                   │
│  JOB_ASSIGNMENTS Record 1:                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ part_id: 5                                              │    │
│  │ user_id: 2 (CNC Operator)                               │    │
│  │ status: 'pending'                                       │    │
│  │ assigned_at: 2025-12-26 10:30:00                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  JOB_ASSIGNMENTS Record 2:                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ part_id: 5                                              │    │
│  │ user_id: 3 (Cutting Operator)                           │    │
│  │ status: 'pending'                                       │    │
│  │ assigned_at: 2025-12-26 10:30:00                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            SUPERVISOR SEES IN TABLE:                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Order │ Name │ Material │ Qty │ Target │ Assignments   │    │
│  │─────────────────────────────────────────────────────────│    │
│  │ 5     │ Part │ Steel    │ 20  │ 120    │ EMP01(pending)│    │
│  │       │      │          │     │        │ EMP02(pending)│    │
│  │                                    [Assign to Users] │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Operator Dashboard View

```
┌──────────────────────────────────────────────────────────────────┐
│  CNC OPERATOR DASHBOARD                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐     ┌──────────────────┐                   │
│  │  Part Card       │     │  Part Card       │                   │
│  │ ┌──────────────┐ │     │ ┌──────────────┐ │                   │
│  │ │ Shaft Conn   │ │     │ │ Housing      │ │                   │
│  │ │ ┌──────────┐ │ │     │ │ ┌──────────┐ │ │                   │
│  │ │ │ PENDING  │ │ │     │ │ │COMPLETED │ │ │                   │
│  │ │ └──────────┘ │ │     │ │ └──────────┘ │ │                   │
│  │ │ Steel 4140   │ │     │ │ Aluminum     │ │                   │
│  │ │ Qty: 25      │ │     │ │ Qty: 30      │ │                   │
│  │ │ Target: 180m │ │     │ │ Target: 90m  │ │                   │
│  │ └──────────────┘ │     │ └──────────────┘ │                   │
│  │ [Click to work]  │     │ [Completed]     │                   │
│  └──────────────────┘     └──────────────────┘                   │
│                                                                   │
│  Note: ONLY shows jobs assigned to CNC Operator                  │
│  Does NOT show Cutting Operator's jobs                           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  CUTTING OPERATOR DASHBOARD                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐     ┌──────────────────┐                   │
│  │  Part Card       │     │  Part Card       │                   │
│  │ ┌──────────────┐ │     │ ┌──────────────┐ │                   │
│  │ │ Shaft Conn   │ │     │ │ Bracket      │ │                   │
│  │ │ ┌──────────┐ │ │     │ │ ┌──────────┐ │ │                   │
│  │ │ │PENDING   │ │ │     │ │ │ PENDING  │ │ │                   │
│  │ │ └──────────┘ │ │     │ │ └──────────┘ │ │                   │
│  │ │ Steel 4140   │ │     │ │ Aluminum     │ │                   │
│  │ │ Qty: 25      │ │     │ │ Qty: 50      │ │                   │
│  │ │ Target: 180m │ │     │ │ Target: 120m │ │                   │
│  │ └──────────────┘ │     │ └──────────────┘ │                   │
│  │ [Click to work]  │     │ [Click to work] │                   │
│  └──────────────────┘     └──────────────────┘                   │
│                                                                   │
│  Note: DIFFERENT jobs than CNC Operator                          │
└──────────────────────────────────────────────────────────────────┘
```

## Job Completion Flow

```
BEFORE COMPLETION
┌────────────────────────────────────────────────┐
│ PART 5: "Shaft Connector"                      │
│ ┌──────────────────────────────────────────┐   │
│ │ JOB_ASSIGNMENTS:                         │   │
│ │ • ID:2 (CNC Operator) - PENDING          │   │
│ │ • ID:3 (Cutting Operator) - PENDING      │   │
│ └──────────────────────────────────────────┘   │
│ PARTS table:                                   │
│ • completed = FALSE                            │
│ • locked = FALSE (available for work)          │
└────────────────────────────────────────────────┘
                      │
                      │ CNC Operator completes
                      │ POST /api/parts/5/complete
                      ▼
┌────────────────────────────────────────────────┐
│ AFTER CNC COMPLETION                           │
│ ┌──────────────────────────────────────────┐   │
│ │ JOB_ASSIGNMENTS:                         │   │
│ │ • ID:2 (CNC Operator) - COMPLETED ✓      │   │
│ │ • ID:3 (Cutting Operator) - PENDING      │   │
│ └──────────────────────────────────────────┘   │
│ PARTS table:                                   │
│ • completed = FALSE (still not done)           │
│ • locked = FALSE                               │
│                                                │
│ Supervisor sees "completed" for CNC Operator  │
│ Cutting Operator still sees job as "PENDING"   │
└────────────────────────────────────────────────┘
                      │
                      │ Cutting Operator completes
                      │ POST /api/parts/5/complete
                      ▼
┌────────────────────────────────────────────────┐
│ AFTER ALL COMPLETE                             │
│ ┌──────────────────────────────────────────┐   │
│ │ JOB_ASSIGNMENTS:                         │   │
│ │ • ID:2 (CNC Operator) - COMPLETED ✓      │   │
│ │ • ID:3 (Cutting Operator) - COMPLETED ✓  │   │
│ └──────────────────────────────────────────┘   │
│ PARTS table:                                   │
│ • completed = TRUE ✓✓ (JOB DONE!)              │
│ • locked = FALSE                               │
│                                                │
│ PART 6 (next):                                 │
│ • locked = FALSE (UNLOCKED - ready to work!)   │
└────────────────────────────────────────────────┘
```

## Status State Machine

```
                  ┌─────────────────┐
                  │  UNASSIGNED     │ (no job_assignments)
                  └────────┬────────┘
                           │
                    Supervisor assigns
                    to 1+ operators
                           │
                           ▼
                  ┌─────────────────┐
                  │  PENDING ⏳      │ (status='pending')
                  │ (wait to start)  │
                  └────────┬────────┘
                           │
                    Operator starts
                    job (clicks work)
                           │
                           ▼
                  ┌─────────────────┐
                  │  IN_PROGRESS ▶  │ (status='in_progress')
                  │ (operator works) │
                  └────────┬────────┘
                           │
                    Operator completes
                    (submits actual_time)
                           │
                           ▼
                  ┌─────────────────┐
                  │  COMPLETED ✓    │ (status='completed')
                  │ (done)          │
                  └─────────────────┘

NOTE: Each operator tracks their own status independently.
      The PART is only marked completed when ALL assignments are completed.
```

## Example: Complete Workflow

```
SCENARIO: Assign "Bracket Mount" job to CNC Operator and Cutting Operator

TIME 10:00 AM - SUPERVISOR
  └─ Assigns job ID=5 to users [2, 3]
  └─ Creates: job_assignments(part_id=5, user_id=2, status='pending')
  └─ Creates: job_assignments(part_id=5, user_id=3, status='pending')

TIME 10:05 AM - CNC OPERATOR (ID=2)
  └─ Login to Dashboard
  └─ Sees "Bracket Mount" with status "PENDING"
  └─ Clicks job card to open
  └─ Clicks "Start" button
  └─ Updates: job_assignments SET status='in_progress', started_at=NOW()
  └─ Starts working on part

TIME 10:45 AM - CNC OPERATOR (ID=2)
  └─ Finishes work
  └─ Clicks "Complete" button
  └─ Submits actual_time=45 (minutes)
  └─ Updates: job_assignments SET status='completed', completed_at=NOW(), actual_time=45
  └─ Job card now shows "COMPLETED" ✓

TIME 10:45 AM - CUTTING OPERATOR (ID=3)
  └─ Still sees job as "PENDING" (because their assignment is still pending)
  └─ Can start working when ready

TIME 11:15 AM - CUTTING OPERATOR (ID=3)
  └─ Starts working
  └─ Updates: job_assignments SET status='in_progress'

TIME 12:00 PM - CUTTING OPERATOR (ID=3)
  └─ Finishes work
  └─ Submits actual_time=105
  └─ Updates: job_assignments SET status='completed'
  └─ System detects: ALL assignments for part_id=5 are completed
  └─ Updates: parts SET completed=TRUE WHERE id=5
  └─ Unlocks: parts SET locked=FALSE WHERE order_position=6

TIME 12:00 PM - SUPERVISOR
  └─ Refreshes Supervisor Dashboard
  └─ Sees Part 5: "EMP01(completed) EMP02(completed)"
  └─ Part 6 is now available for new assignments
```

---

This visual representation helps understand how the multi-assignment system coordinates multiple operators working on the same job with independent progress tracking.
