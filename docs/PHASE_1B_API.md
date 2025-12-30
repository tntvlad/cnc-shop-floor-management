# Phase 1B API Reference

## Authentication
All endpoints require `Authorization: Bearer <jwt_token>` header.

---

## Batch Splitting & Merging

### Split Part Into Batches
**POST** `/api/parts/:partId/split-batches`

**Permission:** Supervisor+

**Request Body:**
```json
{
  "batches": [
    {
      "quantity": 50,
      "batch_number": "Batch 1 of 2",
      "notes": "Assign to Operator A"
    },
    {
      "quantity": 50,
      "batch_number": "Batch 2 of 2", 
      "notes": "Assign to Operator B"
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Part split into batches successfully",
  "originalPartId": 5,
  "batchIds": [10, 11],
  "batches": [
    {
      "batchId": 10,
      "batchNumber": "Batch 1 of 2",
      "quantity": 50
    },
    {
      "batchId": 11,
      "batchNumber": "Batch 2 of 2",
      "quantity": 50
    }
  ]
}
```

**Error Responses:**
- 400: Must provide at least 2 batches
- 400: Batch quantities must match original quantity
- 404: Part not found
- 500: Database error

---

### Merge Batches
**POST** `/api/parts/:parentPartId/merge-batches`

**Permission:** Supervisor+

**Request Body:**
```json
{
  "batchIds": [10, 11]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Batches merged successfully",
  "parentPartId": 5,
  "mergedQuantity": 100
}
```

**Error Responses:**
- 400: No valid batches found
- 404: Parent part not found
- 500: Database error

---

## Drawing Revision Control

### Update Drawing Revision
**PUT** `/api/parts/:partId/revision`

**Permission:** Supervisor+

**Request Body:**
```json
{
  "revision": "Rev B",
  "notes": "Customer changed hole tolerance from ±0.5mm to ±0.25mm. ALERT: 15 pieces already done on Rev A"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Drawing revision updated to Rev B",
  "part": {
    "id": 5,
    "drawing_revision": "Rev B",
    "drawing_revision_date": "2025-12-27T14:30:00Z",
    "revision_notes": "Customer changed hole tolerance from ±0.5mm to ±0.25mm. ALERT: 15 pieces already done on Rev A"
  }
}
```

**Error Responses:**
- 400: Revision is required
- 404: Part not found
- 500: Database error

---

### Get Revision History
**GET** `/api/parts/:partId/revision-history`

**Permission:** Any authenticated user

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "revisions": [
    {
      "id": 5,
      "part_name": "Bearing Plate",
      "drawing_revision": "Rev B",
      "drawing_revision_date": "2025-12-27T14:30:00Z",
      "revision_notes": "Customer changed hole tolerance",
      "stage": "in_progress",
      "updated_at": "2025-12-27T14:30:00Z"
    },
    {
      "id": 5,
      "part_name": "Bearing Plate",
      "drawing_revision": "Rev A",
      "drawing_revision_date": "2025-12-26T10:00:00Z",
      "revision_notes": null,
      "stage": "cutting",
      "updated_at": "2025-12-26T10:00:00Z"
    }
  ]
}
```

**Error Responses:**
- 404: Part not found
- 500: Database error

---

## Setup & Runtime Tracking

### Set Time Estimates
**POST** `/api/parts/:partId/time-estimates`

**Permission:** Supervisor+

**Request Body:**
```json
{
  "setupTime": 15,
  "runTimePerPiece": 3,
  "setupInstructions": "Mount part in vise, set tool offset to Z=0.00, run automatic probe cycle"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Time estimates set successfully",
  "estimates": {
    "estimated_setup_time": 15,
    "estimated_run_time_per_piece": 3,
    "estimated_time": 165,
    "setup_instructions": "Mount part in vise...",
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

**Error Responses:**
- 400: Setup time and runtime per piece are required
- 404: Part not found
- 500: Database error

---

### Record Actual Times
**POST** `/api/parts/:partId/record-times`

**Permission:** Any authenticated user (typically operator completing job)

**Request Body:**
```json
{
  "actualSetupTime": 18,
  "actualRunTime": 155
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Actual times recorded",
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
    "efficiency": "95%"
  }
}
```

**Notes:**
- Efficiency calculation: `(estimated_total / actual_total) * 100`
- Values > 100% mean faster than estimated (good!)
- Values < 100% mean slower than estimated (learning opportunity)

**Error Responses:**
- 400: Both actual times are required
- 404: Part not found
- 500: Database error

---

### Get Time Analysis
**GET** `/api/parts/:partId/time-analysis`

**Permission:** Any authenticated user

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "analysis": {
    "part": {
      "id": 5,
      "name": "Bearing Plate",
      "quantity": 50
    },
    "setup": {
      "estimated": 15,
      "actual": 18,
      "variance": 3
    },
    "runtime": {
      "estimatedPerPiece": 3,
      "estimatedTotal": 150,
      "actualTotal": 155,
      "variance": 5
    },
    "total": {
      "estimated": 165,
      "actual": 173,
      "efficiency": "95%"
    }
  }
}
```

**Error Responses:**
- 404: Part not found
- 500: Database error

---

## Priority Calculation

### Calculate Priority Score
**POST** `/api/parts/:partId/calculate-priority`

**Permission:** Supervisor+

**Request Body:** None (uses part and order data from database)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Priority calculated and saved",
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

**Priority Score Breakdown:**
- **Due Date (0-400 pts)**
  - 0-3 days: 350-400 pts
  - 3-7 days: 300-350 pts
  - 7-14 days: 200-300 pts
  - 14-30 days: 100-200 pts
  - 30+ days: 50-100 pts

- **Material Ready (0-200 pts)**
  - Ready for cutting: 200 pts
  - In stock: 150 pts
  - Arrived: 100 pts
  - Other: 0 pts

- **Stage Progression (0-150 pts)**
  - material_planning: 0 pts
  - cutting: 50 pts
  - programming: 100 pts
  - assigned: 125 pts
  - in_progress: 150 pts

- **Setup Time (0-100 pts)**
  - ≤15 min: 100 pts
  - 15-30 min: 75 pts
  - 30-60 min: 50 pts
  - >60 min: 25 pts

- **Priority Override (±150 pts)**
  - urgent: +150 pts
  - high: +100 pts
  - normal: 0 pts
  - low: -50 pts

**Error Responses:**
- 404: Part not found
- 500: Database error

---

### Get Priority Queue
**GET** `/api/priority-queue`

**Permission:** Any authenticated user

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "queue": [
    {
      "id": 8,
      "part_name": "Emergency Gasket",
      "quantity": 10,
      "order_id": 3,
      "priority_score": 850,
      "priority_factors": {
        "daysUntilDue": 1,
        "dueDateScore": 400,
        "materialReadyScore": 200,
        "stageScore": 150,
        "setupTimeScore": 100,
        "priorityBonus": 0
      },
      "stage": "assigned",
      "material_status": "ready_for_cutting",
      "estimated_time": 35,
      "customer_name": "Acme Corp",
      "due_date": "2025-12-28T17:00:00Z"
    },
    {
      "id": 5,
      "part_name": "Bearing Plate",
      "quantity": 50,
      "order_id": 2,
      "priority_score": 720,
      "priority_factors": {
        "daysUntilDue": 2,
        "dueDateScore": 350,
        "materialReadyScore": 200,
        "stageScore": 150,
        "setupTimeScore": 20,
        "priorityBonus": 0
      },
      "stage": "assigned",
      "material_status": "ready_for_cutting",
      "estimated_time": 165,
      "customer_name": "Smith Manufacturing",
      "due_date": "2025-12-30T17:00:00Z"
    }
  ]
}
```

**Notes:**
- Returns up to 50 parts
- Filters out completed parts and held parts
- Sorted by priority_score DESC, then due_date ASC
- Use this to populate supervisor job assignment dashboard

**Error Responses:**
- 500: Database error

---

## Complete Workflow Example

### Create Order with Phase 1B Features

```bash
#!/bin/bash

TOKEN="your_jwt_token"
BASE_URL="http://192.168.8.226:5000/api"

# 1. Create order
ORDER_RESPONSE=$(curl -X POST "$BASE_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Acme Corp",
    "customer_email": "orders@acme.com",
    "customer_phone": "555-1234",
    "order_date": "2025-12-27",
    "due_date": "2025-12-30",
    "notes": "Priority order - customer wants quick turnaround"
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order.id')
echo "Created Order: $ORDER_ID"

# 2. Add part to order (100 pieces)
PART_RESPONSE=$(curl -X POST "$BASE_URL/orders/$ORDER_ID/parts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "part_name": "Bearing Plate",
    "quantity": 100,
    "description": "Aluminum 6061 bearing mount",
    "material_id": 1
  }')

PART_ID=$(echo $PART_RESPONSE | jq -r '.parts[0].id')
echo "Created Part: $PART_ID (100 qty)"

# 3. Split into 2 batches for parallel machining
curl -X POST "$BASE_URL/parts/$PART_ID/split-batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batches": [
      { "quantity": 50, "batch_number": "Batch 1 of 2" },
      { "quantity": 50, "batch_number": "Batch 2 of 2" }
    ]
  }' | jq .

# 4. Set time estimates for original part
curl -X POST "$BASE_URL/parts/$PART_ID/time-estimates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "setupTime": 20,
    "runTimePerPiece": 2.5,
    "setupInstructions": "Mount in vice, set offset, run probe"
  }' | jq .

# 5. Calculate priority
curl -X POST "$BASE_URL/parts/$PART_ID/calculate-priority" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Get priority queue
curl -X GET "$BASE_URL/priority-queue" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 7. Update drawing revision
curl -X PUT "$BASE_URL/parts/$PART_ID/revision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "revision": "Rev B",
    "notes": "Hole tolerance changed to ±0.25mm"
  }' | jq .

# 8. After job completion, record actual times
curl -X POST "$BASE_URL/parts/$PART_ID/record-times" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualSetupTime": 22,
    "actualRunTime": 245
  }' | jq .

# 9. View time analysis
curl -X GET "$BASE_URL/parts/$PART_ID/time-analysis" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

Common HTTP Status Codes:
- **200** - Success
- **201** - Created
- **400** - Bad request (missing/invalid parameters)
- **404** - Not found
- **500** - Server error

Always check `success` flag in response body.

---

## Rate Limiting

No rate limiting implemented yet.

---

## Versioning

API Version: 1.0 (Phase 1B)

Future versions will be prefixed: `/api/v2/...`

---

## Testing

Use Postman collection included in project, or:

```bash
# Test with curl
curl -X POST "http://localhost:5000/api/parts/5/split-batches" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "batches": [
    { "quantity": 50, "batch_number": "Batch 1 of 2" },
    { "quantity": 50, "batch_number": "Batch 2 of 2" }
  ]
}
EOF
```

---

## Support

For issues or questions, check:
- [PHASE_1B_COMPLETE.md](PHASE_1B_COMPLETE.md) - Usage examples
- Backend logs: `docker logs cnc-backend`
- Database: `docker exec cnc-postgres psql -U postgres -d cnc_shop_floor`
