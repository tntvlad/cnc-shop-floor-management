# Phase 1A API Reference

## Orders Endpoints

### Create Order
```
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "customer_name": "string",           // required
  "customer_email": "string@email",    // required
  "customer_phone": "string",          // optional
  "order_date": "YYYY-MM-DD",          // required
  "due_date": "YYYY-MM-DD",            // required
  "notes": "string",                   // optional
  "parts": [                           // optional
    {
      "part_name": "string",           // required
      "quantity": number,              // optional (default: 1)
      "description": "string",         // optional
      "material_id": number            // optional
    }
  ]
}

Response:
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "id": number,
    "customer_name": "string",
    "customer_email": "string",
    "order_date": "ISO date",
    "due_date": "ISO date",
    "status": "pending",
    "created_at": "ISO timestamp"
  }
}
```

### List Orders
```
GET /api/orders?status=pending&customer=acme&limit=50&offset=0
Authorization: Bearer <token>

Query Parameters:
- status: "pending" | "in-progress" | "paused" | "completed" | "cancelled" (optional)
- customer: search string (optional)
- limit: number (default: 50)
- offset: number (default: 0)

Response:
{
  "success": true,
  "orders": [
    {
      "id": number,
      "customer_name": "string",
      "customer_email": "string",
      "customer_phone": "string",
      "order_date": "ISO date",
      "due_date": "ISO date",
      "status": "string",
      "notes": "string",
      "created_at": "ISO timestamp",
      "part_count": number,
      "completed_parts": number
    }
  ],
  "total": number
}
```

### Get Order Details
```
GET /api/orders/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "order": {
    "id": number,
    "customer_name": "string",
    "customer_email": "string",
    "customer_phone": "string",
    "order_date": "ISO date",
    "due_date": "ISO date",
    "status": "string",
    "notes": "string",
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp",
    "parts": [
      {
        "id": number,
        "part_name": "string",
        "quantity": number,
        "description": "string",
        "status": "string",
        "workflow_stage": "string",
        "material_id": number,
        "material_name": "string",
        "estimated_setup_time": number,
        "estimated_run_time": number,
        "batch_number": "string",
        "quantity_scrapped": number,
        "created_at": "ISO timestamp"
      }
    ]
  }
}
```

### Update Order
```
PUT /api/orders/:id
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body (all optional):
{
  "customer_name": "string",
  "customer_email": "string@email",
  "customer_phone": "string",
  "due_date": "YYYY-MM-DD",
  "notes": "string"
}

Response: Updated order object
```

### Update Order Status
```
PUT /api/orders/:id/status
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "status": "pending" | "in-progress" | "paused" | "completed" | "cancelled"
}

Response: Updated order with new status
```

### Delete Order
```
DELETE /api/orders/:id
Authorization: Bearer <token>
(Supervisor+ required)

Response:
{
  "success": true,
  "message": "Order deleted successfully"
}
```

### Get Order Statistics
```
GET /api/orders/stats/summary
Authorization: Bearer <token>

Response:
{
  "success": true,
  "stats": {
    "total_orders": number,
    "pending_orders": number,
    "in_progress_orders": number,
    "completed_orders": number,
    "total_parts": number,
    "completed_parts": number,
    "avg_lead_days": number
  }
}
```

---

## Materials Endpoints

### List Materials
```
GET /api/materials?limit=100&offset=0
Authorization: Bearer <token>

Response:
{
  "success": true,
  "materials": [
    {
      "id": number,
      "material_name": "string",
      "material_type": "string",
      "supplier_id": number,
      "current_stock": number,
      "reorder_level": number,
      "unit": "string",
      "cost_per_unit": number,
      "notes": "string",
      "created_at": "ISO timestamp"
    }
  ],
  "total": number
}
```

### Get Material Details
```
GET /api/materials/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "material": {
    "id": number,
    "material_name": "string",
    "material_type": "string",
    "supplier_id": number,
    "current_stock": number,
    "reorder_level": number,
    "unit": "string",
    "cost_per_unit": number,
    "notes": "string",
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp",
    "transactions": [
      {
        "id": number,
        "material_id": number,
        "order_id": number,
        "quantity": number,
        "transaction_type": "add" | "remove" | "use",
        "notes": "string",
        "created_at": "ISO timestamp"
      }
    ]
  }
}
```

### Create Material
```
POST /api/materials
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "material_name": "string",      // required
  "material_type": "string",      // optional
  "supplier_id": number,          // optional
  "current_stock": number,        // optional
  "reorder_level": number,        // optional
  "unit": "string",               // required
  "cost_per_unit": number,        // optional
  "notes": "string"               // optional
}
```

### Update Material Stock
```
PUT /api/materials/:id
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body (all optional):
{
  "current_stock": number,
  "reorder_level": number,
  "cost_per_unit": number
}
```

### Adjust Material Stock
```
POST /api/materials/:id/adjust
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "quantity": number,                              // required
  "transaction_type": "add" | "remove" | "use",   // required
  "notes": "string"                                // optional
}

Response:
{
  "success": true,
  "message": "string",
  "newStock": number,
  "transaction": {
    "id": number,
    "material_id": number,
    "quantity": number,
    "transaction_type": "string",
    "created_at": "ISO timestamp"
  }
}
```

### Get Low Stock Alerts
```
GET /api/materials/alerts/low-stock
Authorization: Bearer <token>

Response:
{
  "success": true,
  "alerts": [
    {
      "id": number,
      "material_name": "string",
      "material_type": "string",
      "current_stock": number,
      "reorder_level": number,
      "unit": "string",
      "cost_per_unit": number,
      "alert_level": "out-of-stock" | "low-stock" | "ok"
    }
  ],
  "total": number
}
```

### Get Order Material Requirements
```
GET /api/orders/:orderId/material-requirements
Authorization: Bearer <token>

Response:
{
  "success": true,
  "requirements": [
    {
      "id": number,
      "material_name": "string",
      "material_type": "string",
      "current_stock": number,
      "reorder_level": number,
      "unit": "string",
      "cost_per_unit": number,
      "parts_using": number,
      "total_quantity_needed": number,
      "fulfillment_status": "in-stock" | "need-to-order"
    }
  ],
  "total": number
}
```

### Get Material Usage Report
```
GET /api/materials/reports/usage?days=30
Authorization: Bearer <token>

Query Parameters:
- days: number (default: 30)

Response:
{
  "success": true,
  "report": [
    {
      "material_name": "string",
      "material_type": "string",
      "unit": "string",
      "cost_per_unit": number,
      "quantity_used": number,
      "quantity_added": number,
      "cost_used": number
    }
  ],
  "period_days": number
}
```

---

## Workflow Endpoints

### Start Workflow Stage
```
POST /api/parts/:partId/workflow/start
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "stage": "cutting" | "programming" | "machining" | "qc" | "completed"
}

Response:
{
  "success": true,
  "message": "Part moved to {stage} stage",
  "part": {
    "id": number,
    "part_name": "string",
    "workflow_stage": "string",
    "status": "in-progress",
    "batch_number": "string"
  }
}
```

### Complete Workflow Stage
```
POST /api/parts/:partId/workflow/complete
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "notes": "string"  // optional
}

Response:
{
  "success": true,
  "message": "string stage completed, moving to {next_stage}",
  "part": {
    "id": number,
    "part_name": "string",
    "workflow_stage": "string",
    "status": "pending" | "completed",
    "batch_number": "string"
  }
}
```

### Hold Part
```
POST /api/parts/:partId/hold
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "reason": "string"  // optional
}

Response:
{
  "success": true,
  "message": "Part placed on hold",
  "part": {
    "id": number,
    "part_name": "string",
    "status": "on-hold",
    "hold_reason": "string"
  }
}
```

### Resume Part
```
POST /api/parts/:partId/resume
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body: {}

Response:
{
  "success": true,
  "message": "Part resumed",
  "part": {
    "id": number,
    "part_name": "string",
    "status": "in-progress",
    "workflow_stage": "string"
  }
}
```

### Record Scrap
```
POST /api/parts/:partId/scrap
Authorization: Bearer <token>
Content-Type: application/json
(Supervisor+ required)

Body:
{
  "quantity_scrapped": number,   // required
  "reason": "string",            // optional
  "notes": "string"              // optional
}

Response:
{
  "success": true,
  "message": "Scrap recorded",
  "part": {
    "id": number,
    "part_name": "string",
    "quantity": number,
    "quantity_scrapped": number
  }
}
```

---

## Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request (validation error)
- **401** - Unauthorized (missing/invalid token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **500** - Server Error

Error Response:
```json
{
  "success": false,
  "message": "Error description"
}
```
