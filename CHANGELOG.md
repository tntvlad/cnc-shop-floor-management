# Changelog

All notable changes to the CNC Shop Floor Management system will be documented in this file.

## [1.2-beta] - 2025-01-02

### 🚀 New Features

#### Per-Part Priority System
- Parts now support individual priority settings (Urgent, High, Normal, Low)
- Parts inherit order priority by default when added
- Priority can be manually adjusted per part in the Edit Order modal
- Visual emoji indicators: 🔴 Urgent, 🟠 High, 🟢 Normal, ⚪ Low
- New API endpoints:
  - `POST /api/orders/:orderId/parts` - Add part to existing order
  - `PUT /api/parts/:partId/priority` - Update individual part priority

#### Role-Based Access Control
- Operators (level < 400) now restricted to Dashboard only
- Supervisors and Admins have full access to Orders, Customers, and Admin pages
- Backend middleware protection on sensitive endpoints
- Frontend navigation dynamically hides restricted links based on user level

### 🔧 Improvements

#### Ubuntu Server Compatibility
- Updated `install.sh` and `deploy-docker.sh` for Docker Compose V2 support
- Automatic detection of `docker compose` (V2) vs `docker-compose` (V1)
- Added helpful error messages for Docker installation on Ubuntu

#### Bug Fixes
- Fixed "undefined" values in supervisor assignment modal
- Fixed "Failed to assign part" errors from schema mismatches
- Fixed order edit not saving priority, status, and customer fields
- Fixed `customers.company_name` column reference (was using incorrect `name`)
- Fixed `getPriorityMeta()` crash when handling integer priority values
- Fixed `gitBtn is null` error in admin-settings.js

### 📋 Database Schema Notes
- `parts.priority` stored as INTEGER (0=low, 1=normal, 2=high, 3=urgent)
- `orders.priority` stored as VARCHAR ('low', 'normal', 'high', 'urgent')
- Automatic conversion between formats handled by backend

### 🔐 Security
- Added `requireSupervisor()` middleware to protect:
  - `GET /api/orders`
  - `GET /api/orders/:id`
  - `GET /api/orders/stats/summary`
  - `GET /api/customers`
  - `GET /api/customers/:id`
  - `GET /api/customers/:id/contacts`

### 📚 Documentation
- Added this CHANGELOG.md
- Updated deployment scripts with version information

---

## [1.1] - Previous Release

- Initial V2 schema deployment
- Order management system
- Material stock tracking
- Workflow monitoring (6 stages)
- Machine scheduling
- Quality control checklists
- Customer management

---

## Installation

```bash
# Fresh installation
chmod +x install.sh && ./install.sh

# Upgrade existing deployment
chmod +x deploy-docker.sh && ./deploy-docker.sh
```

## Quick Start

1. Access: `http://your-server:3000`
2. Default login: `ADMIN001` / `admin123`
3. Create operators in Admin → Users
4. Start creating orders!

## Support

For issues or feature requests, please create an issue in the repository.
