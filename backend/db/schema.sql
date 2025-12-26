-- CNC Shop Floor Management System Database Schema

-- Drop existing tables
DROP TABLE IF EXISTS job_assignments CASCADE;
DROP TABLE IF EXISTS part_completions CASCADE;
DROP TABLE IF EXISTS time_logs CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table with hierarchical level-based permission system
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 100, -- 50=Customer, 100=CNC Operator, 200=Cutting Operator, 300=QC, 400=Supervisor, 500=Admin
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parts table
CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    material VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    treatment VARCHAR(100),
    target_time INTEGER NOT NULL, -- in minutes
    order_position INTEGER UNIQUE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Assignments table - allows same job to be assigned to multiple operators
CREATE TABLE job_assignments (
    id SERIAL PRIMARY KEY,
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    actual_time INTEGER, -- in minutes
    UNIQUE(part_id, user_id)
);

-- Files table
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL, -- 'PDF', 'DXF', 'NC'
    file_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback table
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time logs table
CREATE TABLE time_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration INTEGER, -- in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Part completions table
CREATE TABLE part_completions (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    actual_time INTEGER NOT NULL, -- in minutes
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_parts_order_position ON parts(order_position);
CREATE INDEX idx_parts_locked ON parts(locked);
CREATE INDEX idx_parts_completed ON parts(completed);
CREATE INDEX idx_job_assignments_part_id ON job_assignments(part_id);
CREATE INDEX idx_job_assignments_user_id ON job_assignments(user_id);
CREATE INDEX idx_job_assignments_status ON job_assignments(status);
CREATE INDEX idx_files_part_id ON files(part_id);
CREATE INDEX idx_feedback_part_id ON feedback(part_id);
CREATE INDEX idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX idx_time_logs_part_id ON time_logs(part_id);
CREATE INDEX idx_part_completions_part_id ON part_completions(part_id);

-- Insert default admin user (password: admin123, level: 500 = Super Admin)
INSERT INTO users (employee_id, name, password_hash, level) VALUES
('ADMIN001', 'Administrator', '$2b$10$v4KiJjM5GIq9dkRrekc7Nu1ZT2IHDPXZbVBppl4kdXAqxPnHEffBG', 500);

-- Insert sample parts
INSERT INTO parts (name, material, quantity, treatment, target_time, order_position, locked) VALUES
('Bracket Mount A', 'Aluminum 6061', 50, 'Anodized', 120, 1, FALSE),
('Shaft Connector B', 'Steel 4140', 25, 'Heat Treated', 180, 2, TRUE),
('Housing Cover C', 'Aluminum 7075', 30, 'None', 90, 3, TRUE),
('Gear Assembly D', 'Steel 1045', 20, 'Carburized', 240, 4, TRUE),
('Support Plate E', 'Stainless 304', 40, 'Passivated', 150, 5, TRUE);

COMMENT ON TABLE users IS 'Employee users with authentication credentials';
COMMENT ON TABLE parts IS 'Manufacturing parts with specifications and sequential locking';
COMMENT ON TABLE files IS 'Technical files (PDF, DXF, NC) associated with parts';
COMMENT ON TABLE feedback IS 'Employee feedback on parts';
COMMENT ON TABLE time_logs IS 'Tracking of time spent on parts';
COMMENT ON TABLE part_completions IS 'Records of completed parts with actual vs target time';
