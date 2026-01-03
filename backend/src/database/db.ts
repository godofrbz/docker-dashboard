import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

let db: sqlite3.Database | null = null;

export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Stelle sicher, dass das data-Verzeichnis existiert
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'docker-dashboard.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Fehler beim Öffnen der Datenbank:', err);
        reject(err);
        return;
      }
      logger.info('Datenbank erfolgreich verbunden');
      createTables().then(resolve).catch(reject);
    });
  });
}

async function createTables(): Promise<void> {
  if (!db) throw new Error('Datenbank nicht initialisiert');

  const run = promisify(db.run.bind(db));

  // Tabelle für Update-Zeitpläne
  await run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT,
      day_of_week INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Migration: Falls container_id NOT NULL war, entferne die Constraint
  // (SQLite unterstützt ALTER TABLE nicht gut, daher ignorieren wir das)

  // Tabelle für Logs
  await run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Benachrichtigungseinstellungen
  await run(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_enabled BOOLEAN DEFAULT 0,
      email_address TEXT,
      web_enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für verfügbare Updates
  await run(`
    CREATE TABLE IF NOT EXISTS available_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      container_name TEXT,
      current_image TEXT,
      available_image TEXT,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notified BOOLEAN DEFAULT 0
    )
  `);

  // Tabelle für ausgeschlossene Container
  await run(`
    CREATE TABLE IF NOT EXISTS excluded_containers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL UNIQUE,
      container_name TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Authentifizierung (Passwort-Hash)
  await run(`
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE DEFAULT 'admin',
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für App-Einstellungen (Session-Timeout, Sprache, Theme)
  await run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_timeout_minutes INTEGER DEFAULT 30,
      default_language TEXT DEFAULT 'en',
      theme TEXT DEFAULT 'light',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Container-Statistiken (Metriken-Historie)
  await run(`
    CREATE TABLE IF NOT EXISTS container_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      cpu_percent REAL,
      memory_usage BIGINT,
      memory_limit BIGINT,
      memory_percent REAL,
      network_rx BIGINT,
      network_tx BIGINT,
      block_read BIGINT,
      block_write BIGINT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Index für schnelle Abfragen
  await run(`
    CREATE INDEX IF NOT EXISTS idx_container_stats_container_id_timestamp 
    ON container_stats(container_id, timestamp DESC)
  `);

  // Tabelle für Update-Strategien pro Container
  await run(`
    CREATE TABLE IF NOT EXISTS update_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL UNIQUE,
      update_policy TEXT DEFAULT 'manual',
      auto_rollback BOOLEAN DEFAULT 0,
      rollback_on_failure BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Images
  await run(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_tag TEXT,
      image_size BIGINT,
      created_at DATETIME,
      last_used DATETIME,
      in_use BOOLEAN DEFAULT 0,
      created_at_db DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Index für Images
  await run(`
    CREATE INDEX IF NOT EXISTS idx_images_image_name 
    ON images(image_name)
  `);

  // Tabelle für Backup-Strategien
  await run(`
    CREATE TABLE IF NOT EXISTS backup_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      strategy_type TEXT DEFAULT 'full',
      retention_days INTEGER DEFAULT 7,
      compression_enabled BOOLEAN DEFAULT 0,
      auto_rotation BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Backup-Metadaten (erweitert)
  await run(`
    CREATE TABLE IF NOT EXISTS backup_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_id TEXT NOT NULL UNIQUE,
      container_id TEXT NOT NULL,
      strategy_type TEXT DEFAULT 'full',
      size_bytes BIGINT,
      compressed BOOLEAN DEFAULT 0,
      verified BOOLEAN DEFAULT 0,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Dashboard-Widgets
  await run(`
    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_type TEXT NOT NULL,
      widget_config TEXT,
      position INTEGER,
      visible BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für Favoriten-Container
  await run(`
    CREATE TABLE IF NOT EXISTS favorite_containers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL UNIQUE,
      container_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.info('Database tables created');
}

export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error('Datenbank nicht initialisiert');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    return new Promise((resolve, reject) => {
      db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          logger.info('Datenbankverbindung geschlossen');
          resolve();
        }
      });
    });
  }
}

