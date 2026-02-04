-- Migration: Add financial tracking fields to orders table
-- Date: 2026-02-04
-- Description: Add columns to track post-completion financial stages: delivery, invoicing, and cash collection

-- Add financial stage tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS financial_stage VARCHAR(50) DEFAULT 'pending';
-- Valid values: 'pending', 'delivered', 'invoiced', 'cashed_in', 'completed'

-- Add flag for orders that don't require invoicing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS no_invoice_needed BOOLEAN DEFAULT false;

-- Delivery tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_document_path TEXT NULL;

-- Invoice tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_document_path TEXT NULL;

-- Payment/Cash collection tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashed_in_date TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(12,2) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_notes TEXT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_financial_stage ON orders(financial_stage);
CREATE INDEX IF NOT EXISTS idx_orders_status_financial ON orders(status, financial_stage);

-- Add comment for documentation
COMMENT ON COLUMN orders.financial_stage IS 'Tracks post-completion stages: pending, delivered, invoiced, cashed_in, completed';
COMMENT ON COLUMN orders.no_invoice_needed IS 'Flag for orders that skip invoicing stage';
