const pool = require('../config/database');

// Add feedback
exports.addFeedback = async (req, res) => {
  try {
    const { partId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO feedback (part_id, user_id, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [partId, userId, text]
    );

    // Get user name for response
    const feedbackWithUser = await pool.query(
      `SELECT f.*, u.name as user_name
       FROM feedback f
       JOIN users u ON f.user_id = u.id
       WHERE f.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(feedbackWithUser.rows[0]);
  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({ error: 'Failed to add feedback' });
  }
};

// Get feedback for part
exports.getPartFeedback = async (req, res) => {
  try {
    const { partId } = req.params;

    const result = await pool.query(
      `SELECT f.*, u.name as user_name
       FROM feedback f
       JOIN users u ON f.user_id = u.id
       WHERE f.part_id = $1
       ORDER BY f.created_at DESC`,
      [partId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
};
