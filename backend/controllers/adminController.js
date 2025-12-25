const { execSync } = require('child_process');
const pool = require('../config/database');
const { LEVELS, getLevelName } = require('../middleware/permissions');

// Git pull (admin only)
exports.gitPull = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can pull updates. Your level: ${getLevelName(req.user.level)}`
      });
    }

    try {
      const output = execSync('cd /app && git pull origin main 2>&1', {
        encoding: 'utf-8',
        timeout: 30000
      });

      res.json({
        message: 'Git pull completed successfully',
        output
      });
    } catch (error) {
      res.status(500).json({
        error: 'Git pull failed',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Git pull error:', error);
    res.status(500).json({ error: 'Failed to pull updates' });
  }
};

// Restart services (admin only)
exports.restartServices = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can restart services. Your level: ${getLevelName(req.user.level)}`
      });
    }

    try {
      // This will restart the Docker containers
      const output = execSync('docker-compose restart 2>&1', {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: '/app'
      });

      res.json({
        message: 'Services restarting. Please wait for them to come back online.',
        output
      });
    } catch (error) {
      res.status(500).json({
        error: 'Restart failed',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Restart error:', error);
    res.status(500).json({ error: 'Failed to restart services' });
  }
};
