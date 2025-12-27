const pool = require('../config/database');

// Create a new order
async function createOrder(req, res) {
  try {
    const { customer_name, customer_email, customer_phone, order_date, due_date, notes, parts } = req.body;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (customer_name, customer_email, customer_phone, order_date, due_date, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, customer_name, customer_email, order_date, due_date, status, created_at`,
        [customer_name, customer_email, customer_phone, order_date, due_date, notes, 'pending']
      );

      const orderId = orderResult.rows[0].id;

      // Insert parts for this order
      if (parts && Array.isArray(parts) && parts.length > 0) {
        for (const part of parts) {
          await client.query(
            `INSERT INTO parts (order_id, part_name, quantity, description, material_id, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [orderId, part.part_name, part.quantity || 1, part.description || '', part.material_id || null, 'pending']
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        order: orderResult.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get all orders with filtering
async function getOrders(req, res) {
  try {
    const { status, customer, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        o.id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.order_date,
        o.due_date,
        o.status,
        o.notes,
        o.created_at,
        COUNT(p.id) as part_count,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_parts
      FROM orders o
      LEFT JOIN parts p ON o.id = p.order_id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    if (customer) {
      query += ` AND (o.customer_name ILIKE $${params.length + 1} OR o.customer_email ILIKE $${params.length + 1})`;
      params.push(`%${customer}%`, `%${customer}%`);
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      orders: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get single order with parts and materials
async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT 
        o.id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.order_date,
        o.due_date,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Get parts for this order
    const partsResult = await pool.query(
      `SELECT 
        p.id,
        p.part_name,
        p.quantity,
        p.description,
        p.status,
        p.stage,
        p.material_id,
        m.material_name,
        p.estimated_setup_time,
        p.estimated_run_time_per_piece,
        p.batch_number,
        p.quantity_scrapped,
        p.created_at
      FROM parts p
      LEFT JOIN material_stock m ON p.material_id = m.id
      WHERE p.order_id = $1
      ORDER BY p.id`,
      [id]
    );

    order.parts = partsResult.rows;

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Update order status
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in-progress', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` 
      });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, updated_at`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Update order details
async function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const { customer_name, customer_email, customer_phone, due_date, notes } = req.body;

    const result = await pool.query(
      `UPDATE orders 
       SET customer_name = COALESCE($1, customer_name),
           customer_email = COALESCE($2, customer_email),
           customer_phone = COALESCE($3, customer_phone),
           due_date = COALESCE($4, due_date),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, customer_name, customer_email, customer_phone, due_date, notes, updated_at`,
      [customer_name, customer_email, customer_phone, due_date, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Delete order
async function deleteOrder(req, res) {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete parts first (foreign key constraint)
      await client.query('DELETE FROM parts WHERE order_id = $1', [id]);

      // Delete order
      const result = await client.query(
        'DELETE FROM orders WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Order deleted successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get order summary stats
async function getOrderStats(req, res) {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'in-progress' THEN o.id END) as in_progress_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders,
        COUNT(p.id) as total_parts,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_parts,
        ROUND(AVG(EXTRACT(DAY FROM (o.due_date - o.order_date))))::INT as avg_lead_days
      FROM orders o
      LEFT JOIN parts p ON o.id = p.order_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
    `);

    res.status(200).json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrderStats
};
