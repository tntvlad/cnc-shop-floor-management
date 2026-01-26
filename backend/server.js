const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();
const pool = require('./config/database');

const authMiddleware = require('./middleware/auth');
const { validateRequest, schemas } = require('./middleware/validation');
const { requireSupervisor } = require('./middleware/permissions');

// Controllers
const authController = require('./controllers/authController');
const partsController = require('./controllers/partsController');
const feedbackController = require('./controllers/feedbackController');
const timeController = require('./controllers/timeController');
const filesController = require('./controllers/filesController');
const adminController = require('./controllers/adminController');
const ordersController = require('./controllers/ordersController');
const materialsController = require('./controllers/materialsController');
const phase1bController = require('./controllers/phase1bController');
const machinesController = require('./controllers/machinesController');
const customersController = require('./controllers/customersController');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure minimal schema updates are applied at startup
async function ensureSchema() {
  try {
    await pool.query('ALTER TABLE parts ADD COLUMN IF NOT EXISTS file_folder TEXT');
    console.log('✓ Schema check: parts.file_folder ready');
  } catch (err) {
    console.error('Schema check failed:', err.message || err);
  }

  // Create customers table if it doesn't exist
  try {
    // Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        customer_id VARCHAR(50),
        cif VARCHAR(50),
        reg_com VARCHAR(50),
        trade_register_number VARCHAR(100),
        headquarters_address TEXT,
        delivery_address TEXT,
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
        notes TEXT,
        processing_notes TEXT,
        delivery_notes TEXT,
        billing_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add new columns if they don't exist (for existing databases)
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50)');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS headquarters_address TEXT');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_register_number VARCHAR(100)');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address TEXT');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT');
    
    // Customer parameters (Phase 1)
    await pool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
    await pool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(30) DEFAULT 'standard_credit'");
    await pool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_history VARCHAR(20) DEFAULT 'new_customer'");
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_terms_notes TEXT');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS approval_threshold DECIMAL(12,2)');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2)');
    
    // Create indexes separately
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)');
    
    console.log('✓ Schema check: customers table ready');
  } catch (err) {
    console.error('Customers table creation failed:', err.message || err);
  }

  // Create contact_persons table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_persons (
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
      )
    `);
    
    await pool.query('CREATE INDEX IF NOT EXISTS idx_contact_persons_customer ON contact_persons(customer_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_contact_persons_type ON contact_persons(contact_type)');
    
    console.log('✓ Schema check: contact_persons table ready');
  } catch (err) {
    console.error('Contact persons table creation failed:', err.message || err);
  }

  // Add contact person references to orders table
  try {
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_contact_id INTEGER REFERENCES contact_persons(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_contact_id INTEGER REFERENCES contact_persons(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS technical_contact_id INTEGER REFERENCES contact_persons(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT');
    
    // Order approval workflow fields (Phase 2 ready)
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'approved'");
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_applied DECIMAL(5,2) DEFAULT 0.00');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_notes TEXT');
    
    console.log('✓ Schema check: orders contact fields ready');
  } catch (err) {
    console.error('Orders contact fields failed:', err.message || err);
  }
}
ensureSchema();

// Middleware - CORS configuration
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // If wildcard, allow any origin by echoing it back
    if (allowedOrigin === '*') {
      return callback(null, origin);
    }
    
    // Otherwise, check if it matches
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/login', validateRequest(schemas.login), authController.login);
app.get('/api/auth/me', authMiddleware, authController.getCurrentUser);
app.post('/api/auth/users', authMiddleware, authController.createUser);
app.delete('/api/auth/users/:userId', authMiddleware, authController.deleteUser);
app.get('/api/auth/users', authMiddleware, authController.listUsers);

// Admin routes
app.get('/api/admin/git-branch', authMiddleware, adminController.getGitBranch);
app.get('/api/admin/git-releases', authMiddleware, adminController.getGitReleases);
app.get('/api/admin/check-updates', authMiddleware, adminController.checkForUpdates);
app.post('/api/admin/git-pull', authMiddleware, adminController.gitPull);
app.post('/api/admin/git-switch', authMiddleware, adminController.switchBranch);
app.post('/api/admin/git-checkout-release', authMiddleware, adminController.checkoutRelease);
app.post('/api/admin/restart', authMiddleware, adminController.restartServices);
app.get('/api/admin/database/backup', authMiddleware, adminController.databaseBackup);
app.post('/api/admin/database/restore', authMiddleware, adminController.databaseRestore);

// Parts routes
app.get('/api/parts', authMiddleware, partsController.getAllParts);
app.get('/api/parts/my-jobs', authMiddleware, partsController.getOperatorJobs);
app.get('/api/parts/statistics', authMiddleware, partsController.getStatistics);
app.get('/api/parts/:id', authMiddleware, partsController.getPart);
app.post('/api/parts', authMiddleware, requireSupervisor(), validateRequest(schemas.createPart), partsController.createPart);
app.put('/api/parts/:id', authMiddleware, requireSupervisor(), validateRequest(schemas.updatePart), partsController.updatePart);
app.put('/api/parts/:id/folder', authMiddleware, requireSupervisor(), validateRequest(schemas.updateFolder), partsController.updateFileFolder);
app.delete('/api/parts/:id', authMiddleware, requireSupervisor(), partsController.deletePart);
app.post('/api/parts/:id/assign', authMiddleware, requireSupervisor(), validateRequest(schemas.assignPart), partsController.assignPart);
app.post('/api/parts/:id/start', authMiddleware, partsController.startJob);
app.post('/api/parts/:id/complete', authMiddleware, validateRequest(schemas.completeTime), partsController.completePart);

// Folder browse (Supervisor+)
app.get('/api/folders/browse', authMiddleware, requireSupervisor(), filesController.browseFolders);
// Create folder (Supervisor+)
app.post('/api/folders/create', authMiddleware, requireSupervisor(), filesController.createFolder);

// Sync files from assigned folder into DB (Supervisor+)
app.post('/api/parts/:id/files/sync', authMiddleware, requireSupervisor(), filesController.syncFromFolder);

// Feedback routes
app.get('/api/parts/:partId/feedback', authMiddleware, feedbackController.getPartFeedback);
app.post('/api/parts/:partId/feedback', authMiddleware, validateRequest(schemas.feedback), feedbackController.addFeedback);

// Time tracking routes
app.get('/api/time/active', authMiddleware, timeController.getActiveTimer);
app.post('/api/parts/:partId/timer/start', authMiddleware, timeController.startTimer);
app.post('/api/parts/:partId/timer/stop', authMiddleware, timeController.stopTimer);
app.get('/api/parts/:partId/timelogs', authMiddleware, timeController.getPartTimeLogs);

// ======================== ORDERS ROUTES ========================
// Note: requireSupervisor must be INVOKED to return the middleware instance.
app.post('/api/orders', authMiddleware, requireSupervisor(), ordersController.createOrder);
app.get('/api/orders', authMiddleware, requireSupervisor(), ordersController.getOrders);
app.get('/api/orders/:id', authMiddleware, requireSupervisor(), ordersController.getOrderById);
app.put('/api/orders/:id', authMiddleware, requireSupervisor(), ordersController.updateOrder);
app.put('/api/orders/:id/status', authMiddleware, requireSupervisor(), ordersController.updateOrderStatus);
app.delete('/api/orders/:id', authMiddleware, requireSupervisor(), ordersController.deleteOrder);
app.get('/api/orders/stats/summary', authMiddleware, requireSupervisor(), ordersController.getOrderStats);
app.post('/api/orders/:orderId/parts', authMiddleware, requireSupervisor(), ordersController.addPartToOrder);
app.put('/api/parts/:partId/priority', authMiddleware, requireSupervisor(), ordersController.updatePartPriority);

// ======================== MATERIALS ROUTES ========================
app.get('/api/materials/stats', authMiddleware, materialsController.getMaterialsStats);
app.get('/api/materials/types', authMiddleware, materialsController.getMaterialTypes);
app.get('/api/materials/types/:id', authMiddleware, materialsController.getMaterialTypeById);
app.post('/api/materials/types', authMiddleware, requireSupervisor(), materialsController.createMaterialType);
app.put('/api/materials/types/:id', authMiddleware, requireSupervisor(), materialsController.updateMaterialType);
app.delete('/api/materials/types/:id', authMiddleware, requireSupervisor(), materialsController.deleteMaterialType);
app.get('/api/materials/alerts/low-stock', authMiddleware, materialsController.getLowStockAlerts);
app.get('/api/materials/reports/usage', authMiddleware, materialsController.getMaterialUsageReport);
app.get('/api/materials/transactions', authMiddleware, materialsController.getTransactions);
app.get('/api/materials', authMiddleware, materialsController.getMaterials);
app.get('/api/materials/:id', authMiddleware, materialsController.getMaterialById);
app.post('/api/materials', authMiddleware, requireSupervisor(), materialsController.createMaterial);
app.put('/api/materials/:id', authMiddleware, requireSupervisor(), materialsController.updateMaterial);
app.delete('/api/materials/:id', authMiddleware, requireSupervisor(), materialsController.deleteMaterial);
app.post('/api/materials/:id/stock-in', authMiddleware, requireSupervisor(), materialsController.stockIn);
app.post('/api/materials/:id/stock-out', authMiddleware, requireSupervisor(), materialsController.stockOut);
app.post('/api/materials/:id/transfer', authMiddleware, requireSupervisor(), materialsController.transferStock);
app.post('/api/materials/:id/adjust', authMiddleware, requireSupervisor(), materialsController.adjustMaterialStock);
app.get('/api/orders/:orderId/material-requirements', authMiddleware, materialsController.getOrderMaterialRequirements);

// ======================== MATERIAL SUGGESTIONS ROUTES ========================
app.post('/api/materials/suggestions', authMiddleware, materialsController.getMaterialSuggestions);
app.get('/api/materials/types/search/:term', authMiddleware, materialsController.searchMaterialTypes);
app.get('/api/materials/types/:id/equivalents', authMiddleware, materialsController.getMaterialTypeEquivalents);
app.post('/api/materials/types/:id/equivalents', authMiddleware, requireSupervisor(), materialsController.addMaterialEquivalent);
app.delete('/api/materials/types/:id/equivalents/:equivalentId', authMiddleware, requireSupervisor(), materialsController.removeMaterialEquivalent);
app.post('/api/materials/suggestions/:id/accept', authMiddleware, materialsController.acceptSuggestion);
app.post('/api/materials/suggestions/:id/reject', authMiddleware, materialsController.rejectSuggestion);
app.get('/api/parts/:partId/material-suggestions', authMiddleware, materialsController.getPartSuggestions);

// ======================== SUPPLIERS ROUTES ========================
app.get('/api/suppliers', authMiddleware, materialsController.getSuppliers);
app.post('/api/suppliers', authMiddleware, requireSupervisor(), materialsController.createSupplier);
app.put('/api/suppliers/:id', authMiddleware, requireSupervisor(), materialsController.updateSupplier);
app.delete('/api/suppliers/:id', authMiddleware, requireSupervisor(), materialsController.deleteSupplier);

// ======================== STORAGE LOCATIONS ROUTES ========================
app.get('/api/storage-locations', authMiddleware, materialsController.getStorageLocations);
app.post('/api/storage-locations', authMiddleware, requireSupervisor(), materialsController.createStorageLocation);
app.put('/api/storage-locations/:id', authMiddleware, requireSupervisor(), materialsController.updateStorageLocation);
app.delete('/api/storage-locations/:id', authMiddleware, requireSupervisor(), materialsController.deleteStorageLocation);

// ======================== CUSTOMERS ROUTES ========================
app.get('/api/customers', authMiddleware, requireSupervisor(), customersController.getCustomers);
app.get('/api/customers/:id', authMiddleware, requireSupervisor(), customersController.getCustomer);
app.post('/api/customers', authMiddleware, requireSupervisor(), customersController.createCustomer);
app.put('/api/customers/:id', authMiddleware, requireSupervisor(), customersController.updateCustomer);
app.delete('/api/customers/:id', authMiddleware, requireSupervisor(), customersController.deleteCustomer);
app.post('/api/customers/import/csv', authMiddleware, requireSupervisor(), customersController.importCustomers);

// Contact Persons routes
app.get('/api/customers/:id/contacts', authMiddleware, requireSupervisor(), customersController.getCustomerContacts);
app.post('/api/customers/:id/contacts', authMiddleware, requireSupervisor(), customersController.createContact);
app.put('/api/customers/:id/contacts/:contactId', authMiddleware, requireSupervisor(), customersController.updateContact);
app.delete('/api/customers/:id/contacts/:contactId', authMiddleware, requireSupervisor(), customersController.deleteContact);

// Client Folder Management routes
app.get('/api/client-folders', authMiddleware, requireSupervisor(), customersController.listClientFolders);
app.post('/api/client-folders', authMiddleware, requireSupervisor(), customersController.createClientFolder);
app.get('/api/client-folders/suggest', authMiddleware, requireSupervisor(), customersController.suggestFolderName);

// ======================== MACHINES ROUTES ========================
app.get('/api/machines', authMiddleware, machinesController.getMachines);
app.get('/api/machines/:id', authMiddleware, machinesController.getMachine);
app.post('/api/machines', authMiddleware, requireSupervisor(), validateRequest(schemas.createMachine), machinesController.createMachine);
app.put('/api/machines/:id', authMiddleware, requireSupervisor(), validateRequest(schemas.updateMachine), machinesController.updateMachine);
app.post('/api/machines/:id/assign', authMiddleware, requireSupervisor(), validateRequest(schemas.assignMachineJob), machinesController.assignJob);

// ======================== WORKFLOW TRANSITIONS ========================
app.post('/api/parts/:partId/workflow/start', authMiddleware, requireSupervisor(), partsController.startWorkflowStage);
app.post('/api/parts/:partId/workflow/complete', authMiddleware, requireSupervisor(), partsController.completeWorkflowStage);
app.post('/api/parts/:partId/workflow/stage', authMiddleware, requireSupervisor(), partsController.setWorkflowStage);
app.post('/api/parts/:partId/hold', authMiddleware, requireSupervisor(), partsController.holdPart);
app.post('/api/parts/:partId/resume', authMiddleware, requireSupervisor(), partsController.resumePart);
app.post('/api/parts/:partId/scrap', authMiddleware, requireSupervisor(), partsController.recordScrap);

// ======================== PHASE 1B ROUTES (Batch, Revision, Time, Priority) ========================
// Batch splitting
app.post('/api/parts/:partId/split-batches', authMiddleware, requireSupervisor(), phase1bController.splitPartIntoBatches);
app.post('/api/parts/:parentPartId/merge-batches', authMiddleware, requireSupervisor(), phase1bController.mergeBatches);

// Drawing revision control
app.put('/api/parts/:partId/revision', authMiddleware, requireSupervisor(), phase1bController.updateDrawingRevision);
app.get('/api/parts/:partId/revision-history', authMiddleware, phase1bController.getRevisionHistory);

// Setup and runtime tracking
app.post('/api/parts/:partId/time-estimates', authMiddleware, requireSupervisor(), phase1bController.setTimeEstimates);
app.post('/api/parts/:partId/record-times', authMiddleware, phase1bController.recordActualTimes);
app.get('/api/parts/:partId/time-analysis', authMiddleware, phase1bController.getTimeAnalysis);

// Priority calculation
app.post('/api/parts/:partId/calculate-priority', authMiddleware, requireSupervisor(), phase1bController.calculatePriority);
app.get('/api/priority-queue', authMiddleware, phase1bController.getPriorityQueue);


// File routes
app.get('/api/parts/:partId/files', authMiddleware, filesController.getPartFiles);
app.post('/api/parts/:partId/files', authMiddleware, filesController.uploadFile);
app.get('/api/files/:fileId/download', authMiddleware, filesController.downloadFile);
app.delete('/api/files/:fileId', authMiddleware, filesController.deleteFile);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

  // Configure git safe.directory for Docker environment
  try {
    const { execSync } = require('child_process');
    execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });
    execSync('git config --global user.email "admin@cnc-shop.local" 2>/dev/null || true', { encoding: 'utf-8' });
    execSync('git config --global user.name "CNC Admin" 2>/dev/null || true', { encoding: 'utf-8' });
    console.log('✓ Git configuration ready');
  } catch (err) {
    // Ignore git config errors on non-Docker environments
  }

  // Auto sync scheduler
  const autoEnabled = (process.env.AUTO_SYNC_ENABLED ?? 'true') !== 'false';
  const intervalMs = parseInt(process.env.AUTO_SYNC_INTERVAL_MS || '60000');
  if (autoEnabled) {
    setInterval(async () => {
      try {
        await filesController.syncAllPartsFromFolders();
      } catch (err) {
        console.error('Auto-sync scheduler error:', err);
      }
    }, intervalMs);
    console.log(`✓ Auto file sync enabled every ${intervalMs} ms`);
  } else {
    console.log('⏸ Auto file sync disabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
