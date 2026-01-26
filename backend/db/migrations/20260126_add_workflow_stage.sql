-- Migration: Consolidate to workflow_stage column (remove stage column)
-- Date: 2026-01-26
-- Description: Consolidates stage columns to use only workflow_stage for Kanban workflow

-- Add workflow_stage column if it doesn't exist
ALTER TABLE parts ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT 'pending';

-- Migrate data from old stage column to workflow_stage (if stage exists and workflow_stage is null)
UPDATE parts 
SET workflow_stage = CASE 
    WHEN stage = 'material_planning' THEN 'pending'
    WHEN stage = 'cutting' THEN 'cutting'
    WHEN stage = 'programming' THEN 'programming'
    WHEN stage IN ('assigned', 'in_progress') THEN 'machining'
    WHEN stage IN ('qc_pending', 'qc_approved') THEN 'qc'
    WHEN stage = 'shipped' THEN 'completed'
    ELSE 'pending'
END
WHERE workflow_stage IS NULL OR workflow_stage = 'pending';

-- Add comment for documentation
COMMENT ON COLUMN parts.workflow_stage IS 'Workflow stage for Kanban board: pending → cutting → programming → machining → qc → completed';

-- Create index for faster filtering by workflow_stage
CREATE INDEX IF NOT EXISTS idx_parts_workflow_stage ON parts(workflow_stage);

-- Note: The old 'stage' column can be dropped after verifying the migration:
-- ALTER TABLE parts DROP COLUMN IF EXISTS stage;
