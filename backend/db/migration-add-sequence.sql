-- Migration: Add sequence field to job_assignments
-- This preserves existing data while adding the new field

-- Add sequence column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='job_assignments' AND column_name='sequence'
    ) THEN
        ALTER TABLE job_assignments ADD COLUMN sequence INTEGER;
        
        -- Set sequence based on user level for existing assignments
        -- Group by part_id and assign sequence
        WITH ranked AS (
            SELECT 
                ja.id,
                ja.part_id,
                u.level,
                ROW_NUMBER() OVER (PARTITION BY ja.part_id ORDER BY u.level ASC) as seq
            FROM job_assignments ja
            JOIN users u ON ja.user_id = u.id
        )
        UPDATE job_assignments ja
        SET sequence = ranked.seq
        FROM ranked
        WHERE ja.id = ranked.id;
        
        -- Make sequence NOT NULL after populating
        ALTER TABLE job_assignments ALTER COLUMN sequence SET NOT NULL;
        
        RAISE NOTICE 'Added sequence column to job_assignments';
    ELSE
        RAISE NOTICE 'Column sequence already exists, skipping';
    END IF;
END $$;

-- Update status values to new format
-- Convert old statuses to new workflow statuses
UPDATE job_assignments SET status = 'ready' WHERE sequence = 1 AND status = 'pending';
UPDATE job_assignments SET status = 'locked' WHERE sequence > 1 AND status = 'pending';

-- Verify changes
SELECT COUNT(*) as total_assignments, 
       COUNT(DISTINCT part_id) as parts_with_assignments,
       COUNT(CASE WHEN sequence IS NOT NULL THEN 1 END) as assignments_with_sequence
FROM job_assignments;
