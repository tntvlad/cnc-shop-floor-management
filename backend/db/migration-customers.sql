-- Create customers table with all fields from CSV
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  customer_id VARCHAR(50),
  cif VARCHAR(50),
  reg_com VARCHAR(50),
  trade_register_number VARCHAR(50),
  address TEXT,
  headquarters_address TEXT,
  delivery_address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Romania',
  contact_person VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  technical_contact_person VARCHAR(255),
  technical_phone VARCHAR(20),
  technical_email VARCHAR(255),
  processing_notes TEXT,
  delivery_notes TEXT,
  billing_notes TEXT,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  payment_terms VARCHAR(50) DEFAULT 'standard_credit',
  payment_history VARCHAR(50) DEFAULT 'new_customer',
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  credit_limit DECIMAL(12,2),
  approval_threshold DECIMAL(12,2),
  custom_terms_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for searching
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Add new columns for existing databases (Phase 1 Customer Management)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_register_number VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS headquarters_address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'standard_credit';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_history VARCHAR(50) DEFAULT 'new_customer';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS approval_threshold DECIMAL(12,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_terms_notes TEXT;
