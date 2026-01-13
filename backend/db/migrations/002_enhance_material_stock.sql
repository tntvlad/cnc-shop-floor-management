-- Migration 002: Enhance material_stock table
-- Adds material type linking, size indexing, and quality tracking

-- Add enhanced tracking fields to material_stock
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS material_type_id INTEGER REFERENCES material_types(id);
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS specification_code VARCHAR(50);
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS size_index DECIMAL(10,4);
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS size_category VARCHAR(50);
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS last_used_date TIMESTAMP;
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS supplier_batch_number VARCHAR(100);
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS quality_status VARCHAR(50) DEFAULT 'new';
ALTER TABLE material_stock ADD COLUMN IF NOT EXISTS inspection_required BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_stock_material_type_id ON material_stock(material_type_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_size_index ON material_stock(size_index);
CREATE INDEX IF NOT EXISTS idx_material_stock_size_category ON material_stock(size_category);
CREATE INDEX IF NOT EXISTS idx_material_stock_quality_status ON material_stock(quality_status);
CREATE INDEX IF NOT EXISTS idx_material_stock_shape_type ON material_stock(shape_type);

-- Create function to calculate size_index based on shape
CREATE OR REPLACE FUNCTION calculate_size_index(
    p_shape_type VARCHAR,
    p_diameter DECIMAL,
    p_width DECIMAL,
    p_height DECIMAL,
    p_thickness DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    CASE p_shape_type
        WHEN 'bar_round' THEN
            RETURN COALESCE(p_diameter, 0);
        WHEN 'bar_square' THEN
            RETURN COALESCE(p_width * p_width, 0);
        WHEN 'bar_hex' THEN
            RETURN COALESCE(p_width, 0);
        WHEN 'plate' THEN
            RETURN COALESCE(p_width * p_height * p_thickness, 0);
        WHEN 'sheet' THEN
            RETURN COALESCE(p_width * p_height * p_thickness, 0);
        WHEN 'tube' THEN
            RETURN COALESCE(p_diameter * p_thickness, 0);
        ELSE
            RETURN COALESCE(p_width * p_height, 0);
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to determine size_category
CREATE OR REPLACE FUNCTION determine_size_category(p_size_index DECIMAL) 
RETURNS VARCHAR AS $$
BEGIN
    IF p_size_index < 10 THEN
        RETURN 'small';
    ELSIF p_size_index < 50 THEN
        RETURN 'medium';
    ELSIF p_size_index < 200 THEN
        RETURN 'large';
    ELSE
        RETURN 'extra_large';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-calculate size_index on insert/update
CREATE OR REPLACE FUNCTION update_material_stock_size_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW.size_index := calculate_size_index(
        NEW.shape_type,
        NEW.diameter,
        NEW.width,
        NEW.height,
        NEW.thickness
    );
    NEW.size_category := determine_size_category(NEW.size_index);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_stock_size_index ON material_stock;
CREATE TRIGGER trg_material_stock_size_index
    BEFORE INSERT OR UPDATE ON material_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_material_stock_size_index();

-- Update existing records with calculated size_index
UPDATE material_stock 
SET size_index = calculate_size_index(shape_type, diameter, width, height, thickness),
    size_category = determine_size_category(
        calculate_size_index(shape_type, diameter, width, height, thickness)
    )
WHERE size_index IS NULL;

-- Add comments
COMMENT ON COLUMN material_stock.material_type_id IS 'Foreign key to material_types table';
COMMENT ON COLUMN material_stock.size_index IS 'Calculated index for size-based matching';
COMMENT ON COLUMN material_stock.size_category IS 'Size category: small, medium, large, extra_large';
COMMENT ON COLUMN material_stock.quality_status IS 'Quality status: new, tested, used, restricted';
