-- Migration 004: Create material_suggestions table
-- Tracks material suggestions for parts/orders

CREATE TABLE IF NOT EXISTS material_suggestions (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    requested_material_type_id INTEGER REFERENCES material_types(id),
    requested_material_name VARCHAR(200),
    requested_width DECIMAL(10,2),
    requested_height DECIMAL(10,2),
    requested_thickness DECIMAL(10,2),
    requested_diameter DECIMAL(10,2),
    requested_quantity DECIMAL(10,2),
    suggested_stock_id INTEGER REFERENCES material_stock(id),
    suggestion_rank INTEGER,
    match_score DECIMAL(5,2),
    match_reason TEXT,
    category VARCHAR(50),
    size_score DECIMAL(5,2),
    availability_score DECIMAL(5,2),
    freshness_score DECIMAL(5,2),
    cost_score DECIMAL(5,2),
    quality_bonus DECIMAL(5,2),
    is_accepted BOOLEAN,
    is_rejected BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    accepted_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejected_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_suggestions_part_id ON material_suggestions(part_id);
CREATE INDEX IF NOT EXISTS idx_material_suggestions_stock_id ON material_suggestions(suggested_stock_id);
CREATE INDEX IF NOT EXISTS idx_material_suggestions_match_score ON material_suggestions(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_material_suggestions_accepted ON material_suggestions(is_accepted);
CREATE INDEX IF NOT EXISTS idx_material_suggestions_category ON material_suggestions(category);

-- Add comments
COMMENT ON TABLE material_suggestions IS 'Tracks all material suggestions for audit and learning';
COMMENT ON COLUMN material_suggestions.match_score IS 'Overall match score 0-100';
COMMENT ON COLUMN material_suggestions.category IS 'exact_match, close_fit, acceptable, last_resort';
