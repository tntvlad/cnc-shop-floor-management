# Loading Test Data into V2 Database

## Quick Start - Add Materials

You now have **2 ways** to add test data:

### Option 1: Automated Script (Easiest) ✅

**Windows (PowerShell):**
```powershell
.\load-test-data.ps1
```

**Linux/Mac (Bash):**
```bash
bash load-test-data.sh
```

This automatically loads 8 test materials with realistic stock levels.

---

### Option 2: Direct SQL Commands

**Access the database:**
```bash
docker exec -it <db-container-name> psql -U postgres -d cnc_shop_floor
```

**Add a single material:**
```sql
INSERT INTO material_stock (material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes) 
VALUES ('Aluminum 6061', 'Aluminum Rod', 1, 150, 50, 'meters', 15.50, 'Standard aluminum stock');
```

**Add multiple materials at once:**
```sql
INSERT INTO material_stock (material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes) VALUES
('Steel Mild', 'Steel Bar', 1, 200, 75, 'kg', 8.25, 'Low carbon steel'),
('Brass Rod', 'Brass', 1, 80, 30, 'meters', 22.00, 'Brass stock for fittings'),
('Copper Pipe', 'Copper', 1, 60, 20, 'meters', 18.75, 'Copper piping');
```

**View all materials:**
```sql
SELECT id, material_name, current_stock, unit, cost_per_unit FROM material_stock ORDER BY material_name;
```

**Update material stock:**
```sql
UPDATE material_stock SET current_stock = 250 WHERE material_name = 'Aluminum 6061';
```

**Delete a material (if needed):**
```sql
DELETE FROM material_stock WHERE material_name = 'Test Material';
```

---

## Test Data Available

The **load-test-data** script adds these materials:

| Material | Type | Stock | Unit | Cost |
|----------|------|-------|------|------|
| Aluminum 6061 | Aluminum Rod | 150 | meters | $15.50 |
| Steel Mild | Steel Bar | 200 | kg | $8.25 |
| Brass Rod | Brass | 80 | meters | $22.00 |
| Plastic Acrylic | Acrylic | 120 | sheets | $12.50 |
| Copper Pipe | Copper | 60 | meters | $18.75 |
| Stainless 316 | Stainless Steel | 100 | kg | $28.50 |
| Titanium Grade 5 | Titanium | 25 | kg | $95.00 |
| Aluminum 7075 | Aluminum Alloy | 110 | kg | $32.00 |

---

## Workflow After Adding Data

1. **Add materials** using one of the methods above
2. **Go to create-order.html**
3. **Create a test order** with customer details
4. **Add parts** to the order
5. **Select materials** from the dropdown (materials will show with current stock)
6. **Submit order** to test the workflow

---

## Useful Database Queries

### Count materials:
```sql
SELECT COUNT(*) as material_count FROM material_stock;
```

### See low stock alerts:
```sql
SELECT material_name, current_stock, reorder_level 
FROM material_stock 
WHERE current_stock <= reorder_level;
```

### Get total inventory value:
```sql
SELECT SUM(current_stock * cost_per_unit) as total_inventory_value 
FROM material_stock;
```

### View all orders:
```sql
SELECT id, customer_name, status, created_at FROM orders;
```

### View parts in an order:
```sql
SELECT p.* FROM parts p 
WHERE p.order_id = 1;
```

---

## If You Need Direct Database Access

**For complex queries or bulk operations:**

```bash
# Open interactive PostgreSQL shell
docker exec -it <db-container> psql -U postgres -d cnc_shop_floor

# Run SQL from file:
docker exec <db-container> psql -U postgres -d cnc_shop_floor -f /tmp/your-file.sql
```

---

## Testing the Full Workflow

1. Run `./load-test-data.ps1` (Windows) or `bash load-test-data.sh` (Linux)
2. Login to dashboard as ADMIN001 / admin123
3. Click "📦 Orders" button
4. Click "+ New Order"
5. Fill in customer info:
   - Name: Test Company
   - Email: test@example.com
   - Phone: 555-0123
   - Order Date: (today)
   - Due Date: (30 days from today)
6. Add a part:
   - Part Name: Test Part
   - Quantity: 10
   - Material: Select "Aluminum 6061" (shows stock: 150)
7. Click "Create Order"
8. View order in dashboard
9. Click order to see details
10. Click "Material Requirements" to see the stock check

---

## Common Issues

### "Materials dropdown is empty"
- Run the load-test-data script
- Or manually INSERT materials using SQL above

### "Cannot find database container"
- Make sure Docker containers are running: `docker-compose up`
- Check container name: `docker ps`

### "Permission denied" on script
- Linux/Mac: Make script executable: `chmod +x load-test-data.sh`
- Then run: `./load-test-data.sh`

---

## Files

- **backend/db/test-data.sql** - SQL script with all test data
- **load-test-data.ps1** - PowerShell script (Windows)
- **load-test-data.sh** - Bash script (Linux/Mac)
