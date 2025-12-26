-- Migration: Resequence job_assignments to order Cutting → CNC → QC
-- Safe to run multiple times; preserves existing statuses except initial pending/locked

WITH ranked AS (
  SELECT 
    ja.id,
    ja.part_id,
    ROW_NUMBER() OVER (
      PARTITION BY ja.part_id 
      ORDER BY CASE u.level 
                 WHEN 200 THEN 1  -- Cutting first
                 WHEN 100 THEN 2  -- CNC second
                 WHEN 300 THEN 3  -- QC third
                 ELSE 99          -- Others last
               END, ja.id
    ) AS seq
  FROM job_assignments ja
  JOIN users u ON ja.user_id = u.id
)
UPDATE job_assignments ja
SET sequence = ranked.seq
FROM ranked
WHERE ja.id = ranked.id;

-- Initialize statuses where appropriate (do not touch in_progress/completed)
UPDATE job_assignments SET status = 'ready'
WHERE sequence = 1 AND status IN ('pending','locked');

UPDATE job_assignments SET status = 'locked'
WHERE sequence > 1 AND status IN ('pending','ready');

-- Summary
SELECT COUNT(*) AS total_assignments,
       COUNT(DISTINCT part_id) AS parts_with_assignments
FROM job_assignments;
