const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const { validateRequest, schemas } = require('./middleware/validation');

// Controllers
const authController = require('./controllers/authController');
const partsController = require('./controllers/partsController');
const feedbackController = require('./controllers/feedbackController');
const timeController = require('./controllers/timeController');
const filesController = require('./controllers/filesController');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Parts routes
app.get('/api/parts', authMiddleware, partsController.getAllParts);
app.get('/api/parts/statistics', authMiddleware, partsController.getStatistics);
app.get('/api/parts/:id', authMiddleware, partsController.getPart);
app.post('/api/parts', authMiddleware, validateRequest(schemas.createPart), partsController.createPart);
app.put('/api/parts/:id', authMiddleware, validateRequest(schemas.updatePart), partsController.updatePart);
app.delete('/api/parts/:id', authMiddleware, partsController.deletePart);
app.post('/api/parts/:id/complete', authMiddleware, validateRequest(schemas.completeTime), partsController.completePart);

// Feedback routes
app.get('/api/parts/:partId/feedback', authMiddleware, feedbackController.getPartFeedback);
app.post('/api/parts/:partId/feedback', authMiddleware, validateRequest(schemas.feedback), feedbackController.addFeedback);

// Time tracking routes
app.get('/api/time/active', authMiddleware, timeController.getActiveTimer);
app.post('/api/parts/:partId/timer/start', authMiddleware, timeController.startTimer);
app.post('/api/parts/:partId/timer/stop', authMiddleware, timeController.stopTimer);
app.get('/api/parts/:partId/timelogs', authMiddleware, timeController.getPartTimeLogs);

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
