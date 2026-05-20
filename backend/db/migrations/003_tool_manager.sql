-- ============================================================
-- Migration 003: CNC Cutting Tool Storage Manager
-- Date: 2026-05-20
-- Description: Full cutting tool management module
--   - tool_categories, tool_brands, tool_cabinets (new tables)
--   - tool_price_history, tool_transactions, tool_usage_log (new tables)
--   - Expand existing `tools` table with new columns
-- Run: docker exec -it cnc-postgres psql -U cnc_user -d cnc_db -f /path/to/003_tool_manager.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. REFERENCE / LOOKUP TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-load standard cutting tool categories
INSERT INTO tool_categories (name, code, description) VALUES
    ('End Mill', 'ENDMILL', 'Flat, ball-nose, and corner-radius end mills for milling operations'),
    ('Drill Bit', 'DRILL', 'Twist drills, center drills, spot drills for hole-making'),
    ('Tap', 'TAP', 'Threading taps for internal threads (hand, spiral point, spiral flute)'),
    ('Reamer', 'REAMER', 'Finish-sizing of drilled holes to close tolerances'),
    ('Boring Bar', 'BORING', 'Single-point tools for enlarging and finishing bored holes'),
    ('Face Mill', 'FACEMILL', 'Large-diameter indexable face mills for surfacing operations'),
    ('Insert - Turning', 'INS-TURN', 'Indexable inserts for turning operations (CNMG, TNMG, etc.)'),
    ('Insert - Milling', 'INS-MILL', 'Indexable inserts for milling cutters'),
    ('Turning Tool Holder', 'TURN-HOLD', 'Tool holders/shanks for indexable turning inserts'),
    ('Grooving Tool', 'GROOVE', 'External and internal grooving / parting tools'),
    ('Threading Tool', 'THREAD', 'External/internal threading tooling'),
    ('Chamfer Mill', 'CHAMFER', 'Chamfer cutters and countersinks'),
    ('T-Slot Cutter', 'TSLOT', 'T-slot milling cutters for keyways and T-slots'),
    ('Slot Drill', 'SLOTDRILL', '2-flute slot drills for slot milling and plunging'),
    ('Step Drill', 'STEPDRILL', 'Multi-diameter step drills'),
    ('Other', 'OTHER', 'Miscellaneous cutting tools not in above categories')
ON CONFLICT (code) DO NOTHING;

-- ============================================================

CREATE TABLE IF NOT EXISTS tool_brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    country VARCHAR(100),
    website VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-load common CNC tool brands
INSERT INTO tool_brands (name, country, website) VALUES
    ('Sandvik Coromant', 'Sweden', 'https://www.sandvik.coromant.com'),
    ('Kennametal', 'USA', 'https://www.kennametal.com'),
    ('Iscar', 'Israel', 'https://www.iscar.com'),
    ('Seco Tools', 'Sweden', 'https://www.secotools.com'),
    ('Walter Tools', 'Germany', 'https://www.walter-tools.com'),
    ('Mitsubishi Materials', 'Japan', 'https://www.mmc.co.jp'),
    ('Kyocera', 'Japan', 'https://www.kyocera.com'),
    ('YG-1', 'South Korea', 'https://www.yg1.kr'),
    ('Guhring', 'Germany', 'https://www.guehring.com'),
    ('OSG', 'Japan', 'https://www.osg.co.jp'),
    ('Fraisa', 'Switzerland', 'https://www.fraisa.com'),
    ('Local / Generic', NULL, NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================================

CREATE TABLE IF NOT EXISTS tool_cabinets (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    location_description VARCHAR(255),
    total_drawers INTEGER DEFAULT 1,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. EXPAND EXISTING `tools` TABLE
-- ============================================================

-- Relationships
ALTER TABLE tools ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES tool_categories(id) ON DELETE SET NULL;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES tool_brands(id) ON DELETE SET NULL;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS cabinet_id INTEGER REFERENCES tool_cabinets(id) ON DELETE SET NULL;

-- Storage slot within cabinet (e.g. "D3-S7" = Drawer 3, Slot 7)
ALTER TABLE tools ADD COLUMN IF NOT EXISTS drawer_slot VARCHAR(20);

-- Shop's own internal code / label sticker
ALTER TABLE tools ADD COLUMN IF NOT EXISTS internal_code VARCHAR(50);

-- Detailed specifications
ALTER TABLE tools ADD COLUMN IF NOT EXISTS tool_material VARCHAR(50);
-- Values: 'HSS', 'Solid Carbide', 'Carbide Tipped', 'Ceramic', 'CBN', 'PCD'

ALTER TABLE tools ADD COLUMN IF NOT EXISTS coating VARCHAR(50);
-- Values: 'Uncoated', 'TiN', 'TiCN', 'TiAlN', 'AlTiN', 'DLC', 'Other'

ALTER TABLE tools ADD COLUMN IF NOT EXISTS flute_count SMALLINT;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS shank_diameter DECIMAL(8,2);  -- mm
ALTER TABLE tools ADD COLUMN IF NOT EXISTS cutting_length DECIMAL(8,2);  -- mm (usable cutting length)
ALTER TABLE tools ADD COLUMN IF NOT EXISTS overall_length DECIMAL(8,2);  -- mm (overall including shank)

-- Lifecycle management
ALTER TABLE tools ADD COLUMN IF NOT EXISTS is_resharpable BOOLEAN DEFAULT false;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'sharpening', 'worn', 'retired'));
ALTER TABLE tools ADD COLUMN IF NOT EXISTS parts_produced_total INTEGER DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS parts_since_sharpen INTEGER DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS expected_tool_life INTEGER;  -- parts count before replacement

-- Cost (current/latest price, synced from tool_price_history on insert)
ALTER TABLE tools ADD COLUMN IF NOT EXISTS current_cost DECIMAL(10,2);

-- Image
ALTER TABLE tools ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tools_brand ON tools(brand_id);
CREATE INDEX IF NOT EXISTS idx_tools_supplier ON tools(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tools_cabinet ON tools(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tools_internal_code ON tools(internal_code);

-- ============================================================
-- 3. TRANSACTION / HISTORY TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_price_history (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'RON',
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_order_number VARCHAR(100),
    invoice_number VARCHAR(100),
    quantity_purchased INTEGER DEFAULT 1,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_price_history_tool ON tool_price_history(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_price_history_date ON tool_price_history(purchase_date DESC);

-- ============================================================

CREATE TABLE IF NOT EXISTS tool_transactions (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL
        CHECK (transaction_type IN ('stock_in', 'stock_out', 'adjust', 'damaged', 'to_sharpen', 'from_sharpen', 'retired')),
    quantity INTEGER NOT NULL DEFAULT 1,
    quantity_after INTEGER,  -- quantity_available after this transaction
    part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    condition VARCHAR(20) DEFAULT 'good'
        CHECK (condition IN ('new', 'good', 'worn', 'damaged')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_transactions_tool ON tool_transactions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_type ON tool_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_date ON tool_transactions(created_at DESC);

-- ============================================================

CREATE TABLE IF NOT EXISTS tool_usage_log (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
    machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
    operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    parts_produced INTEGER DEFAULT 0,
    condition_after VARCHAR(20) DEFAULT 'good'
        CHECK (condition_after IN ('good', 'worn', 'damaged')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON tool_usage_log(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_part ON tool_usage_log(part_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_date ON tool_usage_log(created_at DESC);

COMMIT;
