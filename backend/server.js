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
app.post('/api/admin/git-pull', authMiddleware, adminController.gitPull);
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
app.post('/api/orders', authMiddleware, requireSupervisor, ordersController.createOrder);
app.get('/api/orders', authMiddleware, ordersController.getOrders);
app.get('/api/orders/:id', authMiddleware, ordersController.getOrderById);
app.put('/api/orders/:id', authMiddleware, requireSupervisor, ordersController.updateOrder);
app.put('/api/orders/:id/status', authMiddleware, requireSupervisor, ordersController.updateOrderStatus);
app.delete('/api/orders/:id', authMiddleware, requireSupervisor, ordersController.deleteOrder);
app.get('/api/orders/stats/summary', authMiddleware, ordersController.getOrderStats);

// ======================== MATERIALS ROUTES ========================
app.get('/api/materials', authMiddleware, materialsController.getMaterials);
app.get('/api/materials/:id', authMiddleware, materialsController.getMaterialById);
app.post('/api/materials', authMiddleware, requireSupervisor, materialsController.createMaterial);
app.put('/api/materials/:id', authMiddleware, requireSupervisor, materialsController.updateMaterialStock);
app.post('/api/materials/:id/adjust', authMiddleware, requireSupervisor, materialsController.adjustMaterialStock);
app.get('/api/materials/alerts/low-stock', authMiddleware, materialsController.getLowStockAlerts);
app.get('/api/orders/:orderId/material-requirements', authMiddleware, materialsController.getOrderMaterialRequirements);
app.get('/api/materials/reports/usage', authMiddleware, materialsController.getMaterialUsageReport);

// ======================== WORKFLOW TRANSITIONS ========================
app.post('/api/parts/:partId/workflow/start', authMiddleware, requireSupervisor, partsController.startWorkflowStage);
app.post('/api/parts/:partId/workflow/complete', authMiddleware, requireSupervisor, partsController.completeWorkflowStage);
app.post('/api/parts/:partId/hold', authMiddleware, requireSupervisor, partsController.holdPart);
app.post('/api/parts/:partId/resume', authMiddleware, requireSupervisor, partsController.resumePart);
app.post('/api/parts/:partId/scrap', authMiddleware, requireSupervisor, partsController.recordScrap);

// ======================== PHASE 1B ROUTES (Batch, Revision, Time, Priority) ========================
// Batch splitting
app.post('/api/parts/:partId/split-batches', authMiddleware, requireSupervisor, phase1bController.splitPartIntoBatches);
app.post('/api/parts/:parentPartId/merge-batches', authMiddleware, requireSupervisor, phase1bController.mergeBatches);

// Drawing revision control
app.put('/api/parts/:partId/revision', authMiddleware, requireSupervisor, phase1bController.updateDrawingRevision);
app.get('/api/parts/:partId/revision-history', authMiddleware, phase1bController.getRevisionHistory);

// Setup and runtime tracking
app.post('/api/parts/:partId/time-estimates', authMiddleware, requireSupervisor, phase1bController.setTimeEstimates);
app.post('/api/parts/:partId/record-times', authMiddleware, phase1bController.recordActualTimes);
app.get('/api/parts/:partId/time-analysis', authMiddleware, phase1bController.getTimeAnalysis);

// Priority calculation
app.post('/api/parts/:partId/calculate-priority', authMiddleware, requireSupervisor, phase1bController.calculatePriority);
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
