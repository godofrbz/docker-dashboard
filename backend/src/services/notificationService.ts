import nodemailer from 'nodemailer';
import { dbGet } from '../database/db-helpers';
import { logger } from '../utils/logger';

interface Notification {
  type: string;
  containerId?: string;
  containerName?: string;
  message: string;
}

interface NotificationSettings {
  id?: number;
  email_enabled?: number;
  email_address?: string;
  web_enabled?: number;
}

let transporter: nodemailer.Transporter | null = null;

export async function initializeEmailService(): Promise<void> {
  // Email configuration from environment variables
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpSecure = process.env.SMTP_SECURE;
  
  const emailConfig: any = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  // Port 465 uses implicit SSL/TLS (secure = true)
  // Port 587 uses STARTTLS (secure = false, requireTLS = true)
  if (smtpPort === 465) {
    // Port 465: implicit SSL/TLS (always secure)
    emailConfig.secure = true;
    emailConfig.tls = {
      rejectUnauthorized: false // Allow self-signed certificates if needed
    };
  } else {
    // Port 587 or other: STARTTLS
    emailConfig.secure = false;
    if (smtpSecure === 'true' || smtpSecure === 'force_tls' || smtpSecure === '1') {
      emailConfig.requireTLS = true;
    }
    emailConfig.tls = {
      rejectUnauthorized: false // Allow self-signed certificates if needed
    };
  }
  
  if (emailConfig.auth.user && emailConfig.auth.pass) {
    // Debug logging (only if configuration is present)
    logger.info('Email configuration check:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      requireTLS: emailConfig.requireTLS,
      hasUser: !!emailConfig.auth.user,
      hasPass: !!emailConfig.auth.pass,
      smtpSecure: smtpSecure
    });
    try {
      transporter = nodemailer.createTransport(emailConfig);
      // Verify connection
      await transporter.verify();
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      transporter = null;
    }
  } else {
    // Don't log warning - email configuration might be loaded later via docker-compose env_file
    // The service will be reinitialized when sendTestEmail is called
    transporter = null;
  }
}

export async function sendNotification(notification: Notification): Promise<void> {
  const settings = await dbGet(`SELECT * FROM notification_settings ORDER BY id DESC LIMIT 1`) as NotificationSettings | undefined;

  if (!settings) {
    logger.warn('No notification settings found');
    return;
  }

  // Web notification (stored in database)
  if (settings.web_enabled) {
    logger.info(`Web notification: ${notification.message}`);
    // Could use WebSocket or Server-Sent Events here
  }

  // Email notification
  if (settings.email_enabled && settings.email_address && transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: settings.email_address,
        subject: `Docker Dashboard: ${notification.type}`,
        text: notification.message,
        html: `
          <h2>Docker Dashboard Notification</h2>
          <p><strong>Type:</strong> ${notification.type}</p>
          ${notification.containerName ? `<p><strong>Container:</strong> ${notification.containerName}</p>` : ''}
          <p><strong>Message:</strong> ${notification.message}</p>
          <p><small>Timestamp: ${new Date().toLocaleString()}</small></p>
        `
      });
      logger.info(`Email notification sent to ${settings.email_address}`);
    } catch (error) {
      logger.error('Error sending email:', error);
    }
  }
}

/**
 * Sends a test email
 */
export async function sendTestEmail(emailAddress: string): Promise<void> {
  if (!transporter) {
    // Try to reinitialize if transporter is null (env vars might be loaded now via docker-compose)
    logger.info('Reinitializing email service for test email...');
    await initializeEmailService();
    if (!transporter) {
      throw new Error('Email service is not initialized. Please check your SMTP settings in the .env file.');
    }
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: emailAddress,
      subject: 'Docker Dashboard - Test Email',
      text: 'This is a test email from Docker Dashboard. If you receive this email, the email configuration is working correctly.',
      html: `
        <h2>Docker Dashboard - Test Email</h2>
        <p>This is a test email from Docker Dashboard.</p>
        <p>If you receive this email, the email configuration is working correctly.</p>
        <p><small>Timestamp: ${new Date().toLocaleString()}</small></p>
      `
    });
    logger.info(`Test email successfully sent to ${emailAddress}`);
  } catch (error) {
    logger.error('Error sending test email:', error);
    throw error;
  }
}

// Initialize email service on startup (silently, will retry if needed)
// Note: Environment variables might not be loaded yet via docker-compose env_file
// The service will be reinitialized when sendTestEmail is called
initializeEmailService().catch(err => {
  // Only log error if it's not a configuration issue (missing env vars)
  if (err.message && !err.message.includes('configuration') && !err.message.includes('ECONNREFUSED')) {
    logger.error('Error initializing email service:', err);
  }
});

