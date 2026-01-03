# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Container management dashboard
- Update management with available updates view
- Update strategies configuration (Manual, Auto, Scheduled)
- Bulk edit for update strategies
- Backup management (create, restore, verify, delete)
- Manual backup creation from dashboard
- Scheduling system for automatic update checks
- Container exclusion from updates
- Application logs viewer
- Settings page with:
  - Password change
  - Session timeout configuration
  - Language selection (English/German)
  - Theme selection (Light/Dark) with persistence
  - Email notification configuration
- Multi-language support (English/German)
- Session-based authentication
- SQLite session store for production
- Email notifications via SMTP
- Test email functionality

### Security
- Session-based authentication
- Password hashing with bcrypt
- Secure session management
- All API routes protected

### Technical
- TypeScript for type safety
- React with Material-UI
- Express.js backend
- SQLite database
- Docker Compose setup
- Multi-stage Docker build

