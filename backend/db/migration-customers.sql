-- Create customers table with all fields from CSV
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  cif VARCHAR(50),
  reg_com VARCHAR(50),
  address TEXT,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for searching
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
