-- Migration: Fix order status consistency
-- Date: 2026-01-28
-- Convert 'in_progress' (underscore) to 'in-progress' (hyphen) for consistency

UPDATE orders SET status = 'in-progress' WHERE status = 'in_progress';
