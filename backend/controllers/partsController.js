const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const BROWSE_ROOT = path.resolve(process.env.FILE_BROWSE_ROOT || process.env.UPLOAD_DIR || './uploads');

function ensureWithinRoot(resolvedPath) {
  const normalizedRoot = BROWSE_ROOT.endsWith(path.sep) ? BROWSE_ROOT : `${BROWSE_ROOT}${path.sep}`;
  const normalizedTarget = resolvedPath.endsWith(path.sep) ? resolvedPath : `${resolvedPath}${path.sep}`;
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error('Folder must be inside the allowed root');
  }
}

function normalizeFolderPath(folderPath) {
  if (folderPath === undefined || folderPath === null || folderPath === '') {
    return null;
  }

  const resolved = path.resolve(folderPath.startsWith(BROWSE_ROOT) ? folderPath : path.join(BROWSE_ROOT, folderPath));

  ensureWithinRoot(resolved);

  if (!fs.existsSync(resolved)) {
    throw new Error('Folder path does not exist on server');
  }

  const stats = fs.statSync(resolved);
  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  return resolved;
}

// Get all parts with assignments
exports.getAllParts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        p.part_name as name,
        COALESCE(p.material_type, 'N/A') as material,
        p.order_id as order_position,
        COALESCE(p.estimated_time, 0) as target_time,
        m.material_name,
        u.name as assigned_user_name,
        u.employee_id as assigned_employee_id,
        o.due_date,
        o.priority as order_priority,
        o.status as order_status,
        CASE WHEN p.assigned_to IS NOT NULL THEN
          json_build_array(json_build_object(
            'user_id', p.assigned_to,
            'employeeId', u.employee_id,
            'name', u.name,
            'status', CASE WHEN p.status = 'in_progress' THEN 'in_progress' ELSE 'ready' END
          ))
        ELSE '[]'::json END as assignments
      FROM parts p
      LEFT JOIN material_stock m ON p.material_id = m.id
      LEFT JOIN users u ON p.assigned_to = u.id
      LEFT JOIN orders o ON p.order_id = o.id
      ORDER BY p.created_at DESC
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
        p.part_name as name,
        p.material_type as material,
        p.priority as order_position,
        p.estimated_time as target_time,
        m.material_name,
        u.name as assigned_user_name,
        CASE WHEN p.assigned_to IS NOT NULL THEN
          json_build_object(
            'user_id', p.assigned_to,
            'status', CASE WHEN p.status = 'in_progress' THEN 'in_progress' ELSE 'ready' END
          )
        ELSE NULL END as assignment
      FROM parts p
      LEFT JOIN material_stock m ON p.material_id = m.id
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.id = $1
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

    // Normalize to get the first user ID (this schema only supports single assignment)
    let assignUserId = null;
    if (Array.isArray(userIds) && userIds.length > 0) {
      assignUserId = Number(userIds[0]);
    } else if (userIds) {
      assignUserId = Number(userIds);
    } else if (userId !== undefined && userId !== null) {
      assignUserId = Number(userId);
    }

    if (!assignUserId || Number.isNaN(assignUserId)) {
      return res.status(400).json({ error: 'No valid user ID provided' });
    }

    // Verify user exists and has appropriate level
    const userRes = await pool.query('SELECT id, level, name FROM users WHERE id = $1', [assignUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: `User ${assignUserId} not found` });
    }
    const targetLevel = userRes.rows[0].level || 100;
    if (targetLevel > 300) {
      return res.status(400).json({ error: `Cannot assign to user with level > 300` });
    }

    // Update the part's assigned_to column
    const result = await pool.query(
      `UPDATE parts 
       SET assigned_to = $1, 
           assigned_at = NOW(),
           status = 'assigned'
       WHERE id = $2
       RETURNING *`,
      [assignUserId, id]
    );

    res.json({ 
      message: 'Part assigned successfully', 
      assignment: {
        part_id: id,
        user_id: assignUserId,
        user_name: userRes.rows[0].name,
        status: 'ready'
      }
    });
  } catch (error) {
    console.error('Assign part error:', error);
    res.status(500).json({ error: 'Failed to assign part' });
  }
};

// Create part
exports.createPart = async (req, res) => {
  try {
    const { name, material, quantity, treatment, targetTime, orderPosition, fileFolder } = req.body;

    let normalizedFolder = null;
    try {
      normalizedFolder = normalizeFolderPath(fileFolder);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const result = await pool.query(
      `INSERT INTO parts (name, material, quantity, treatment, target_time, order_position, locked, file_folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, material, quantity, treatment || null, targetTime, orderPosition, orderPosition !== 1, normalizedFolder]
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
    const updates = { ...req.body };

    if ('fileFolder' in updates || 'file_folder' in updates) {
      const rawFolder = updates.fileFolder !== undefined ? updates.fileFolder : updates.file_folder;
      try {
        updates.fileFolder = normalizeFolderPath(rawFolder);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      delete updates.file_folder;
    }

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

// Update only the file folder path for a part
exports.updateFileFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { folderPath } = req.body;

    let normalizedFolder = null;
    try {
      normalizedFolder = normalizeFolderPath(folderPath);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const result = await pool.query(
      'UPDATE parts SET file_folder = $1 WHERE id = $2 RETURNING file_folder',
      [normalizedFolder, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    res.json({ message: 'Folder updated', fileFolder: result.rows[0].file_folder });
  } catch (error) {
    console.error('Update file folder error:', error);
    res.status(500).json({ error: 'Failed to update file folder' });
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
  try {
    const { id } = req.params;
    const { actualTime } = req.body;
    const userId = req.user.id;

    // Get current part and verify assignment
    const partResult = await pool.query(
      'SELECT * FROM parts WHERE id = $1',
      [id]
    );
    
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const part = partResult.rows[0];

    // Verify user is assigned to this part
    if (part.assigned_to !== userId) {
      return res.status(403).json({ error: 'You are not assigned to this part' });
    }

    // Update part status to completed
    await pool.query(
      `UPDATE parts 
       SET status = 'completed', 
           completed_at = NOW(),
           actual_time = $1
       WHERE id = $2`,
      [actualTime || 0, id]
    );

    // End active time log
    await pool.query(
      `UPDATE time_logs 
       SET ended_at = NOW(), 
           duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE part_id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [id, userId]
    );

    res.json({ message: 'Job marked as completed successfully' });
  } catch (error) {
    console.error('Complete part error:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
};

// Get statistics
exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await pool.query(`
          SELECT 
            (SELECT COUNT(*) FROM parts WHERE assigned_to = $1 AND status = 'completed') AS completed_parts,
            (SELECT COALESCE(SUM(duration), 0) FROM time_logs WHERE user_id = $1) AS total_time,
            (SELECT part_name FROM parts 
               WHERE assigned_to = $1 AND status IN ('in_progress','assigned')
               ORDER BY updated_at DESC NULLS LAST
               LIMIT 1) AS current_part
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
            p.part_name as name,
            p.material_type as material,
            p.priority as order_position,
            p.estimated_time as target_time,
            m.material_name,
            json_build_object(
              'user_id', p.assigned_to,
              'status', CASE 
                WHEN p.status = 'in_progress' THEN 'in_progress'
                WHEN p.status = 'completed' THEN 'completed'
                ELSE 'ready'
              END
            ) as assignment,
            COALESCE(json_agg(
              DISTINCT jsonb_build_object(
                'id', f.id,
                'filename', f.filename,
                'fileType', f.file_type,
                'uploadedAt', f.uploaded_at
              )
            ) FILTER (WHERE f.id IS NOT NULL), '[]') as files
          FROM parts p
          LEFT JOIN material_stock m ON p.material_id = m.id
          LEFT JOIN files f ON p.id = f.part_id
          WHERE p.assigned_to = $1 AND p.status != 'completed'
          GROUP BY p.id, m.material_name
          ORDER BY p.priority DESC NULLS LAST, p.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get operator jobs error:', error);
    res.status(500).json({ error: 'Failed to get operator jobs' });
  }
};

// Start job (update job assignment status and unlock next in sequence)
exports.startJob = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get current part and verify assignment
    const partResult = await pool.query(
      'SELECT * FROM parts WHERE id = $1',
      [id]
    );

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const part = partResult.rows[0];

    // Verify user is assigned to this part
    if (part.assigned_to !== userId) {
      return res.status(403).json({ error: 'You are not assigned to this part' });
    }

    // Check if status allows starting
    if (part.status === 'in_progress') {
      return res.status(400).json({ error: 'Job is already in progress' });
    }

    if (part.status === 'completed') {
      return res.status(400).json({ error: 'Job is already completed' });
    }

    // Update part status to in_progress
    await pool.query(
      `UPDATE parts 
       SET status = 'in_progress', 
           started_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ 
      message: 'Job started', 
      assignment: {
        part_id: id,
        user_id: userId,
        status: 'in_progress'
      }
    });
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({ error: 'Failed to start job' });
  }
};

// ======================== WORKFLOW TRANSITIONS ========================

// Start workflow stage (move part to next stage)
exports.startWorkflowStage = async (req, res) => {
  try {
    const { partId } = req.params;
    const { stage } = req.body;

    const validStages = ['cutting', 'programming', 'machining', 'qc', 'completed'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid stage. Valid stages: ${validStages.join(', ')}` 
      });
    }

    const result = await pool.query(
      `UPDATE parts 
           SET stage = $1, 
           status = 'in_progress',
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, part_name, workflow_stage, status, batch_number`,
      [stage, partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (part_id, action, details)
       VALUES ($1, $2, $3)`,
      [partId, `started_${stage}`, `Part moved to ${stage} workflow stage`]
    );

    res.status(200).json({
      success: true,
      message: `Part moved to ${stage} stage`,
      part: result.rows[0]
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Complete workflow stage
exports.completeWorkflowStage = async (req, res) => {
  try {
    const { partId } = req.params;
    const { notes } = req.body;

    // Get current part
    const partResult = await pool.query(
      'SELECT id, workflow_stage, batch_number FROM parts WHERE id = $1',
      [partId]
    );

    if (partResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    const currentStage = partResult.rows[0].workflow_stage;
    const stageProgression = {
      'pending': 'cutting',
      'cutting': 'programming',
      'programming': 'machining',
      'machining': 'qc',
      'qc': 'completed'
    };

    const nextStage = stageProgression[currentStage] || 'completed';

    const result = await pool.query(
      `UPDATE parts 
       SET workflow_stage = $1, 
           status = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, part_name, workflow_stage, status, batch_number`,
      [nextStage, nextStage === 'completed' ? 'completed' : 'pending', partId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (part_id, action, details)
       VALUES ($1, $2, $3)`,
      [partId, `completed_${currentStage}`, `${currentStage} stage completed. ${notes || ''}`]
    );

    res.status(200).json({
      success: true,
      message: `${currentStage} stage completed, moving to ${nextStage}`,
      part: result.rows[0]
    });
  } catch (error) {
    console.error('Error completing stage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Hold part (pause workflow)
exports.holdPart = async (req, res) => {
  try {
    const { partId } = req.params;
    const { reason } = req.body;

    const result = await pool.query(
      `UPDATE parts 
       SET status = 'on-hold', hold_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, part_name, status, hold_reason`,
      [reason || '', partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    await pool.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id || null, 'part_held', 'part', partId, `Part placed on hold: ${reason || 'No reason provided'}`]
    );

    res.status(200).json({
      success: true,
      message: 'Part placed on hold',
      part: result.rows[0]
    });
  } catch (error) {
    console.error('Error holding part:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resume part from hold
exports.resumePart = async (req, res) => {
  try {
    const { partId } = req.params;

    const partResult = await pool.query(
      'SELECT stage FROM parts WHERE id = $1',
      [partId]
    );

    if (partResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    const result = await pool.query(
      `UPDATE parts 
       SET status = 'in-progress', hold_reason = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, part_name, status, stage`,
      [partId]
    );

    await pool.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id || null, 'part_resumed', 'part', partId, `Part resumed from hold in ${result.rows[0].stage} stage`]
    );

    res.status(200).json({
      success: true,
      message: 'Part resumed',
      part: result.rows[0]
    });
  } catch (error) {
    console.error('Error resuming part:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Record scrap
exports.recordScrap = async (req, res) => {
  try {
    const { partId } = req.params;
    const { quantity_scrapped, reason, notes, stage } = req.body;

    const partResult = await pool.query(
      'SELECT quantity, batch_number FROM parts WHERE id = $1',
      [partId]
    );

    if (partResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    const totalQuantity = partResult.rows[0].quantity;
    
    const result = await pool.query(
      `UPDATE parts 
       SET quantity_scrapped = quantity_scrapped + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, part_name, quantity, quantity_scrapped`,
      [quantity_scrapped, partId]
    );

    // Record in scrap table (aligns with schema columns)
    await pool.query(
      `INSERT INTO scrap_records (part_id, quantity, stage, reason, operator_id, cost_impact)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [partId, quantity_scrapped, stage || null, reason || 'unspecified', req.user?.id || null, null]
    );

    await pool.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id || null, 'scrap_recorded', 'part', partId, `${quantity_scrapped} units scrapped (${reason || 'no reason'})`]
    );

    res.status(200).json({
      success: true,
      message: 'Scrap recorded',
      part: result.rows[0]
    });
  } catch (error) {
    console.error('Error recording scrap:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
