-- Migration: Add location column to machines table
-- Date: 2026-01-27

ALTER TABLE machines ADD COLUMN IF NOT EXISTS location VARCHAR(100);

-- Also make machine_type and machine_number nullable since they may not always be needed
ALTER TABLE machines ALTER COLUMN machine_type DROP NOT NULL;
ALTER TABLE machines ALTER COLUMN machine_number DROP NOT NULL;

-- Drop the unique constraint on machine_type, machine_number since they can be null now
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_machine_type_machine_number_key;
