-- Add external_order_id column to orders table
-- This stores the customer's reference/PO number for the order

ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);

-- Create index for searching by external order ID
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);

COMMENT ON COLUMN orders.external_order_id IS 'Customer reference or PO number for this order';
