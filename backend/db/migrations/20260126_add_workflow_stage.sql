-- Migration: Add workflow_stage column to parts table
-- Date: 2026-01-26
-- Description: Adds workflow_stage column for visual Kanban workflow tracking

-- Add workflow_stage column if it doesn't exist
ALTER TABLE parts ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN parts.workflow_stage IS 'Visual workflow stage for Kanban board: pending → cutting → programming → machining → qc → completed';

-- Create index for faster filtering by workflow_stage
CREATE INDEX IF NOT EXISTS idx_parts_workflow_stage ON parts(workflow_stage);
