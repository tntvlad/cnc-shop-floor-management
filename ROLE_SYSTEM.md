# CNC Shop Floor Management - Role Hierarchy System

## Overview

The system now uses a **hierarchical level-based permission system** (50-500) instead of simple role names. Each level grants specific permissions and capabilities.

## Permission Levels & Capabilities

### Level 50 - Customer (Future Feature)
**Description:** External customers who can track their orders
- View only their own orders
- See progress of their jobs
- View estimated completion dates
- Download completed part files
- **Cannot:** edit or interact with jobs
- **Created by:** Admin (500) only

### Level 100 - CNC Operator
**Description:** Primary machine operators
- View **ONLY** their assigned jobs (read-only for others)
- Can start/complete assigned jobs
- Track time per job (required)
- Can skip/jump to next job **WITH mandatory explanation**
- Add feedback on jobs
- **Cannot:** view other operators' jobs or job assignments
- **Created by:** Supervisor (400+) and Admin (500)

### Level 200 - Cutting Material Operator
**Description:** Specialized cutting/material operators
- View **ALL** jobs in the system
- Can start/complete assigned cutting jobs only
- Track time on cutting jobs
- Add notes/feedback on jobs
- View material inventory (future feature)
- **Cannot:** operate machines outside cutting domain
- **Created by:** Supervisor (400+) and Admin (500)

### Level 300 - Quality Control
**Description:** Quality assurance and inspection personnel
- View jobs completed by operators
- Can approve/reject completed jobs
- Add quality notes and feedback to jobs
- View operator performance metrics
- **Cannot:** create, assign, or start jobs
- **Cannot:** create or manage users
- **Created by:** Supervisor (400+) and Admin (500)

### Level 400 - Supervisor
**Description:** Production supervisors and team leads
- Create, assign, and edit jobs
- View all jobs with advanced filters:
  - Completed jobs
  - In progress jobs
  - Next jobs (queued)
  - To be assigned (unassigned)
  - Date range filter (from → to dates)
  - Filter by operator name/ID
  - Filter by status
- Reassign jobs between operators
- View all operator statistics and performance metrics
- **Create users** with level ≤ 400 (cannot create Admins)
- **Create categories/job templates** (future)
- **Cannot:** perform system-level operations (git pull, restart services)
- **Created by:** Supervisor (400+) and Admin (500)

### Level 500 - Admin (Super Admin)
**Description:** System administrators with full access
- **Full system access** - all capabilities
- Create users with any level ≤ 500
- Create/edit/delete all categories and jobs
- View all statistics and reports
- System configuration access
- Git pull and code updates
- Restart services via web interface
- Manage all user accounts
- **Created by:** Current Admin (500) only

## Permission Hierarchy Rules

### User Creation
- **Users can only create other users with level ≤ their own level**
- A Level 400 Supervisor can create: Operators (100), Cutting Operators (200), QC (300), and other Supervisors (400)
- A Level 400 Supervisor **cannot** create an Admin (500)
- An Admin (500) can create anyone at any level

### User Deletion
- **Users can only delete other users with level ≤ their own level**
- **Cannot delete your own account**
- Requires Supervisor level (400+) minimum

### Admin Panel Access
- **Requires:** Level 400+ (Supervisor or Admin)
- **Admin Settings button** only visible to level 400+ users
- Git pull and service restart: **Admin (500) only**

## Database Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 100,  -- 50, 100, 200, 300, 400, or 500
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## JWT Token Structure

When a user logs in, the token contains:
```json
{
  "id": 1,
  "employeeId": "OP001",
  "name": "John Operator",
  "level": 100,
  "iat": 1234567890,
  "exp": 1234605890
}
```

## API Endpoints & Permission Requirements

### Authentication
- `POST /api/auth/login` - No auth required
- `GET /api/auth/me` - Authenticated only
- `POST /api/auth/users` - Requires Supervisor (400+)
- `GET /api/auth/users` - Requires Supervisor (400+)
- `DELETE /api/auth/users/:id` - Requires Supervisor (400+)

### Admin
- `POST /api/admin/git-pull` - Requires Admin (500)
- `POST /api/admin/restart` - Requires Admin (500)

## Frontend Components

### Login Page (`login.html`)
- No level-based restrictions
- Default admin (ADMIN001) redirects to first-setup page

### First Setup (`first-setup.html`)
- Must be ADMIN001 (default admin)
- Creates new Admin level (500) user
- Deletes default ADMIN001 account

### Dashboard (`index.html`)
- Admin link visible for level 400+
- Shows user's assigned/available jobs based on level

### Admin Settings (`admin-settings.html`)
- Access restricted to level 400+ (Supervisor+)
- User creation form shows available levels
- Level description hints for each level

### Create User Page (`create-user.html`)
- Restricted to level 400+
- Shows only available levels for creation

## Migration from Old System

Old `role` field values → New `level` values:
- `'operator'` → `100` (CNC Operator)
- `'supervisor'` → `400` (Supervisor)
- `'admin'` → `500` (Admin)

## Permissions Helper Module

**File:** `backend/middleware/permissions.js`

Exports:
```javascript
// Constants
LEVELS.CNC_OPERATOR = 100
LEVELS.CUTTING_OPERATOR = 200
LEVELS.QUALITY_CONTROL = 300
LEVELS.SUPERVISOR = 400
LEVELS.ADMIN = 500

// Functions
hasLevel(userLevel, requiredLevel) // Check minimum level
canAssignLevel(creatorLevel, targetLevel) // Can create/edit user
getLevelName(level) // Get display name
requireLevel(level) // Express middleware
requireAdmin() // Express middleware (500 only)
requireSupervisor() // Express middleware (400+)
```

## Frontend Permissions Config

**File:** `frontend/js/permissions-config.js`

Provides client-side permission constants and utility functions for UI logic.

## Implementation Notes

1. **Backward Compatibility:** Existing databases will need migration (update `role` → `level`)
2. **JWT Claims:** Token includes `level` instead of `role`
3. **Middleware:** Uses `permissions.js` module for centralized permission logic
4. **Frontend:** UI components check user level for visibility/interactivity
5. **Audit Trail:** `created_by` field tracks who created each user

## Testing Checklist

- [ ] Admin can create all levels (100-500)
- [ ] Supervisor can create levels 100-400 but not 500
- [ ] Operator level 100 cannot access user creation
- [ ] QC level 300 cannot create/assign jobs
- [ ] Users can only see jobs appropriate to their level
- [ ] Admin panel restricted to 400+
- [ ] Git/restart operations only for level 500
- [ ] Cannot delete own account
- [ ] Cannot create user with level > own level
