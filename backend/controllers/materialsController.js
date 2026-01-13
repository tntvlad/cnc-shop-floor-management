const pool = require('../config/database');

// ============================================================================
// MATERIALS CRUD
// ============================================================================

// Get all materials in stock with full details
async function getMaterials(req, res) {
  try {
    const { limit = 100, offset = 0, search, material_type, location_id, status } = req.query;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(ms.material_name ILIKE $${paramIndex} OR ms.material_type ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (material_type) {
      whereConditions.push(`ms.material_type = $${paramIndex}`);
      params.push(material_type);
      paramIndex++;
    }
    if (location_id) {
      whereConditions.push(`ms.location_id = $${paramIndex}`);
      params.push(location_id);
      paramIndex++;
    }
    if (status) {
      whereConditions.push(`ms.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT 
        ms.id,
        ms.material_name,
        ms.material_type,
        ms.shape_type,
        ms.diameter,
        ms.width,
        ms.height,
        ms.thickness,
        ms.length,
        ms.current_stock,
        ms.reserved_stock,
        ms.reorder_level,
        ms.unit,
        ms.cost_per_unit,
        ms.unit_weight,
        ms.total_value,
        ms.status,
        ms.notes,
        ms.created_at,
        ms.updated_at,
        ms.supplier_id,
        s.name as supplier_name,
        ms.location_id,
        sl.code as location_code,
        sl.zone as location_zone
      FROM material_stock ms
      LEFT JOIN suppliers s ON ms.supplier_id = s.id
      LEFT JOIN storage_locations sl ON ms.location_id = sl.id
      ${whereClause}
      ORDER BY ms.material_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM material_stock ms ${whereClause}`,
      params
    );

    res.status(200).json({
      success: true,
      materials: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get materials dashboard stats
async function getMaterialsStats(req, res) {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(DISTINCT material_type) as material_types,
        COALESCE(SUM(total_value), 0) as total_value,
        COUNT(CASE WHEN current_stock <= reorder_level THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_count
      FROM material_stock
    `);

    const supplierCount = await pool.query(`
      SELECT COUNT(*) FROM suppliers WHERE is_active = true
    `);

    const locationCount = await pool.query(`
      SELECT COUNT(*) FROM storage_locations WHERE is_active = true
    `);

    res.status(200).json({
      success: true,
      stats: {
        ...stats.rows[0],
        active_suppliers: parseInt(supplierCount.rows[0].count),
        storage_locations: parseInt(locationCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get material by ID with transactions
async function getMaterialById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        ms.*,
        s.name as supplier_name,
        s.contact_person as supplier_contact,
        s.phone as supplier_phone,
        sl.code as location_code,
        sl.zone as location_zone,
        sl.shelf as location_shelf
      FROM material_stock ms
      LEFT JOIN suppliers s ON ms.supplier_id = s.id
      LEFT JOIN storage_locations sl ON ms.location_id = sl.id
      WHERE ms.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const material = result.rows[0];

    // Get recent transactions
    const transactions = await pool.query(
      `SELECT 
        mt.id,
        mt.transaction_type,
        mt.quantity,
        mt.reference_number,
        mt.notes,
        mt.created_at,
        u.full_name as performed_by_name,
        sl_from.code as from_location,
        sl_to.code as to_location
      FROM material_transactions mt
      LEFT JOIN users u ON mt.performed_by = u.id
      LEFT JOIN storage_locations sl_from ON mt.from_location_id = sl_from.id
      LEFT JOIN storage_locations sl_to ON mt.to_location_id = sl_to.id
      WHERE mt.material_id = $1
      ORDER BY mt.created_at DESC
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

// Create new material with all fields
async function createMaterial(req, res) {
  try {
    const { 
      material_name, 
      material_type, 
      shape_type,
      diameter,
      width,
      height,
      thickness,
      length,
      supplier_id, 
      location_id,
      current_stock, 
      reorder_level, 
      unit, 
      cost_per_unit, 
      unit_weight,
      notes 
    } = req.body;

    // Calculate total value
    const totalValue = (cost_per_unit || 0) * (current_stock || 0);

    const result = await pool.query(
      `INSERT INTO material_stock (
        material_name, material_type, shape_type, diameter, width, height, thickness, length,
        supplier_id, location_id, current_stock, reorder_level, unit, cost_per_unit, 
        unit_weight, total_value, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'available')
      RETURNING *`,
      [
        material_name, material_type, shape_type, diameter, width, height, thickness, length,
        supplier_id, location_id, current_stock || 0, reorder_level || 0, unit || 'pieces', 
        cost_per_unit || 0, unit_weight, totalValue, notes
      ]
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

// Update material
async function updateMaterial(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'material_name', 'material_type', 'shape_type', 'diameter', 'width', 'height',
      'thickness', 'length', 'supplier_id', 'location_id', 'current_stock', 
      'reserved_stock', 'reorder_level', 'unit', 'cost_per_unit', 'unit_weight', 'status', 'notes'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE material_stock SET ${setClauses.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Material updated',
      material: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating material:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Delete material
async function deleteMaterial(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM material_stock WHERE id = $1 RETURNING id, material_name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Material deleted',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================================================
// STOCK TRANSACTIONS
// ============================================================================

// Stock In
async function stockIn(req, res) {
  try {
    const { id } = req.params;
    const { quantity, reference_number, notes } = req.body;
    const userId = req.user?.id;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update stock
      const updateResult = await client.query(
        `UPDATE material_stock 
         SET current_stock = current_stock + $1, updated_at = NOW()
         WHERE id = $2 
         RETURNING id, material_name, current_stock`,
        [quantity, id]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Material not found');
      }

      // Record transaction
      await client.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, quantity, reference_number, notes, performed_by)
         VALUES ($1, 'stock_in', $2, $3, $4, $5)`,
        [id, quantity, reference_number, notes, userId]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Added ${quantity} to stock`,
        material: updateResult.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in stock in:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Stock Out
async function stockOut(req, res) {
  try {
    const { id } = req.params;
    const { quantity, order_id, part_id, reference_number, notes } = req.body;
    const userId = req.user?.id;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current stock
      const checkResult = await client.query(
        'SELECT current_stock FROM material_stock WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Material not found');
      }

      if (checkResult.rows[0].current_stock < quantity) {
        throw new Error('Insufficient stock');
      }

      // Update stock
      const updateResult = await client.query(
        `UPDATE material_stock 
         SET current_stock = current_stock - $1, updated_at = NOW()
         WHERE id = $2 
         RETURNING id, material_name, current_stock`,
        [quantity, id]
      );

      // Record transaction
      await client.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, quantity, order_id, part_id, reference_number, notes, performed_by)
         VALUES ($1, 'stock_out', $2, $3, $4, $5, $6, $7)`,
        [id, quantity, order_id, part_id, reference_number, notes, userId]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Removed ${quantity} from stock`,
        material: updateResult.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: err.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in stock out:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Transfer between locations
async function transferStock(req, res) {
  try {
    const { id } = req.params;
    const { quantity, to_location_id, notes } = req.body;
    const userId = req.user?.id;

    if (!quantity || quantity <= 0 || !to_location_id) {
      return res.status(400).json({ success: false, message: 'Invalid quantity or destination' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current location
      const checkResult = await client.query(
        'SELECT current_stock, location_id FROM material_stock WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Material not found');
      }

      const fromLocationId = checkResult.rows[0].location_id;

      // Update location
      const updateResult = await client.query(
        `UPDATE material_stock 
         SET location_id = $1, updated_at = NOW()
         WHERE id = $2 
         RETURNING id, material_name, location_id`,
        [to_location_id, id]
      );

      // Record transaction
      await client.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, quantity, from_location_id, to_location_id, notes, performed_by)
         VALUES ($1, 'transfer', $2, $3, $4, $5, $6)`,
        [id, quantity, fromLocationId, to_location_id, notes, userId]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Material transferred',
        material: updateResult.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in transfer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get transactions history
async function getTransactions(req, res) {
  try {
    const { material_id, transaction_type, limit = 50 } = req.query;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (material_id) {
      whereConditions.push(`mt.material_id = $${paramIndex}`);
      params.push(material_id);
      paramIndex++;
    }
    if (transaction_type) {
      whereConditions.push(`mt.transaction_type = $${paramIndex}`);
      params.push(transaction_type);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT 
        mt.*,
        ms.material_name,
        u.full_name as performed_by_name,
        sl_from.code as from_location_code,
        sl_to.code as to_location_code
      FROM material_transactions mt
      JOIN material_stock ms ON mt.material_id = ms.id
      LEFT JOIN users u ON mt.performed_by = u.id
      LEFT JOIN storage_locations sl_from ON mt.from_location_id = sl_from.id
      LEFT JOIN storage_locations sl_to ON mt.to_location_id = sl_to.id
      ${whereClause}
      ORDER BY mt.created_at DESC
      LIMIT $${paramIndex}`,
      [...params, limit]
    );

    res.status(200).json({
      success: true,
      transactions: result.rows
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================================================
// SUPPLIERS CRUD
// ============================================================================

async function getSuppliers(req, res) {
  try {
    const result = await pool.query(
      `SELECT s.*, 
        COUNT(ms.id) as materials_count
      FROM suppliers s
      LEFT JOIN material_stock ms ON s.id = ms.supplier_id
      WHERE s.is_active = true
      GROUP BY s.id
      ORDER BY s.name`
    );

    res.status(200).json({
      success: true,
      suppliers: result.rows
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function createSupplier(req, res) {
  try {
    const { name, contact_person, email, phone, address, city, country, lead_time_days, payment_terms, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_person, email, phone, address, city, country, lead_time_days, payment_terms, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, contact_person, email, phone, address, city, country || 'Romania', lead_time_days || 7, payment_terms, notes]
    );

    res.status(201).json({
      success: true,
      message: 'Supplier created',
      supplier: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['name', 'contact_person', 'email', 'phone', 'address', 'city', 'country', 'lead_time_days', 'payment_terms', 'notes', 'is_active'];
    
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE suppliers SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier updated',
      supplier: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;

    // Soft delete
    const result = await pool.query(
      'UPDATE suppliers SET is_active = false WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier deactivated',
      supplier: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================================================
// STORAGE LOCATIONS CRUD
// ============================================================================

async function getStorageLocations(req, res) {
  try {
    const result = await pool.query(
      `SELECT sl.*, 
        COUNT(ms.id) as materials_count,
        COALESCE(SUM(ms.current_stock), 0) as total_items
      FROM storage_locations sl
      LEFT JOIN material_stock ms ON sl.id = ms.location_id
      WHERE sl.is_active = true
      GROUP BY sl.id
      ORDER BY sl.code`
    );

    res.status(200).json({
      success: true,
      locations: result.rows
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function createStorageLocation(req, res) {
  try {
    const { code, zone, shelf, description, capacity } = req.body;

    const result = await pool.query(
      `INSERT INTO storage_locations (code, zone, shelf, description, capacity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code, zone, shelf, description, capacity]
    );

    res.status(201).json({
      success: true,
      message: 'Location created',
      location: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating location:', error);
    if (error.code === '23505') {
      res.status(400).json({ success: false, message: 'Location code already exists' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

async function updateStorageLocation(req, res) {
  try {
    const { id } = req.params;
    const { code, zone, shelf, description, capacity, is_active } = req.body;

    const result = await pool.query(
      `UPDATE storage_locations 
       SET code = COALESCE($1, code),
           zone = COALESCE($2, zone),
           shelf = COALESCE($3, shelf),
           description = COALESCE($4, description),
           capacity = COALESCE($5, capacity),
           is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [code, zone, shelf, description, capacity, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Location updated',
      location: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function deleteStorageLocation(req, res) {
  try {
    const { id } = req.params;

    // Check if location has materials
    const checkResult = await pool.query(
      'SELECT COUNT(*) FROM material_stock WHERE location_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete location with materials. Move materials first.' 
      });
    }

    const result = await pool.query(
      'DELETE FROM storage_locations WHERE id = $1 RETURNING id, code',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Location deleted',
      location: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================================================
// MATERIAL TYPES
// ============================================================================

async function getMaterialTypes(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM material_types WHERE is_active = true ORDER BY category, name`
    );

    res.status(200).json({
      success: true,
      types: result.rows
    });
  } catch (error) {
    console.error('Error fetching material types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================================================
// ALERTS & REPORTS
// ============================================================================

async function getLowStockAlerts(req, res) {
  try {
    const result = await pool.query(
      `SELECT 
        ms.id,
        ms.material_name,
        ms.material_type,
        ms.shape_type,
        ms.current_stock,
        ms.reorder_level,
        ms.unit,
        s.name as supplier_name,
        s.lead_time_days,
        CASE 
          WHEN ms.current_stock <= 0 THEN 'out_of_stock'
          WHEN ms.current_stock <= ms.reorder_level THEN 'low_stock'
          ELSE 'ok'
        END as alert_level
      FROM material_stock ms
      LEFT JOIN suppliers s ON ms.supplier_id = s.id
      WHERE ms.current_stock <= ms.reorder_level
      ORDER BY 
        CASE WHEN ms.current_stock <= 0 THEN 0 ELSE 1 END,
        ms.current_stock ASC`
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

async function getMaterialUsageReport(req, res) {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        ms.material_name,
        ms.material_type,
        ms.unit,
        ms.cost_per_unit,
        COALESCE(SUM(CASE WHEN mt.transaction_type = 'stock_out' THEN mt.quantity ELSE 0 END), 0) as quantity_used,
        COALESCE(SUM(CASE WHEN mt.transaction_type = 'stock_in' THEN mt.quantity ELSE 0 END), 0) as quantity_added,
        COALESCE(SUM(CASE WHEN mt.transaction_type = 'stock_out' THEN mt.quantity ELSE 0 END), 0) * ms.cost_per_unit as cost_used
      FROM material_stock ms
      LEFT JOIN material_transactions mt ON ms.id = mt.material_id 
        AND mt.created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY ms.id, ms.material_name, ms.material_type, ms.unit, ms.cost_per_unit
      ORDER BY cost_used DESC NULLS LAST`,
      [days]
    );

    res.status(200).json({
      success: true,
      report: result.rows,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Legacy function for compatibility
async function updateMaterialStock(req, res) {
  return updateMaterial(req, res);
}

async function adjustMaterialStock(req, res) {
  const { transaction_type } = req.body;
  if (transaction_type === 'add') {
    return stockIn(req, res);
  } else {
    return stockOut(req, res);
  }
}

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
      GROUP BY m.id`,
      [orderId]
    );

    res.status(200).json({
      success: true,
      requirements: result.rows
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  // Materials
  getMaterials,
  getMaterialsStats,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  
  // Stock operations
  stockIn,
  stockOut,
  transferStock,
  getTransactions,
  
  // Suppliers
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  
  // Storage Locations
  getStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
  
  // Material Types
  getMaterialTypes,
  
  // Alerts & Reports
  getLowStockAlerts,
  getMaterialUsageReport,
  
  // Legacy compatibility
  updateMaterialStock,
  adjustMaterialStock,
  getOrderMaterialRequirements
};
