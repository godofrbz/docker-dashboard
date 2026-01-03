# Docker Dashboard

A comprehensive web-based dashboard for managing Docker containers with advanced features including automatic updates, backup management, scheduling, and monitoring.

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)

## Features

### 🐳 Container Management
- View all Docker containers with real-time status
- Start, stop, and manage containers
- Container statistics and monitoring
- Quick actions from dashboard

### 🔄 Update Management
- **Available Updates**: Check for and apply container image updates
- **Update Strategies**: Configure per-container update policies
  - **Manual**: Updates require manual approval
  - **Auto**: Updates are applied automatically (when implemented)
  - **Scheduled**: Updates follow schedule settings
- **Bulk Operations**: Select and update multiple containers at once
- **Container Exclusion**: Exclude specific containers from automatic updates

### 💾 Backup Management
- **Automatic Backups**: Created before each update
- **Manual Backups**: Create backups on-demand from dashboard
- **Backup Verification**: Verify backup integrity and update success
- **Backup Restoration**: Restore containers from backups
- **Backup Cleanup**: Delete old backups after successful updates

### 📅 Scheduling
- Schedule automatic update checks
- Configure schedules per container or globally
- Cron-based scheduling
- Enable/disable schedules

### 📊 Monitoring & Logs
- View container logs and application activity
- Filter logs by container, action, and status
- Real-time log updates

### ⚙️ Settings
- **Security**: Change password, configure session timeout
- **Localization**: English and German language support
- **Theme**: Light and Dark mode with persistence
- **Notifications**: Email notifications for important events
- **SMTP Configuration**: Configure email notifications

## Screenshots

*Add screenshots here*

## Prerequisites

- Docker and Docker Compose installed
- Port 3001 available
- Access to Docker socket (`/var/run/docker.sock`)

## Quick Start

### 1. Clone the Repository

```bash
git clone git@github.com:godofrbz/docker-dashboard.git
cd docker-dashboard
```

### 2. Configure Environment Variables

Create `backend/.env` file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your settings:

```env
PORT=3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Session Configuration
SESSION_SECRET=your-random-secret-key
SESSION_TIMEOUT_MINUTES=30

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001
```

### 3. Start the Application

```bash
docker-compose up -d --build
```

### 4. Access the Dashboard

Open your browser and navigate to:
```
http://localhost:3001
```

### 5. Login

**Default Credentials:**
- **Username**: `admin`
- **Password**: Check the console output for the generated password (first run only)

**⚠️ Important**: Change the password immediately after first login!

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Use SSL/TLS | `false` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `SESSION_SECRET` | Session encryption secret | Auto-generated |
| `SESSION_TIMEOUT_MINUTES` | Session timeout | `30` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3001` |

### Volumes

The application uses the following volumes:
- `./data` - Application data and SQLite database
- `./logs` - Application logs
- `./backups` - Container backups

## Usage Guide

### Dashboard

- **Container Overview**: View all containers with status indicators
- **Quick Actions**: 
  - Click container name to view statistics
  - Toggle update exclusion per container
  - Create manual backups
- **Statistics**: See total, running, and stopped containers

### Updates

#### Available Updates Tab
- View all containers with available updates
- Apply updates individually or in bulk
- Exclude containers from updates

#### Update Strategies Tab
- Configure update policies for each container
- **Bulk Edit**: Select multiple containers and apply settings at once
- Settings:
  - **Update Policy**: Manual, Auto, or Scheduled
  - **Auto Rollback**: Automatically rollback on failure
  - **Rollback on Failure**: Rollback if update fails

### Backups

- View all backups with metadata
- **Verify**: Check if update was successful
- **Restore**: Restore container from backup
- **Delete**: Remove backups (only if update was successful)
- **Bulk Operations**: Select and delete multiple backups

### Schedule

- Create schedules for automatic update checks
- Configure day, hour, and minute
- Enable/disable schedules
- View last run and next run times

### Logs

- View all application logs
- Filter by container, action, or status
- Search functionality
- Download logs

### Settings

- **Security**: Change password
- **Session**: Configure timeout
- **Language**: Switch between English and German
- **Theme**: Toggle between Light and Dark mode
- **Email**: Configure SMTP settings and send test emails

## Project Structure

```
docker-dashboard/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── database/       # Database management
│   │   ├── middleware/     # Authentication middleware
│   │   └── utils/          # Utilities
│   ├── package.json
│   └── .env.example
├── frontend/                # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── contexts/       # React contexts
│   │   └── i18n/           # Translations (en/de)
│   └── package.json
├── data/                    # Application data (gitignored)
├── logs/                    # Application logs (gitignored)
├── backups/                 # Container backups (gitignored)
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile              # Docker build file
├── .gitignore              # Git ignore rules
├── .env.example            # Environment variables example
└── README.md               # This file
```

## Development

### Building from Source

```bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend
cd frontend
npm install
npm start
```

### Running Tests

```bash
# Run test script
./test-all.sh
```

## Security

- ✅ Session-based authentication
- ✅ Password hashing with bcrypt
- ✅ All API routes require authentication
- ✅ SQLite session store (production-ready)
- ✅ Secure cookie settings
- ⚠️ Change default password after first login
- ⚠️ Use HTTPS in production
- ⚠️ Set strong `SESSION_SECRET` in production

## Troubleshooting

### Container won't start

```bash
# Check Docker socket permissions
ls -l /var/run/docker.sock

# Check if port is in use
lsof -i :3001

# View logs
docker-compose logs docker-dashboard
```

### Email notifications not working

- Verify SMTP settings in `backend/.env`
- Check firewall settings
- Test email configuration in Settings
- Check logs for SMTP errors

### Database issues

```bash
# Check database integrity
docker-compose exec docker-dashboard sqlite3 /app/data/docker-dashboard.db "PRAGMA integrity_check;"
```

### Performance issues

- Check container resource usage
- Review logs for errors
- Verify Docker daemon is running properly

## API Documentation

### Authentication

All API routes (except `/api/auth/*`) require authentication via session cookie.

### Endpoints

- `GET /api/containers` - List all containers
- `POST /api/updates/check-all` - Check all containers for updates
- `POST /api/updates/apply` - Apply update to container
- `GET /api/backups` - List all backups
- `POST /api/backups/create-manual` - Create manual backup
- `GET /api/schedule` - List all schedules
- `GET /api/logs` - Get application logs

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review the logs

## Changelog

### Version 1.0.0
- Initial release
- Container management
- Update management with strategies
- Backup management
- Scheduling
- Multi-language support (EN/DE)
- Theme support (Light/Dark)
- Email notifications

## Acknowledgments

- Built with [Docker](https://www.docker.com/)
- Frontend: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- Backend: [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- Database: [SQLite](https://www.sqlite.org/)
- UI: [Material-UI](https://mui.com/)
# docker-dashboard
# docker-dashboard
