const pool = require('../config/database');

// Get all materials in stock
async function getMaterials(req, res) {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT 
        id,
        material_name,
        material_type,
        supplier_id,
        current_stock,
        reorder_level,
        unit,
        cost_per_unit,
        notes,
        created_at
      FROM material_stock
      ORDER BY material_name
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      success: true,
      materials: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get material by ID
async function getMaterialById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        id,
        material_name,
        material_type,
        supplier_id,
        current_stock,
        reorder_level,
        unit,
        cost_per_unit,
        notes,
        created_at,
        updated_at
      FROM material_stock
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const material = result.rows[0];

    // Get recent transactions
    const transactions = await pool.query(
      `SELECT 
        id,
        material_id,
        order_id,
        quantity,
        transaction_type,
        notes,
        created_at
      FROM material_orders
      WHERE material_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
      [id]
    );

    material.transactions = transactions.rows;

    res.status(200).json({
      success: true,
      material
    });
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Create new material
async function createMaterial(req, res) {
  try {
    const { material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO material_stock (material_name, material_type, supplier_id, current_stock, reorder_level, unit, cost_per_unit, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, material_name, material_type, current_stock, reorder_level, unit, cost_per_unit, created_at`,
      [material_name, material_type, supplier_id, current_stock || 0, reorder_level || 0, unit, cost_per_unit || 0, notes]
    );

    res.status(201).json({
      success: true,
      message: 'Material created successfully',
      material: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating material:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Update material stock
async function updateMaterialStock(req, res) {
  try {
    const { id } = req.params;
    const { current_stock, reorder_level, cost_per_unit } = req.body;

    const result = await pool.query(
      `UPDATE material_stock 
       SET current_stock = COALESCE($1, current_stock),
           reorder_level = COALESCE($2, reorder_level),
           cost_per_unit = COALESCE($3, cost_per_unit),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, current_stock, reorder_level, cost_per_unit, updated_at`,
      [current_stock, reorder_level, cost_per_unit, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Material stock updated',
      material: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating material:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Adjust material stock (add/remove quantity with transaction)
async function adjustMaterialStock(req, res) {
  try {
    const { id } = req.params;
    const { quantity, transaction_type, notes } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current stock
      const currentResult = await client.query(
        'SELECT current_stock FROM material_stock WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Material not found');
      }

      const currentStock = currentResult.rows[0].current_stock;
      let newStock = currentStock;

      if (transaction_type === 'add') {
        newStock = currentStock + quantity;
      } else if (transaction_type === 'remove' || transaction_type === 'use') {
        newStock = currentStock - quantity;
      }

      if (newStock < 0) {
        throw new Error('Insufficient stock');
      }

      // Update stock
      await client.query(
        'UPDATE material_stock SET current_stock = $1, updated_at = NOW() WHERE id = $2',
        [newStock, id]
      );

      // Record transaction
      const transactionResult = await client.query(
        `INSERT INTO material_orders (material_id, quantity, transaction_type, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING id, material_id, quantity, transaction_type, created_at`,
        [id, quantity, transaction_type, notes]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Stock ${transaction_type === 'add' ? 'added' : 'removed'}`,
        newStock,
        transaction: transactionResult.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: err.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get low stock alerts
async function getLowStockAlerts(req, res) {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        material_name,
        material_type,
        current_stock,
        reorder_level,
        unit,
        cost_per_unit,
        CASE 
          WHEN current_stock <= 0 THEN 'out-of-stock'
          WHEN current_stock <= reorder_level THEN 'low-stock'
          ELSE 'ok'
        END as alert_level
      FROM material_stock
      WHERE current_stock <= reorder_level
      ORDER BY alert_level DESC, current_stock ASC`
    );

    res.status(200).json({
      success: true,
      alerts: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Calculate material requirements for an order
async function getOrderMaterialRequirements(req, res) {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT 
        m.id,
        m.material_name,
        m.material_type,
        m.current_stock,
        m.reorder_level,
        m.unit,
        m.cost_per_unit,
        COUNT(p.id) as parts_using,
        SUM(p.quantity) as total_quantity_needed,
        CASE 
          WHEN m.current_stock < SUM(p.quantity) THEN 'need-to-order'
          ELSE 'in-stock'
        END as fulfillment_status
      FROM material_stock m
      JOIN parts p ON m.id = p.material_id
      WHERE p.order_id = $1
      GROUP BY m.id, m.material_name, m.material_type, m.current_stock, m.reorder_level, m.unit, m.cost_per_unit`,
      [orderId]
    );

    res.status(200).json({
      success: true,
      requirements: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get material usage report
async function getMaterialUsageReport(req, res) {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        m.material_name,
        m.material_type,
        m.unit,
        m.cost_per_unit,
        SUM(CASE WHEN mo.transaction_type = 'use' THEN mo.quantity ELSE 0 END) as quantity_used,
        SUM(CASE WHEN mo.transaction_type = 'add' THEN mo.quantity ELSE 0 END) as quantity_added,
        SUM(CASE WHEN mo.transaction_type = 'use' THEN mo.quantity ELSE 0 END) * m.cost_per_unit as cost_used
      FROM material_stock m
      LEFT JOIN material_orders mo ON m.id = mo.material_id
      WHERE mo.created_at >= NOW() - INTERVAL '${days} days'
         OR mo.created_at IS NULL
      GROUP BY m.id, m.material_name, m.material_type, m.unit, m.cost_per_unit
      ORDER BY cost_used DESC NULLS LAST`,
      []
    );

    res.status(200).json({
      success: true,
      report: result.rows,
      period_days: days
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterialStock,
  adjustMaterialStock,
  getLowStockAlerts,
  getOrderMaterialRequirements,
  getMaterialUsageReport
};
