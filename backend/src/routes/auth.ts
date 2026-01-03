import { Router, Request, Response } from 'express';
import { verifyPassword, changePassword } from '../services/authService';
import { logger } from '../utils/logger';
import { requireAuth, requireNotAuth } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Login-Endpunkt
 */
authRouter.post('/login', requireNotAuth, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username !== 'admin') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Session erstellen
    req.session!.authenticated = true;
    req.session!.username = username;
    req.session!.lastActivity = Date.now();

    logger.info(`User ${username} logged in`);
    
    // Sende Antwort direkt - express-session speichert automatisch
    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    logger.error('Fehler beim Login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Logout-Endpunkt
 */
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const username = req.session!.username;
    
    req.session!.destroy((err) => {
      if (err) {
        logger.error('Fehler beim Zerstören der Session:', err);
        return res.status(500).json({ error: 'Error during logout' });
      }

      logger.info(`User ${username} logged out`);
      res.json({ success: true, message: 'Logout successful' });
    });
  } catch (error) {
    logger.error('Fehler beim Logout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/check
 * Prüft, ob Benutzer authentifiziert ist
 */
authRouter.get('/check', (req: Request, res: Response) => {
  // Debug logging
  logger.info('Session check:', {
    hasSession: !!req.session,
    authenticated: req.session?.authenticated,
    username: req.session?.username,
    sessionId: req.sessionID,
  });
  
  if (req.session && req.session.authenticated) {
    // Aktualisiere letzte Aktivität
    req.session.lastActivity = Date.now();
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

/**
 * POST /api/auth/change-password
 * Ändert das Passwort
 */
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const success = await changePassword(oldPassword, newPassword);
    if (!success) {
      return res.status(401).json({ error: 'Invalid old password' });
    }

    logger.info(`Password changed for user ${req.session!.username}`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Fehler beim Ändern des Passworts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
