const pool = require('../config/database');

// Map priority string to integer for parts table
function mapPriorityToInt(priorityStr) {
  const map = { 'urgent': 3, 'high': 2, 'normal': 1, 'low': 0 };
  return map[priorityStr] !== undefined ? map[priorityStr] : 1; // default to normal (1)
}

// Map integer priority to string for display
function mapPriorityToStr(priorityInt) {
  const map = { 3: 'urgent', 2: 'high', 1: 'normal', 0: 'low' };
  return map[priorityInt] || 'normal';
}

// Create a new order
async function createOrder(req, res) {
  try {
    const { 
      customer_id,
      customer_name, 
      customer_email, 
      customer_phone, 
      order_date,
      internal_order_id,
      external_order_id,
      due_date, 
      notes, 
      parts,
      invoice_contact_id,
      order_contact_id,
      technical_contact_id,
      delivery_address,
      priority,
      // Order approval fields (Phase 2)
      discount_applied,
      requires_approval,
      approval_status
    } = req.body;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If customer_id provided, get customer details
      let customerDetails = { name: customer_name, email: customer_email, phone: customer_phone };
      if (customer_id) {
        const customerResult = await client.query(
          'SELECT company_name, email, phone, delivery_address, headquarters_address FROM customers WHERE id = $1',
          [customer_id]
        );
        if (customerResult.rows.length > 0) {
          const cust = customerResult.rows[0];
          customerDetails = {
            name: cust.company_name,
            email: cust.email,
            phone: cust.phone
          };
        }
      }

      // Insert order with new fields
      const orderResult = await client.query(
        `INSERT INTO orders (
          customer_id, customer_name, customer_email, customer_phone, 
          order_date, internal_order_id, external_order_id, due_date, notes, status, priority,
          invoice_contact_id, order_contact_id, technical_contact_id,
          delivery_address,
          discount_applied, requires_approval, approval_status
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id, customer_id, customer_name, customer_email, order_date, internal_order_id, external_order_id, due_date, status, priority, created_at, approval_status, requires_approval`,
        [
          customer_id || null,
          customerDetails.name,
          customerDetails.email,
          customerDetails.phone,
          order_date,
          internal_order_id || null,
          external_order_id || null,
          due_date,
          notes,
          'pending',
          priority || 'normal',
          invoice_contact_id || null,
          order_contact_id || null,
          technical_contact_id || null,
          delivery_address || null,
          discount_applied || 0,
          requires_approval || false,
          approval_status || 'approved'
        ]
      );

      const orderId = orderResult.rows[0].id;

      // Insert parts for this order (inherit order priority by default)
      if (parts && Array.isArray(parts) && parts.length > 0) {
        for (const part of parts) {
          // Part can have its own priority, or inherit from order
          const partPriorityStr = part.priority || priority || 'normal';
          const partPriorityInt = mapPriorityToInt(partPriorityStr);
          await client.query(
            `INSERT INTO parts (order_id, part_name, quantity, description, material_id, material_type, material_dimensions, estimated_time, file_folder, status, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              orderId,
              part.part_name,
              part.quantity || 1,
              part.description || '',
              part.material_id || null,
              part.material_type || null,
              part.material_dimensions || null,
              part.estimated_time || null,
              part.file_folder || null,
              'pending',
              partPriorityInt
            ]
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
        o.customer_id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.order_date,
        o.internal_order_id,
        o.external_order_id,
        o.due_date,
        o.status,
        o.priority,
        o.notes,
        o.created_at,
        o.completed_at,
        o.invoice_contact_id,
        o.order_contact_id,
        o.technical_contact_id,
        o.delivery_address,
        c.headquarters_address,
        c.cif,
        c.trade_register_number,
        COUNT(p.id) as part_count,
        SUM(CASE WHEN p.workflow_stage = 'completed' OR p.status = 'completed' THEN 1 ELSE 0 END) as completed_parts,
        SUM(CASE 
          WHEN p.workflow_stage = 'completed' THEN 100
          WHEN p.workflow_stage = 'qc' THEN 80
          WHEN p.workflow_stage = 'machining' THEN 60
          WHEN p.workflow_stage = 'programming' THEN 40
          WHEN p.workflow_stage = 'cutting' THEN 20
          ELSE 0 
        END) as workflow_progress_sum
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
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

    query += ` GROUP BY o.id, c.id ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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

// Get single order with parts, materials, and contact info
async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT 
        o.id,
        o.customer_id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.order_date,
        o.internal_order_id,
        o.external_order_id,
        o.due_date,
        o.status,
        o.priority,
        o.notes,
        o.created_at,
        o.updated_at,
        o.invoice_contact_id,
        o.order_contact_id,
        o.technical_contact_id,
        o.delivery_address as order_delivery_address,
        c.headquarters_address,
        c.delivery_address as customer_delivery_address,
        c.cif,
        c.trade_register_number,
        c.customer_id as customer_code,
        -- Invoice contact
        ic.name as invoice_contact_name,
        ic.phone as invoice_contact_phone,
        ic.email as invoice_contact_email,
        -- Order contact
        oc.name as order_contact_name,
        oc.phone as order_contact_phone,
        oc.email as order_contact_email,
        -- Technical contact
        tc.name as technical_contact_name,
        tc.phone as technical_contact_phone,
        tc.email as technical_contact_email
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN contact_persons ic ON o.invoice_contact_id = ic.id
      LEFT JOIN contact_persons oc ON o.order_contact_id = oc.id
      LEFT JOIN contact_persons tc ON o.technical_contact_id = tc.id
      WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];
    
    // Compute effective delivery address
    order.effective_delivery_address = order.order_delivery_address 
      || order.customer_delivery_address 
      || order.headquarters_address;

    // Get parts for this order
    const partsResult = await pool.query(
      `SELECT 
        p.id,
        p.part_name,
        p.quantity,
        p.description,
        p.status,
        p.workflow_stage,
        p.material_id,
        p.material_type,
        p.priority,
        mt.name as material_name,
        p.estimated_setup_time,
        p.estimated_run_time_per_piece,
        p.batch_number,
        p.quantity_scrapped,
        p.created_at
      FROM parts p
      LEFT JOIN material_types mt ON p.material_id = mt.id
      WHERE p.order_id = $1
      ORDER BY p.id`,
      [id]
    );

    // Convert integer priority to string for each part
    order.parts = partsResult.rows.map(part => ({
      ...part,
      priority: mapPriorityToStr(part.priority)
    }));

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

    // Set completed_at when marking as completed, clear it otherwise
    const completedAtClause = status === 'completed' 
      ? ', completed_at = COALESCE(completed_at, NOW())' 
      : ', completed_at = NULL';

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW()${completedAtClause}
       WHERE id = $2
       RETURNING id, status, updated_at, completed_at`,
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
    const { 
      customer_name, customer_email, customer_phone, 
      due_date, notes, priority, status, customer_id 
    } = req.body;

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (customer_name !== undefined) {
      updates.push(`customer_name = $${paramCount++}`);
      values.push(customer_name);
    }
    if (customer_email !== undefined) {
      updates.push(`customer_email = $${paramCount++}`);
      values.push(customer_email);
    }
    if (customer_phone !== undefined) {
      updates.push(`customer_phone = $${paramCount++}`);
      values.push(customer_phone);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date || null);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    // If customer_id is provided, fetch customer details to update customer_name
    if (customer_id !== undefined && customer_id !== null) {
      const customerResult = await pool.query(
        'SELECT company_name FROM customers WHERE id = $1',
        [customer_id]
      );
      if (customerResult.rows.length > 0) {
        updates.push(`customer_name = $${paramCount++}`);
        values.push(customerResult.rows[0].company_name);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE orders 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, customer_name, customer_email, customer_phone, due_date, notes, priority, status, updated_at`,
      values
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

      // Clear machine references that point to parts from this order (FK protection)
      await client.query(
        `UPDATE machines
         SET current_job = NULL, current_operator = NULL
         WHERE current_job IN (SELECT id FROM parts WHERE order_id = $1)`,
        [id]
      );

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
    res.status(500).json({ success: false, message: 'Failed to delete order. Clear active machine assignments and try again.' });
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
  getOrderStats,
  addPartToOrder,
  updatePartPriority,
  getNextInternalOrderId
};

// Get next available internal order ID (format: FP-YYYY-NNN)
async function getNextInternalOrderId(req, res) {
  try {
    const currentYear = new Date().getFullYear();
    const prefix = `FP-${currentYear}-`;
    
    // Find the highest number for this year
    const result = await pool.query(
      `SELECT internal_order_id FROM orders 
       WHERE internal_order_id LIKE $1 
       ORDER BY internal_order_id DESC 
       LIMIT 1`,
      [`${prefix}%`]
    );
    
    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastId = result.rows[0].internal_order_id;
      const lastNumber = parseInt(lastId.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    
    const nextInternalOrderId = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    
    res.json({
      success: true,
      nextInternalOrderId
    });
  } catch (error) {
    console.error('Error getting next internal order ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Add a part to an existing order
async function addPartToOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { part_name, quantity, description, material_type, priority } = req.body;

    if (!part_name) {
      return res.status(400).json({ success: false, message: 'Part name is required' });
    }

    // Get order's priority if not provided for the part
    let partPriorityStr = priority;
    if (!partPriorityStr) {
      const orderResult = await pool.query('SELECT priority FROM orders WHERE id = $1', [orderId]);
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      partPriorityStr = orderResult.rows[0].priority || 'normal';
    }
    
    // Convert to integer for parts table
    const partPriorityInt = mapPriorityToInt(partPriorityStr);

    const result = await pool.query(
      `INSERT INTO parts (order_id, part_name, quantity, description, material_type, status, priority)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [orderId, part_name, quantity || 1, description || '', material_type || null, partPriorityInt]
    );
    
    // Convert priority back to string for response
    const part = result.rows[0];
    part.priority = mapPriorityToStr(part.priority);

    res.status(201).json({
      success: true,
      message: 'Part added successfully',
      part: part
    });
  } catch (error) {
    console.error('Error adding part to order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Update a part's priority
async function updatePartPriority(req, res) {
  try {
    const { partId } = req.params;
    const { priority } = req.body;

    if (!priority || !['urgent', 'high', 'normal', 'low'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Valid priority is required (urgent, high, normal, low)' });
    }
    
    // Convert to integer for parts table
    const priorityInt = mapPriorityToInt(priority);

    const result = await pool.query(
      `UPDATE parts SET priority = $1 WHERE id = $2 RETURNING id, part_name, priority`,
      [priorityInt, partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }
    
    // Convert priority back to string for response
    const part = result.rows[0];
    part.priority = mapPriorityToStr(part.priority);

    res.status(200).json({
      success: true,
      message: 'Part priority updated',
      part: part
    });
  } catch (error) {
    console.error('Error updating part priority:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}
