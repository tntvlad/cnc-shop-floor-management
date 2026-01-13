const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const MaterialType = require('../models/MaterialType');

// Get all material types
router.get('/', authenticateToken, async (req, res) => {
    try {
        const types = await MaterialType.getAll();
        res.json({ success: true, types });
    } catch (error) {
        console.error('Error fetching material types:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search material types by name or spec code
router.get('/search/:term', authenticateToken, async (req, res) => {
    try {
        const types = await MaterialType.findByNameOrSpec(req.params.term);
        res.json({ success: true, types });
    } catch (error) {
        console.error('Error searching material types:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get material type by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const type = await MaterialType.getById(req.params.id);
        if (!type) {
            return res.status(404).json({ success: false, error: 'Material type not found' });
        }
        res.json({ success: true, type });
    } catch (error) {
        console.error('Error fetching material type:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get equivalent materials for a type
router.get('/:id/equivalents', authenticateToken, async (req, res) => {
    try {
        const equivalents = await MaterialType.getEquivalents(req.params.id);
        res.json({ success: true, equivalents });
    } catch (error) {
        console.error('Error fetching equivalents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all equivalent IDs (including self) for suggestions
router.get('/:id/equivalent-ids', authenticateToken, async (req, res) => {
    try {
        const ids = await MaterialType.getAllEquivalentIds(req.params.id);
        res.json({ success: true, ids });
    } catch (error) {
        console.error('Error fetching equivalent IDs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create material type
router.post('/', authenticateToken, async (req, res) => {
    try {
        const type = await MaterialType.create(req.body);
        res.status(201).json({ success: true, type, message: 'Material type created successfully' });
    } catch (error) {
        console.error('Error creating material type:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update material type
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const type = await MaterialType.update(req.params.id, req.body);
        if (!type) {
            return res.status(404).json({ success: false, error: 'Material type not found' });
        }
        res.json({ success: true, type, message: 'Material type updated successfully' });
    } catch (error) {
        console.error('Error updating material type:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add equivalence relationship
router.post('/:id/equivalents', authenticateToken, async (req, res) => {
    try {
        const { equivalent_id, rank, notes } = req.body;
        if (!equivalent_id) {
            return res.status(400).json({ success: false, error: 'equivalent_id is required' });
        }
        const equiv = await MaterialType.addEquivalent(req.params.id, equivalent_id, rank, notes);
        res.status(201).json({ success: true, equivalent: equiv, message: 'Equivalence added' });
    } catch (error) {
        console.error('Error adding equivalence:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove equivalence relationship
router.delete('/:id/equivalents/:equivalentId', authenticateToken, async (req, res) => {
    try {
        const removed = await MaterialType.removeEquivalent(req.params.id, req.params.equivalentId);
        if (!removed) {
            return res.status(404).json({ success: false, error: 'Equivalence not found' });
        }
        res.json({ success: true, message: 'Equivalence removed' });
    } catch (error) {
        console.error('Error removing equivalence:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete material type (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const type = await MaterialType.delete(req.params.id);
        if (!type) {
            return res.status(404).json({ success: false, error: 'Material type not found' });
        }
        res.json({ success: true, message: 'Material type deleted' });
    } catch (error) {
        console.error('Error deleting material type:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
