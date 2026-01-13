-- ============================================================================
-- MATERIALS MANAGEMENT UPGRADE
-- Adds shapes, dimensions, suppliers, storage locations, and transactions
-- ============================================================================

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Romania',
    lead_time_days INTEGER DEFAULT 7,
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STORAGE LOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS storage_locations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    zone VARCHAR(50),
    shelf VARCHAR(50),
    description TEXT,
    capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MATERIAL TYPES TABLE (Reference table for material categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS material_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'metal', 'plastic', 'composite'
    density DECIMAL(10,4), -- kg/dm³ for weight calculations
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ADD NEW COLUMNS TO MATERIAL_STOCK
-- ============================================================================
DO $$
BEGIN
    -- Shape type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'shape_type') THEN
        ALTER TABLE material_stock ADD COLUMN shape_type VARCHAR(50);
    END IF;
    
    -- Dimensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'diameter') THEN
        ALTER TABLE material_stock ADD COLUMN diameter DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'width') THEN
        ALTER TABLE material_stock ADD COLUMN width DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'height') THEN
        ALTER TABLE material_stock ADD COLUMN height DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'thickness') THEN
        ALTER TABLE material_stock ADD COLUMN thickness DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'length') THEN
        ALTER TABLE material_stock ADD COLUMN length DECIMAL(10,2);
    END IF;
    
    -- Storage location
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'location_id') THEN
        ALTER TABLE material_stock ADD COLUMN location_id INTEGER REFERENCES storage_locations(id);
    END IF;
    
    -- Status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'status') THEN
        ALTER TABLE material_stock ADD COLUMN status VARCHAR(50) DEFAULT 'available';
    END IF;
    
    -- Reserved quantity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'reserved_stock') THEN
        ALTER TABLE material_stock ADD COLUMN reserved_stock DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Unit weight
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'unit_weight') THEN
        ALTER TABLE material_stock ADD COLUMN unit_weight DECIMAL(10,4);
    END IF;
    
    -- Total value
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_stock' AND column_name = 'total_value') THEN
        ALTER TABLE material_stock ADD COLUMN total_value DECIMAL(12,2);
    END IF;
END $$;

-- ============================================================================
-- MATERIAL TRANSACTIONS TABLE (Stock In/Out/Transfer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS material_transactions (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES material_stock(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'stock_in', 'stock_out', 'transfer', 'adjustment', 'reserved'
    quantity DECIMAL(10,2) NOT NULL,
    from_location_id INTEGER REFERENCES storage_locations(id),
    to_location_id INTEGER REFERENCES storage_locations(id),
    order_id INTEGER,
    part_id INTEGER,
    reference_number VARCHAR(100),
    notes TEXT,
    performed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Default Storage Locations
INSERT INTO storage_locations (code, zone, shelf, description) VALUES
('1A', 'Zone 1', 'Shelf A', 'Metal raw materials - Round bars'),
('1B', 'Zone 1', 'Shelf B', 'Metal raw materials - Square/Flat bars'),
('1C', 'Zone 1', 'Shelf C', 'Metal raw materials - Plates'),
('2A', 'Zone 2', 'Shelf A', 'Aluminum materials'),
('2B', 'Zone 2', 'Shelf B', 'Plastics - Engineering plastics'),
('2C', 'Zone 2', 'Shelf C', 'Plastics - High performance'),
('3A', 'Zone 3', 'Shelf A', 'Stainless steel'),
('3B', 'Zone 3', 'Shelf B', 'Special alloys')
ON CONFLICT (code) DO NOTHING;

-- Default Material Types
INSERT INTO material_types (name, category, density, description) VALUES
('Aluminum 6061', 'metal', 2.70, 'General purpose aluminum alloy, good machinability'),
('Aluminum 7075', 'metal', 2.81, 'High strength aluminum alloy'),
('Steel 1018', 'metal', 7.87, 'Low carbon mild steel'),
('Steel 4140', 'metal', 7.85, 'Chromium-molybdenum alloy steel'),
('Stainless Steel 304', 'metal', 8.00, 'Austenitic stainless steel'),
('Stainless Steel 316', 'metal', 8.00, 'Marine grade stainless steel'),
('Brass C360', 'metal', 8.50, 'Free-cutting brass'),
('Copper C101', 'metal', 8.94, 'Oxygen-free copper'),
('POM (Delrin)', 'plastic', 1.41, 'Acetal homopolymer'),
('PEEK', 'plastic', 1.32, 'High performance thermoplastic'),
('Nylon 6', 'plastic', 1.14, 'General purpose nylon'),
('PTFE (Teflon)', 'plastic', 2.20, 'Low friction plastic'),
('HDPE', 'plastic', 0.95, 'High-density polyethylene'),
('Acrylic (PMMA)', 'plastic', 1.18, 'Transparent thermoplastic')
ON CONFLICT (name) DO NOTHING;

-- Default Suppliers
INSERT INTO suppliers (name, contact_person, email, phone, address, city, lead_time_days) VALUES
('MetalSupply SRL', 'Ion Popescu', 'comenzi@metalsupply.ro', '+40721123456', 'Str. Industriei 15', 'București', 7),
('AluminiumPro SA', 'Maria Ionescu', 'vanzari@aluminiumpro.ro', '+40722234567', 'Bd. Metalurgiei 23', 'Cluj-Napoca', 10),
('PlasticTech SRL', 'Andrei Georgescu', 'office@plastictech.ro', '+40723345678', 'Str. Polimeri 8', 'Timișoara', 14)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_material_stock_shape ON material_stock(shape_type);
CREATE INDEX IF NOT EXISTS idx_material_stock_location ON material_stock(location_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_status ON material_stock(status);
CREATE INDEX IF NOT EXISTS idx_material_transactions_material ON material_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_material_transactions_type ON material_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_material_transactions_date ON material_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- ============================================================================
-- UPDATE TRIGGER FOR material_stock
-- ============================================================================
CREATE OR REPLACE FUNCTION update_material_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    -- Calculate total value
    IF NEW.cost_per_unit IS NOT NULL AND NEW.current_stock IS NOT NULL THEN
        NEW.total_value = NEW.cost_per_unit * NEW.current_stock;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_material_stock ON material_stock;
CREATE TRIGGER trigger_update_material_stock
    BEFORE UPDATE ON material_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_material_stock_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE suppliers IS 'Material suppliers and vendors';
COMMENT ON TABLE storage_locations IS 'Physical storage locations in the workshop';
COMMENT ON TABLE material_types IS 'Reference table for material categories and properties';
COMMENT ON TABLE material_transactions IS 'Stock movements and adjustments history';
COMMENT ON COLUMN material_stock.shape_type IS 'Shape: bar_round, bar_square, bar_hex, plate, tube, sheet';
COMMENT ON COLUMN material_stock.status IS 'Status: available, reserved, low_stock, out_of_stock, damaged';
