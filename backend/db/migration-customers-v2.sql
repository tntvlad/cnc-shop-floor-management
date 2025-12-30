-- Migration: Enhanced Customer Information and Contact Person System
-- Date: 2025-12-30

-- ============================================================================
-- STEP 1: Add new columns to customers table
-- ============================================================================

-- Customer identification number
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);

-- Headquarters address (main address)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS headquarters_address TEXT;

-- Trade Register Number (already have reg_com, add alias)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_register_number VARCHAR(100);

-- Delivery address (optional - falls back to headquarters if null)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- General notes field
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for customer_id
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);

-- ============================================================================
-- STEP 2: Create contact_persons table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_persons (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('invoice', 'order', 'technical')),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for contact_persons
CREATE INDEX IF NOT EXISTS idx_contact_persons_customer ON contact_persons(customer_id);
CREATE INDEX IF NOT EXISTS idx_contact_persons_type ON contact_persons(contact_type);
CREATE INDEX IF NOT EXISTS idx_contact_persons_customer_type ON contact_persons(customer_id, contact_type);

-- ============================================================================
-- STEP 3: Add contact person foreign keys to orders table
-- ============================================================================

-- Add customer_id reference to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Add contact person references to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_contact_id INTEGER REFERENCES contact_persons(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_contact_id INTEGER REFERENCES contact_persons(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS technical_contact_id INTEGER REFERENCES contact_persons(id) ON DELETE SET NULL;

-- Add delivery address override for orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Create indexes for order contact lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_contact ON orders(invoice_contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_contact ON orders(order_contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_technical_contact ON orders(technical_contact_id);

-- ============================================================================
-- STEP 4: Migrate existing contact data to contact_persons table
-- ============================================================================

-- Migrate existing contact_person fields to invoice contacts
INSERT INTO contact_persons (customer_id, contact_type, name, phone, email, is_primary)
SELECT 
  id,
  'invoice',
  contact_person,
  contact_phone,
  contact_email,
  true
FROM customers
WHERE contact_person IS NOT NULL AND contact_person != ''
ON CONFLICT DO NOTHING;

-- Migrate existing technical_contact fields to technical contacts
INSERT INTO contact_persons (customer_id, contact_type, name, phone, email, is_primary)
SELECT 
  id,
  'technical',
  technical_contact_person,
  technical_phone,
  technical_email,
  true
FROM customers
WHERE technical_contact_person IS NOT NULL AND technical_contact_person != ''
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Create helper function for delivery address resolution
-- ============================================================================

-- Function to get effective delivery address (with fallback to headquarters)
CREATE OR REPLACE FUNCTION get_effective_delivery_address(
  p_delivery_address TEXT,
  p_headquarters_address TEXT,
  p_legacy_address TEXT
) RETURNS TEXT AS $$
BEGIN
  -- Priority: delivery_address > headquarters_address > legacy address field
  IF p_delivery_address IS NOT NULL AND p_delivery_address != '' THEN
    RETURN p_delivery_address;
  ELSIF p_headquarters_address IS NOT NULL AND p_headquarters_address != '' THEN
    RETURN p_headquarters_address;
  ELSE
    RETURN p_legacy_address;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Create view for orders with resolved contact info
-- ============================================================================

CREATE OR REPLACE VIEW orders_with_contacts AS
SELECT 
  o.*,
  c.company_name,
  c.cif,
  c.trade_register_number,
  c.headquarters_address,
  get_effective_delivery_address(o.delivery_address, c.delivery_address, c.headquarters_address) as effective_delivery_address,
  
  -- Invoice contact info
  ic.name as invoice_contact_name,
  ic.phone as invoice_contact_phone,
  ic.email as invoice_contact_email,
  
  -- Order contact info
  oc.name as order_contact_name,
  oc.phone as order_contact_phone,
  oc.email as order_contact_email,
  
  -- Technical contact info
  tc.name as technical_contact_name,
  tc.phone as technical_contact_phone,
  tc.email as technical_contact_email

FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN contact_persons ic ON o.invoice_contact_id = ic.id
LEFT JOIN contact_persons oc ON o.order_contact_id = oc.id
LEFT JOIN contact_persons tc ON o.technical_contact_id = tc.id;

-- ============================================================================
-- Done!
-- ============================================================================
