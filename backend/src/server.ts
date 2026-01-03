import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import crypto from 'crypto';
import { containerRouter } from './routes/containers';
import { updateRouter } from './routes/updates';
import { scheduleRouter } from './routes/schedule';
import { notificationRouter } from './routes/notifications';
import { logRouter } from './routes/logs';
import { backupRouter } from './routes/backups';
import { excludedRouter } from './routes/excluded';
import { authRouter } from './routes/auth';
import { settingsRouter } from './routes/settings';
import { updateStrategiesRouter } from './routes/updateStrategies';
import { dashboardRouter } from './routes/dashboard';
import { initializeDatabase } from './database/db';
import { initializeDocker } from './services/dockerService';
import { startScheduler } from './services/schedulerService';
import { initializePassword } from './services/authService';
import { logger } from './utils/logger';
import { requireAuth } from './middleware/auth';

// Load .env from backend directory or root directory
// In Docker, environment variables are set via docker-compose.yml (env_file)
// In development, try to load from backend/.env
if (process.env.NODE_ENV !== 'production' || !process.env.SMTP_HOST) {
  dotenv.config({ path: path.join(__dirname, '../.env') }); // backend/.env
  dotenv.config({ path: path.join(__dirname, '../../.env') }); // Fallback to root/.env
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS-Konfiguration - erlaube Credentials für Session
// In Production sollte die Origin auf die tatsächliche Domain gesetzt werden
const corsOrigin = process.env.FRONTEND_URL || true; // true erlaubt alle Origins (für Docker)
app.use(cors({
  origin: corsOrigin as string | boolean,
  credentials: true,
}));

app.use(express.json());

// Session-Konfiguration
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const sessionTimeoutMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10);

// SQLite Session Store für Production
const SQLiteStoreSession = SQLiteStore(session);
const sessionStore = new SQLiteStoreSession({
  db: 'sessions.db',
  dir: './data',
  table: 'sessions'
});

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'docker-dashboard.sid',
  store: sessionStore as any,
  cookie: {
    secure: false, // Für HTTP in Docker (in Production auf true setzen bei HTTPS)
    httpOnly: true,
    maxAge: sessionTimeoutMinutes * 60 * 1000, // Minuten in Millisekunden
    sameSite: 'lax',
    path: '/',
  },
}));

// Public Routes (keine Authentifizierung erforderlich)
app.use('/api/auth', authRouter);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected Routes (authentication required)
app.use('/api/containers', requireAuth, containerRouter);
app.use('/api/updates', requireAuth, updateRouter);
app.use('/api/schedule', requireAuth, scheduleRouter);
app.use('/api/notifications', requireAuth, notificationRouter);
app.use('/api/logs', requireAuth, logRouter);
app.use('/api/backups', requireAuth, backupRouter);
app.use('/api/excluded', requireAuth, excludedRouter);
app.use('/api/settings', settingsRouter); // Settings has its own requireAuth
app.use('/api/update-strategies', requireAuth, updateStrategiesRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

// Statische Dateien für Frontend
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Alle anderen Routen an Frontend weiterleiten (für React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Initialize services
async function startServer() {
  try {
    await initializeDatabase();
    
    // Initialisiere Passwort beim ersten Start
    const generatedPassword = await initializePassword();
    
    await initializeDocker();
    startScheduler();
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      if (generatedPassword) {
        console.log('');
        console.log('⚠️  IMPORTANT: Please note the password shown above!');
        console.log('');
        logger.info('');
        logger.info('⚠️  IMPORTANT: Please note the password shown above!');
        logger.info('');
      }
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();
