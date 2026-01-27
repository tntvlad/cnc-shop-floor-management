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

    const allowed = ['status', 'is_available', 'current_job', 'current_operator', 'maintenance_scheduled_start', 'maintenance_scheduled_end', 'maintenance_notes', 'notes', 'next_maintenance_due', 'last_maintenance'];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        values.push(req.body[key]);
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
