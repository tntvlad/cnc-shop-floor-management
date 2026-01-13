-- Migration 001: Enhance material_types table
-- Adds specification fields and equivalence support

-- Add specification fields to material_types
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS specification_code VARCHAR(50);
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS specification_standard VARCHAR(50);
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS specification_name TEXT;
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS material_grade VARCHAR(100);
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS equivalent_to_id INTEGER REFERENCES material_types(id);
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN DEFAULT false;
ALTER TABLE material_types ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_types_spec_code ON material_types(specification_code);
CREATE INDEX IF NOT EXISTS idx_material_types_equivalent_to ON material_types(equivalent_to_id);
CREATE INDEX IF NOT EXISTS idx_material_types_category ON material_types(category);

-- Add comments for documentation
COMMENT ON COLUMN material_types.specification_code IS 'Material specification code (e.g., 1.2027, 6061-T6)';
COMMENT ON COLUMN material_types.specification_standard IS 'Standard body (EN, ASTM, DIN, ISO)';
COMMENT ON COLUMN material_types.material_grade IS 'Material grade or temper designation';
COMMENT ON COLUMN material_types.equivalent_to_id IS 'Reference to parent equivalent material type';
COMMENT ON COLUMN material_types.is_preferred IS 'Mark as preferred material in equivalence group';
