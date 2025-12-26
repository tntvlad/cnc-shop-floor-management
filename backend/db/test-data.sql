-- CNC Shop Floor Management - Test Data Script
-- Run this to populate the database with sample data for testing

-- ============================================================================
-- MATERIALS (for testing material requirements)
-- ============================================================================
INSERT INTO material_stock (material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes) VALUES
('Aluminum 6061', 'Aluminum Rod', 1, 150, 50, 'meters', 15.50, 'Standard aluminum stock'),
('Steel Mild', 'Steel Bar', 1, 200, 75, 'kg', 8.25, 'Low carbon steel'),
('Brass Rod', 'Brass', 1, 80, 30, 'meters', 22.00, 'Brass stock for fittings'),
('Plastic Acrylic', 'Acrylic', 2, 120, 40, 'sheets', 12.50, 'Clear acrylic sheets'),
('Copper Pipe', 'Copper', 1, 60, 20, 'meters', 18.75, 'Copper piping'),
('Stainless 316', 'Stainless Steel', 1, 100, 40, 'kg', 28.50, 'Food-grade stainless'),
('Titanium Grade 5', 'Titanium', 1, 25, 10, 'kg', 95.00, 'High-strength aerospace'),
('Aluminum 7075', 'Aluminum Alloy', 1, 110, 35, 'kg', 32.00, 'High-strength aluminum');

-- ============================================================================
-- TEST DATA FOR ORDERS (Optional - create sample order to test)
-- ============================================================================
-- Uncomment below to create a test order

-- INSERT INTO orders (customer_name, customer_email, customer_phone, order_date, due_date, status, notes) VALUES
-- ('Acme Manufacturing', 'contact@acme.com', '555-0123', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'pending', 'Rush order - high precision required');

-- Get the order ID (you'll need to manually add parts after creating order)
-- SELECT * FROM orders WHERE customer_name = 'Acme Manufacturing';

-- ============================================================================
-- ADDITIONAL SUPPLIERS (Optional)
-- ============================================================================
-- INSERT INTO suppliers (name, contact_email, contact_phone, address) VALUES
-- ('Steel Supply Co', 'sales@steelsupply.com', '555-1111', '123 Industrial Ave'),
-- ('Metals Plus', 'info@metalsplus.com', '555-2222', '456 Factory Blvd'),
-- ('Plastic Distributors', 'orders@plasticdist.com', '555-3333', '789 Trade Park');

-- ============================================================================
-- OPERATORS SKILLS (Optional - if your system tracks operator certifications)
-- ============================================================================
-- INSERT INTO operator_skills (user_id, skill_name, skill_level, certified_date) VALUES
-- (1, 'CNC Mill Operation', 5, '2024-01-15'),
-- (1, 'Manual Lathe', 4, '2024-02-20'),
-- (2, 'CNC Programming', 5, '2024-03-10');

-- ============================================================================
-- TOOLS INVENTORY (Optional - if using tool tracking)
-- ============================================================================
-- INSERT INTO tools (tool_name, tool_type, current_quantity, reorder_level, unit, location, notes) VALUES
-- ('End Mill 1/2 inch', 'Cutting Tool', 12, 5, 'pieces', 'Tool Rack A', 'For aluminum'),
-- ('Drill Bit 1/4 inch', 'Drill', 25, 10, 'pieces', 'Tool Rack B', 'Standard'),
-- ('Threading Die M10', 'Cutting Tool', 3, 2, 'pieces', 'Tool Cabinet', 'Metric thread');

-- ============================================================================
-- VERIFY DATA
-- ============================================================================
SELECT 'Material Stock:' as "Data Summary";
SELECT COUNT(*) as material_count FROM material_stock;

SELECT '' as "";
SELECT 'Sample Materials:' as "Materials";
SELECT material_name, current_stock, unit, cost_per_unit FROM material_stock LIMIT 5;

-- Check users
SELECT '' as "";
SELECT 'Users/Operators:' as "Users";
SELECT id, name, employee_id, role FROM users LIMIT 5;

-- Check machines
SELECT '' as "";
SELECT 'Machines:' as "Machines";
SELECT id, machine_name, machine_type FROM machines LIMIT 6;

-- ============================================================================
-- HELPFUL COMMANDS
-- ============================================================================
-- To add more materials manually:
-- INSERT INTO material_stock (material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes) 
-- VALUES ('Material Name', 'Type', 1, 100, 25, 'unit', 10.50, 'Notes');

-- To adjust stock levels:
-- UPDATE material_stock SET current_stock = 200 WHERE material_name = 'Aluminum 6061';

-- To view all materials:
-- SELECT * FROM material_stock ORDER BY material_name;

-- To create a test order (run create-order.html in UI instead - easier!)
-- INSERT INTO orders (customer_name, customer_email, customer_phone, order_date, due_date, status) 
-- VALUES ('Test Customer', 'test@example.com', '555-0000', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'pending');
