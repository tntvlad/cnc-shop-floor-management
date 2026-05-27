-- ============================================================
-- Migration 004: Tool Checkout Tracking
-- Date: 2026-05-27
-- Description: Add given_to column to tool_transactions so
--   stock-out operations can record which workshop user
--   received the tool.
-- Run: docker exec cnc-postgres psql -U postgres cnc_shop_floor -f /path/to/004_tool_checkouts.sql
-- ============================================================

BEGIN;

ALTER TABLE tool_transactions
  ADD COLUMN IF NOT EXISTS given_to INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tool_transactions_given_to
  ON tool_transactions(given_to);

COMMIT;
