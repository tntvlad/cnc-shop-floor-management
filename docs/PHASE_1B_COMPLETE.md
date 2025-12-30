# Phase 1B Implementation - Complete

## ✅ What's Implemented

### 1. Batch Splitting & Merging
**Scenario:** You have 100 pieces to mill. Split to two operators for parallel work.

**Endpoints:**
- `POST /api/parts/:partId/split-batches` - Split part into multiple batches
- `POST /api/parts/:parentPartId/merge-batches` - Merge batches back together

**Example:**
```json
POST /api/parts/5/split-batches
{
  "batches": [
    { "quantity": 50, "batch_number": "Batch 1 of 2", "notes": "Assigned to Operator A" },
    { "quantity": 50, "batch_number": "Batch 2 of 2", "notes": "Assigned to Operator B" }
  ]
}

Response:
{
  "success": true,
  "originalPartId": 5,
  "batchIds": [10, 11],
  "batches": [
    { "batchId": 10, "batchNumber": "Batch 1 of 2", "quantity": 50 },
    { "batchId": 11, "batchNumber": "Batch 2 of 2", "quantity": 50 }
  ]
}
```

**Data Structure:**
```
Part 5 (100 qty)
├── batch_number: "Main"
├── parent_part_id: NULL
└── is_batch_split: true

Part 10 (50 qty) - BATCH 1
├── batch_number: "Batch 1 of 2"
├── parent_part_id: 5
└── quantity_in_batch: 50

Part 11 (50 qty) - BATCH 2
├── batch_number: "Batch 2 of 2"
├── parent_part_id: 5
└── quantity_in_batch: 50
```

---

### 2. Drawing Revision Control
**Scenario:** Customer changes spec from "Rev A" to "Rev B". Must track changes and alert operators.

**Endpoints:**
- `PUT /api/parts/:partId/revision` - Update drawing revision
- `GET /api/parts/:partId/revision-history` - View all revisions

**Example:**
```json
PUT /api/parts/5/revision
{
  "revision": "Rev B",
  "notes": "Customer changed hole tolerance from ±0.5mm to ±0.25mm - REWORK FIRST 10 PIECES"
}

Response:
{
  "success": true,
  "message": "Drawing revision updated to Rev B",
  "part": {
    "id": 5,
    "drawing_revision": "Rev B",
    "drawing_revision_date": "2025-12-27T14:30:00Z",
    "revision_notes": "Customer changed hole tolerance..."
  }
}
```

**Data Structure:**
```
Part 5:
├── drawing_revision: "Rev B"
├── drawing_revision_date: TIMESTAMP (auto-updated)
└── revision_notes: "Customer changed hole tolerance..."
```

**Revision History View:**
```
Rev A (2025-12-26) → Original design
Rev B (2025-12-27) → Hole tolerance changed
Rev C (2025-12-28) → Surface finish changed
```

---

### 3. Setup Time vs Runtime Tracking
**Scenario:** Mill job needs 15 min setup, then 3 min per piece × 50 pieces = 165 total minutes

**Endpoints:**
- `POST /api/parts/:partId/time-estimates` - Set estimated times
- `POST /api/parts/:partId/record-times` - Record actual times after job
- `GET /api/parts/:partId/time-analysis` - Compare estimated vs actual

**Example - Set Estimates:**
```json
POST /api/parts/5/time-estimates
{
  "setupTime": 15,           // minutes
  "runTimePerPiece": 3,      // minutes per piece
  "setupInstructions": "Mount part in vise, set tool offset to Z=0.00, run probe cycle"
}

Response:
{
  "success": true,
  "estimates": {
    "estimated_setup_time": 15,
    "estimated_run_time_per_piece": 3,
    "estimated_time": 165,     // 15 + (3 × 50)
    "setup_instructions": "...",
    "totalQuantity": 50,
    "breakdown": {
      "setupTime": 15,
      "runtimePerPiece": 3,
      "totalRuntime": 150,
      "total": 165
    }
  }
}
```

**Example - Record Actual Times:**
```json
POST /api/parts/5/record-times
{
  "actualSetupTime": 18,     // took 18 min (3 min over)
  "actualRunTime": 155       // took 155 min total (5 min under estimate)
}

Response:
{
  "success": true,
  "times": {
    "estimated": {
      "setup": 15,
      "perPiece": 3,
      "total": 165
    },
    "actual": {
      "setup": 18,
      "runtime": 155,
      "total": 173
    },
    "efficiency": "95%"        // 165 / 173 = 95% (under is bad, over 100% is good)
  }
}
```

**Time Analysis:**
```json
GET /api/parts/5/time-analysis

{
  "success": true,
  "analysis": {
    "part": { "id": 5, "name": "Bearing Plate", "quantity": 50 },
    "setup": {
      "estimated": 15,
      "actual": 18,
      "variance": +3           // took 3 min longer
    },
    "runtime": {
      "estimatedPerPiece": 3,
      "estimatedTotal": 150,
      "actualTotal": 155,
      "variance": +5           // took 5 min longer
    },
    "total": {
      "estimated": 165,
      "actual": 173,
      "efficiency": "95%"
    }
  }
}
```

**Data Structure:**
```
Part 5:
├── estimated_setup_time: 15
├── estimated_run_time_per_piece: 3
├── estimated_time: 165        // auto-calculated
├── setup_instructions: "..."
├── actual_setup_time: 18
├── actual_run_time: 155
├── actual_time: 173           // auto-calculated
└── updated_at: TIMESTAMP
```

---

### 4. Priority Auto-Calculation
**Scenario:** Supervisor needs to know which jobs to assign first to optimize shop floor.

**Priority Score Factors (0-1000):**
- **Due Date (0-400 pts)** - Urgent (0-3 days): 350-400pts
- **Material Ready (0-200 pts)** - Materials available: +200pts
- **Stage Progression (0-150 pts)** - Ready to machine: +150pts  
- **Setup Time (0-100 pts)** - Quick setup: +100pts
- **Priority Override (±150 pts)** - Urgent order: +150pts

**Endpoints:**
- `POST /api/parts/:partId/calculate-priority` - Calculate and save priority score
- `GET /api/priority-queue` - Get all parts ranked by priority

**Example - Calculate:**
```json
POST /api/parts/5/calculate-priority

Response:
{
  "success": true,
  "priority": {
    "score": 720,
    "factors": {
      "daysUntilDue": 2,
      "dueDateScore": 350,
      "materialReadyScore": 200,
      "stageScore": 150,
      "setupTimeScore": 20,
      "priorityBonus": 0
    }
  }
}
```

**Priority Queue - See All Jobs Ranked:**
```json
GET /api/priority-queue

{
  "success": true,
  "queue": [
    {
      "id": 8,
      "part_name": "Emergency gasket",
      "quantity": 10,
      "priority_score": 850,      // HIGHEST
      "stage": "assigned",
      "due_date": "2025-12-28",
      "customer_name": "Acme Corp"
    },
    {
      "id": 5,
      "part_name": "Bearing Plate",
      "quantity": 50,
      "priority_score": 720,      // SECOND
      "stage": "assigned",
      "due_date": "2025-12-30",
      "customer_name": "Smith Mfg"
    },
    {
      "id": 3,
      "part_name": "Valve Housing",
      "quantity": 25,
      "priority_score": 450,      // THIRD
      "stage": "programming",
      "due_date": "2026-01-15",
      "customer_name": "Tech Parts"
    }
  ]
}
```

**Data Structure:**
```
Part 5:
├── priority: 0                    // manual 1-5 priority
├── priority_score: 720            // auto-calculated 0-1000
└── priority_factors: {
      "daysUntilDue": 2,
      "dueDateScore": 350,
      ...
    }
```

---

## 🔌 API Routes Summary

| Method | Endpoint | Permission | Use Case |
|--------|----------|-----------|----------|
| POST | `/api/parts/:partId/split-batches` | Supervisor | Split job for parallel ops |
| POST | `/api/parts/:parentPartId/merge-batches` | Supervisor | Combine batches back together |
| PUT | `/api/parts/:partId/revision` | Supervisor | Update drawing revision |
| GET | `/api/parts/:partId/revision-history` | Any | See all drawing versions |
| POST | `/api/parts/:partId/time-estimates` | Supervisor | Set setup/runtime times |
| POST | `/api/parts/:partId/record-times` | Any | Record actual times after job |
| GET | `/api/parts/:partId/time-analysis` | Any | Compare estimated vs actual |
| POST | `/api/parts/:partId/calculate-priority` | Supervisor | Calculate priority score |
| GET | `/api/priority-queue` | Any | Get jobs ranked by priority |

---

## 📊 Database Fields Added

**Parts Table - New Columns:**
```sql
-- Phase 1A (already in schema)
material_id INTEGER
status VARCHAR(50)
description TEXT

-- Phase 1B
batch_number VARCHAR(50)              -- e.g., "Batch 1 of 2"
quantity_in_batch INTEGER             -- qty in this batch
parent_part_id INTEGER                -- link to original part
is_batch_split BOOLEAN DEFAULT false

drawing_revision VARCHAR(20)          -- e.g., "Rev B"
drawing_revision_date TIMESTAMP
revision_notes TEXT

estimated_setup_time INTEGER          -- minutes
estimated_run_time_per_piece INTEGER  -- minutes per piece
actual_setup_time INTEGER
actual_run_time INTEGER
estimated_time INTEGER                -- total (setup + run)
actual_time INTEGER

setup_instructions TEXT

priority INTEGER DEFAULT 0            -- manual 1-5
priority_score INTEGER                -- auto-calculated 0-1000
priority_factors JSONB                -- breakdown of calculation
```

---

## 🚀 Usage Examples

### Scenario 1: Production Split for Parallel Work
```
Customer orders 100 connector blocks, due in 2 days

1. Create order with 1 part (100 qty)
2. Supervisor reviews: Material ready, high priority (2 days)
3. Has 2 mills available
4. Split part: 50 qty → Mill 1, 50 qty → Mill 2
5. Each operator gets 50-piece batch
6. Both complete in parallel, 4 hours vs 8 hours
```

**API Calls:**
```bash
# 1. Create order & part (Phase 1A)
POST /api/orders
POST /api/orders/:id/parts

# 2. Split into batches
POST /api/parts/5/split-batches
{ "batches": [
  {"quantity": 50, "batch_number": "Batch 1 of 2"},
  {"quantity": 50, "batch_number": "Batch 2 of 2"}
]}

# 3. Calculate priority
POST /api/parts/5/calculate-priority

# 4. Assign each batch to operator (already in Phase 1A)
POST /api/parts/10/assign-machining { "assigned_to": 2 }
POST /api/parts/11/assign-machining { "assigned_to": 3 }
```

---

### Scenario 2: Drawing Change Mid-Production
```
Part partially complete, customer sends new revision

1. Supervisor uploads new rev B drawing
2. Updates part revision record
3. System alerts: "Rev changed! Rework already completed pieces?"
4. Tracks before/after revision quantities separately
```

**API Calls:**
```bash
# Update revision
PUT /api/parts/5/revision
{
  "revision": "Rev B",
  "notes": "Hole tolerance ±0.25mm instead of ±0.5mm - REWORK FIRST 20 PIECES"
}

# Check history
GET /api/parts/5/revision-history

# Results show:
# Rev A: 20 pieces completed
# Rev B: Updated 2025-12-27 14:30
# Status: Need to rework those 20 pieces
```

---

### Scenario 3: Time Estimation & Analysis
```
Supervisor estimates times, operator works, compares actual

1. Part created
2. Supervisor sets: 15 min setup + 3 min per piece
3. Operator starts job timer (Phase 1A)
4. Operator finishes, records actual times
5. System calculates efficiency & learns for future estimates
```

**API Calls:**
```bash
# 1. Set estimates
POST /api/parts/5/time-estimates
{
  "setupTime": 15,
  "runTimePerPiece": 3,
  "setupInstructions": "Mount in vise, set offset, probe"
}

# 2. After job completes
POST /api/parts/5/record-times
{
  "actualSetupTime": 18,
  "actualRunTime": 155
}

# 3. Analyze
GET /api/parts/5/time-analysis
# Shows: 165 min estimated, 173 actual, 95% efficiency
```

---

### Scenario 4: Smart Job Assignment
```
Multiple jobs waiting. Supervisor needs priority order to assign.

1. System auto-calculates priority for all waiting jobs
2. Supervisor sees ranked list
3. Assigns highest priority first
4. Scheduler can predict finish times
```

**API Calls:**
```bash
# Auto-calc priority for each part
for part_id in 5,6,7,8; do
  POST /api/parts/$part_id/calculate-priority
done

# Get ranked queue
GET /api/priority-queue

# Returns sorted by score (highest first)
# Supervisor assigns in order, knowing they're optimized
```

---

## 🎯 Next Steps

**Phase 2 (When Ready):**
- [ ] Operator skills/certifications
- [ ] First article inspection (FAI)
- [ ] Notifications system
- [ ] Part dependencies
- [ ] Cost tracking

**To Deploy Phase 1B:**

1. **Reset database** with fixed schema:
```bash
docker exec cnc-postgres psql -U postgres -d cnc_shop_floor -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker cp backend/db/schema-v2-complete.sql cnc-postgres:/tmp/schema-v2.sql
docker exec cnc-postgres psql -U postgres -d cnc_shop_floor -f /tmp/schema-v2.sql
```

2. **Restart backend:**
```bash
docker restart cnc-backend
```

3. **Test endpoints** (use Postman or curl):
```bash
# Login
POST /api/auth/login

# Create order
POST /api/orders

# Create part with 100 qty
POST /api/orders/1/parts

# Split into batches
POST /api/parts/1/split-batches

# Set time estimates
POST /api/parts/1/time-estimates

# Calculate priority
POST /api/parts/1/calculate-priority

# Get priority queue
GET /api/priority-queue
```

---

## 📝 Notes

- **Batch splitting** creates new part records (good for parallel tracking)
- **Revision history** stored in database (can't be lost)
- **Time estimates** used for scheduling (actual times improve future estimates)
- **Priority scores** auto-update when part moves through workflow
- All Phase 1B endpoints require authentication
- Batch/revision/time operations require supervisor permission (except recording times)

Enjoy Phase 1B! 🎯
