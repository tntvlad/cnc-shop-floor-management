const pool = require('../config/database');

// Get all parts with assignments
exports.getAllParts = async (req, res) => {
  try {
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
          jsonb_build_object(
            'id', ja.id,
            'userId', ja.user_id,
            'userName', u.name,
            'employeeId', u.employee_id,
            'status', ja.status,
            'assignedAt', ja.assigned_at
          ) ORDER BY ja.assigned_at
        ) FILTER (WHERE ja.id IS NOT NULL), '[]') as assignments
      FROM parts p
      LEFT JOIN files f ON p.id = f.part_id
      LEFT JOIN job_assignments ja ON p.id = ja.part_id
      LEFT JOIN users u ON ja.user_id = u.id
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
          jsonb_build_object(
            'id', fb.id,
            'text', fb.text,
            'userName', u.name,
            'createdAt', fb.created_at
          ) ORDER BY fb.created_at DESC
        ) FILTER (WHERE fb.id IS NOT NULL), '[]') as feedback,
        COALESCE(json_agg(
          jsonb_build_object(
            'id', ja.id,
            'userId', ja.user_id,
            'userName', u2.name,
            'employeeId', u2.employee_id,
            'status', ja.status,
            'assignedAt', ja.assigned_at
          ) ORDER BY ja.assigned_at
        ) FILTER (WHERE ja.id IS NOT NULL), '[]') as assignments
      FROM parts p
      LEFT JOIN files f ON p.id = f.part_id
      LEFT JOIN feedback fb ON p.id = fb.part_id
      LEFT JOIN users u ON fb.user_id = u.id
      LEFT JOIN job_assignments ja ON p.id = ja.part_id
      LEFT JOIN users u2 ON ja.user_id = u2.id
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

// Assign part to users (Supervisor+) - can assign to multiple operators
// Sequential workflow: first operator gets 'ready', others get 'locked'
exports.assignPart = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds, userId } = req.body; // Accept array or single value

    // Validate part exists
    const partRes = await pool.query('SELECT id FROM parts WHERE id = $1', [id]);
    if (partRes.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    // Normalize to an array of numeric IDs
    const idsToAssign = [];
    if (Array.isArray(userIds)) idsToAssign.push(...userIds);
    if (userIds && !Array.isArray(userIds)) idsToAssign.push(userIds);
    if (userId !== undefined && userId !== null) idsToAssign.push(userId);

    const normalizedIds = idsToAssign
      .map((val) => Number(val))
      .filter((val) => !Number.isNaN(val));

    if (normalizedIds.length === 0) {
      return res.status(400).json({ error: 'No user IDs provided' });
    }

    // Fetch users with their levels to determine sequence
    const usersData = [];
    for (const userId of normalizedIds) {
      const userRes = await pool.query('SELECT id, level FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: `User ${userId} not found` });
      }
      const targetLevel = userRes.rows[0].level || 100;
      if (targetLevel > 300) {
        return res.status(400).json({ error: `Cannot assign to user with level > 300` });
      }
      usersData.push({ id: userId, level: targetLevel });
    }

    // Establish sequence with desired order: Cutting (200) → CNC (100) → QC (300)
    const priority = (lvl) => {
      if (lvl === 200) return 1; // Cutting first
      if (lvl === 100) return 2; // CNC second
      if (lvl === 300) return 3; // QC third
      return 99; // Others last
    };
    usersData.sort((a, b) => priority(a.level) - priority(b.level));

    // Assign to all users with sequence and status
    const results = [];
    for (let i = 0; i < usersData.length; i++) {
      const userData = usersData[i];
      const sequence = i + 1;
      const status = sequence === 1 ? 'ready' : 'locked';
      
      const result = await pool.query(
        `INSERT INTO job_assignments (part_id, user_id, sequence, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (part_id, user_id) DO UPDATE
         SET sequence = $3, status = $4, assigned_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [id, userData.id, sequence, status]
      );
      results.push(result.rows[0]);
    }

    res.json({ message: 'Part assigned successfully', assignments: results });
  } catch (error) {
    console.error('Assign part error:', error);
    res.status(500).json({ error: 'Failed to assign part' });
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

// Mark job assignment as complete (operator marks their own assignment as done)
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

    // Get job assignment for this user
    const assignmentResult = await client.query(
      'SELECT * FROM job_assignments WHERE part_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (assignmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job assignment not found for this user' });
    }

    const assignment = assignmentResult.rows[0];

    // Mark assignment as completed
    await client.query(
      'UPDATE job_assignments SET status = $1, completed_at = NOW(), actual_time = $2 WHERE id = $3',
      ['completed', actualTime, assignment.id]
    );

    // Update next operator in sequence to 'ready'
    await client.query(
      `UPDATE job_assignments 
       SET status = 'ready'
       WHERE part_id = $1 AND sequence = $2 AND status IN ('locked', 'pending')`,
      [id, assignment.sequence + 1]
    );

    // Record in part_completions for history
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

    const part = partResult.rows[0];

    // Check if all assignments for this part are completed
    const pendingAssignments = await client.query(
      "SELECT COUNT(*) as count FROM job_assignments WHERE part_id = $1 AND status != 'completed'",
      [id]
    );

    // If all assignments done, unlock next part
    if (parseInt(pendingAssignments.rows[0].count, 10) === 0) {
      const nextPart = await client.query(
        'SELECT id FROM parts WHERE order_position = $1 AND locked = TRUE',
        [part.order_position + 1]
      );

      if (nextPart.rows.length > 0) {
        await client.query('UPDATE parts SET locked = FALSE WHERE id = $1', [nextPart.rows[0].id]);
      }

      // Mark part as completed
      await client.query('UPDATE parts SET completed = TRUE WHERE id = $1', [id]);
    }

    await client.query('COMMIT');

    res.json({ message: 'Job marked as completed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete part error:', error);
    res.status(500).json({ error: 'Failed to complete job' });
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
        COUNT(DISTINCT ja.part_id) as completed_parts,
        COALESCE(SUM(tl.duration), 0) as total_time,
        (
          SELECT p.name 
          FROM job_assignments ja2
          JOIN parts p ON ja2.part_id = p.id
          WHERE ja2.user_id = $1 AND ja2.status = 'in_progress'
          LIMIT 1
        ) as current_part
      FROM job_assignments ja
      LEFT JOIN time_logs tl ON tl.user_id = ja.user_id AND tl.part_id = ja.part_id
      WHERE ja.user_id = $1 AND ja.status = 'completed'
    `, [userId]);

    res.json(stats.rows[0] || { completed_parts: 0, total_time: 0, current_part: null });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};

// Get operator's assigned jobs (only their assignments)
exports.getOperatorJobs = async (req, res) => {
  try {
    const userId = req.user.id;

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
        json_build_object(
          'id', ja.id,
          'status', ja.status,
          'assignedAt', ja.assigned_at
        ) as assignment
      FROM job_assignments ja
      JOIN parts p ON ja.part_id = p.id
      LEFT JOIN files f ON p.id = f.part_id
      WHERE ja.user_id = $1
      GROUP BY p.id, ja.id, ja.status, ja.assigned_at
      ORDER BY ja.status DESC, p.order_position ASC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get operator jobs error:', error);
    res.status(500).json({ error: 'Failed to get operator jobs' });
  }
};

// Start job (update job assignment status and unlock next in sequence)
exports.startJob = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = req.user.id;

    // Get current assignment
    const assignmentRes = await client.query(
      'SELECT * FROM job_assignments WHERE part_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (assignmentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job assignment not found' });
    }

    const currentAssignment = assignmentRes.rows[0];

    // Check if status allows starting
    if (currentAssignment.status !== 'ready') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot start job with status: ${currentAssignment.status}` });
    }

    // Update current assignment to in_progress
    await client.query(
      `UPDATE job_assignments 
       SET status = 'in_progress', started_at = NOW()
       WHERE id = $1`,
      [currentAssignment.id]
    );

    // Update next operator in sequence to 'pending'
    await client.query(
      `UPDATE job_assignments 
       SET status = 'pending'
       WHERE part_id = $1 AND sequence = $2 AND status = 'locked'`,
      [id, currentAssignment.sequence + 1]
    );

    await client.query('COMMIT');

    res.json({ message: 'Job started', assignment: currentAssignment });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start job error:', error);
    res.status(500).json({ error: 'Failed to start job' });
  } finally {
    client.release();
  }
};
