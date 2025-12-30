# Quick Start: Customer Management Feature

## Live Testing

Navigate to http://localhost:3000/create-order.html in your browser.

### Test 1: View Existing Customers

1. Find the "Search or Select Customer" field at the top
2. Click in the field and start typing "test"
3. You should see "Test Company Ltd" appear in the dropdown
4. Click on it to select
5. The "Selected Customer Details" grid should show all information for that customer

### Test 2: Create New Customer

1. On the create-order page, click the "Create New" link
2. Fill in the modal form:
   - Company Name: "Demo Corp"
   - Email: "demo@example.com"
   - Phone: "+40722111222"
   - Contact Person: "John Smith"
3. Click "Add Customer"
4. The modal closes and the new customer is automatically selected
5. Try searching for "Demo" in the dropdown - it should now appear

### Test 3: Import from CSV

1. Create a test CSV file with this content:
```
Company,Email,Phone,City
"Test 1","test1@example.com","+40211111111","Bucharest"
"Test 2","test2@example.com","+40211111112","Cluj"
"Test 3","test3@example.com","+40211111113","Timisoara"
```

2. Save it as `test_customers.csv`
3. On create-order page, click "Import from CSV"
4. Click the file input and select your test CSV
5. A preview table appears with checkboxes
6. Check the boxes for rows you want (or use "Select All")
7. Click "Import Selected Rows"
8. You should see a success message
9. Search for "Test 1" in the customer dropdown - it should now be available

### Test 4: Create Order with Selected Customer

1. Search and select a customer from the dropdown
2. Fill in order details:
   - Order Date: (auto-filled to today)
   - Due Date: (pick a future date)
   - Priority: "High"
3. Add at least one part with a name
4. Click "Create Order"
5. Should redirect to order dashboard with success message

## API Testing with curl

```bash
# Get token (use admin credentials)
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "ADMIN001", "password": "admin123"}' | jq -r '.token')

echo "Token: $TOKEN"

# List all customers
curl http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN" | jq .

# Search customers
curl "http://localhost:5000/api/customers?search=Demo" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Create single customer
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "company_name": "API Test Company",
    "email": "apitest@example.com",
    "phone": "+40799999999",
    "city": "Bucharest"
  }' | jq .

# Bulk import
curl -X POST http://localhost:5000/api/customers/import/csv \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customers": [
      {
        "company_name": "Bulk Test 1",
        "email": "bulk1@example.com",
        "phone": "+40701111111"
      },
      {
        "company_name": "Bulk Test 2",
        "email": "bulk2@example.com",
        "phone": "+40702222222"
      }
    ]
  }' | jq .
```

## Expected Results

### After Test 1:
- Customer dropdown shows filtered results
- Selected customer info appears in a grid below

### After Test 2:
- New customer appears in database
- Modal closes automatically
- Customer is pre-selected in order form

### After Test 3:
- CSV file is parsed correctly
- Preview shows all rows from CSV
- Selected rows are imported
- Success message shows import count

### After Test 4:
- Order created with customer_id linked
- Redirect confirms success
- Order appears in dashboard with customer name/email

## Troubleshooting

**Dropdown not showing customers:**
- Check backend logs: `docker logs cnc-backend`
- Verify auth token: Token should start with `eyJ`
- Test API directly: Use curl commands above

**Modal not opening:**
- Open DevTools (F12) and check Console tab
- Look for JavaScript errors
- Verify create-order.js loaded in Network tab

**CSV not importing:**
- Check file format is plain text CSV
- Ensure email column exists
- Check for duplicate emails across batches
- Review backend logs for specific error

**Order creation fails:**
- Ensure at least one part is added
- Check that order/due dates are filled
- Verify customer is selected (customer-id input should have a value)

## Files to Monitor

- Frontend: [frontend/create-order.html](frontend/create-order.html)
- Frontend JS: [frontend/js/create-order.js](frontend/js/create-order.js)
- Backend: [backend/controllers/customersController.js](backend/controllers/customersController.js)
- Database: `customers` table in PostgreSQL

## Next Steps After Testing

1. Push to main branch when ready for production
2. Update deployment documentation
3. Train users on CSV import format
4. Consider adding more test data for demo purposes

## Documentation

For detailed information, see [CUSTOMER_MANAGEMENT.md](CUSTOMER_MANAGEMENT.md)
