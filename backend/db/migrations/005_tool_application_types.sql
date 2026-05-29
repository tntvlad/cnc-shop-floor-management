-- Migration 005: Tool Application Types
-- Adds a lookup table for what material a tool is designed to cut (Steel, Aluminum, etc.)
-- with a color per type for visual identification in the UI.

CREATE TABLE IF NOT EXISTS tool_application_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    color       VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default types (Romanian names to match user's workflow)
INSERT INTO tool_application_types (name, color, description) VALUES
    ('Otel (Steel)',        '#3b82f6', 'Carbon steel, tool steel, structural steel'),
    ('Aluminiu',            '#f59e0b', 'Aluminium alloys'),
    ('Inox (Stainless)',    '#8b5cf6', 'Stainless steel, AISI 304/316'),
    ('Fonta (Cast Iron)',   '#6b7280', 'Grey cast iron, ductile iron'),
    ('Cupru / Alama',       '#d97706', 'Copper, brass, bronze'),
    ('Universal',           '#10b981', 'Multi-material, general purpose')
ON CONFLICT (name) DO NOTHING;

-- Add application_type_id column to tools table
ALTER TABLE tools
    ADD COLUMN IF NOT EXISTS application_type_id INTEGER
        REFERENCES tool_application_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tools_application_type_id ON tools(application_type_id);
