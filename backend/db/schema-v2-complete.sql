-- CNC Shop Floor Management System - Complete Database Schema v2.0
-- Enhanced with: Orders, Material Management, QC, Machines, Tools, Notifications
-- Date: 2025-12-26

-- ============================================================================
-- DROP EXISTING TABLES (Fresh Start)
-- ============================================================================

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
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE DEFAULT ('ORD-' || LPAD(nextval('orders_id_seq')::TEXT, 6, '0')),
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(200),
    customer_phone VARCHAR(50),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal', -- urgent, normal, low
    status VARCHAR(50) DEFAULT 'material_planning',
    -- Status flow: material_planning → cutting → programming → machining → qc → completed → shipped
    total_parts INTEGER DEFAULT 0,
    completed_parts INTEGER DEFAULT 0,
    
    -- Hold/Pause functionality
    is_on_hold BOOLEAN DEFAULT false,
    hold_reason TEXT,
    hold_started_at TIMESTAMP,
    hold_started_by INTEGER REFERENCES users(id),
    
    -- Shipping
    shipping_address TEXT,
    shipping_method VARCHAR(100),
    
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    
    -- Workflow stages
    stage VARCHAR(50) DEFAULT 'material_planning',
    -- Stages: material_planning → cutting → programming → assigned → in_progress → qc_pending → qc_approved → shipped
    
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
-- MATERIAL STOCK TABLE
-- ============================================================================

CREATE TABLE material_stock (
    id SERIAL PRIMARY KEY,
    material_name VARCHAR(200) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    supplier_id INTEGER,
    current_stock DECIMAL(10,2) DEFAULT 0,
    reorder_level DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pieces',
    cost_per_unit DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    machine_type VARCHAR(20) NOT NULL,
    machine_number INTEGER NOT NULL,
    machine_name VARCHAR(100),
    machine_model VARCHAR(100),
    status VARCHAR(50) DEFAULT 'available',
    is_available BOOLEAN DEFAULT true,
    
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(machine_type, machine_number)
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
CREATE INDEX idx_material_orders_status ON material_orders(status);

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

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
