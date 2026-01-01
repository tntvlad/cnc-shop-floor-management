const { execSync } = require('child_process');
const pool = require('../config/database');
const { LEVELS, getLevelName } = require('../middleware/permissions');

// Get git releases/tags (admin only)
exports.getGitReleases = async (req, res) => {
  try {
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can view releases. Your level: ${getLevelName(req.user.level)}`
      });
    }

    try {
      // Mark directory as safe
      execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });

      // Fetch tags from remote
      execSync('git fetch --tags origin 2>&1', {
        encoding: 'utf-8',
        cwd: '/app/project',
        timeout: 30000
      });

      // Get all tags sorted by version (newest first)
      const tagsOutput = execSync('git tag -l --sort=-version:refname', {
        encoding: 'utf-8',
        cwd: '/app/project'
      }).trim();

      const tags = tagsOutput ? tagsOutput.split('\n').filter(t => t.trim()) : [];

      // Get details for each tag (limit to last 10)
      const releases = [];
      for (const tag of tags.slice(0, 10)) {
        try {
          const date = execSync(`git log -1 --format=%ci ${tag}`, {
            encoding: 'utf-8',
            cwd: '/app/project'
          }).trim();

          const commit = execSync(`git rev-list -n 1 ${tag}`, {
            encoding: 'utf-8',
            cwd: '/app/project'
          }).trim().substring(0, 7);

          releases.push({
            tag,
            commit,
            date
          });
        } catch (e) {
          // Skip tags with errors
        }
      }

      // Get current tag if on a release
      let currentTag = null;
      try {
        currentTag = execSync('git describe --tags --exact-match 2>/dev/null || echo ""', {
          encoding: 'utf-8',
          cwd: '/app/project'
        }).trim();
      } catch (e) {
        currentTag = null;
      }

      res.json({
        releases,
        currentTag: currentTag || null
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get releases',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Get releases error:', error);
    res.status(500).json({ error: 'Failed to get releases' });
  }
};

// Checkout specific release/tag (admin only)
exports.checkoutRelease = async (req, res) => {
  try {
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can checkout releases. Your level: ${getLevelName(req.user.level)}`
      });
    }

    const tag = req.body?.tag;
    if (!tag) {
      return res.status(400).json({ error: 'Tag is required' });
    }

    try {
      // Mark directory as safe
      execSync('git config --global --add safe.directory /app/project 2>/dev/null || true', { encoding: 'utf-8' });

      // Fetch latest tags
      execSync('git fetch --tags origin 2>&1', {
        encoding: 'utf-8',
        cwd: '/app/project',
        timeout: 30000
      });

      // Checkout the tag
      const output = execSync(`git checkout tags/${tag} 2>&1`, {
        encoding: 'utf-8',
        cwd: '/app/project',
        timeout: 30000
      });

      res.json({
        message: `Checked out release ${tag}`,
        output
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to checkout release',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Checkout release error:', error);
    res.status(500).json({ error: 'Failed to checkout release' });
  }
};

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

// Restart services (admin only) - now rebuilds containers
exports.restartServices = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.level !== LEVELS.ADMIN) {
      return res.status(403).json({
        error: `Only Admin (500) can restart services. Your level: ${getLevelName(req.user.level)}`
      });
    }

    try {
      // Detect Docker Compose command (V1 vs V2)
      let composeCmd = 'docker compose';
      try {
        execSync('docker compose version', { encoding: 'utf-8' });
      } catch {
        composeCmd = 'docker-compose';
      }

      // Rebuild and restart containers to pick up any code changes
      const output = execSync(`${composeCmd} up -d --build 2>&1`, {
        encoding: 'utf-8',
        timeout: 120000,
        cwd: '/app/project'
      });

      res.json({
        message: 'Services rebuilding and restarting. Please wait for them to come back online.',
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

      // Drop all tables first to allow clean restore
      console.log('Dropping existing tables for clean restore...');
      const dropTablesSQL = `
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `;
      execSync(
        `PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${dbHost} -U ${dbUser} -d ${dbName} -c "${dropTablesSQL}"`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      console.log('Tables dropped, restoring from backup...');

      // Execute SQL file
      const output = execSync(
        `PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${dbHost} -U ${dbUser} -d ${dbName} -f ${tempFile} 2>&1`,
        {
          encoding: 'utf-8',
          timeout: 120000
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      console.log('Database restore completed');
      res.json({
        message: 'Database restored successfully',
        output
      });
    } catch (error) {
      console.error('Restore error:', error.message);
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
