import { Router, Request, Response } from 'express';
import { dbGet, dbRun } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const notificationRouter = Router();

interface NotificationSettings {
  id?: number;
  email_enabled?: number;
  email_address?: string;
  web_enabled?: number;
}

// Benachrichtigungseinstellungen abrufen
notificationRouter.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await dbGet(`SELECT * FROM notification_settings ORDER BY id DESC LIMIT 1`) as NotificationSettings | undefined;
    
    if (!settings) {
      // Standardeinstellungen erstellen
      await dbRun(
        `INSERT INTO notification_settings (email_enabled, web_enabled)
         VALUES (?, ?)`,
        [0, 1]
      );
      const newSettings = await dbGet(`SELECT * FROM notification_settings ORDER BY id DESC LIMIT 1`) as NotificationSettings;
      return res.json(newSettings);
    }
    
    res.json(settings);
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Error fetching settings' });
  }
});

// Benachrichtigungseinstellungen aktualisieren
notificationRouter.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { emailEnabled, emailAddress, webEnabled } = req.body;
    
    // Prüfe ob Einstellungen existieren
    const existing = await dbGet(`SELECT * FROM notification_settings ORDER BY id DESC LIMIT 1`) as NotificationSettings | undefined;
    
    if (existing && existing.id) {
      await dbRun(
        `UPDATE notification_settings 
         SET email_enabled = ?, email_address = ?, web_enabled = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [emailEnabled ? 1 : 0, emailAddress || null, webEnabled !== undefined ? (webEnabled ? 1 : 0) : 1, existing.id]
      );
    } else {
      await dbRun(
        `INSERT INTO notification_settings (email_enabled, email_address, web_enabled)
         VALUES (?, ?, ?)`,
        [emailEnabled ? 1 : 0, emailAddress || null, webEnabled !== undefined ? (webEnabled ? 1 : 0) : 1]
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Error updating settings' });
  }
});

/**
 * POST /api/notifications/test-email
 * Sendet eine Test-E-Mail
 */
notificationRouter.post('/test-email', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await dbGet(`SELECT * FROM notification_settings ORDER BY id DESC LIMIT 1`) as NotificationSettings | undefined;

    if (!settings || !settings.email_enabled || !settings.email_address) {
      return res.status(400).json({ error: 'Email notifications are not enabled or no email address is configured' });
    }

    // Check if email service is initialized
    const { sendTestEmail } = await import('../services/notificationService');
    await sendTestEmail(settings.email_address);

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({ error: `Error sending test email: ${(error as Error).message}` });
  }
});
