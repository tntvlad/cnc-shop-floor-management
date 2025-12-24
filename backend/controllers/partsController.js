const pool = require('../config/database');

// Get all parts
exports.getAllParts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        COALESCE(json_agg(
          json_build_object(
            'id', f.id,
            'filename', f.filename,
            'fileType', f.file_type,
            'uploadedAt', f.uploaded_at
          )
        ) FILTER (WHERE f.id IS NOT NULL), '[]') as files
      FROM parts p
      LEFT JOIN files f ON p.id = f.part_id
      GROUP BY p.id
      ORDER BY p.order_position ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get parts error:', error);
    res.status(500).json({ error: 'Failed to get parts' });
  }
};

// Get single part
exports.getPart = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        p.*,
        COALESCE(json_agg(
          DISTINCT jsonb_build_object(
            'id', f.id,
            'filename', f.filename,
            'fileType', f.file_type,
            'uploadedAt', f.uploaded_at
          )
        ) FILTER (WHERE f.id IS NOT NULL), '[]') as files,
        COALESCE(json_agg(
          DISTINCT jsonb_build_object(
            'id', fb.id,
            'text', fb.text,
            'userName', u.name,
            'createdAt', fb.created_at
          ) ORDER BY fb.created_at DESC
        ) FILTER (WHERE fb.id IS NOT NULL), '[]') as feedback
      FROM parts p
      LEFT JOIN files f ON p.id = f.part_id
      LEFT JOIN feedback fb ON p.id = fb.part_id
      LEFT JOIN users u ON fb.user_id = u.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get part error:', error);
    res.status(500).json({ error: 'Failed to get part' });
  }
};

// Create part
exports.createPart = async (req, res) => {
  try {
    const { name, material, quantity, treatment, targetTime, orderPosition } = req.body;

    const result = await pool.query(
      `INSERT INTO parts (name, material, quantity, treatment, target_time, order_position, locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, material, quantity, treatment || null, targetTime, orderPosition, orderPosition !== 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create part error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Order position already exists' });
    }
    res.status(500).json({ error: 'Failed to create part' });
  }
};

// Update part
exports.updatePart = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = $${paramCount}`);
      values.push(updates[key]);
      paramCount++;
    });

    values.push(id);

    const result = await pool.query(
      `UPDATE parts SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update part error:', error);
    res.status(500).json({ error: 'Failed to update part' });
  }
};

// Delete part
exports.deletePart = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM parts WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    res.json({ message: 'Part deleted successfully' });
  } catch (error) {
    console.error('Delete part error:', error);
    res.status(500).json({ error: 'Failed to delete part' });
  }
};

// Mark part as complete
exports.completePart = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { actualTime } = req.body;
    const userId = req.user.id;

    // Get current part
    const partResult = await client.query('SELECT * FROM parts WHERE id = $1', [id]);
    if (partResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Part not found' });
    }

    const part = partResult.rows[0];

    // Check if part is locked
    if (part.locked) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Part is locked' });
    }

    // Mark part as completed
    await client.query('UPDATE parts SET completed = TRUE WHERE id = $1', [id]);

    // Record completion
    await client.query(
      'INSERT INTO part_completions (part_id, user_id, actual_time) VALUES ($1, $2, $3)',
      [id, userId, actualTime]
    );

    // End active time log
    await client.query(
      `UPDATE time_logs 
       SET end_time = NOW(), 
           duration = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
       WHERE part_id = $1 AND user_id = $2 AND end_time IS NULL`,
      [id, userId]
    );

    // Unlock next part
    const nextPart = await client.query(
      'SELECT id FROM parts WHERE order_position = $1 AND locked = TRUE',
      [part.order_position + 1]
    );

    if (nextPart.rows.length > 0) {
      await client.query('UPDATE parts SET locked = FALSE WHERE id = $1', [nextPart.rows[0].id]);
    }

    await client.query('COMMIT');

    res.json({ message: 'Part completed successfully', nextUnlocked: nextPart.rows.length > 0 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete part error:', error);
    res.status(500).json({ error: 'Failed to complete part' });
  } finally {
    client.release();
  }
};

// Get statistics
exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT pc.part_id) as completed_parts,
        COALESCE(SUM(tl.duration), 0) as total_time,
        (
          SELECT p.name 
          FROM time_logs tl2
          JOIN parts p ON tl2.part_id = p.id
          WHERE tl2.user_id = $1 AND tl2.end_time IS NULL
          LIMIT 1
        ) as current_part
      FROM part_completions pc
      LEFT JOIN time_logs tl ON tl.user_id = pc.user_id
      WHERE pc.user_id = $1
    `, [userId]);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};
