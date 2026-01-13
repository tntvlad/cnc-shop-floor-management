-- Migration 003: Create material_equivalents table
-- Many-to-many relationship for material equivalence

CREATE TABLE IF NOT EXISTS material_equivalents (
    id SERIAL PRIMARY KEY,
    material_type_id_primary INTEGER NOT NULL REFERENCES material_types(id) ON DELETE CASCADE,
    material_type_id_equivalent INTEGER NOT NULL REFERENCES material_types(id) ON DELETE CASCADE,
    equivalent_rank INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_type_id_primary, material_type_id_equivalent),
    CHECK (material_type_id_primary != material_type_id_equivalent)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_equivalents_primary ON material_equivalents(material_type_id_primary);
CREATE INDEX IF NOT EXISTS idx_material_equivalents_equivalent ON material_equivalents(material_type_id_equivalent);

-- Add comments
COMMENT ON TABLE material_equivalents IS 'Many-to-many material equivalence relationships';
COMMENT ON COLUMN material_equivalents.equivalent_rank IS 'Ranking: 1=primary equivalent, 2=secondary, etc.';
