const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const MaterialSuggestions = require('../models/MaterialSuggestions');

// Get material suggestions based on requirements
router.post('/suggest', authenticateToken, async (req, res) => {
    try {
        const { material_type, dimensions, quantity, max_suggestions } = req.body;

        console.log('[Smart Search] Request:', JSON.stringify({ material_type, dimensions, quantity }));

        if (!material_type) {
            return res.status(400).json({ success: false, error: 'material_type is required' });
        }

        const suggestions = await MaterialSuggestions.getSuggestions(
            material_type,
            dimensions || {},
            quantity || 1,
            max_suggestions || 5
        );

        console.log('[Smart Search] Result: candidates=', suggestions.total_candidates || 0, ', suggestions=', suggestions.suggestions?.length || 0);

        res.json({ success: true, ...suggestions });
    } catch (error) {
        console.error('Error getting suggestions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get suggestions for a specific part
router.get('/part/:partId', authenticateToken, async (req, res) => {
    try {
        const suggestions = await MaterialSuggestions.getByPartId(req.params.partId);
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Error fetching part suggestions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save a suggestion
router.post('/', authenticateToken, async (req, res) => {
    try {
        const suggestion = await MaterialSuggestions.saveSuggestion(req.body);
        res.status(201).json({ success: true, suggestion });
    } catch (error) {
        console.error('Error saving suggestion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Accept a suggestion
router.post('/:id/accept', authenticateToken, async (req, res) => {
    try {
        const suggestion = await MaterialSuggestions.acceptSuggestion(req.params.id, req.user.id);
        if (!suggestion) {
            return res.status(404).json({ success: false, error: 'Suggestion not found' });
        }
        res.json({ success: true, suggestion, message: 'Suggestion accepted' });
    } catch (error) {
        console.error('Error accepting suggestion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject a suggestion
router.post('/:id/reject', authenticateToken, async (req, res) => {
    try {
        const suggestion = await MaterialSuggestions.rejectSuggestion(req.params.id, req.user.id);
        if (!suggestion) {
            return res.status(404).json({ success: false, error: 'Suggestion not found' });
        }
        res.json({ success: true, suggestion, message: 'Suggestion rejected' });
    } catch (error) {
        console.error('Error rejecting suggestion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
