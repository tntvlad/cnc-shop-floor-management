const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const MaterialStock = require('../models/MaterialStock');

// Get all material stock with optional filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const filters = {
            material_type_id: req.query.material_type_id,
            shape_type: req.query.shape_type,
            size_category: req.query.size_category,
            status: req.query.status,
            quality_status: req.query.quality_status,
            min_available: req.query.min_available ? parseFloat(req.query.min_available) : null,
            limit: req.query.limit ? parseInt(req.query.limit) : null
        };

        // Remove undefined filters
        Object.keys(filters).forEach(key => filters[key] === null && delete filters[key]);

        const stock = await MaterialStock.getAll(filters);
        res.json({ success: true, stock });
    } catch (error) {
        console.error('Error fetching material stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get stock by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const stock = await MaterialStock.getById(req.params.id);
        if (!stock) {
            return res.status(404).json({ success: false, error: 'Stock not found' });
        }
        res.json({ success: true, stock });
    } catch (error) {
        console.error('Error fetching stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Find available stock by criteria
router.post('/find-available', authenticateToken, async (req, res) => {
    try {
        const { material_type_ids, shape_type, dimensions, required_qty } = req.body;
        const stock = await MaterialStock.findAvailable(
            material_type_ids,
            shape_type,
            dimensions || {},
            required_qty || 1
        );
        res.json({ success: true, stock });
    } catch (error) {
        console.error('Error finding available stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create material stock
router.post('/', authenticateToken, async (req, res) => {
    try {
        const stock = await MaterialStock.create(req.body);
        res.status(201).json({ success: true, stock, message: 'Stock created successfully' });
    } catch (error) {
        console.error('Error creating stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update material stock
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const stock = await MaterialStock.update(req.params.id, req.body);
        if (!stock) {
            return res.status(404).json({ success: false, error: 'Stock not found' });
        }
        res.json({ success: true, stock, message: 'Stock updated successfully' });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reserve material
router.post('/:id/reserve', authenticateToken, async (req, res) => {
    try {
        const { quantity, part_id } = req.body;
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, error: 'Valid quantity required' });
        }

        const stock = await MaterialStock.reserve(req.params.id, quantity, part_id);
        if (!stock) {
            return res.status(400).json({ success: false, error: 'Insufficient stock available' });
        }
        res.json({ success: true, stock, message: 'Stock reserved successfully' });
    } catch (error) {
        console.error('Error reserving stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Release reserved material
router.post('/:id/release', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, error: 'Valid quantity required' });
        }

        const stock = await MaterialStock.releaseReserve(req.params.id, quantity);
        if (!stock) {
            return res.status(404).json({ success: false, error: 'Stock not found' });
        }
        res.json({ success: true, stock, message: 'Reservation released successfully' });
    } catch (error) {
        console.error('Error releasing reservation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Consume from stock
router.post('/:id/consume', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, error: 'Valid quantity required' });
        }

        const stock = await MaterialStock.consume(req.params.id, quantity);
        if (!stock) {
            return res.status(400).json({ success: false, error: 'Insufficient stock' });
        }
        res.json({ success: true, stock, message: 'Stock consumed successfully' });
    } catch (error) {
        console.error('Error consuming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add stock
router.post('/:id/add', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, error: 'Valid quantity required' });
        }

        const stock = await MaterialStock.addStock(req.params.id, quantity);
        if (!stock) {
            return res.status(404).json({ success: false, error: 'Stock not found' });
        }
        res.json({ success: true, stock, message: 'Stock added successfully' });
    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete stock
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const stock = await MaterialStock.delete(req.params.id);
        if (!stock) {
            return res.status(404).json({ success: false, error: 'Stock not found' });
        }
        res.json({ success: true, message: 'Stock deleted successfully' });
    } catch (error) {
        console.error('Error deleting stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
