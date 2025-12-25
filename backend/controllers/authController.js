const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { canAssignLevel, getLevelName, LEVELS } = require('../middleware/permissions');

// Login
exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE employee_id = $1',
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        employeeId: user.employee_id,
        name: user.name,
        level: user.level
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        employeeId: user.employee_id,
        name: user.name,
        level: user.level,
        levelName: getLevelName(user.level)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, employee_id, name, level, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      ...user,
      levelName: getLevelName(user.level)
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Create new user (requires appropriate level)
exports.createUser = async (req, res) => {
  try {
    // Check if requester has minimum level to create users
    if (req.user.level < LEVELS.SUPERVISOR) {
      return res.status(403).json({
        error: `Only Supervisor (400+) and above can create users. Your level: ${getLevelName(req.user.level)}`
      });
    }

    const { employeeId, name, password, level } = req.body;

    // Validate input
    if (!employeeId || !name || !password || level === undefined) {
      return res.status(400).json({ error: 'Missing required fields: employeeId, name, password, level' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Validate level is a valid number
    if (typeof level !== 'number' || level < 50 || level > 500) {
      return res.status(400).json({
        error: 'Invalid level. Must be between 50-500 (Customer, CNC Operator, Cutting Operator, QC, Supervisor, Admin)'
      });
    }

    // Check if user can assign this level (can only assign levels <= their own)
    if (!canAssignLevel(req.user.level, level)) {
      return res.status(403).json({
        error: `You can only create users with level <= ${req.user.level}. Requested level: ${level}`,
        allowedMaxLevel: req.user.level
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (employee_id, name, password_hash, level, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, employee_id, name, level',
      [employeeId, name, passwordHash, level, req.user.id]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        ...newUser,
        levelName: getLevelName(newUser.level)
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Employee ID already exists' });
    }

    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Delete user (requires appropriate level, cannot delete yourself)
exports.deleteUser = async (req, res) => {
  try {
    // Check if requester has minimum level to delete users
    if (req.user.level < LEVELS.SUPERVISOR) {
      return res.status(403).json({
        error: `Only Supervisor (400+) and above can delete users. Your level: ${getLevelName(req.user.level)}`
      });
    }

    const userId = parseInt(req.params.userId);
    const requesterUserId = req.user.id;

    // Prevent deleting yourself
    if (userId === requesterUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get target user's level to check permissions
    const targetResult = await pool.query(
      'SELECT id, employee_id, level FROM users WHERE id = $1',
      [userId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = targetResult.rows[0];

    // Check if user can delete this level (can only delete users with level <= their own)
    if (!canAssignLevel(req.user.level, targetUser.level)) {
      return res.status(403).json({
        error: `You can only delete users with level <= ${req.user.level}. Target user level: ${targetUser.level}`
      });
    }

    // Delete user
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, employee_id, level',
      [userId]
    );

    res.json({
      message: 'User deleted successfully',
      user: {
        ...result.rows[0],
        levelName: getLevelName(result.rows[0].level)
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// List all users (Supervisor+ only)
exports.listUsers = async (req, res) => {
  try {
    if (req.user.level < LEVELS.SUPERVISOR) {
      return res.status(403).json({
        error: `Only Supervisor (400+) and above can list users`
      });
    }

    // Get all users with level <= requester's level
    const result = await pool.query(
      'SELECT id, employee_id, name, level, created_at FROM users WHERE level <= $1 ORDER BY level DESC, created_at ASC',
      [req.user.level]
    );

    const users = result.rows.map(user => ({
      ...user,
      levelName: getLevelName(user.level)
    }));

    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
};