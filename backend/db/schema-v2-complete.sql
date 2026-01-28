-- CNC Shop Floor Management System - Complete Database Schema v2.1
-- Enhanced with: Orders, Material Management, QC, Machines, Tools, Notifications, Customers
-- Date: 2025-01-13

-- ============================================================================
-- DROP EXISTING TABLES (Fresh Start)
-- ============================================================================

DROP TABLE IF EXISTS material_suggestions CASCADE;
DROP TABLE IF EXISTS material_equivalents CASCADE;
DROP TABLE IF EXISTS material_transactions CASCADE;
DROP TABLE IF EXISTS storage_locations CASCADE;
DROP TABLE IF EXISTS material_types CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS qc_inspection_results CASCADE;
DROP TABLE IF EXISTS qc_inspections CASCADE;
DROP TABLE IF EXISTS qc_checklist_items CASCADE;
DROP TABLE IF EXISTS qc_checklists CASCADE;
DROP TABLE IF EXISTS machine_maintenance_records CASCADE;
DROP TABLE IF EXISTS shipment_items CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS part_tool_requirements CASCADE;
DROP TABLE IF EXISTS tools CASCADE;
DROP TABLE IF EXISTS machine_requirements CASCADE;
DROP TABLE IF EXISTS operator_skills CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS time_logs CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS scrap_records CASCADE;
DROP TABLE IF EXISTS part_dependencies CASCADE;
DROP TABLE IF EXISTS material_orders CASCADE;
DROP TABLE IF EXISTS material_stock CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS machines CASCADE;
DROP TABLE IF EXISTS job_assignments CASCADE;
DROP TABLE IF EXISTS part_completions CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS contact_persons CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- USERS TABLE (Enhanced with Skills)
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 100, 
    -- 50=Customer, 100=CNC Operator, 200=Cutting Operator, 300=QC, 400=Supervisor, 500=Admin
    email VARCHAR(200),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CUSTOMERS TABLE (Customer Management)
-- ============================================================================

CREATE TABLE customers (
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
    folder_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CONTACT PERSONS TABLE (Multiple contacts per customer)
-- ============================================================================

CREATE TABLE contact_persons (
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

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE DEFAULT ('ORD-' || LPAD(nextval('orders_id_seq')::TEXT, 6, '0')),
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(200),
    customer_phone VARCHAR(50),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    internal_order_id VARCHAR(100), -- Company's internal reference number
    external_order_id VARCHAR(100), -- Customer's reference/PO number
    due_date TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal', -- urgent, normal, low
    status VARCHAR(50) DEFAULT 'pending',
    -- Status flow: pending → in-progress → paused → completed → cancelled
    total_parts INTEGER DEFAULT 0,
    completed_parts INTEGER DEFAULT 0,
    
    -- Hold/Pause functionality
    is_on_hold BOOLEAN DEFAULT false,
    hold_reason TEXT,
    hold_started_at TIMESTAMP,
    hold_started_by INTEGER REFERENCES users(id),
    
    -- Completion tracking
    completed_at TIMESTAMP,
    
    -- Shipping
    shipping_address TEXT,
    shipping_method VARCHAR(100),
    
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for orders
CREATE INDEX idx_orders_internal_order_id ON orders(internal_order_id);
CREATE INDEX idx_orders_external_order_id ON orders(external_order_id);

-- ============================================================================
-- PARTS TABLE (Jobs with Complete Workflow)
-- ============================================================================

CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    part_number VARCHAR(100),
    part_name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL,
    quantity_completed INTEGER DEFAULT 0,
    quantity_scrapped INTEGER DEFAULT 0,
    
    -- Material reference
    material_id INTEGER,
    
    -- Simple status for Phase 1A compatibility
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Batch management
    batch_number VARCHAR(50),
    quantity_in_batch INTEGER,
    parent_part_id INTEGER REFERENCES parts(id),
    is_batch_split BOOLEAN DEFAULT false,
    
    -- Material info
    material_type VARCHAR(100),
    material_dimensions VARCHAR(100),
    material_status VARCHAR(50) DEFAULT 'planning',
    material_order_date TIMESTAMP,
    material_arrival_date TIMESTAMP,
    
    -- Drawing revision control (CRITICAL!)
    drawing_revision VARCHAR(20),
    drawing_revision_date TIMESTAMP,
    revision_notes TEXT,
    
    -- Workflow stage for Kanban board: pending → cutting → programming → machining → qc → completed
    workflow_stage VARCHAR(50) DEFAULT 'pending',
    
    -- Hold/Pause functionality
    is_on_hold BOOLEAN DEFAULT false,
    hold_reason TEXT,
    hold_started_at TIMESTAMP,
    hold_started_by INTEGER REFERENCES users(id),
    
    -- Folder path for job files
    file_folder TEXT,
    
    -- Cutting stage
    cutting_assigned_to INTEGER REFERENCES users(id),
    cutting_started_at TIMESTAMP,
    cutting_completed_at TIMESTAMP,
    cutting_notes TEXT,
    pieces_cut INTEGER,
    
    -- Programming stage
    programmed_by INTEGER REFERENCES users(id),
    programmed_at TIMESTAMP,
    programming_notes TEXT,
    
    -- Machining stage
    machine_type VARCHAR(20), -- 'mill' or 'lathe'
    machine_number INTEGER, -- 1-5 for mills, 1 for lathe
    assigned_to INTEGER REFERENCES users(id),
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP,
    
    -- Time estimation (CRITICAL for scheduling)
    estimated_setup_time INTEGER, -- minutes
    estimated_run_time_per_piece INTEGER, -- minutes per piece
    actual_setup_time INTEGER,
    actual_run_time INTEGER,
    estimated_time INTEGER, -- total minutes (setup + run)
    actual_time INTEGER, -- total minutes
    
    setup_instructions TEXT,
    
    -- Job execution
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    paused_at TIMESTAMP,
    pause_reason TEXT,
    skip_reason TEXT,
    operator_notes TEXT,
    
    -- Quality Control
    qc_assigned_to INTEGER REFERENCES users(id),
    qc_started_at TIMESTAMP,
    qc_completed_at TIMESTAMP,
    qc_status VARCHAR(20), -- approved, rejected, rework
    qc_notes TEXT,
    rejection_reason TEXT,
    rework_instructions TEXT,
    
    -- First Article Inspection
    requires_first_article BOOLEAN DEFAULT false,
    first_article_completed BOOLEAN DEFAULT false,
    first_article_approved_by INTEGER REFERENCES users(id),
    first_article_approved_at TIMESTAMP,
    
    -- Cost tracking
    estimated_material_cost DECIMAL(10,2),
    actual_material_cost DECIMAL(10,2),
    estimated_labor_cost DECIMAL(10,2),
    actual_labor_cost DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    profit_margin DECIMAL(10,2),
    
    -- Priority system
    priority INTEGER DEFAULT 0,
    priority_score INTEGER, -- Auto-calculated: 0-1000
    priority_factors JSONB, -- Store calculation breakdown
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PART DEPENDENCIES TABLE
-- ============================================================================

CREATE TABLE part_dependencies (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    depends_on_part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'must_complete_first',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SCRAP RECORDS TABLE
-- ============================================================================

CREATE TABLE scrap_records (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    stage VARCHAR(50),
    reason TEXT,
    operator_id INTEGER REFERENCES users(id),
    cost_impact DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================

CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Romania',
    lead_time_days INTEGER DEFAULT 7,
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STORAGE LOCATIONS TABLE
-- ============================================================================

CREATE TABLE storage_locations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    zone VARCHAR(50),
    shelf VARCHAR(50),
    description TEXT,
    capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MATERIAL TYPES TABLE (Reference table for material categories)
-- Enhanced with specification and equivalence support
-- ============================================================================

CREATE TABLE material_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'metal', 'plastic', 'composite', 'wood', 'other'
    density DECIMAL(10,4), -- kg/dm³ for weight calculations
    aliases TEXT[] DEFAULT '{}', -- Alternative/equivalent names for this material
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    -- Specification fields
    specification_code VARCHAR(50), -- e.g., 1.2027, 6061-T6
    specification_standard VARCHAR(50), -- EN, ASTM, DIN, ISO
    specification_name TEXT,
    material_grade VARCHAR(100),
    equivalent_to_id INTEGER REFERENCES material_types(id),
    is_preferred BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for material_types
CREATE INDEX idx_material_types_spec_code ON material_types(specification_code);
CREATE INDEX idx_material_types_equivalent_to ON material_types(equivalent_to_id);
CREATE INDEX idx_material_types_category ON material_types(category);

-- ============================================================================
-- MATERIAL STOCK TABLE (Enhanced with shapes, dimensions, locations)
-- ============================================================================

CREATE TABLE material_stock (
    id SERIAL PRIMARY KEY,
    material_name VARCHAR(200) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    
    -- Shape and Dimensions
    shape_type VARCHAR(50), -- 'bar_round', 'bar_square', 'bar_hex', 'plate', 'tube', 'sheet'
    diameter DECIMAL(10,2), -- for round bars, tubes
    width DECIMAL(10,2), -- for square bars, plates, sheets
    height DECIMAL(10,2), -- for square bars, plates
    thickness DECIMAL(10,2), -- for plates, sheets, tubes
    length DECIMAL(10,2), -- standard length
    
    -- Stock Management
    current_stock DECIMAL(10,2) DEFAULT 0,
    reserved_stock DECIMAL(10,2) DEFAULT 0,
    reorder_level DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pieces',
    
    -- Location
    location_id INTEGER REFERENCES storage_locations(id),
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'low_stock', 'out_of_stock', 'reserved'
    
    -- Cost and Value
    cost_per_unit DECIMAL(10,2),
    unit_weight DECIMAL(10,4), -- kg per unit
    total_value DECIMAL(12,2),
    
    -- Enhanced fields for smart suggestions
    material_type_id INTEGER REFERENCES material_types(id),
    specification_code VARCHAR(50),
    size_index DECIMAL(10,4),
    size_category VARCHAR(50),
    last_used_date TIMESTAMP,
    supplier_batch_number VARCHAR(100),
    quality_status VARCHAR(50) DEFAULT 'new',
    inspection_required BOOLEAN DEFAULT false,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for material_stock
CREATE INDEX idx_material_stock_material_type_id ON material_stock(material_type_id);
CREATE INDEX idx_material_stock_size_index ON material_stock(size_index);
CREATE INDEX idx_material_stock_size_category ON material_stock(size_category);
CREATE INDEX idx_material_stock_quality_status ON material_stock(quality_status);
CREATE INDEX idx_material_stock_shape_type ON material_stock(shape_type);

-- ============================================================================
-- MATERIAL TRANSACTIONS TABLE (Stock In/Out/Transfer)
-- ============================================================================

CREATE TABLE material_transactions (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES material_stock(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'stock_in', 'stock_out', 'transfer', 'adjustment', 'reserved'
    quantity DECIMAL(10,2) NOT NULL,
    from_location_id INTEGER REFERENCES storage_locations(id),
    to_location_id INTEGER REFERENCES storage_locations(id),
    order_id INTEGER,
    part_id INTEGER,
    reference_number VARCHAR(100),
    notes TEXT,
    performed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MATERIAL ORDERS TABLE
-- ============================================================================

CREATE TABLE material_orders (
    id SERIAL PRIMARY KEY,
    material_type VARCHAR(100) NOT NULL,
    dimensions VARCHAR(100),
    quantity DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(200),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_delivery TIMESTAMP,
    actual_delivery TIMESTAMP,
    status VARCHAR(50) DEFAULT 'ordered',
    cost DECIMAL(10,2),
    invoice_number VARCHAR(100),
    notes TEXT,
    ordered_by INTEGER REFERENCES users(id)
);

-- ============================================================================
-- MACHINES TABLE
-- ============================================================================

CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    machine_type VARCHAR(20),
    machine_number INTEGER,
    machine_name VARCHAR(100),
    machine_model VARCHAR(100),
    status VARCHAR(50) DEFAULT 'available',
    is_available BOOLEAN DEFAULT true,
    location VARCHAR(100),
    
    -- Current job tracking
    current_job INTEGER REFERENCES parts(id),
    current_operator INTEGER REFERENCES users(id),
    
    -- Maintenance
    last_maintenance TIMESTAMP,
    next_maintenance_due TIMESTAMP,
    maintenance_scheduled_start TIMESTAMP,
    maintenance_scheduled_end TIMESTAMP,
    maintenance_notes TEXT,
    
    -- Performance tracking
    total_runtime_hours DECIMAL(10,2) DEFAULT 0,
    utilization_percentage DECIMAL(5,2),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- OPERATOR SKILLS/CERTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE operator_skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    skill_type VARCHAR(50) NOT NULL,
    proficiency_level INTEGER DEFAULT 1,
    certified_by VARCHAR(100),
    certified_date TIMESTAMP,
    expires_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MACHINE REQUIREMENTS TABLE
-- ============================================================================

CREATE TABLE machine_requirements (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    required_skill VARCHAR(50),
    min_proficiency_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TOOLS TABLE
-- ============================================================================

CREATE TABLE tools (
    id SERIAL PRIMARY KEY,
    tool_number VARCHAR(50) UNIQUE NOT NULL,
    tool_type VARCHAR(100) NOT NULL,
    diameter DECIMAL(10,3),
    length DECIMAL(10,3),
    material VARCHAR(50),
    location VARCHAR(100),
    quantity_available INTEGER DEFAULT 0,
    minimum_quantity INTEGER DEFAULT 0,
    cost_per_tool DECIMAL(10,2),
    supplier VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PART TOOL REQUIREMENTS TABLE
-- ============================================================================

CREATE TABLE part_tool_requirements (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    tool_id INTEGER REFERENCES tools(id),
    quantity_needed INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SHIPMENTS TABLE
-- ============================================================================

CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    shipment_number INTEGER NOT NULL,
    ship_date TIMESTAMP,
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    shipping_cost DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SHIPMENT ITEMS TABLE
-- ============================================================================

CREATE TABLE shipment_items (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    quantity_shipped INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal',
    action_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- ============================================================================
-- FILES TABLE
-- ============================================================================

CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    file_type VARCHAR(50) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stage VARCHAR(50),
    revision VARCHAR(20),
    description TEXT,
    is_latest BOOLEAN DEFAULT true
);

-- ============================================================================
-- TIME LOGS TABLE
-- ============================================================================

CREATE TABLE time_logs (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    stage VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration INTEGER,
    is_setup_time BOOLEAN DEFAULT false,
    machine_number INTEGER,
    machine_type VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ACTIVITY LOG TABLE
-- ============================================================================

CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    description TEXT,
    metadata JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- QC CHECKLISTS TABLE
-- ============================================================================

CREATE TABLE qc_checklists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- QC CHECKLIST ITEMS TABLE
-- ============================================================================

CREATE TABLE qc_checklist_items (
    id SERIAL PRIMARY KEY,
    checklist_id INTEGER REFERENCES qc_checklists(id) ON DELETE CASCADE,
    item_order INTEGER,
    item_text TEXT NOT NULL,
    item_type VARCHAR(50) DEFAULT 'checkbox',
    tolerance VARCHAR(50),
    required BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- QC INSPECTIONS TABLE
-- ============================================================================

CREATE TABLE qc_inspections (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    checklist_id INTEGER REFERENCES qc_checklists(id),
    inspector_id INTEGER REFERENCES users(id),
    result VARCHAR(20),
    overall_notes TEXT,
    inspection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signature_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- QC INSPECTION RESULTS TABLE
-- ============================================================================

CREATE TABLE qc_inspection_results (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER REFERENCES qc_inspections(id) ON DELETE CASCADE,
    checklist_item_id INTEGER REFERENCES qc_checklist_items(id),
    result VARCHAR(20),
    measured_value VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MACHINE MAINTENANCE RECORDS TABLE
-- ============================================================================

CREATE TABLE machine_maintenance_records (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50),
    description TEXT,
    performed_by INTEGER REFERENCES users(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cost DECIMAL(10,2),
    parts_replaced TEXT,
    next_maintenance_due TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FEEDBACK TABLE (Keep for legacy compatibility)
-- ============================================================================

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Orders indexes
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_due_date ON orders(due_date);
CREATE INDEX idx_orders_priority ON orders(priority);
CREATE INDEX idx_orders_customer_name ON orders(customer_name);

-- Parts indexes
CREATE INDEX idx_parts_order_id ON parts(order_id);
CREATE INDEX idx_parts_stage ON parts(stage);
CREATE INDEX idx_parts_assigned_to ON parts(assigned_to);
CREATE INDEX idx_parts_machine_type ON parts(machine_type);
CREATE INDEX idx_parts_qc_status ON parts(qc_status);
CREATE INDEX idx_parts_priority_score ON parts(priority_score DESC);

-- Files indexes
CREATE INDEX idx_files_part_id ON files(part_id);
CREATE INDEX idx_files_file_type ON files(file_type);
CREATE INDEX idx_files_stage ON files(stage);

-- Time logs indexes
CREATE INDEX idx_time_logs_part_id ON time_logs(part_id);
CREATE INDEX idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX idx_time_logs_stage ON time_logs(stage);

-- Machines indexes
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_machines_type ON machines(machine_type);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Material indexes
CREATE INDEX idx_material_stock_type ON material_stock(material_type);
CREATE INDEX idx_material_stock_shape ON material_stock(shape_type);
CREATE INDEX idx_material_stock_location ON material_stock(location_id);
CREATE INDEX idx_material_stock_status ON material_stock(status);
CREATE INDEX idx_material_orders_status ON material_orders(status);
CREATE INDEX idx_material_transactions_material ON material_transactions(material_id);
CREATE INDEX idx_material_transactions_type ON material_transactions(transaction_type);
CREATE INDEX idx_material_transactions_date ON material_transactions(created_at);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

-- Customers indexes
CREATE INDEX idx_customers_company_name ON customers(company_name);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_customer_id ON customers(customer_id);
CREATE INDEX idx_customers_status ON customers(status);

-- Contact persons indexes
CREATE INDEX idx_contact_persons_customer_id ON contact_persons(customer_id);
CREATE INDEX idx_contact_persons_type ON contact_persons(contact_type);
CREATE INDEX idx_contact_persons_customer_type ON contact_persons(customer_id, contact_type);

-- ============================================================================
-- INSERT DEFAULT ADMIN USER
-- ============================================================================

INSERT INTO users (employee_id, name, password_hash, level, email) VALUES
('ADMIN001', 'Administrator', '$2b$10$v4KiJjM5GIq9dkRrekc7Nu1ZT2IHDPXZbVBppl4kdXAqxPnHEffBG', 500, 'admin@cncshop.local');
-- Password: admin123

-- ============================================================================
-- INSERT DEFAULT MACHINES
-- ============================================================================

INSERT INTO machines (machine_type, machine_number, machine_name, machine_model) VALUES
('mill', 1, 'Mill #1', 'Haas VF-2'),
('mill', 2, 'Mill #2', 'Haas VF-3'),
('mill', 3, 'Mill #3', 'Haas VF-4'),
('mill', 4, 'Mill #4', 'DMG Mori DMU 50'),
('mill', 5, 'Mill #5', 'Makino A51'),
('lathe', 1, 'Lathe #1', 'DMG Mori NLX 2500');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE orders IS 'Customer orders containing multiple parts';
COMMENT ON TABLE parts IS 'Manufacturing parts/jobs with complete workflow tracking';
COMMENT ON TABLE machines IS '5 CNC Mills + 1 CNC Lathe with status tracking';
COMMENT ON TABLE material_stock IS 'Current material inventory';
COMMENT ON TABLE scrap_records IS 'Track scrapped parts and cost impact';
COMMENT ON TABLE qc_inspections IS 'Quality control inspection records';
COMMENT ON TABLE notifications IS 'Real-time user notifications';
COMMENT ON TABLE operator_skills IS 'Track operator skills and certifications';
COMMENT ON TABLE tools IS 'Cutting tools inventory';
COMMENT ON TABLE customers IS 'Customer companies with billing and contact information';
COMMENT ON TABLE contact_persons IS 'Multiple contact persons per customer';
COMMENT ON TABLE suppliers IS 'Material suppliers with contact and lead time info';
COMMENT ON TABLE storage_locations IS 'Physical storage locations for materials';
COMMENT ON TABLE material_types IS 'Reference table for material categories and properties';
COMMENT ON TABLE material_transactions IS 'Stock in/out/transfer transaction history';

-- ============================================================================
-- INSERT DEFAULT STORAGE LOCATIONS
-- ============================================================================

INSERT INTO storage_locations (code, zone, shelf, description) VALUES
('1A', 'Zone 1', 'Shelf A', 'Metal raw materials - Round bars'),
('1B', 'Zone 1', 'Shelf B', 'Metal raw materials - Square/Flat bars'),
('1C', 'Zone 1', 'Shelf C', 'Metal raw materials - Plates'),
('2A', 'Zone 2', 'Shelf A', 'Aluminum materials'),
('2B', 'Zone 2', 'Shelf B', 'Plastics - Engineering plastics'),
('2C', 'Zone 2', 'Shelf C', 'Plastics - High performance'),
('3A', 'Zone 3', 'Shelf A', 'Stainless steel'),
('3B', 'Zone 3', 'Shelf B', 'Special alloys');

-- ============================================================================
-- INSERT DEFAULT MATERIAL TYPES
-- ============================================================================

INSERT INTO material_types (name, category, density, specification_code, specification_standard, description) VALUES
('Aluminum 6061', 'metal', 2.70, '6061-T6', 'ASTM', 'General purpose aluminum alloy, good machinability'),
('Aluminum 7075', 'metal', 2.81, '7075-T6', 'ASTM', 'High strength aluminum alloy'),
('Steel 1018', 'metal', 7.87, '1.0453', 'EN', 'Low carbon mild steel'),
('Steel 4140', 'metal', 7.85, '1.7225', 'EN', 'Chromium-molybdenum alloy steel'),
('Stainless Steel 304', 'metal', 8.00, '1.4301', 'EN', 'Austenitic stainless steel'),
('Stainless Steel 316', 'metal', 8.00, '1.4401', 'EN', 'Marine grade stainless steel'),
('Brass C360', 'metal', 8.50, 'CW614N', 'EN', 'Free-cutting brass'),
('Copper C101', 'metal', 8.94, 'CW004A', 'EN', 'Oxygen-free copper'),
('POM (Delrin)', 'plastic', 1.41, 'POM-H', NULL, 'Acetal homopolymer'),
('PEEK', 'plastic', 1.32, 'PEEK', NULL, 'High performance thermoplastic'),
('Nylon 6', 'plastic', 1.14, 'PA6', NULL, 'General purpose nylon'),
('PTFE (Teflon)', 'plastic', 2.20, 'PTFE', NULL, 'Low friction plastic'),
('HDPE', 'plastic', 0.95, 'PE-HD', NULL, 'High-density polyethylene'),
('Acrylic (PMMA)', 'plastic', 1.18, 'PMMA', NULL, 'Transparent thermoplastic'),
('Tool Steel 1.2017', 'metal', 7.85, '1.2017', 'EN', 'Case hardening steel - 115CrV3'),
('Tool Steel 1.2027', 'metal', 7.85, '1.2027', 'EN', 'Cold work tool steel - 60WCrV7'),
('Tool Steel 1.2379', 'metal', 7.70, '1.2379', 'EN', 'Cold work tool steel - X153CrMoV12'),
('Tool Steel 1.2080', 'metal', 7.70, '1.2080', 'EN', 'Cold work tool steel - X210Cr12');

-- ============================================================================
-- INSERT DEFAULT SUPPLIERS
-- ============================================================================

INSERT INTO suppliers (name, contact_person, email, phone, address, city, lead_time_days) VALUES
('MetalSupply SRL', 'Ion Popescu', 'comenzi@metalsupply.ro', '+40721123456', 'Str. Industriei 15', 'București', 7),
('AluminiumPro SA', 'Maria Ionescu', 'vanzari@aluminiumpro.ro', '+40722234567', 'Bd. Metalurgiei 23', 'Cluj-Napoca', 10),
('PlasticTech SRL', 'Andrei Georgescu', 'office@plastictech.ro', '+40723345678', 'Str. Polimeri 8', 'Timișoara', 14);

-- ============================================================================
-- UPDATE TRIGGER FOR material_stock
-- ============================================================================

CREATE OR REPLACE FUNCTION update_material_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    -- Calculate total value
    IF NEW.cost_per_unit IS NOT NULL AND NEW.current_stock IS NOT NULL THEN
        NEW.total_value = NEW.cost_per_unit * NEW.current_stock;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_material_stock
    BEFORE UPDATE ON material_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_material_stock_timestamp();

-- ============================================================================
-- MATERIAL EQUIVALENTS TABLE (Many-to-many equivalence)
-- ============================================================================

CREATE TABLE material_equivalents (
    id SERIAL PRIMARY KEY,
    material_type_id_primary INTEGER NOT NULL REFERENCES material_types(id) ON DELETE CASCADE,
    material_type_id_equivalent INTEGER NOT NULL REFERENCES material_types(id) ON DELETE CASCADE,
    equivalent_rank INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_type_id_primary, material_type_id_equivalent),
    CHECK (material_type_id_primary != material_type_id_equivalent)
);

CREATE INDEX idx_material_equivalents_primary ON material_equivalents(material_type_id_primary);
CREATE INDEX idx_material_equivalents_equivalent ON material_equivalents(material_type_id_equivalent);

-- ============================================================================
-- MATERIAL SUGGESTIONS TABLE (Audit trail for smart suggestions)
-- ============================================================================

CREATE TABLE material_suggestions (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    requested_material_type_id INTEGER REFERENCES material_types(id),
    requested_material_name VARCHAR(200),
    requested_width DECIMAL(10,2),
    requested_height DECIMAL(10,2),
    requested_thickness DECIMAL(10,2),
    requested_diameter DECIMAL(10,2),
    requested_quantity DECIMAL(10,2),
    suggested_stock_id INTEGER REFERENCES material_stock(id),
    suggestion_rank INTEGER,
    match_score DECIMAL(5,2),
    match_reason TEXT,
    category VARCHAR(50),
    size_score DECIMAL(5,2),
    availability_score DECIMAL(5,2),
    freshness_score DECIMAL(5,2),
    cost_score DECIMAL(5,2),
    quality_bonus DECIMAL(5,2),
    is_accepted BOOLEAN,
    is_rejected BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    accepted_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejected_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_material_suggestions_part_id ON material_suggestions(part_id);
CREATE INDEX idx_material_suggestions_stock_id ON material_suggestions(suggested_stock_id);
CREATE INDEX idx_material_suggestions_match_score ON material_suggestions(match_score DESC);
CREATE INDEX idx_material_suggestions_accepted ON material_suggestions(is_accepted);
CREATE INDEX idx_material_suggestions_category ON material_suggestions(category);

-- ============================================================================
-- SIZE INDEX CALCULATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_size_index(
    p_shape_type VARCHAR,
    p_diameter DECIMAL,
    p_width DECIMAL,
    p_height DECIMAL,
    p_thickness DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    CASE p_shape_type
        WHEN 'bar_round' THEN
            RETURN COALESCE(p_diameter, 0);
        WHEN 'bar_square' THEN
            RETURN COALESCE(p_width * p_width, 0);
        WHEN 'bar_hex' THEN
            RETURN COALESCE(p_width, 0);
        WHEN 'plate' THEN
            RETURN COALESCE(p_width * p_height * p_thickness, 0);
        WHEN 'sheet' THEN
            RETURN COALESCE(p_width * p_height * p_thickness, 0);
        WHEN 'tube' THEN
            RETURN COALESCE(p_diameter * p_thickness, 0);
        ELSE
            RETURN COALESCE(p_width * p_height, 0);
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION determine_size_category(p_size_index DECIMAL) 
RETURNS VARCHAR AS $$
BEGIN
    IF p_size_index < 10 THEN
        RETURN 'small';
    ELSIF p_size_index < 50 THEN
        RETURN 'medium';
    ELSIF p_size_index < 200 THEN
        RETURN 'large';
    ELSE
        RETURN 'extra_large';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_material_stock_size_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW.size_index := calculate_size_index(
        NEW.shape_type,
        NEW.diameter,
        NEW.width,
        NEW.height,
        NEW.thickness
    );
    NEW.size_category := determine_size_category(NEW.size_index);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_material_stock_size_index
    BEFORE INSERT OR UPDATE ON material_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_material_stock_size_index();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
