const Tool = require('../models/Tool');

// GET /api/tools — list with filters
const getTools = async (req, res) => {
    try {
        const filters = {
            status: req.query.status || null,
            category_id: req.query.category_id ? parseInt(req.query.category_id) : null,
            brand_id: req.query.brand_id ? parseInt(req.query.brand_id) : null,
            cabinet_id: req.query.cabinet_id ? parseInt(req.query.cabinet_id) : null,
            search: req.query.search || null,
            low_stock_only: req.query.low_stock_only === 'true',
            limit: req.query.limit ? parseInt(req.query.limit) : 100,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };
        Object.keys(filters).forEach(k => filters[k] === null && delete filters[k]);

        const { tools, total } = await Tool.getAll(filters);
        res.json({ success: true, tools, total });
    } catch (error) {
        console.error('getTools error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/stats
const getStats = async (req, res) => {
    try {
        const stats = await Tool.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('getStats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/low-stock
const getLowStock = async (req, res) => {
    try {
        const tools = await Tool.getLowStock();
        res.json({ success: true, tools });
    } catch (error) {
        console.error('getLowStock error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/categories
const getCategories = async (req, res) => {
    try {
        const categories = await Tool.getCategories();
        res.json({ success: true, categories });
    } catch (error) {
        console.error('getCategories error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/brands
const getBrands = async (req, res) => {
    try {
        const brands = await Tool.getBrands();
        res.json({ success: true, brands });
    } catch (error) {
        console.error('getBrands error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/tools/brands
const createBrand = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        if (!req.body.name) {
            return res.status(400).json({ success: false, error: 'Brand name is required' });
        }
        const brand = await Tool.createBrand(req.body);
        res.status(201).json({ success: true, brand });
    } catch (error) {
        console.error('createBrand error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// PUT /api/tools/brands/:id
const updateBrand = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        const brand = await Tool.updateBrand(req.params.id, req.body);
        if (!brand) return res.status(404).json({ success: false, error: 'Brand not found' });
        res.json({ success: true, brand });
    } catch (error) {
        console.error('updateBrand error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/cabinets
const getCabinets = async (req, res) => {
    try {
        const cabinets = await Tool.getCabinets();
        res.json({ success: true, cabinets });
    } catch (error) {
        console.error('getCabinets error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/tools/cabinets
const createCabinet = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        const { code, name } = req.body;
        if (!code || !name) {
            return res.status(400).json({ success: false, error: 'Code and name are required' });
        }
        const cabinet = await Tool.createCabinet(req.body);
        res.status(201).json({ success: true, cabinet });
    } catch (error) {
        console.error('createCabinet error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/:id
const getToolById = async (req, res) => {
    try {
        const tool = await Tool.getById(req.params.id);
        if (!tool) return res.status(404).json({ success: false, error: 'Tool not found' });
        res.json({ success: true, tool });
    } catch (error) {
        console.error('getToolById error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/tools
const createTool = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        if (!req.body.tool_number || !req.body.tool_type) {
            return res.status(400).json({ success: false, error: 'tool_number and tool_type are required' });
        }
        const tool = await Tool.create(req.body);
        res.status(201).json({ success: true, tool });
    } catch (error) {
        console.error('createTool error:', error);
        if (error.message.includes('unique') || error.code === '23505') {
            return res.status(409).json({ success: false, error: 'Tool number already exists' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

// PUT /api/tools/:id
const updateTool = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        const tool = await Tool.update(req.params.id, req.body);
        if (!tool) return res.status(404).json({ success: false, error: 'Tool not found' });
        res.json({ success: true, tool });
    } catch (error) {
        console.error('updateTool error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// DELETE /api/tools/:id — soft retire
const retireTool = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        const tool = await Tool.retire(req.params.id, req.user.id);
        if (!tool) return res.status(404).json({ success: false, error: 'Tool not found' });
        res.json({ success: true, tool, message: 'Tool retired from service' });
    } catch (error) {
        console.error('retireTool error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/:id/prices
const getPriceHistory = async (req, res) => {
    try {
        const history = await Tool.getPriceHistory(req.params.id);
        res.json({ success: true, history });
    } catch (error) {
        console.error('getPriceHistory error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/tools/:id/prices
const addPriceRecord = async (req, res) => {
    try {
        if (req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Supervisor level required' });
        }
        if (!req.body.price || isNaN(parseFloat(req.body.price))) {
            return res.status(400).json({ success: false, error: 'Valid price is required' });
        }
        const record = await Tool.addPriceRecord(req.params.id, {
            ...req.body,
            recorded_by: req.user.id
        });
        res.status(201).json({ success: true, record });
    } catch (error) {
        console.error('addPriceRecord error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/:id/transactions
const getTransactions = async (req, res) => {
    try {
        const transactions = await Tool.getTransactions(req.params.id);
        res.json({ success: true, transactions });
    } catch (error) {
        console.error('getTransactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/tools/:id/stock-in
const stockIn = async (req, res) => {
    try {
        if (req.user.level < 200) {
            return res.status(403).json({ success: false, error: 'Operator level required' });
        }
        const qty = parseInt(req.body.quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ success: false, error: 'Valid quantity required' });
        }
        const newQty = await Tool.stockIn(req.params.id, qty, req.user.id, req.body.notes);
        res.json({ success: true, quantity_available: newQty, message: `${qty} tools added to stock` });
    } catch (error) {
        console.error('stockIn error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/tools/:id/stock-out
const stockOut = async (req, res) => {
    try {
        if (req.user.level < 200) {
            return res.status(403).json({ success: false, error: 'Operator level required' });
        }
        const qty = parseInt(req.body.quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ success: false, error: 'Valid quantity required' });
        }
        const data = { ...req.body };
        if (data.given_to) data.given_to = parseInt(data.given_to);
        const newQty = await Tool.stockOut(req.params.id, qty, req.user.id, data);
        res.json({ success: true, quantity_available: newQty, message: `${qty} tools removed from stock` });
    } catch (error) {
        if (error.message.includes('Insufficient stock')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        console.error('stockOut error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/tools/checkouts
const getCheckouts = async (req, res) => {
    try {
        const limit  = req.query.limit  ? parseInt(req.query.limit)  : 200;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const checkouts = await Tool.getCheckouts(limit, offset);
        res.json({ success: true, checkouts });
    } catch (error) {
        console.error('getCheckouts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getTools, getStats, getLowStock,
    getCategories, getBrands, createBrand, updateBrand,
    getCabinets, createCabinet,
    getToolById, createTool, updateTool, retireTool,
    getPriceHistory, addPriceRecord,
    getTransactions, stockIn, stockOut, getCheckouts
};
