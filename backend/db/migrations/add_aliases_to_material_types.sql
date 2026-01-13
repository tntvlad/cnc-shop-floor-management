-- Migration: Add aliases column to material_types table
-- This allows storing alternative/equivalent names for each material type

-- Add aliases column (stored as JSON array of strings)
ALTER TABLE material_types 
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

-- Update density column to ensure it exists
ALTER TABLE material_types 
ALTER COLUMN density TYPE DECIMAL(10,4);

-- Add comment for documentation
COMMENT ON COLUMN material_types.aliases IS 'Alternative names for this material type (e.g., AlMg3, EN AW-5754, 3.3535 are all the same aluminum alloy)';
COMMENT ON COLUMN material_types.density IS 'Material density in kg/dm³';

-- Example: Update some common materials with their aliases
-- UPDATE material_types SET aliases = ARRAY['EN AW-6061', 'AlMg1SiCu', '3.3211'] WHERE name = 'Aluminum 6061';
-- UPDATE material_types SET aliases = ARRAY['EN AW-7075', 'AlZn5.5MgCu', '3.4365'] WHERE name = 'Aluminum 7075';
