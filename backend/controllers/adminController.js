const { execSync } = require('child_process');
const pool = require('../config/database');
const { LEVELS, getLevelName } = require('../middleware/permissions');

// Get current git branch (admin only)
exports.getGitBranch = async (req, res) => {
  try {
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can view git branch. Your level: ${getLevelName(req.user.level)}`
      });
    }

    // Mark directory as safe
    execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      cwd: '/app/project'
    }).trim();

    res.json({ branch });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get git branch', details: error.message });
  }
};

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
      // Mark directory as safe and configure git
      execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });
      execSync('git config --global user.email "admin@cnc-shop.local" 2>/dev/null || true', {
        encoding: 'utf-8',
        cwd: '/app/project'
      });
      execSync('git config --global user.name "CNC Admin" 2>/dev/null || true', {
        encoding: 'utf-8',
        cwd: '/app/project'
      });

      // Get current branch and pull from it
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      const output = execSync(`cd /app/project && git pull origin ${currentBranch} --no-edit 2>&1`, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      });

      res.json({
        message: `Git pull from ${currentBranch} completed successfully`,
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

// Switch git branch (admin only)
exports.switchBranch = async (req, res) => {
  try {
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can switch branch. Your level: ${getLevelName(req.user.level)}`
      });
    }

    const branch = (req.body && req.body.branch) ? String(req.body.branch) : 'main';
    if (!['main', 'beta'].includes(branch)) {
      return res.status(400).json({ error: 'Invalid branch. Allowed: main, beta' });
    }

    try {
      // Mark directory as safe
      execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });

      const cmds = [
        'git fetch origin 2>&1',
        `git checkout ${branch} 2>&1`,
        `git pull origin ${branch} --no-edit 2>&1`
      ];

      let output = '';
      cmds.forEach(cmd => {
        output += execSync(cmd, { encoding: 'utf-8', cwd: '/app/project', timeout: 60000 });
      });

      const current = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', cwd: '/app/project' }).trim();

      res.json({ message: `Switched to ${current}`, output });
    } catch (error) {
      res.status(500).json({ error: 'Branch switch failed', details: error.message });
    }
  } catch (error) {
    console.error('Switch branch error:', error);
    res.status(500).json({ error: 'Failed to switch branch' });
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
        cwd: '/app/project'
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

// Database backup (admin only)
exports.databaseBackup = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can backup database. Your level: ${getLevelName(req.user.level)}`
      });
    }

    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `cnc_backup_${timestamp}.sql`;
      const dbName = process.env.DB_NAME || 'cnc_shop_floor';
      const dbUser = process.env.DB_USER || 'postgres';
      const dbHost = process.env.DB_HOST || 'postgres';

      // Use pg_dump to create backup
      const output = execSync(
        `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${dbHost} -U ${dbUser} ${dbName}`,
        {
          encoding: 'utf-8',
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024 // 10MB
        }
      );

      // Send the SQL file as download
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(output);
    } catch (error) {
      res.status(500).json({
        error: 'Backup failed',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
};

// Database restore (admin only)
exports.databaseRestore = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can restore database. Your level: ${getLevelName(req.user.level)}`
      });
    }

    if (!req.body || !req.body.sqlContent) {
      return res.status(400).json({ error: 'SQL content is required' });
    }

    try {
      const dbName = process.env.DB_NAME || 'cnc_shop_floor';
      const dbUser = process.env.DB_USER || 'postgres';
      const dbHost = process.env.DB_HOST || 'postgres';
      const fs = require('fs');
      const path = require('path');

      // Write SQL to temp file
      const tempFile = path.join('/tmp', `restore_${Date.now()}.sql`);
      fs.writeFileSync(tempFile, req.body.sqlContent, 'utf-8');

      // Execute SQL file
      const output = execSync(
        `PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${dbHost} -U ${dbUser} -d ${dbName} -f ${tempFile}`,
        {
          encoding: 'utf-8',
          timeout: 120000
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      res.json({
        message: 'Database restored successfully',
        output
      });
    } catch (error) {
      res.status(500).json({
        error: 'Restore failed',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore database' });
  }
};

// Check for updates (admin only)
exports.checkForUpdates = async (req, res) => {
  try {
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can check for updates. Your level: ${getLevelName(req.user.level)}`
      });
    }

    try {
      // Mark directory as safe
      execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });

      // Get current branch
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      // Get local commit
      const localCommit = execSync('git rev-parse HEAD', {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      const localCommitShort = localCommit.substring(0, 7);

      // Get local commit date
      const localDate = execSync('git log -1 --format=%ci', {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      // Fetch remote
      execSync('git fetch origin 2>&1', {
        encoding: 'utf-8',
        cwd: '/app/project',
        timeout: 30000
      });

      // Get remote commit
      const remoteCommit = execSync(`git rev-parse origin/${branch}`, {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      const remoteCommitShort = remoteCommit.substring(0, 7);

      // Get remote commit date
      const remoteDate = execSync(`git log -1 --format=%ci origin/${branch}`, {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      // Count commits behind
      const behindCount = execSync(`git rev-list HEAD..origin/${branch} --count`, {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      const updateAvailable = localCommit !== remoteCommit;

      res.json({
        branch,
        local: {
          commit: localCommitShort,
          date: localDate
        },
        remote: {
          commit: remoteCommitShort,
          date: remoteDate
        },
        updateAvailable,
        commitsBehind: parseInt(behindCount, 10) || 0
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to check for updates',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Check updates error:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
};
