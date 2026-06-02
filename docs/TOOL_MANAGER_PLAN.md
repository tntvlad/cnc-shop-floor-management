# CNC Tool Storage Manager — Plan & Architecture

## Overview

A dedicated module for managing CNC cutting tool inventory in the shop floor management system.
Covers the full lifecycle: purchase → storage → use → sharpening → retirement.

---

## Status

| Feature | Status | Commit |
|---------|--------|--------|
| Core inventory (tools, brands, categories) | ✅ Done | Initial |
| Price history & stock transactions | ✅ Done | Initial |
| Application types | ✅ Done | — |
| Storage hierarchy (Location > Cabinet > Shelf > Box) | ✅ Done | `81c6c39` |
| Tool usage log per operation | ⏳ Planned | — |
| Tool image upload | ⏳ Planned | — |
| QR code label printing | ⏳ Planned | — |

---

## Goals

- Track every cutting tool (end mills, drills, taps, inserts, boring bars, etc.)
- Record brand, supplier, price history (cost over time)
- Manage stock: quantities, minimum reorder points, low-stock alerts
- Physical storage location: 4-level hierarchy — Location > Cabinet > Shelf > Box
- Auto-generated location code from hierarchy codes (e.g. `LOC1-CAB2-SH3-BX1`)
- Track tool wear: parts produced, expected life, sharpening cycles
- Provide a complete audit trail (transactions + usage log)

---

## Database Schema

### New tables

| Table | Purpose |
|-------|---------|
| `tool_categories` | Pre-loaded reference: End Mill, Drill, Tap, etc. (16 types) |
| `tool_brands` | Pre-loaded reference: Sandvik, Kennametal, Iscar, etc. (12 brands) |
| `tool_locations` | Top-level physical zones (e.g. "Tool Room A") — migration 006 |
| `tool_cabinets` | Cabinets within a location (linked to `tool_locations`) |
| `tool_shelves` | Shelves within a cabinet — migration 006 |
| `tool_boxes` | Boxes/bins within a shelf — migration 006 |
| `tool_price_history` | Price per purchase event, linked to supplier |
| `tool_transactions` | Stock movements: in/out/adjust/damaged/to_sharpen/from_sharpen/retired |
| `tool_usage_log` | Per-operation usage: tool + part + machine + operator + condition |

### Extended: `tools` table (ALTER TABLE)

Added columns:
- `category_id` → FK tool_categories
- `brand_id` → FK tool_brands
- `supplier_id` → FK suppliers (existing table)
- `cabinet_id` → FK tool_cabinets
- `shelf_id` → FK tool_shelves *(migration 006)*
- `box_id` → FK tool_boxes *(migration 006)*
- `drawer_slot` (VARCHAR) — legacy, replaced by shelf/box hierarchy
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
  db/migrations/003_tool_manager.sql        ← core DDL (tools, brands, categories, etc.)
  db/migrations/006_storage_hierarchy.sql   ← Location > Cabinet > Shelf > Box hierarchy
  models/Tool.js                             ← data access layer (all CRUD + hierarchy methods)
  controllers/toolsController.js             ← request handlers
  routes/tools.js                            ← Express router
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
| GET | /api/tools/locations | 100+ | Location list |
| POST | /api/tools/locations | 400+ | Create location |
| PUT | /api/tools/locations/:id | 400+ | Update location |
| DELETE | /api/tools/locations/:id | 400+ | Delete location |
| GET | /api/tools/cabinets | 100+ | Cabinet list (filterable by ?location_id=) |
| POST | /api/tools/cabinets | 400+ | Create cabinet |
| PUT | /api/tools/cabinets/:id | 400+ | Update cabinet |
| DELETE | /api/tools/cabinets/:id | 400+ | Delete cabinet |
| GET | /api/tools/shelves | 100+ | Shelf list (filterable by ?cabinet_id=) |
| POST | /api/tools/shelves | 400+ | Create shelf |
| PUT | /api/tools/shelves/:id | 400+ | Update shelf |
| DELETE | /api/tools/shelves/:id | 400+ | Delete shelf |
| GET | /api/tools/boxes | 100+ | Box list (filterable by ?shelf_id=) |
| POST | /api/tools/boxes | 400+ | Create box |
| PUT | /api/tools/boxes/:id | 400+ | Update box |
| DELETE | /api/tools/boxes/:id | 400+ | Delete box |
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
   - Inventory — searchable/filterable table with all tools; location column shows full hierarchy code (e.g. `LOC1-CAB2-SH3-BX1`)
   - Low Stock — alert table showing tools below minimum
   - Brands — reference table with edit
   - Storage — 4 sub-tabs:
     - **Locations** — top-level zones (code, name, description, cabinet count)
     - **Cabinets** — cabinets per location (code, name, location badge, shelf count, tool count)
     - **Shelves** — shelves per cabinet (filterable by cabinet; code, name, box count, tool count)
     - **Boxes** — boxes per shelf (filterable by shelf; code, name, tool count)

3. **Modals**
   - Tool Detail — full info + price history chart + transaction log
   - Add/Edit Tool — cascade selects: Location → Cabinet → Shelf → Box; live Location Code preview
   - Stock In/Out — simple quantity + notes form
   - Add Price Record — date, price, supplier, PO/invoice
   - Add/Edit Brand — name, country, website
   - Add/Edit Location — code, name, description
   - Add/Edit Cabinet — code, name, location (select)
   - Add/Edit Shelf — code, name, cabinet (select)
   - Add/Edit Box — code, name, shelf (select)

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

Run migrations in order after each deployment:

```bash
# Migration 003 — core tool manager (run once at initial setup)
docker exec cnc-postgres psql -U postgres -d cnc_shop_floor \
  -f /tmp/003_tool_manager.sql

# Migration 006 — storage hierarchy (Location > Cabinet > Shelf > Box)
docker cp backend/db/migrations/006_storage_hierarchy.sql cnc-postgres:/tmp/006.sql
docker exec cnc-postgres psql -U postgres -d cnc_shop_floor -f /tmp/006.sql
```

---

## Future Enhancements

- Tool image upload (`image_path` column ready)
- QR code label printing for cabinet drawers / shelf labels
- Usage logging per operation (`tool_usage_log` table already created)
- Tool life percentage gauge in inventory table
- Export to CSV / PDF for procurement
- Supplier comparison chart (price over time by supplier)
- Integration with order parts: auto-assign tools to machining operations
