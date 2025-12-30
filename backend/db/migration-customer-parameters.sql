-- Migration: Customer Parameters and Order Approval System
-- Date: 2025-12-30
-- Phase 1: Customer status, payment terms, payment history, discount/fee fields
-- Phase 2 Ready: Order approval workflow fields

-- ============================================================================
-- STEP 1: Create ENUM types for customer parameters
-- ============================================================================

-- Customer status enum
DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'bankrupt', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment terms enum
DO $$ BEGIN
  CREATE TYPE payment_terms_type AS ENUM ('standard_credit', 'prepayment_required', 'cod', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment history enum
DO $$ BEGIN
  CREATE TYPE payment_history_type AS ENUM ('good', 'delayed', 'bad', 'new_customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Order status enum (for Phase 2)
DO $$ BEGIN
  CREATE TYPE order_approval_status AS ENUM ('draft', 'pending_payment', 'pending_approval', 'approved', 'in_production', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Add customer parameter columns
-- ============================================================================

-- Customer status (active, inactive, bankrupt, closed)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Payment terms
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(30) DEFAULT 'standard_credit';

-- Payment history indicator
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_history VARCHAR(20) DEFAULT 'new_customer';

-- Discount percentage (positive = discount, negative = extra fee)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Custom payment terms notes
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_terms_notes TEXT;

-- Order approval threshold (orders above this value require approval)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS approval_threshold DECIMAL(12,2);

-- Credit limit for the customer
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2);

-- ============================================================================
-- STEP 3: Add order approval workflow columns (Phase 2 ready)
-- ============================================================================

-- Order approval status
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'approved';

-- Who approved the order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- When was the order approved
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- When was payment received
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP;

-- Discount applied to this order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_applied DECIMAL(5,2) DEFAULT 0.00;

-- Whether this order requires approval
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

-- Approval notes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- ============================================================================
-- STEP 4: Create indexes for efficient queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_payment_terms ON customers(payment_terms);
CREATE INDEX IF NOT EXISTS idx_customers_payment_history ON customers(payment_history);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_requires_approval ON orders(requires_approval);

-- ============================================================================
-- STEP 5: Create view for customers requiring special attention
-- ============================================================================

CREATE OR REPLACE VIEW customers_requiring_attention AS
SELECT 
  c.*,
  CASE 
    WHEN c.status IN ('inactive', 'bankrupt', 'closed') THEN 'Status Warning'
    WHEN c.payment_history IN ('bad', 'delayed') THEN 'Payment Warning'
    WHEN c.payment_terms = 'prepayment_required' THEN 'Prepayment Required'
    ELSE 'Normal'
  END as attention_reason
FROM customers c
WHERE c.status != 'active' 
   OR c.payment_history IN ('bad', 'delayed')
   OR c.payment_terms = 'prepayment_required';

-- ============================================================================
-- DONE: Migration complete
-- ============================================================================

-- Summary of changes:
-- 1. Customer parameters: status, payment_terms, payment_history, discount_percentage
-- 2. Customer settings: custom_terms_notes, approval_threshold, credit_limit
-- 3. Order approval fields: approval_status, approved_by_id, approved_at, payment_received_at
-- 4. Order tracking: discount_applied, requires_approval, approval_notes
