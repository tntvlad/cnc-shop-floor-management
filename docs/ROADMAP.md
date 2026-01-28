# CNC Shop Floor Management - Implementation Roadmap

**Date:** January 28, 2026  
**Status:** Phase 1A, 1B, Customer Management Phase 1, Workflow Monitor & Admin Settings Implemented

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

Status: ✅ Implemented & Tested | ⌛ In Progress | ⏸️ On Hold | ❌ Abandoned

### Stage 1: ORDER CREATION
**Who:** Supervisor  
**Actions:**
- ✅ Create new order (customer info, due date, priority)
- ✅ Add multiple parts to order
- ✅ Each part: name, quantity, material selection
- ✅ Set part priority (urgent, high, normal, low)
- ✅ Internal Order ID and External Order ID support
- ✅ Customer selection with folder management

### Stage 2: MATERIAL PLANNING
**Who:** Supervisor  
**Actions:**
- ✅ Material types management with categories
- ✅ Material stock inventory tracking
- ✅ Stock in/out transactions with history
- ✅ Supplier management
- ✅ Storage location tracking
- ⌛ Low stock alerts and reorder points

### Stage 3: MATERIAL CUTTING
**Who:** Material Cutting Operator  
**Actions:**
- ✅ View parts in cutting stage (Workflow Monitor)
- ✅ Move parts through workflow stages
- ⌛ Start cutting job (timer starts)
- ⌛ Mark pieces as cut with notes

### Stage 4: CAM PROGRAMMING
**Who:** Supervisor  
**Actions:**
- ✅ Parts visible in programming stage
- ✅ Move parts to next stage when ready
- ⌛ Upload files: 3D model, drawings, CAM files, G-Code
- ⌛ Add programming notes

### Stage 5: JOB ASSIGNMENT
**Who:** Supervisor  
**Actions:**
- ✅ View parts in machining stage
- ⌛ Assign job to specific operator
- ⌛ Select machine number
- ⌛ Set estimated time
- ⌛ Add setup instructions

### Stage 6: MACHINING
**Who:** CNC Operators  
**Actions:**
- ✅ View parts in machining stage
- ✅ Complete stage to move to QC
- ⌛ Start/Pause/Skip job with reasons
- ⌛ Upload photos

### Stage 7: QUALITY CONTROL
**Who:** QC Inspector  
**Actions:**
- ✅ View parts in QC stage
- ✅ Complete to mark as finished
- ⌛ Approve/Reject workflow
- ⌛ Upload inspection photos

### Stage 8: ORDER COMPLETION
**Who:** Supervisor  
**Actions:**
- ✅ View order progress percentage
- ✅ Auto-complete order when all parts done
- ✅ Order folder moved to Archive on completion
- ⌛ Mark as "Ready to Ship"
- ⌛ Add tracking info

---

## ✅ PHASE 1A: CORE FOUNDATION (IMPLEMENTED)

### Database Tables
- ✅ **orders** - Order management with customer linking, priority, status tracking
- ✅ **parts** - Enhanced with workflow stages (pending → cutting → programming → machining → qc → completed)
- ✅ **material_types** - Material type definitions with categories and aliases
- ✅ **material_stock** - Inventory tracking with dimensions and locations
- ✅ **machines** - Machine tracking with name, type, status, location
- ✅ **users** - User management with permission levels (100-500)
- ✅ **customers** - Full customer management with contacts
- ✅ **contact_persons** - Multi-contact system per customer

### Implemented Features
1. **Order Creation & Management**
   - ✅ Create order with customer selection
   - ✅ Internal/External order ID support
   - ✅ Set due date and priority (urgent, high, normal, low)
   - ✅ Add multiple parts to order
   - ✅ Customer folder creation on NAS
   - ✅ Order editing (customer, dates, priority)
   - ✅ Per-part priority settings

2. **Workflow Monitor (Kanban Board)**
   - ✅ Visual kanban board with 6 stages
   - ✅ Drag-and-drop part movement
   - ✅ Complete button to advance stages
   - ✅ Hold/Resume functionality
   - ✅ Part details popup

3. **Auto-Status Updates**
   - ✅ Order auto-sets to "in-progress" when parts move from pending
   - ✅ Order auto-completes when all parts reach completed
   - ✅ Workflow-based progress percentage (weighted by stage)

4. **Machine Tracking**
   - ✅ Add/Edit/Delete machines
   - ✅ Machine type, status, location fields
   - ✅ Machine list in Admin Settings

---

## ✅ PHASE 1B: ADMIN SETTINGS (IMPLEMENTED)

### Admin Settings Dashboard
- ✅ **Users Tab** - Create, view, delete users with permission levels
- ✅ **Customers Tab** - Full customer management (link to customers page)
- ✅ **Materials Tab** - Material types with categories, aliases, density
- ✅ **Machines Tab** - Machine management with type, status, location
- ✅ **Tools Tab** - Placeholder for future tool management

### Git/Version Control Integration
- ✅ Git status checking
- ✅ Pull updates from repository
- ✅ Restart services
- ✅ Check for new releases

### Database Management
- ✅ Backup database to SQL file
- ✅ Restore database from backup

---

## ✅ MATERIALS MANAGEMENT (IMPLEMENTED)

### Material Types
- ✅ Create material types with name, category, density
- ✅ Alias support for equivalent material names
- ✅ Category organization (steel, aluminum, plastic, etc.)
- ✅ Search and filter materials

### Material Inventory
- ✅ Track stock with dimensions (diameter, width, height, length)
- ✅ Shape types (round bar, square bar, plate, tube, etc.)
- ✅ Supplier tracking
- ✅ Storage location management
- ✅ Stock In/Out transactions with history
- ✅ Unit cost tracking

---

## 🧪 CURRENT TESTING CHECKLIST

### ✅ Completed Tests
- [x] Create new order with customer selection
- [x] Add parts to order
- [x] View order list with progress percentage
- [x] Edit order details (customer, dates, priority)
- [x] Delete orders
- [x] Workflow Monitor - move parts through stages
- [x] Auto-update order status to in-progress
- [x] Auto-complete order when all parts done
- [x] Machine management (add, edit, delete)
- [x] Material types management
- [x] User management
- [x] Customer management

### ⌛ Tests In Progress
- [ ] Material stock tracking (full workflow)
- [ ] Stock in/out transactions
- [ ] Hold/Resume parts
- [ ] Part details view

### 📋 Pending Tests
- [ ] Time tracking for parts
- [ ] File uploads for parts
- [ ] Operator assignment
- [ ] Scrap recording
- [ ] Batch splitting

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

## 📅 PHASE 2: ENHANCED WORKFLOW (PLANNED - NEXT)

### Operator Features
- [ ] Operator assignment to parts/machines
- [ ] Operator workload dashboard
- [ ] Skills/qualifications matching
- [ ] Personal job queue view

### Time Tracking
- [ ] Start/Stop timer for each workflow stage
- [ ] Setup time vs Run time separation
- [ ] Actual vs Estimated time comparison
- [ ] Time log history per part

### File Management
- [ ] Upload files to parts (3D models, drawings, G-code)
- [ ] File viewer integration (STEP files)
- [ ] Revision control for drawings
- [ ] Link files to specific workflow stages

### Quality Control
- [ ] Approve/Reject workflow with notes
- [ ] Inspection photos upload
- [ ] Rework tracking
- [ ] First article inspection checklist

---

## 📅 PHASE 3: ADVANCED FEATURES (PLANNED)

### Scrap & Rework
- [ ] Record scrap at any stage
- [ ] Scrap reason tracking
- [ ] Quantity adjustments
- [ ] Scrap cost calculation

### Reporting & Analytics
- [ ] Order completion reports
- [ ] Machine utilization reports
- [ ] Operator performance metrics
- [ ] On-time delivery tracking
- [ ] Customer revenue analysis

### Shipping & Completion
- [ ] Mark orders ready to ship
- [ ] Tracking number entry
- [ ] Shipping label generation
- [ ] Delivery confirmation

---

## 📅 PHASE 4: INTEGRATION & MOBILE (PLANNED)

### Mobile Interface
- [ ] Mobile-optimized operator interface
- [ ] Barcode/QR scanning for parts
- [ ] Voice notes for operators
- [ ] Photo upload from mobile

### External Integrations
- [ ] Invoice system integration
- [ ] Email notifications
- [ ] Customer portal (read-only)
- [ ] ERP system connector

---

## 🎯 CURRENT FOCUS

**Active Work:**
- Workflow Monitor refinement
- Order progress tracking
- Machine management in Admin Settings

**Next Priority:**
1. Time tracking implementation
2. File upload for parts
3. Operator assignment workflow
4. QC approve/reject flow

**Recent Fixes (January 2026):**
- ✅ Fixed order auto-status update (pending → in-progress)
- ✅ Fixed progress percentage calculation (workflow-weighted)
- ✅ Fixed machine creation/deletion
- ✅ Fixed status consistency (in-progress vs in_progress)
- ✅ Removed Manage Machines from Supervisor page (moved to Admin)

---

## 📝 KNOWN ISSUES

### To Fix
- [ ] Edit machine functionality not implemented
- [ ] Material stock low alerts not shown
- [ ] Part details modal needs more info

### Improvements Needed
- [ ] Add bulk part operations
- [ ] Improve CSV import for parts
- [ ] Add search to Workflow Monitor

---

## 🔗 RELATED DOCUMENTS

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Installation instructions
- [ROLE_SYSTEM.md](ROLE_SYSTEM.md) - User permissions and levels
