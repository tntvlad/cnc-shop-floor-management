# Materials Dropdown Troubleshooting Guide

The materials dropdown in `create-order.html` should now have detailed console logging to help diagnose why materials aren't appearing.

## Step 1: Open Browser Developer Tools

1. Go to the Create Order page (http://localhost:3000/create-order.html)
2. Press **F12** to open Developer Tools
3. Click the **Console** tab
4. Reload the page (F5)

## Step 2: Check Console Logs

When the page loads and tries to load materials, you should see console messages like:

```
Loading materials from: http://192.168.x.x:5000/api/materials
Auth token: Present
Materials API response status: 200
Materials data received: { success: true, materials: [...] }
Found 8 materials
```

### Possible Console Messages

#### ✅ Success
```
Loading materials from: http://192.168.x.x:5000/api/materials
Auth token: Present
Materials API response status: 200
Materials data received: { success: true, materials: [{...}, {...}] }
Found 8 materials
```

#### ❌ Authentication Error
```
Loading materials from: http://192.168.x.x:5000/api/materials
Auth token: Missing
```
**Fix:** You're not logged in. Go to [login.html](login.html) and login first.

#### ❌ Auth Token Present But API Returns 401
```
Materials API response status: 401
Materials API error: 401 Unauthorized
```
**Fix:** Your token is invalid or expired. Try logging out and logging back in.

#### ❌ API Returns 500 Error
```
Materials API response status: 500
Materials API error: 500 Internal Server Error
```
**Fix:** The backend API is having issues. Check the backend logs:
```bash
docker logs <backend-container-name>
```

#### ❌ Network Error (No Response)
```
Error loading materials: TypeError: Failed to fetch
```
**Fix:** The backend is not reachable. Check:
1. Is the backend running? `docker ps`
2. Is it on the correct port? (should be :5000)
3. Is the API_URL correct in console? (should be http://[your-ip]:5000/api)

#### ❌ No Materials in Database
```
Materials API response status: 200
Materials data received: { success: true, materials: [] }
No materials available
```
**Fix:** The database has no materials. Load test data:
```powershell
# Windows
.\load-test-data.ps1
```
Or manually insert materials:
```sql
INSERT INTO material_stock (material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes) 
VALUES ('Aluminum 6061', 'Aluminum Rod', 1, 150, 50, 'meters', 15.50, 'Standard aluminum stock');
```

## Step 3: Verify Test Data in Database

Check if test data actually exists:

```bash
# Inside the database container
docker exec <db-container> psql -U postgres -d cnc_shop_floor -c "SELECT COUNT(*) FROM material_stock;"
```

Expected output: `8` (or more if you added more materials)

If count is 0:
```bash
# Run test data script inside container
docker exec <db-container> psql -U postgres -d cnc_shop_floor -f /docker-entrypoint-initdb.d/test-data.sql
```

## Step 4: Test API Endpoint Directly

Use `curl` or Postman to test the API:

```bash
# Get auth token first (login page returns this)
TOKEN="your-jwt-token-here"

# Test materials endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/materials
```

Expected response:
```json
{
  "success": true,
  "materials": [
    {
      "id": 1,
      "material_name": "Aluminum 6061",
      "material_type": "Aluminum Rod",
      "current_stock": 150,
      "unit": "meters",
      ...
    },
    ...
  ],
  "total": 8
}
```

## Step 5: Check Backend Logs

```bash
docker logs <backend-container> --tail 50
```

Look for error messages related to `/api/materials` endpoint.

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Materials dropdown shows "Error: Failed to fetch" | Backend not running | `docker start <container>` |
| Dropdown shows "Error: 401 Unauthorized" | Token expired | Login again on login.html |
| Dropdown shows "No materials available" | No test data in DB | Run `.\load-test-data.ps1` |
| Dropdown shows "Error loading materials: TypeError..." | CORS/Network issue | Check backend is on correct port (5000) |
| Dropdown options are empty but no error | API response format mismatch | Check backend getMaterials() in materialsController.js |

## Next Steps

Once materials are loading successfully:

1. ✅ Create an order with parts
2. ✅ Select materials from the dropdown
3. ✅ Verify order appears on order-dashboard.html
4. ✅ Check workflow-monitor.html shows the parts

## Additional Debugging

To add even more detailed logging, you can check the Network tab in DevTools:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Reload the page
4. Look for request to `materials` (in the API section)
5. Click it to see:
   - Request headers (should include Authorization)
   - Response body (should show materials array)
   - Response status (should be 200)

---

**Need help?** Check the backend logs and console logs (F12) for specific error messages.
