import { Router } from 'express';
import { dbAll, dbRun, dbGet } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { createBackup, getContainerInfo } from '../services/dockerService';
import { requireAuth } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

export const backupRouter = Router();

// Manuelles Backup erstellen
backupRouter.post('/create', requireAuth, async (req, res) => {
  let containerId: string | undefined;
  try {
    containerId = req.body.containerId;
    if (!containerId) {
      return res.status(400).json({ error: 'containerId is required' });
    }

    logger.info(`Creating manual backup for container ${containerId}`);
    const backupId = await createBackup(containerId);
    
    // Hole Container-Info für Namen
    let containerName = containerId;
    try {
      const containerInfo = await getContainerInfo(containerId);
      containerName = containerInfo.Name || containerId;
    } catch (error) {
      // Container existiert möglicherweise nicht mehr
    }
    
    // Log-Eintrag erstellen
    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'backup', 'success', `Manual backup created: ${backupId}`]
    );
    
    res.json({
      success: true,
      backupId,
      message: `Backup successfully created for ${containerName}`
    });
  } catch (error) {
    logger.error(`Error creating backup for ${containerId}:`, error);
    res.status(500).json({ error: 'Error creating backup' });
  }
});

// Alle Backups abrufen
backupRouter.get('/', requireAuth, async (req, res) => {
  try {
    // Hole Backups aus der Datenbank (aus logs)
    const logs = await dbAll(
      `SELECT * FROM logs WHERE action = 'backup' ORDER BY timestamp DESC`
    );

    const backupsDir = '/app/backups';
    const backups: any[] = [];

    // Prüfe ob Backups-Verzeichnis existiert
    if (fs.existsSync(backupsDir)) {
      const backupDirs = fs.readdirSync(backupsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      // Optimized: Process backups in parallel
      const backupPromises = backupDirs.map(async (backupDirName) => {
        const backupPath = path.join(backupsDir, backupDirName);
        const backupTar = path.join(backupPath, 'backup.tar');
        
        if (!fs.existsSync(backupTar)) {
          return null;
        }

        const stats = fs.statSync(backupTar);
        const parts = backupDirName.split('_');
        const containerId = parts[0];
        const timestamp = parseInt(parts[1]) || Date.now();

        // Hole Container-Info für Namen (nur wenn nötig)
        let containerName = containerId;
        try {
          const { getContainerInfo } = await import('../services/dockerService');
          const containerInfo = await getContainerInfo(containerId);
          containerName = containerInfo.Name || containerId;
        } catch (error) {
          // Container existiert möglicherweise nicht mehr, verwende ID
        }

        // Prüfe ob Update erfolgreich war (aus logs) - optimiert
        const timestampStr = new Date(timestamp).toISOString();
        const updateLogs = await dbAll(
          `SELECT * FROM logs 
           WHERE container_id = ? 
           AND action = 'start' 
           AND status = 'success'
           AND timestamp > ? 
           ORDER BY timestamp DESC 
           LIMIT 1`,
          [containerId, timestampStr]
        );

        const updateSuccessful = updateLogs.length > 0;

        return {
          id: backupDirName,
          containerId: containerId,
          containerName: containerName,
          path: backupTar,
          createdAt: new Date(timestamp).toISOString(),
          size: stats.size,
          verified: false,
          updateSuccessful: updateSuccessful || undefined
        };
      });

      const resolvedBackups = await Promise.all(backupPromises);
      backups.push(...resolvedBackups.filter(b => b !== null));
    }

    res.json(backups);
  } catch (error) {
    logger.error('Error fetching backups:', error);
    res.status(500).json({ error: 'Error fetching backups' });
  }
});

// Backup verifizieren (prüft ob Update erfolgreich war)
backupRouter.post('/:backupId/verify', requireAuth, async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupsDir = '/app/backups';
    const backupPath = path.join(backupsDir, backupId);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const parts = backupId.split('_');
    const containerId = parts[0];
    const timestamp = parseInt(parts[1]) || Date.now();
    const timestampStr = new Date(timestamp).toISOString();

    // Prüfe ob Container nach dem Backup erfolgreich gestartet wurde
    const updateLogs = await dbAll(
      `SELECT * FROM logs 
       WHERE container_id = ? 
       AND action = 'start' 
       AND status = 'success'
       AND timestamp > ? 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [containerId, timestampStr]
    );

    const updateSuccessful = updateLogs.length > 0;

    // Aktualisiere Backup-Status in der Datenbank (könnte eine separate Tabelle sein)
    // Für jetzt loggen wir es
    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [
        containerId,
        'backup_verified',
        updateSuccessful ? 'success' : 'failed',
        `Backup ${backupId} verified: Update ${updateSuccessful ? 'successful' : 'failed'}`
      ]
    );

    res.json({ 
      verified: true, 
      updateSuccessful,
      message: updateSuccessful 
        ? 'Update successful - Backup can be deleted' 
        : 'Update failed - Backup should be kept'
    });
  } catch (error) {
    logger.error('Error verifying backup:', error);
    res.status(500).json({ error: 'Error verifying backup' });
  }
});

// Backup löschen
backupRouter.delete('/:backupId', requireAuth, async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupsDir = '/app/backups';
    const backupPath = path.join(backupsDir, backupId);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Prüfe ob Backup gelöscht werden kann (Update muss erfolgreich sein)
    const parts = backupId.split('_');
    const containerId = parts[0];
    const timestamp = parseInt(parts[1]) || Date.now();
    const timestampStr = new Date(timestamp).toISOString();

    const updateLogs = await dbAll(
      `SELECT * FROM logs 
       WHERE container_id = ? 
       AND action = 'start' 
       AND status = 'success'
       AND timestamp > ? 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [containerId, timestampStr]
    );

    if (updateLogs.length === 0) {
      return res.status(400).json({ 
        error: 'Backup can only be deleted if the update was successful' 
      });
    }

    // Lösche Backup-Verzeichnis
    fs.rmSync(backupPath, { recursive: true, force: true });

    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'backup_deleted', 'success', `Backup ${backupId} gelöscht`]
    );

    res.json({ success: true, message: 'Backup successfully deleted' });
  } catch (error) {
    logger.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Error deleting backup' });
  }
});

// Backup wiederherstellen
backupRouter.post('/:backupId/restore', requireAuth, async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupsDir = '/app/backups';
    const backupPath = path.join(backupsDir, backupId);
    const backupTar = path.join(backupPath, 'backup.tar');

    if (!fs.existsSync(backupTar)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const parts = backupId.split('_');
    const containerId = parts[0];

    // Wiederherstellen des Backups
    const { restoreBackup } = await import('../services/dockerService');
    await restoreBackup(backupId);

    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'backup_restored', 'success', `Backup ${backupId} wiederhergestellt`]
    );

    res.json({ success: true, message: 'Backup successfully restored' });
  } catch (error) {
    logger.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Error restoring backup' });
  }
});

// Mehrere Backups löschen
backupRouter.post('/delete-multiple', requireAuth, async (req, res) => {
  try {
    const { backupIds } = req.body;
    
    if (!Array.isArray(backupIds) || backupIds.length === 0) {
      return res.status(400).json({ error: 'backupIds array is required' });
    }

    const backupsDir = '/app/backups';
    const results = [];

    for (const backupId of backupIds) {
      try {
        const backupPath = path.join(backupsDir, backupId);
        
        if (!fs.existsSync(backupPath)) {
          results.push({ backupId, success: false, error: 'Not found' });
          continue;
        }

        // Prüfe ob Backup gelöscht werden kann
        const parts = backupId.split('_');
        const containerId = parts[0];
        const timestamp = parseInt(parts[1]) || Date.now();
        const timestampStr = new Date(timestamp).toISOString();

        const updateLogs = await dbAll(
          `SELECT * FROM logs 
           WHERE container_id = ? 
           AND action = 'start' 
           AND status = 'success'
           AND timestamp > ? 
           ORDER BY timestamp DESC 
           LIMIT 1`,
          [containerId, timestampStr]
        );

        if (updateLogs.length === 0) {
          results.push({ 
            backupId, 
            success: false, 
            error: 'Update not successful' 
          });
          continue;
        }

        // Lösche Backup
        fs.rmSync(backupPath, { recursive: true, force: true });

        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'backup_deleted', 'success', `Backup ${backupId} gelöscht`]
        );

        results.push({ backupId, success: true });
      } catch (error) {
        results.push({ 
          backupId, 
          success: false, 
          error: (error as Error).message 
        });
      }
    }

    res.json({ results });
  } catch (error) {
    logger.error('Error deleting multiple backups:', error);
    res.status(500).json({ error: 'Error deleting backups' });
  }
});

