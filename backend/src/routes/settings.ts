import { Router, Request, Response } from 'express';
import { dbGet, dbRun } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const settingsRouter = Router();

/**
 * GET /api/settings
 * Ruft App-Einstellungen ab (Session-Timeout, Sprache)
 */
settingsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await dbGet(`SELECT * FROM app_settings ORDER BY id DESC LIMIT 1`) as {
      session_timeout_minutes?: number;
      default_language?: string;
      theme?: string;
    } | undefined;

    if (!settings) {
      // Standardeinstellungen erstellen
      await dbRun(
        `INSERT INTO app_settings (session_timeout_minutes, default_language, theme)
         VALUES (?, ?, ?)`,
        [30, 'en', 'light']
      );
      const newSettings = await dbGet(`SELECT * FROM app_settings ORDER BY id DESC LIMIT 1`) as {
        session_timeout_minutes: number;
        default_language: string;
        theme: string;
      };
      return res.json({
        sessionTimeoutMinutes: newSettings.session_timeout_minutes,
        language: newSettings.default_language,
        theme: newSettings.theme || 'light',
      });
    }

    res.json({
      sessionTimeoutMinutes: settings.session_timeout_minutes || 30,
      language: settings.default_language || 'en',
      theme: settings.theme || 'light',
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Einstellungen:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Einstellungen' });
  }
});

/**
 * PUT /api/settings
 * Aktualisiert App-Einstellungen
 */
settingsRouter.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { sessionTimeoutMinutes, language, theme } = req.body;

    // Validierung
    if (sessionTimeoutMinutes !== undefined && (sessionTimeoutMinutes < 5 || sessionTimeoutMinutes > 480)) {
      return res.status(400).json({ error: 'Session timeout must be between 5 and 480 minutes' });
    }

    if (language && !['en', 'de'].includes(language)) {
      return res.status(400).json({ error: 'Language must be "en" or "de"' });
    }

    if (theme && !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'Theme must be "light" or "dark"' });
    }

    const existing = await dbGet(`SELECT * FROM app_settings ORDER BY id DESC LIMIT 1`) as { id?: number } | undefined;

    if (existing && existing.id) {
      const updates: string[] = [];
      const values: any[] = [];

      if (sessionTimeoutMinutes !== undefined) {
        updates.push('session_timeout_minutes = ?');
        values.push(sessionTimeoutMinutes);
      }

      if (language) {
        updates.push('default_language = ?');
        values.push(language);
      }

      if (theme) {
        updates.push('theme = ?');
        values.push(theme);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(existing.id);

        await dbRun(
          `UPDATE app_settings SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }
    } else {
      await dbRun(
        `INSERT INTO app_settings (session_timeout_minutes, default_language, theme)
         VALUES (?, ?, ?)`,
        [sessionTimeoutMinutes || 30, language || 'en', theme || 'light']
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Einstellungen:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Einstellungen' });
  }
});

