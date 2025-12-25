/**
 * Role/Level System Configuration
 * Hierarchical permission levels (50-500)
 */

const PERMISSION_LEVELS = {
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
  50: 'View own orders and job progress',
  100: 'View assigned jobs, start/complete work, track time',
  200: 'View all jobs, perform cutting operations, track time',
  300: 'Review and approve/reject completed jobs, add quality notes',
  400: 'Create jobs, assign work, create users up to level 400, view statistics',
  500: 'Full system access, manage all data and configurations'
};

const PERMISSIONS_BY_LEVEL = {
  50: {
    viewOwnOrders: true,
    viewOwnProgress: true,
    canModify: false,
    canManageUsers: false,
    canCreateJobs: false
  },
  100: {
    viewAssignedJobs: true,
    canStartJob: true,
    canCompleteJob: true,
    trackTime: true,
    canSkipJob: true,
    addFeedback: true,
    viewOnlyOwn: true
  },
  200: {
    viewAllJobs: true,
    canStartJob: true,
    canCompleteJob: true,
    trackTime: true,
    addFeedback: true,
    specificJobType: 'cutting'
  },
  300: {
    viewCompletedJobs: true,
    canApproveJob: true,
    canRejectJob: true,
    addQualityNotes: true,
    viewOperatorMetrics: true,
    canCreateJobs: false
  },
  400: {
    createJobs: true,
    assignJobs: true,
    editJobs: true,
    createUsers: true,
    createUserMaxLevel: 400,
    viewAllStatistics: true,
    viewAllJobs: true,
    reassignJobs: true,
    filterByStatus: true,
    filterByOperator: true,
    filterByDateRange: true
  },
  500: {
    fullAccess: true,
    systemConfiguration: true,
    createUsers: true,
    createUserMaxLevel: 500,
    deleteUsers: true,
    viewAllData: true,
    manageCategories: true,
    gitPull: true,
    restartServices: true
  }
};

/**
 * Check if user has minimum level
 * @param {number} userLevel - User's permission level
 * @param {number} requiredLevel - Minimum required level
 * @returns {boolean}
 */
function hasPermissionLevel(userLevel, requiredLevel) {
  return userLevel >= requiredLevel;
}

/**
 * Get permissions for a given level
 * @param {number} level - Permission level
 * @returns {Object} Permissions object
 */
function getPermissionsForLevel(level) {
  return PERMISSIONS_BY_LEVEL[level] || {};
}

/**
 * Check specific permission
 * @param {number} userLevel - User's permission level
 * @param {string} permission - Permission key to check
 * @returns {boolean}
 */
function hasPermission(userLevel, permission) {
  const perms = getPermissionsForLevel(userLevel);
  return perms[permission] === true;
}

/**
 * Get level name from numeric level
 * @param {number} level - Permission level
 * @returns {string} Role name
 */
function getLevelName(level) {
  return LEVEL_NAMES[level] || 'Unknown';
}

/**
 * Get level description
 * @param {number} level - Permission level
 * @returns {string} Role description
 */
function getLevelDescription(level) {
  return LEVEL_DESCRIPTIONS[level] || '';
}
