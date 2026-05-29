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
// Storage hierarchy
router.get('/locations',          authMiddleware, tc.getLocations);
router.post('/locations',         authMiddleware, tc.createLocation);
router.put('/locations/:id',      authMiddleware, tc.updateLocation);
router.delete('/locations/:id',   authMiddleware, tc.deleteLocation);
router.get('/cabinets',           authMiddleware, tc.getCabinets);
router.post('/cabinets',          authMiddleware, tc.createCabinet);
router.put('/cabinets/:id',       authMiddleware, tc.updateCabinet);
router.delete('/cabinets/:id',    authMiddleware, tc.deleteCabinet);
router.get('/shelves',            authMiddleware, tc.getShelves);
router.post('/shelves',           authMiddleware, tc.createShelf);
router.put('/shelves/:id',        authMiddleware, tc.updateShelf);
router.delete('/shelves/:id',     authMiddleware, tc.deleteShelf);
router.get('/boxes',              authMiddleware, tc.getBoxes);
router.post('/boxes',             authMiddleware, tc.createBox);
router.put('/boxes/:id',          authMiddleware, tc.updateBox);
router.delete('/boxes/:id',       authMiddleware, tc.deleteBox);
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
