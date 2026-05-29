const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const tc = require('../controllers/toolsController');

// Stats & lookup (no :id collision risk — must be before /:id)
router.get('/stats',              authMiddleware, tc.getStats);
router.get('/low-stock',          authMiddleware, tc.getLowStock);
router.get('/checkouts',          authMiddleware, tc.getCheckouts);
router.get('/categories',         authMiddleware, tc.getCategories);
router.get('/brands',             authMiddleware, tc.getBrands);
router.post('/brands',            authMiddleware, tc.createBrand);
router.put('/brands/:id',         authMiddleware, tc.updateBrand);
router.get('/cabinets',           authMiddleware, tc.getCabinets);
router.post('/cabinets',          authMiddleware, tc.createCabinet);
router.get('/application-types',        authMiddleware, tc.getAppTypes);
router.post('/application-types',       authMiddleware, tc.createAppType);
router.put('/application-types/:id',    authMiddleware, tc.updateAppType);
router.delete('/application-types/:id', authMiddleware, tc.deleteAppType);

// Main tool CRUD
router.get('/',    authMiddleware, tc.getTools);
router.post('/',   authMiddleware, tc.createTool);
router.get('/:id', authMiddleware, tc.getToolById);
router.put('/:id', authMiddleware, tc.updateTool);
router.delete('/:id', authMiddleware, tc.retireTool);

// Per-tool sub-resources
router.get('/:id/prices',       authMiddleware, tc.getPriceHistory);
router.post('/:id/prices',      authMiddleware, tc.addPriceRecord);
router.get('/:id/transactions', authMiddleware, tc.getTransactions);
router.post('/:id/stock-in',    authMiddleware, tc.stockIn);
router.post('/:id/stock-out',   authMiddleware, tc.stockOut);

module.exports = router;
