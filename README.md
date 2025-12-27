# CNC Shop Floor Management System

A complete, production-ready shop floor management system designed for CNC manufacturing operations. Features employee authentication, sequential part access control, real-time time tracking, file management, and feedback systems.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)
![CasaOS](https://img.shields.io/badge/CasaOS-compatible-orange.svg)

## Features

### Core Functionality
- **Employee Authentication**: Secure JWT-based login system with bcrypt password hashing
- **Parts Management**: Complete CRUD operations for manufacturing parts
- **Sequential Access Control**: Lock/unlock parts based on workflow completion
- **File Management**: Upload and download PDF, DXF, and NC files
- **Time Tracking**: 
  - Session timer: Track employee work session duration
  - Job timer: Track time spent on individual parts
- **Feedback System**: Employee feedback with timestamps and user attribution
- **Statistics Dashboard**: Real-time metrics for completed parts and time spent

### Security Features
- JWT token-based authentication
- Bcrypt password hashing
- Input validation with Joi
- SQL injection prevention with parameterized queries
- File upload validation (only PDF, DXF, NC files)
- CORS protection

## Technology Stack

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Authentication**: JWT + bcrypt
- **File Upload**: Multer
- **Validation**: Joi

### Frontend
- **HTML5/CSS3**: Responsive design
- **Vanilla JavaScript**: No framework dependencies
- **Modern UI**: Clean, professional interface

### Infrastructure
- **Docker**: Multi-container setup with docker-compose
- **Nginx**: Static file serving for frontend
- **CasaOS**: One-click installation support

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM
- Ports 3000, 5000, and 5432 available

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tntvlad/cnc-shop-floor-management.git
   cd cnc-shop-floor-management
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   nano .env
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Database: localhost:5432

5. **Default Login**
   - Employee ID: `ADMIN001`
   - Password: `admin123`
   
   **⚠️ Change the default password immediately after first login!**

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=production

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cnc_shop_floor
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=8h

# File Upload
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760

# CORS
FRONTEND_URL=http://localhost:3000
```

### Port Configuration

Default ports can be changed in `docker-compose.yml`:
- Frontend: `3000:80`
- Backend: `5000:5000`
- Database: `5432:5432`

## Database Schema

### Tables

1. **users**: Employee accounts with authentication
2. **parts**: Manufacturing parts with specifications
3. **files**: Technical drawings and NC programs
4. **feedback**: Employee feedback on parts
5. **time_logs**: Job time tracking
6. **part_completions**: Completion records with actual vs target time

See [backend/db/schema.sql](backend/db/schema.sql) for complete schema.

## API Documentation

### Authentication
- `POST /api/auth/login` - Employee login
- `GET /api/auth/me` - Get current user

### Parts
- `GET /api/parts` - List all parts
- `GET /api/parts/:id` - Get part details
- `POST /api/parts` - Create new part (admin)
- `PUT /api/parts/:id` - Update part (admin)
- `DELETE /api/parts/:id` - Delete part (admin)
- `POST /api/parts/:id/complete` - Mark part as complete
- `GET /api/parts/statistics` - Get user statistics

### Files
- `GET /api/parts/:partId/files` - List part files
- `POST /api/parts/:partId/files` - Upload file
- `GET /api/files/:fileId/download` - Download file
- `DELETE /api/files/:fileId` - Delete file

### Feedback
- `GET /api/parts/:partId/feedback` - Get part feedback
- `POST /api/parts/:partId/feedback` - Add feedback

### Time Tracking
- `GET /api/time/active` - Get active timer
- `POST /api/parts/:partId/timer/start` - Start job timer
- `POST /api/parts/:partId/timer/stop` - Stop job timer
- `GET /api/parts/:partId/timelogs` - Get time logs

## Usage Guide

### For Operators

1. **Login**: Use your employee ID and password
2. **View Dashboard**: See available parts and statistics
3. **Select Part**: Click on an unlocked part card
4. **Download Files**: Access PDF drawings, DXF files, and NC programs
5. **Start Timer**: Begin tracking time when starting work
6. **Add Feedback**: Provide notes or issues encountered
7. **Complete Part**: Stop timer and mark as complete
8. **Next Part**: System automatically unlocks the next part in sequence

### For Administrators

1. **Add Parts**: Create new parts with specifications
2. **Upload Files**: Attach technical documents to parts
3. **Set Sequence**: Define order with `order_position`
4. **Monitor Progress**: View completion statistics
5. **Manage Users**: Create employee accounts (via database)

## CasaOS Installation

### One-Click Install

1. Open CasaOS App Store
2. Search for "CNC Shop Floor Management"
3. Click Install
4. Wait for deployment to complete
5. Access via the provided URL

### Manual Import

1. Copy `casaos-config.yml` to your CasaOS
2. Import as custom app
3. Configure volume mappings
4. Start the application

## Development

### Project Structure

```
cnc-shop-floor-management/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth & validation
│   ├── db/             # Database schema
│   ├── server.js       # Express server
│   └── package.json
├── frontend/
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   ├── index.html      # Dashboard
│   ├── login.html      # Login page
│   └── nginx.conf      # Nginx configuration
├── docker-compose.yml
├── casaos-config.yml
└── .env.example
```

### Running in Development

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
# Use any local web server, e.g.:
python -m http.server 3000
```

### Building Docker Images

```bash
# Backend
docker build -t cnc-backend:latest ./backend

# Frontend
docker build -t cnc-frontend:latest ./frontend
```

## Backup and Restore

### Backup Database

```bash
docker exec cnc-postgres pg_dump -U postgres cnc_shop_floor > backup.sql
```

### Restore Database

```bash
docker exec -i cnc-postgres psql -U postgres cnc_shop_floor < backup.sql
```

### Backup Uploaded Files

```bash
docker cp cnc-backend:/app/uploads ./uploads_backup
```

## Troubleshooting

### Database Connection Failed
- Check if PostgreSQL container is running: `docker ps`
- Verify environment variables in `.env`
- Check database logs: `docker logs cnc-postgres`

### Cannot Login
- Verify default credentials: ADMIN001 / admin123
- Check backend logs: `docker logs cnc-backend`
- Ensure JWT_SECRET is set in `.env`

### Files Not Uploading
- Check uploads directory permissions
- Verify MAX_FILE_SIZE setting
- Check backend logs for errors

### Port Already in Use
- Change ports in `docker-compose.yml`
- Stop conflicting services: `docker ps`

## Security Recommendations

1. **Change Default Credentials**: Immediately after installation
2. **Use Strong JWT Secret**: Generate a secure random string
3. **Enable HTTPS**: Use a reverse proxy (nginx/traefik) with SSL
4. **Regular Backups**: Schedule automated database backups
5. **Update Dependencies**: Keep Docker images updated
6. **Network Isolation**: Use Docker networks for service isolation
7. **File Size Limits**: Configure appropriate upload limits

## Performance Optimization

- Database connection pooling (20 connections)
- Nginx gzip compression enabled
- Static asset caching (1 year)
- Efficient database indexes
- Health checks for all services

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/yourusername/cnc-shop-floor-management/issues)
- Documentation: [Wiki](https://github.com/yourusername/cnc-shop-floor-management/wiki)

## Roadmap

- [ ] Multi-tenant support
- [ ] Advanced reporting and analytics
- [ ] Mobile app (iOS/Android)
- [ ] Real-time notifications
- [ ] Integration with ERP systems
- [ ] Barcode/QR code scanning
- [ ] Machine monitoring integration

## Acknowledgments

- Icons from [Flaticon](https://www.flaticon.com/)
- Built with open-source technologies
- Inspired by modern manufacturing needs

---

**Made with ❤️ for the CNC manufacturing community**
CNC Shop Floor Management System with time tracking and file distribution
