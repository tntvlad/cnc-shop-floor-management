# CNC Tool Storage Manager — Plan & Architecture

## Overview

A dedicated module for managing CNC cutting tool inventory in the shop floor management system.
Covers the full lifecycle: purchase → storage → use → sharpening → retirement.

---

## Goals

- Track every cutting tool (end mills, drills, taps, inserts, boring bars, etc.)
- Record brand, supplier, price history (cost over time)
- Manage stock: quantities, minimum reorder points, low-stock alerts
- Physical storage location: cabinets, drawers, drawer slots
- Track tool wear: parts produced, expected life, sharpening cycles
- Provide a complete audit trail (transactions + usage log)

---

## Database Schema

### New tables

| Table | Purpose |
|-------|---------|
| `tool_categories` | Pre-loaded reference: End Mill, Drill, Tap, etc. (16 types) |
| `tool_brands` | Pre-loaded reference: Sandvik, Kennametal, Iscar, etc. (12 brands) |
| `tool_cabinets` | Physical storage locations (user-managed) |
| `tool_price_history` | Price per purchase event, linked to supplier |
| `tool_transactions` | Stock movements: in/out/adjust/damaged/to_sharpen/from_sharpen/retired |
| `tool_usage_log` | Per-operation usage: tool + part + machine + operator + condition |

### Extended: `tools` table (ALTER TABLE)

Added columns:
- `category_id` → FK tool_categories
- `brand_id` → FK tool_brands
- `supplier_id` → FK suppliers (existing table)
- `cabinet_id` → FK tool_cabinets
- `drawer_slot` (VARCHAR) — e.g. "D3-S7"
- `internal_code` — shop sticker / label
- `tool_material` — HSS / Solid Carbide / Carbide Tipped / Ceramic / CBN / PCD
- `coating` — Uncoated / TiN / TiCN / TiAlN / AlTiN / DLC / Other
- `flute_count`, `shank_diameter`, `cutting_length`, `overall_length`
- `is_resharpable` (BOOLEAN)
- `status` — available / in_use / sharpening / worn / retired
- `parts_produced_total`, `parts_since_sharpen`, `expected_tool_life`
- `current_cost` — denormalized from last price record (RON)
- `image_path`

---

## Backend Architecture

### Files added

```
backend/
  db/migrations/003_tool_manager.sql   ← one-time DDL migration
  models/Tool.js                        ← data access layer
  controllers/toolsController.js        ← request handlers
  routes/tools.js                       ← Express router
```

### server.js changes

```js
const toolsRoutes = require('./routes/tools');
app.use('/api/tools', toolsRoutes);
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/tools | 100+ | List tools (filterable/paginated) |
| POST | /api/tools | 400+ | Create tool |
| GET | /api/tools/stats | 100+ | Summary stats |
| GET | /api/tools/low-stock | 100+ | Below minimum quantity |
| GET | /api/tools/categories | 100+ | Reference list |
| GET | /api/tools/brands | 100+ | Brand list |
| POST | /api/tools/brands | 400+ | Create brand |
| PUT | /api/tools/brands/:id | 400+ | Update brand |
| GET | /api/tools/cabinets | 100+ | Cabinet list |
| POST | /api/tools/cabinets | 400+ | Create cabinet |
| GET | /api/tools/:id | 100+ | Full tool detail |
| PUT | /api/tools/:id | 400+ | Update tool |
| DELETE | /api/tools/:id | 400+ | Retire tool (soft delete) |
| GET | /api/tools/:id/prices | 100+ | Price history |
| POST | /api/tools/:id/prices | 400+ | Add price record |
| GET | /api/tools/:id/transactions | 100+ | Stock transactions |
| POST | /api/tools/:id/stock-in | 200+ | Add stock |
| POST | /api/tools/:id/stock-out | 200+ | Remove stock |

---

## Frontend Architecture

### Files added

```
frontend/
  tools.html        ← main page (all modals inline)
  js/tools.js       ← all page logic
```

### Pages modified

- `frontend/index.html` — added 🔧 Tools nav link (visible level 100+)
- `frontend/js/dashboard.js` — show toolsLink for level >= 100

### UI Sections

1. **Stats row** — Total Active, Available, In Use, Low Stock, Out of Stock, Total Value
2. **Tabs**
   - Inventory — searchable/filterable table with all tools
   - Low Stock — alert table showing tools below minimum
   - Brands — reference table with edit
   - Cabinets — storage cabinet reference with add

3. **Modals**
   - Tool Detail — full info + price history chart + transaction log
   - Add/Edit Tool — all fields in organized grid sections
   - Stock In/Out — simple quantity + notes form
   - Add Price Record — date, price, supplier, PO/invoice
   - Add/Edit Brand — name, country, website
   - Add Cabinet — code, name, location, drawers

---

## Permission Model

| Level | Role | Capabilities |
|-------|------|-------------|
| 100 | CNC Operator | View tools, stock in/out |
| 200 | Cutting Op | View tools, stock in/out |
| 400 | Supervisor | Full create/edit/retire, price records, brands, cabinets |
| 500 | Admin | Everything |

---

## Data Flows

### Adding a new tool
1. Supervisor opens Add Tool modal
2. Fills tool_number, type, category, brand, dimensions, coating, stock qty, location
3. POST /api/tools → inserts into tools table with status='available'
4. Optionally add a price record: POST /api/tools/:id/prices

### Restocking
1. Operator clicks Stock In (+ button in inventory or detail modal)
2. Enters quantity and notes
3. POST /api/tools/:id/stock-in → UPDATE quantity_available, INSERT transaction

### Stock Out / Consumption
1. Operator clicks Stock Out (− button)
2. Enters quantity, condition (good/worn/damaged)
3. POST /api/tools/:id/stock-out → checks availability, UPDATE qty, INSERT transaction

### Sending for sharpening
1. Stock Out with type=to_sharpen
2. Operator later does Stock In with type=from_sharpen, which resets parts_since_sharpen

### Retiring a tool
1. Supervisor clicks Retire in tool detail modal
2. DELETE /api/tools/:id → sets status='retired', logs 'retired' transaction
3. Retired tools filtered out of main inventory by default

---

## Price History & Cost Tracking

- Every purchase is recorded in `tool_price_history`
- `tools.current_cost` is denormalized and updated on each new price record
- Price history table shows trend bar for visual comparison
- Low Stock tab shows cost/unit to facilitate reorder decisions

---

## Migration

Run once on server after deployment:

```bash
docker exec cnc-postgres psql -U cnc_user -d cnc_db \
  -f /DATA/AppData/cnc-shop-floor-management/backend/db/migrations/003_tool_manager.sql
```

---

## Future Enhancements

- Tool image upload (image_path column ready)
- QR code label printing for cabinet drawers
- Usage logging per operation (tool_usage_log table already created)
- Tool life percentage gauge in inventory table
- Export to CSV / PDF for procurement
- Supplier comparison chart (price over time by supplier)
- Integration with order parts: auto-assign tools to machining operations
