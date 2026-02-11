-- Performance Indexes Migration
-- Run this to improve query performance
-- Date: 2026-02-11

-- ============================================================================
-- ORDERS TABLE - Additional indexes for common queries
-- ============================================================================

-- Financial dashboard queries (filter by delivery_date, financial_stage)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_financial_stage ON orders(financial_stage);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_date ON orders(invoice_date);
CREATE INDEX IF NOT EXISTS idx_orders_cashed_in_date ON orders(cashed_in_date);

-- Order dashboard - filter by customer_id and created_at
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);

-- Composite index for common order dashboard query (status + delivery_date)
CREATE INDEX IF NOT EXISTS idx_orders_status_delivery ON orders(status, delivery_date);

-- Composite index for financial dashboard (status + financial_stage)
CREATE INDEX IF NOT EXISTS idx_orders_status_financial ON orders(status, financial_stage);

-- ============================================================================
-- PARTS TABLE - Additional indexes
-- ============================================================================

-- Workflow stage filtering
CREATE INDEX IF NOT EXISTS idx_parts_workflow_stage ON parts(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);

-- Composite index for order parts with workflow
CREATE INDEX IF NOT EXISTS idx_parts_order_workflow ON parts(order_id, workflow_stage);

-- ============================================================================
-- CUSTOMERS TABLE - Search and lookup
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_cif ON customers(cif);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Full text search on company name (optional, for faster ILIKE searches)
-- CREATE INDEX IF NOT EXISTS idx_customers_company_name_trgm ON customers USING gin(company_name gin_trgm_ops);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- TIME LOGS TABLE - For reporting
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_time_logs_start_time ON time_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_time_logs_end_time ON time_logs(end_time);

-- ============================================================================
-- CONTACT PERSONS TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contact_persons_customer_id ON contact_persons(customer_id);
CREATE INDEX IF NOT EXISTS idx_contact_persons_type ON contact_persons(contact_type);

-- ============================================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- ============================================================================

ANALYZE orders;
ANALYZE parts;
ANALYZE customers;
ANALYZE users;
ANALYZE time_logs;
ANALYZE files;
ANALYZE machines;
ANALYZE contact_persons;
