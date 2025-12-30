# CNC Shop Floor Management - Implementation Roadmap

**Date:** December 30, 2025  
**Status:** Phase 1A, 1B & Customer Management Phase 1 Implemented

---

## 🏭 SHOP SETUP

**Machines:**
- 5 CNC Mills
- 1 CNC Lathe

**Personnel:**
- 1 Supervisor (Level 400)
- 4 CNC Operators (Level 100): 3 Mill Operators, 1 Lathe Operator
- 1 Material Cutting Operator (Level 200)
- 1 Quality Control Inspector (Level 300)

---

## 📋 WORKFLOW STAGES

### Stage 1: ORDER CREATION
**Who:** Supervisor  
**Actions:**
- Create new order (customer info, due date, priority)
- Add multiple parts to order
- Each part: name, quantity, material, dimensions, drawings
- Set priority (urgent, normal, low)

### Stage 2: MATERIAL PLANNING
**Who:** Supervisor  
**Actions:**
- Review material requirements
- Check stock levels
- Mark materials: ✅ Available | 🛒 Need to order | ⏳ Ordered
- Mark as "Ready for Cutting" when arrived

### Stage 3: MATERIAL CUTTING
**Who:** Material Cutting Operator  
**Actions:**
- View parts needing cutting
- Start cutting job (timer starts)
- Mark pieces as cut with notes
- Complete cutting → moves to "Ready for Programming"

### Stage 4: CAM PROGRAMMING
**Who:** Supervisor  
**Actions:**
- Upload files: 3D model, drawings, CAM files, G-Code
- Add programming notes
- Set machine type (Mill/Lathe)
- Mark as "Ready for Machining"

### Stage 5: JOB ASSIGNMENT
**Who:** Supervisor  
**Actions:**
- View operator workload dashboard
- Assign job to specific operator
- Select machine number
- Set estimated time
- Add setup instructions

### Stage 6: MACHINING
**Who:** CNC Operators  
**Actions:**
- View assigned jobs queue
- Start/Pause/Skip job with reasons
- Upload photos
- Complete job → goes to QC

### Stage 7: QUALITY CONTROL
**Who:** QC Inspector  
**Actions:**
- Inspect completed jobs
- ✅ Approve → Completed
- ❌ Reject → Back to operator
- 🔄 Rework needed
- Upload inspection photos

### Stage 8: ORDER COMPLETION
**Who:** Supervisor  
**Actions:**
- View order progress
- Mark as "Ready to Ship"
- Add tracking info
- Mark as "Shipped"

---

## ✅ PHASE 1A: CORE FOUNDATION (IMPLEMENTED - TESTING)

### Database Tables
- ✅ **orders** - Order management with hold functionality
- ✅ **parts** - Enhanced with workflow stages, batch support, revision control
- ✅ **material_stock** - Inventory tracking with min stock alerts
- ✅ **material_orders** - Material ordering system
- ✅ **machines** - Machine tracking with availability
- ✅ **scrap_records** - Scrap tracking by stage
- ✅ **users** - User management with roles
- ✅ **time_logs** - Time tracking per stage

### Key Features to Test
1. **Order Creation**
   - Create order with customer info
   - Set due date and priority
   - Add multiple parts to order

2. **Material Management**
   - View material stock
   - Check low stock alerts
   - Create material orders
   - Track material status

3. **Part Workflow**
   - Stage transitions (material_planning → cutting → programming → machining)
   - Hold/pause functionality
   - Drawing revision control
   - Scrap recording

4. **Machine Tracking**
   - View machine status
   - Track current jobs
   - Machine availability

---

## ✅ PHASE 1B: CRITICAL OPERATIONS (IMPLEMENTED - TESTING)

### Enhanced Features
- ✅ **Batch splitting** - Split large orders across operators
- ✅ **Setup vs Run time** - Separate time estimates
- ✅ **Priority scoring** - Auto-calculate job priority
- ✅ **Part dependencies** - Track assembly requirements
- ✅ **Hold functionality** - Pause orders/parts with reasons

### Key Features to Test
1. **Batch Management**
   - Split part into multiple batches
   - Track quantity per batch
   - Link batches together

2. **Time Estimation**
   - Set setup time and run time per piece
   - Track actual vs estimated
   - Calculate total time

3. **Priority System**
   - Auto-calculate priority scores
   - Factor in due dates and material status
   - Display priority order

4. **Dependencies**
   - Create part dependencies
   - Enforce completion order
   - Visual dependency chain

---

## 🧪 TESTING CHECKLIST - PHASE 1A

### Test 1: Order & Parts Management
- [ ] Create new order with customer details
- [ ] Add 3 parts to the order
- [ ] View order progress
- [ ] Edit part details
- [ ] Delete a part
- [ ] Put order on hold
- [ ] Resume order

### Test 2: Material Stock & Orders
- [ ] View current material stock
- [ ] Add new material type
- [ ] Update stock quantity
- [ ] Check low stock alerts
- [ ] Create material order
- [ ] Mark material as delivered
- [ ] View material order history

### Test 3: Workflow Stage Transitions
- [ ] Move part from planning → cutting
- [ ] Assign cutting operator
- [ ] Start cutting (timer)
- [ ] Complete cutting
- [ ] Move to programming
- [ ] Upload files
- [ ] Mark ready for machining

### Test 4: Machine Management
- [ ] View all machines
- [ ] Check machine availability
- [ ] Assign job to machine
- [ ] Update machine status
- [ ] Track current operator

### Test 5: Scrap & Hold Features
- [ ] Record scrap at cutting stage
- [ ] Update part quantity
- [ ] Put part on hold
- [ ] Resume part
- [ ] View scrap history

### Test 6: Time Tracking
- [ ] Start time log for cutting
- [ ] Stop time log
- [ ] View time log history
- [ ] Calculate actual vs estimated

---

## ✅ CUSTOMER MANAGEMENT PHASE 1 (IMPLEMENTED)

### Database Schema
- ✅ **customers** - Enhanced with customer_id, headquarters, delivery_address, trade_register
- ✅ **contact_persons** - Multi-contact system (invoice, order, technical)
- ✅ **Customer Parameters** - status, payment_terms, payment_history, discount_percentage
- ✅ **Order Integration** - customer_id, contact FKs, approval workflow fields

### Customer Fields
| Field | Description |
|-------|-------------|
| `company_name` | Company name (required) |
| `customer_id` | Custom ID (e.g., CUST-001) |
| `cif` | Fiscal Identification Code |
| `trade_register_number` | Trade register number |
| `headquarters_address` | Main office address |
| `delivery_address` | Optional - falls back to headquarters |
| `status` | active, inactive, bankrupt, closed |
| `payment_terms` | standard_credit, prepayment_required, cod, custom |
| `payment_history` | good, delayed, bad, new_customer |
| `discount_percentage` | Positive = discount, Negative = fee |
| `credit_limit` | Customer credit limit |
| `approval_threshold` | Orders above this need approval |

### Contact Person System
- ✅ Three contact types: Invoice, Order, Technical
- ✅ Multiple contacts per type
- ✅ Primary contact flag
- ✅ Contact selection during order creation

### UI Features
- ✅ Customer Management page (`/customers.html`)
- ✅ Customer cards with status/payment badges
- ✅ Warning banners for problematic customers
- ✅ Add/Edit customer modals with all parameters
- ✅ Contact management per customer
- ✅ Customer warnings on order creation page

---

## 📅 CUSTOMER MANAGEMENT PHASE 2 (PLANNED - NEXT)

### Order Approval Workflow
- [ ] **Approval Dashboard** - List of orders pending approval
- [ ] **Approve/Reject Actions** - Admin can approve or reject orders
- [ ] **Payment Confirmation** - Mark payment received for prepayment customers
- [ ] **Approval History** - Track who approved and when

### Order Status Flow
```
draft → pending_payment → pending_approval → approved → in_production → completed
                                    ↓
                              cancelled/rejected
```

### Trigger Conditions for Approval
- [ ] Customer status = inactive, bankrupt, or closed
- [ ] Payment terms = prepayment_required (needs payment confirmation)
- [ ] Payment history = bad or delayed
- [ ] Order value exceeds customer's approval_threshold

### Admin Dashboard Features
- [ ] Filter orders by approval_status
- [ ] Quick approve/reject buttons
- [ ] Bulk approval for trusted customers
- [ ] Email/notification on approval needed

---

## 📅 CUSTOMER MANAGEMENT PHASE 3 (PLANNED - FUTURE)

### Financial Tracking
- [ ] **Invoice Generation** - Create invoices from orders
- [ ] **Payment Tracking** - Track payments against invoices
- [ ] **Outstanding Balance** - Show customer's current balance
- [ ] **Payment History Log** - Record all payments

### Credit Management
- [ ] **Credit Limit Enforcement** - Block orders exceeding credit limit
- [ ] **Credit Utilization** - Show how much credit is used
- [ ] **Credit Hold** - Automatic hold when limit reached
- [ ] **Credit Increase Workflow** - Request and approve credit increases

### Reporting & Analytics
- [ ] **Customer Revenue Report** - Revenue per customer over time
- [ ] **Payment Performance** - Average days to pay
- [ ] **Risk Assessment** - Identify high-risk customers
- [ ] **Discount Impact** - Total discounts given per customer

### Customer Portal (Read-Only)
- [ ] **Order Status View** - Customers can check their order status
- [ ] **Invoice Download** - Download PDF invoices
- [ ] **Contact Update** - Update their contact information
- [ ] **Order History** - View past orders

---

## 📅 PHASE 2: ENHANCED OPERATIONS (PLANNED)

### Features
- Operator skills/qualifications matching
- First article inspection workflow
- Real-time notifications system
- Advanced part dependencies
- Tool management

---

## 📅 PHASE 3: ADVANCED FEATURES (PLANNED)

### Features
- Cost tracking and profit margins
- Partial shipments
- Performance analytics
- Utilization reports
- Customer portal (read-only)

---

## 📅 PHASE 4: INTEGRATION & MOBILE (PLANNED)

### Features
- Mobile-optimized operator interface
- Barcode/QR scanning
- Voice notes for operators
- External system integrations
- Real-time dashboard updates

---

## 🎯 CURRENT FOCUS: TEST PHASE 1A

**Next Steps:**
1. **Start backend and frontend** ✅ DONE
2. **Load test data** ✅ DONE
3. **Login with test user** → NEXT
4. **Run through Test 1: Order & Parts Management**
5. **Document any bugs or issues**
6. **Fix critical issues**
7. **Move to Test 2: Material Stock**

**Default Test User:**
- Employee ID: `ADMIN001`
- Password: Check test-data.sql or create new user

---

## 📝 TESTING NOTES

### Bugs Found
- [ ] List bugs here as discovered

### Features Working
- [ ] List confirmed working features

### Issues/Improvements
- [ ] List improvements needed

---

## 🔗 RELATED DOCUMENTS

- [START_HERE.md](../START_HERE.md) - Quick start guide
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Installation instructions
- [ROLE_SYSTEM.md](../ROLE_SYSTEM.md) - User permissions
- [roadmap.txt](roadmap.txt) - Original detailed roadmap
- [roadmap2_sugestion.txt](roadmap2_sugestion.txt) - Enhancement suggestions
