-- Migration 006: Full storage hierarchy (Location > Cabinet > Shelf > Box)
-- Adds tool_locations, tool_shelves, tool_boxes tables
-- Links cabinets to locations, and extends tools with shelf/box FKs

-- 1. Top-level locations (zones / areas in the workshop)
CREATE TABLE IF NOT EXISTS tool_locations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Link existing cabinets to a location
ALTER TABLE tool_cabinets ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES tool_locations(id) ON DELETE SET NULL;

-- 3. Shelves within a cabinet
CREATE TABLE IF NOT EXISTS tool_shelves (
    id SERIAL PRIMARY KEY,
    cabinet_id INTEGER NOT NULL REFERENCES tool_cabinets(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cabinet_id, code)
);

-- 4. Boxes / slots on a shelf
CREATE TABLE IF NOT EXISTS tool_boxes (
    id SERIAL PRIMARY KEY,
    shelf_id INTEGER NOT NULL REFERENCES tool_shelves(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shelf_id, code)
);

-- 5. Extend tools table with shelf and box links
ALTER TABLE tools ADD COLUMN IF NOT EXISTS shelf_id INTEGER REFERENCES tool_shelves(id) ON DELETE SET NULL;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS box_id  INTEGER REFERENCES tool_boxes(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tool_cabinets_location ON tool_cabinets(location_id);
CREATE INDEX IF NOT EXISTS idx_tool_shelves_cabinet   ON tool_shelves(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_tool_boxes_shelf       ON tool_boxes(shelf_id);
CREATE INDEX IF NOT EXISTS idx_tools_shelf            ON tools(shelf_id);
CREATE INDEX IF NOT EXISTS idx_tools_box              ON tools(box_id);
