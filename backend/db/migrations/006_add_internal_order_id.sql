-- Add internal_order_id column to orders table
-- This is the company's internal reference number for the order

ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_order_id VARCHAR(100);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_internal_order_id ON orders(internal_order_id);

COMMENT ON COLUMN orders.internal_order_id IS 'Internal company reference number for this order';
