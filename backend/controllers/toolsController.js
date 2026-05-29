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

// PUT /api/tools/cabinets/:id
const updateCabinet = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const cabinet = await Tool.updateCabinet(req.params.id, req.body);
        res.json({ success: true, cabinet });
    } catch (error) {
        console.error('updateCabinet error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// DELETE /api/tools/cabinets/:id
const deleteCabinet = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        await Tool.deleteCabinet(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('deleteCabinet error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ── Locations ────────────────────────────────────────────────────

const getLocations = async (req, res) => {
    try {
        const locations = await Tool.getLocations();
        res.json({ success: true, locations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createLocation = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const { code, name } = req.body;
        if (!code || !name) return res.status(400).json({ success: false, error: 'Code and name are required' });
        const location = await Tool.createLocation(req.body);
        res.status(201).json({ success: true, location });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateLocation = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const location = await Tool.updateLocation(req.params.id, req.body);
        res.json({ success: true, location });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteLocation = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        await Tool.deleteLocation(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ── Shelves ──────────────────────────────────────────────────────

const getShelves = async (req, res) => {
    try {
        const shelves = await Tool.getShelves(req.query.cabinet_id ? parseInt(req.query.cabinet_id) : null);
        res.json({ success: true, shelves });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createShelf = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const { cabinet_id, code } = req.body;
        if (!cabinet_id || !code) return res.status(400).json({ success: false, error: 'cabinet_id and code are required' });
        const shelf = await Tool.createShelf(req.body);
        res.status(201).json({ success: true, shelf });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateShelf = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const shelf = await Tool.updateShelf(req.params.id, req.body);
        res.json({ success: true, shelf });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteShelf = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        await Tool.deleteShelf(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ── Boxes ────────────────────────────────────────────────────────

const getBoxes = async (req, res) => {
    try {
        const boxes = await Tool.getBoxes(req.query.shelf_id ? parseInt(req.query.shelf_id) : null);
        res.json({ success: true, boxes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createBox = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const { shelf_id, code } = req.body;
        if (!shelf_id || !code) return res.status(400).json({ success: false, error: 'shelf_id and code are required' });
        const box = await Tool.createBox(req.body);
        res.status(201).json({ success: true, box });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateBox = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        const box = await Tool.updateBox(req.params.id, req.body);
        res.json({ success: true, box });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteBox = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor level required' });
        await Tool.deleteBox(req.params.id);
        res.json({ success: true });
    } catch (error) {
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

// ── Application Types CRUD ────────────────────────────────────
const db = require('../config/database');

const getAppTypes = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT at.*, (SELECT COUNT(*) FROM tools t WHERE t.application_type_id = at.id) AS tool_count FROM tool_application_types at ORDER BY at.name'
        );
        res.json({ success: true, appTypes: result.rows });
    } catch (error) {
        console.error('getAppTypes error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createAppType = async (req, res) => {
    try {
        const { name, color, description } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
        const result = await db.query(
            'INSERT INTO tool_application_types (name, color, description) VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), color || '#6b7280', description || null]
        );
        res.json({ success: true, appType: result.rows[0] });
    } catch (error) {
        console.error('createAppType error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateAppType = async (req, res) => {
    try {
        const { name, color, description } = req.body;
        const result = await db.query(
            'UPDATE tool_application_types SET name=$1, color=$2, description=$3 WHERE id=$4 RETURNING *',
            [name, color || '#6b7280', description || null, req.params.id]
        );
        if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, appType: result.rows[0] });
    } catch (error) {
        console.error('updateAppType error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteAppType = async (req, res) => {
    try {
        // Unlink tools first (set to NULL)
        await db.query('UPDATE tools SET application_type_id = NULL WHERE application_type_id = $1', [req.params.id]);
        await db.query('DELETE FROM tool_application_types WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('deleteAppType error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getTools, getStats, getLowStock,
    getCategories, getBrands, createBrand, updateBrand,
    getCabinets, createCabinet, updateCabinet, deleteCabinet,
    getLocations, createLocation, updateLocation, deleteLocation,
    getShelves, createShelf, updateShelf, deleteShelf,
    getBoxes, createBox, updateBox, deleteBox,
    getToolById, createTool, updateTool, retireTool,
    getPriceHistory, addPriceRecord,
    getTransactions, stockIn, stockOut, getCheckouts,
    getAppTypes, createAppType, updateAppType, deleteAppType
};
