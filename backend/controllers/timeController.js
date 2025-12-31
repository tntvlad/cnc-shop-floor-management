const pool = require('../config/database');

// Start time log
exports.startTimer = async (req, res) => {
  try {
    const { partId } = req.params;
    const userId = req.user.id;
    const stage = req.body.stage || 'machining';

    // Check if there's already an active timer
    const activeTimer = await pool.query(
      'SELECT * FROM time_logs WHERE user_id = $1 AND ended_at IS NULL',
      [userId]
    );

    if (activeTimer.rows.length > 0) {
      return res.status(400).json({ error: 'Timer already running for another part' });
    }

    // Start new timer
    const result = await pool.query(
      'INSERT INTO time_logs (user_id, part_id, stage, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [userId, partId, stage]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
};

// Stop time log
exports.stopTimer = async (req, res) => {
  try {
    const { partId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE time_logs 
       SET ended_at = NOW(), 
           duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE user_id = $1 AND part_id = $2 AND ended_at IS NULL
       RETURNING *`,
      [userId, partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active timer found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
};

// Get active timer
exports.getActiveTimer = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT tl.*, p.part_name
       FROM time_logs tl
       JOIN parts p ON tl.part_id = p.id
       WHERE tl.user_id = $1 AND tl.ended_at IS NULL
       ORDER BY tl.started_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get active timer error:', error);
    res.status(500).json({ error: 'Failed to get timer' });
  }
};

// Get time logs for part
exports.getPartTimeLogs = async (req, res) => {
  try {
    const { partId } = req.params;

    const result = await pool.query(
      `SELECT tl.*, u.name as user_name
       FROM time_logs tl
       JOIN users u ON tl.user_id = u.id
       WHERE tl.part_id = $1
       ORDER BY tl.started_at DESC`,
      [partId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get time logs error:', error);
    res.status(500).json({ error: 'Failed to get time logs' });
  }
};
