/**
 * Permission levels and role descriptions
 * Hierarchical level-based permission system (1-500)
 */

const LEVELS = {
  CUSTOMER: 50,
  CNC_OPERATOR: 100,
  CUTTING_OPERATOR: 200,
  QUALITY_CONTROL: 300,
  SUPERVISOR: 400,
  ADMIN: 500
};

const LEVEL_NAMES = {
  50: 'Customer',
  100: 'CNC Operator',
  200: 'Cutting Operator',
  300: 'Quality Control',
  400: 'Supervisor',
  500: 'Admin'
};

const LEVEL_DESCRIPTIONS = {
  50: 'Can view own orders and job progress',
  100: 'Can view assigned jobs, start/complete work, track time',
  200: 'Can view all jobs, start/complete cutting jobs, track time',
  300: 'Can review and approve/reject completed jobs, add quality notes',
  400: 'Can create jobs, assign work, view statistics, create users up to level 400',
  500: 'Full system access, can create any user, manage all data'
};

/**
 * Check if user has minimum required level
 * @param {number} userLevel - User's permission level
 * @param {number} requiredLevel - Minimum required level
 * @returns {boolean} True if user meets requirement
 */
function hasLevel(userLevel, requiredLevel) {
  return userLevel >= requiredLevel;
}

/**
 * Check if user can create/edit other users
 * @param {number} creatorLevel - Level of user creating/editing
 * @param {number} targetLevel - Level being assigned
 * @returns {boolean} True if creator can assign this level
 */
function canAssignLevel(creatorLevel, targetLevel) {
  // Users can only create/assign users with level <= their own level
  return targetLevel <= creatorLevel;
}

/**
 * Get role name from level
 * @param {number} level - Permission level
 * @returns {string} Role name
 */
function getLevelName(level) {
  return LEVEL_NAMES[level] || 'Unknown';
}

/**
 * Middleware: Check if user has minimum level
 * @param {number} requiredLevel - Minimum required level
 * @returns {Function} Express middleware
 */
function requireLevel(requiredLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasLevel(req.user.level, requiredLevel)) {
      return res.status(403).json({
        error: `Insufficient permissions. Required level: ${getLevelName(requiredLevel)} (${requiredLevel})`,
        currentLevel: req.user.level
      });
    }

    next();
  };
}

/**
 * Middleware: Check if user is admin (level 500)
 * @returns {Function} Express middleware
 */
function requireAdmin() {
  return requireLevel(LEVELS.ADMIN);
}

/**
 * Middleware: Check if user is supervisor or above
 * @returns {Function} Express middleware
 */
function requireSupervisor() {
  return requireLevel(LEVELS.SUPERVISOR);
}

module.exports = {
  LEVELS,
  LEVEL_NAMES,
  LEVEL_DESCRIPTIONS,
  hasLevel,
  canAssignLevel,
  getLevelName,
  requireLevel,
  requireAdmin,
  requireSupervisor
};
