import { Request, Response, NextFunction } from 'express';

// Erweitere Express Request um session
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    username?: string;
    lastActivity?: number;
  }
}

/**
 * Middleware zum Prüfen der Authentifizierung
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.authenticated) {
    res.status(401).json({ error: 'Unauthorized', message: 'Bitte melden Sie sich an' });
    return;
  }

  // Prüfe Session-Timeout (nur wenn lastActivity gesetzt ist)
  const now = Date.now();
  const sessionTimeout = req.session.cookie.maxAge || 30 * 60 * 1000; // Standard: 30 Minuten
  const lastActivity = req.session.lastActivity;
  
  if (lastActivity) {
    if (now - lastActivity > sessionTimeout) {
      // Session abgelaufen
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
      res.status(401).json({ error: 'Session expired', message: 'Ihre Session ist abgelaufen. Bitte melden Sie sich erneut an.' });
      return;
    }
  }

  // Aktualisiere letzte Aktivität
  req.session.lastActivity = now;
  next();
}

/**
 * Middleware zum Prüfen, ob Benutzer bereits eingeloggt ist (für Login-Route)
 */
export function requireNotAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.authenticated) {
    res.status(400).json({ error: 'Already authenticated', message: 'Sie sind bereits angemeldet' });
    return;
  }
  next();
}

