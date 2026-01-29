const pool = require('../config/database');

// Create machine
exports.createMachine = async (req, res) => {
  try {
    const { machine_type, machine_number, machine_name, machine_model, status, is_available, notes, location } = req.body;

    const result = await pool.query(
      `INSERT INTO machines (machine_type, machine_number, machine_name, machine_model, status, is_available, notes, location)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), $7, $8)
       RETURNING *`,
      [machine_type || null, machine_number || null, machine_name, machine_model || null, status || 'available', is_available, notes || null, location || null]
    );

    res.status(201).json({ success: true, machine: result.rows[0] });
  } catch (error) {
    console.error('Create machine error:', error);
    res.status(500).json({ success: false, message: 'Failed to create machine' });
  }
};

// List machines with optional filters
exports.getMachines = async (req, res) => {
  try {
    const { status, machine_type } = req.query;
    const params = [];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    if (machine_type) {
      params.push(machine_type);
      filters.push(`machine_type = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, machine_type, machine_number, machine_name, machine_model, status, is_available,
              current_job, current_operator, last_maintenance, next_maintenance_due,
              maintenance_scheduled_start, maintenance_scheduled_end, maintenance_notes,
              total_runtime_hours, utilization_percentage, notes, location, created_at, updated_at
       FROM machines
       ${where}
       ORDER BY machine_name, machine_type, machine_number`,
      params
    );

    res.json({ success: true, machines: result.rows });
  } catch (error) {
    console.error('Get machines error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch machines' });
  }
};

// Get single machine
exports.getMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, machine_type, machine_number, machine_name, machine_model, status, is_available,
              current_job, current_operator, last_maintenance, next_maintenance_due,
              maintenance_scheduled_start, maintenance_scheduled_end, maintenance_notes,
              total_runtime_hours, utilization_percentage, notes, location, created_at, updated_at
       FROM machines WHERE id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    res.json({ success: true, machine: result.rows[0] });
  } catch (error) {
    console.error('Get machine error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch machine' });
  }
};

// Update machine status/assignment
exports.updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];

    const allowed = ['machine_name', 'machine_type', 'machine_model', 'machine_number', 'status', 'is_available', 'location', 'current_job', 'current_operator', 'maintenance_scheduled_start', 'maintenance_scheduled_end', 'maintenance_notes', 'notes', 'next_maintenance_due', 'last_maintenance'];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        values.push(req.body[key] === '' ? null : req.body[key]);
        fields.push(`${key} = $${values.length}`);
      }
    });

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE machines SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    res.json({ success: true, machine: result.rows[0] });
  } catch (error) {
    console.error('Update machine error:', error);
    res.status(500).json({ success: false, message: 'Failed to update machine' });
  }
};

// Assign a job to a machine
exports.assignJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_job, current_operator, status } = req.body;

    // Basic existence check for machine
    const machine = await pool.query('SELECT id FROM machines WHERE id = $1', [id]);
    if (!machine.rows.length) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    const fields = [];
    const values = [];

    if (current_job !== undefined) {
      values.push(current_job);
      fields.push(`current_job = $${values.length}`);
    }
    if (current_operator !== undefined) {
      values.push(current_operator);
      fields.push(`current_operator = $${values.length}`);
    }
    if (status !== undefined) {
      values.push(status);
      fields.push(`status = $${values.length}`);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE machines SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values
    );

    res.json({ success: true, machine: result.rows[0] });
  } catch (error) {
    console.error('Assign job error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign job' });
  }
};

// Delete machine
exports.deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if machine has current job assigned
    const machine = await pool.query('SELECT current_job FROM machines WHERE id = $1', [id]);
    if (!machine.rows.length) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    if (machine.rows[0].current_job) {
      return res.status(400).json({ success: false, message: 'Cannot delete machine with active job assignment' });
    }

    await pool.query('DELETE FROM machines WHERE id = $1', [id]);
    res.json({ success: true, message: 'Machine deleted' });
  } catch (error) {
    console.error('Delete machine error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete machine' });
  }
};

// =============================================
// MACHINE MAINTENANCE RECORDS
// =============================================

// Get maintenance records for a machine
exports.getMaintenanceRecords = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT mmr.*, u.name as performed_by_name
       FROM machine_maintenance_records mmr
       LEFT JOIN users u ON mmr.performed_by = u.id
       WHERE mmr.machine_id = $1
       ORDER BY COALESCE(mmr.completed_at, mmr.started_at, mmr.created_at) DESC`,
      [id]
    );
    
    res.json({ success: true, records: result.rows });
  } catch (error) {
    console.error('Get maintenance records error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance records' });
  }
};

// Create maintenance record
exports.createMaintenanceRecord = async (req, res) => {
  try {
    const { id } = req.params; // machine_id
    const { maintenance_type, description, started_at, completed_at, cost, parts_replaced, next_maintenance_due, notes } = req.body;
    
    // Get current user ID
    const performed_by = req.user ? req.user.id : null;
    
    const result = await pool.query(
      `INSERT INTO machine_maintenance_records 
       (machine_id, maintenance_type, description, performed_by, started_at, completed_at, cost, parts_replaced, next_maintenance_due, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, maintenance_type, description, performed_by, started_at || null, completed_at || null, cost || null, parts_replaced || null, next_maintenance_due || null, notes || null]
    );
    
    // Update machine's next maintenance due and last maintenance if provided
    const updateFields = [];
    const updateValues = [];
    
    if (completed_at) {
      updateValues.push(completed_at);
      updateFields.push(`last_maintenance = $${updateValues.length}`);
    }
    
    if (next_maintenance_due) {
      updateValues.push(next_maintenance_due);
      updateFields.push(`next_maintenance_due = $${updateValues.length}`);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(id);
      await pool.query(
        `UPDATE machines SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${updateValues.length}`,
        updateValues
      );
    }
    
    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Create maintenance record error:', error);
    res.status(500).json({ success: false, message: 'Failed to create maintenance record' });
  }
};

// Delete maintenance record
exports.deleteMaintenanceRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM machine_maintenance_records WHERE id = $1 RETURNING id',
      [recordId]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }
    
    res.json({ success: true, message: 'Maintenance record deleted' });
  } catch (error) {
    console.error('Delete maintenance record error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete maintenance record' });
  }
};
