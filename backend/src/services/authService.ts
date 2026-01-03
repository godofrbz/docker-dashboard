import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { dbGet, dbRun } from '../database/db-helpers';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 10;
const USERNAME = 'admin';

/**
 * Generiert ein zufälliges Passwort
 */
export function generatePassword(): string {
  // Generiere ein sicheres Passwort mit 16 Zeichen
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
}

/**
 * Hasht ein Passwort
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Vergleicht ein Passwort mit dem Hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Initialisiert das Admin-Passwort beim ersten Start
 * Wenn kein Passwort in der DB existiert, wird ein zufälliges generiert
 */
export async function initializePassword(): Promise<string> {
  try {
    const existing = await dbGet(`SELECT * FROM auth WHERE username = ?`, [USERNAME]);
    
    if (existing) {
      logger.info('Passwort bereits initialisiert');
      // Passwort existiert bereits, geben wir nichts zurück (sicherheit)
      return '';
    }

    // Generiere neues Passwort
    const newPassword = generatePassword();
    const passwordHash = await hashPassword(newPassword);

    // Speichere in Datenbank
    await dbRun(
      `INSERT INTO auth (username, password_hash) VALUES (?, ?)`,
      [USERNAME, passwordHash]
    );

    // Use console.log for better visibility in Docker logs
    console.log('');
    console.log('========================================');
    console.log('ADMIN PASSWORD GENERATED');
    console.log('========================================');
    console.log(`Username: ${USERNAME}`);
    console.log(`Password: ${newPassword}`);
    console.log('========================================');
    console.log('⚠️  IMPORTANT: Please note this password!');
    console.log('You can change it later in Settings.');
    console.log('========================================');
    console.log('');
    
    // Auch in Logger für Datei-Logs
    logger.info('========================================');
    logger.info('ADMIN PASSWORD GENERATED');
    logger.info('========================================');
    logger.info(`Username: ${USERNAME}`);
    logger.info(`Password: ${newPassword}`);
    logger.info('========================================');
    logger.info('Bitte notieren Sie sich dieses Passwort!');
    logger.info('Sie können es später in den Einstellungen ändern.');
    logger.info('========================================');

    return newPassword;
  } catch (error) {
    logger.error('Fehler beim Initialisieren des Passworts:', error);
    throw error;
  }
}

/**
 * Prüft, ob ein Passwort korrekt ist
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const auth = await dbGet(`SELECT password_hash FROM auth WHERE username = ?`, [USERNAME]) as { password_hash: string } | undefined;
    
    if (!auth) {
      return false;
    }

    return comparePassword(password, auth.password_hash);
  } catch (error) {
    logger.error('Fehler beim Verifizieren des Passworts:', error);
    return false;
  }
}

/**
 * Ändert das Passwort
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  try {
    // Prüfe altes Passwort
    const isValid = await verifyPassword(oldPassword);
    if (!isValid) {
      return false;
    }

    // Hashe neues Passwort
    const newHash = await hashPassword(newPassword);

    // Aktualisiere in Datenbank
    await dbRun(
      `UPDATE auth SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?`,
      [newHash, USERNAME]
    );

    logger.info('Passwort erfolgreich geändert');
    return true;
  } catch (error) {
    logger.error('Fehler beim Ändern des Passworts:', error);
    return false;
  }
}

/**
 * Setzt das Passwort (ohne alte Passwort-Prüfung - für Admin-Reset)
 */
export async function setPassword(newPassword: string): Promise<void> {
  try {
    const newHash = await hashPassword(newPassword);

    const existing = await dbGet(`SELECT * FROM auth WHERE username = ?`, [USERNAME]);
    
    if (existing) {
      await dbRun(
        `UPDATE auth SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?`,
        [newHash, USERNAME]
      );
    } else {
      await dbRun(
        `INSERT INTO auth (username, password_hash) VALUES (?, ?)`,
        [USERNAME, newHash]
      );
    }

    logger.info('Passwort erfolgreich gesetzt');
  } catch (error) {
    logger.error('Fehler beim Setzen des Passworts:', error);
    throw error;
  }
}

