# Customer Management System

## Overview

The CNC Shop Floor Management system now includes a comprehensive customer management system with the following features:

1. **Customer Dropdown Search** - Search existing customers by company name, email, phone, or contact person
2. **Add New Customer Modal** - Create new customers on-the-fly without leaving the order creation form
3. **CSV Import** - Bulk import customers from CSV files with row selection
4. **Customer Details Display** - View comprehensive customer information including technical contacts and notes

## Features

### 1. Customer Dropdown Search (Create Order Page)

When creating a new order, users can now search for customers instead of manually typing their information.

**How it works:**
- Click on the "Search or Select Customer" field
- Start typing company name, email, phone, or contact person name
- Matching customers appear in a dropdown below
- Click on a customer to select them
- Customer details are displayed in a read-only information grid

**Search behavior:**
- Real-time filtering as you type
- Case-insensitive search
- Searches across multiple fields (company name, email, phone, contact person)

### 2. Add New Customer Modal

If a customer doesn't exist in the system, you can create them directly from the order creation form.

**Fields available:**
- Company Name (required)
- Email (required, unique)
- Phone
- CIF (Tax ID)
- Address
- City
- Contact Person
- Contact Phone
- Contact Email
- Technical Contact Person
- Technical Phone
- Technical Email
- Processing Notes
- Delivery Notes
- Billing Notes

**How to use:**
1. Click the "Create New" link in the customer search section
2. Fill in the customer details in the modal
3. Click "Add Customer"
4. The new customer is immediately available for selection in the current order

### 3. CSV Import

Bulk import customers from CSV files with row-by-row selection.

**Supported CSV columns:**
- Nume Firma / Company Name
- Email
- Tel / Phone
- C.I.F / CIF
- Nr.RegCom / Registration Number
- Sediu / Address
- Cod Client / Customer Code
- Date Livrare / Delivery Date
- Contact Person Names
- Technical Contact Information
- Notes (Processing, Delivery, Billing)

**How to import:**
1. Click the "Import from CSV" link in the customer search section
2. Select a CSV file from your computer
3. A preview table appears showing up to 300 rows
4. Select/deselect individual rows using checkboxes
5. Click "Import Selected Rows"
6. A success message confirms the import
7. Newly imported customers are available in the dropdown

**CSV Format Example:**
```csv
Nume Firma,Email,Tel,C.I.F,Sediu
"ABC Manufacturing","abc@example.com","+40211234567","RO9876543","Bucharest, Street 123"
"XYZ Services","xyz@example.com","+40215551234","RO1122334","Cluj, Street 456"
```

## API Endpoints

### Get Customers
```
GET /api/customers
Headers: Authorization: Bearer {token}
Query Parameters:
  - search (optional): Search string to filter customers

Response: { success: true, customers: [...] }
```

### Get Single Customer
```
GET /api/customers/:id
Headers: Authorization: Bearer {token}

Response: { success: true, customer: {...} }
```

### Create Customer
```
POST /api/customers
Headers: 
  - Authorization: Bearer {token}
  - Content-Type: application/json
Body: {
  company_name: string (required),
  email: string (required, unique),
  phone: string,
  cif: string,
  reg_com: string,
  address: string,
  city: string,
  postal_code: string,
  country: string,
  contact_person: string,
  contact_phone: string,
  contact_email: string,
  technical_contact_person: string,
  technical_phone: string,
  technical_email: string,
  processing_notes: string,
  delivery_notes: string,
  billing_notes: string
}

Response: { success: true, customer: {...} }
```

### Update Customer
```
PUT /api/customers/:id
Headers: 
  - Authorization: Bearer {token}
  - Content-Type: application/json
Body: { ...any fields to update... }

Response: { success: true, customer: {...} }
```

### Delete Customer
```
DELETE /api/customers/:id
Headers: Authorization: Bearer {token}

Response: { success: true }
```

### Bulk Import Customers
```
POST /api/customers/import/csv
Headers: 
  - Authorization: Bearer {token}
  - Content-Type: application/json
Body: {
  customers: [
    { company_name: "...", email: "...", ... },
    { company_name: "...", email: "...", ... }
  ]
}

Response: { 
  success: true,
  imported: number,
  failed: number,
  errors: [...],
  customers: [...]
}
```

## Database Schema

The `customers` table includes:

```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  cif VARCHAR(50),
  reg_com VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Romania',
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  technical_contact_person VARCHAR(100),
  technical_phone VARCHAR(20),
  technical_email VARCHAR(100),
  processing_notes TEXT,
  delivery_notes TEXT,
  billing_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_customers_company ON customers(company_name);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
```

## Frontend Implementation

### Files Modified:
- `frontend/create-order.html` - Updated with customer search dropdown, add customer modal, CSV import modal
- `frontend/js/create-order.js` - New file with all customer management logic

### Key Functions:
- `loadCustomers()` - Load all customers from API on page load
- `setupCustomerSearch()` - Initialize dropdown and filter logic
- `selectCustomer()` - Handle customer selection
- `openAddCustomerModal()` / `closeAddCustomerModal()` - Modal management
- `handleAddCustomer()` - Submit new customer form
- `openImportCsvModal()` / `closeImportCsvModal()` - CSV modal management
- `parseCsv()` - Parse CSV file content
- `renderCsvPreview()` - Display preview table with row selection
- `handleImportCsv()` - Submit selected CSV rows for import

### Styling:
New CSS classes for customer components:
- `.customer-search-wrapper` - Search container
- `.customer-dropdown` - Dropdown list styling
- `.customer-option` - Individual dropdown items
- `.customer-details-grid` - Customer info display
- `.modal` - Modal dialog styling
- `.csv-table` - CSV preview table

## Backend Implementation

### Files Modified:
- `backend/server.js` - Added customersController import and 6 API routes
- `backend/config/database.js` - Database connection (no changes needed)
- `backend/middleware/auth.js` - Used for route protection (existing)
- `backend/middleware/permissions.js` - Used for `requireSupervisor()` guard

### New File:
- `backend/controllers/customersController.js` - All CRUD and import logic

### Controller Methods:
1. `getCustomers()` - List with optional search filter
2. `getCustomer()` - Get by ID
3. `createCustomer()` - Create new (supervisor+ only)
4. `updateCustomer()` - Update existing (supervisor+ only)
5. `deleteCustomer()` - Delete (supervisor+ only)
6. `importCustomers()` - Bulk import (supervisor+ only)

## Security

- All customer endpoints require authentication
- Create, update, delete, and import operations require supervisor role or higher
- Read operations (GET) are available to all authenticated users
- Email field is unique to prevent duplicates

## Testing

### Test with curl:

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "ADMIN001", "password": "admin123"}' | jq -r '.token')

# 2. Create a customer
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "company_name": "Test Company",
    "email": "test@example.com",
    "phone": "+40123456789"
  }'

# 3. List customers
curl http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN"

# 4. Search customers
curl "http://localhost:5000/api/customers?search=Test" \
  -H "Authorization: Bearer $TOKEN"

# 5. Import bulk customers
curl -X POST http://localhost:5000/api/customers/import/csv \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customers": [
      {"company_name": "ABC Inc", "email": "abc@example.com"},
      {"company_name": "XYZ Corp", "email": "xyz@example.com"}
    ]
  }'
```

## Known Limitations

- CSV import does not validate file format before preview
- Maximum 1000 rows recommended for CSV import (for performance)
- Email must be unique per customer
- Manual entry fallback is hidden if a customer is selected (show with "Clear Selection" button if needed)

## Future Enhancements

- [ ] Edit existing customer from order form
- [ ] Customer history/orders view
- [ ] Customer categorization (premium, regular, etc.)
- [ ] Custom fields per customer
- [ ] Duplicate detection on CSV import
- [ ] Email validation on import
- [ ] Payment terms per customer
- [ ] Customer contact preferences

## Troubleshooting

### Customers not appearing in dropdown
1. Ensure database is running: `docker compose ps`
2. Check backend logs: `docker logs cnc-backend`
3. Verify customers exist: `curl http://localhost:5000/api/customers -H "Authorization: Bearer $TOKEN"`

### CSV import failing
1. Check CSV file format (comma-separated)
2. Ensure email column is present
3. Check for duplicate emails
4. Review backend logs for detailed errors

### Modal not opening
1. Check browser console for JavaScript errors
2. Verify create-order.js is loaded: Network tab in DevTools
3. Ensure no other JavaScript is blocking modal

## Related Documentation

- [API Documentation](README.md)
- [Order Creation Guide](SETUP_GUIDE.md)
- [User Roles and Permissions](ROLE_SYSTEM.md)
