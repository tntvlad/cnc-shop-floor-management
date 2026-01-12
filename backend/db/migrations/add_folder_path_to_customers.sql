-- Migration: Add folder_path column to customers table
-- Run this on existing databases to add the folder_path feature

-- Add folder_path column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'folder_path'
    ) THEN
        ALTER TABLE customers ADD COLUMN folder_path VARCHAR(500);
        RAISE NOTICE 'Added folder_path column to customers table';
    ELSE
        RAISE NOTICE 'folder_path column already exists';
    END IF;
END $$;
