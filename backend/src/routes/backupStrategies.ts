import { Router } from 'express';
import {
  getBackupStrategy,
  getOrCreateBackupStrategy,
  updateBackupStrategy,
  createBackupWithStrategy,
  rotateBackups,
  verifyBackup,
  getContainerBackups
} from '../services/backupService';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const backupStrategiesRouter = Router();

// Get backup strategy for a container
backupStrategiesRouter.get('/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const strategy = await getOrCreateBackupStrategy(containerId);
    res.json(strategy);
  } catch (error) {
    logger.error(`Error fetching backup strategy for ${containerId}:`, error);
    res.status(500).json({ error: 'Error fetching backup strategy' });
  }
});

// Update backup strategy
backupStrategiesRouter.put('/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const { strategyType, retentionDays, compressionEnabled, autoRotation } = req.body;
    
    await updateBackupStrategy(containerId, {
      strategyType,
      retentionDays,
      compressionEnabled,
      autoRotation
    });
    
    res.json({ success: true, message: 'Backup strategy updated successfully' });
  } catch (error) {
    logger.error(`Error updating backup strategy for ${containerId}:`, error);
    res.status(500).json({ error: 'Error updating backup strategy' });
  }
});

// Create backup with strategy
backupStrategiesRouter.post('/:containerId/create', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const backupId = await createBackupWithStrategy(containerId);
    res.json({ success: true, backupId, message: 'Backup created successfully' });
  } catch (error) {
    logger.error(`Error creating backup for ${containerId}:`, error);
    res.status(500).json({ error: 'Error creating backup' });
  }
});

// Rotate backups manually
backupStrategiesRouter.post('/:containerId/rotate', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const { retentionDays } = req.body;
    const deleted = await rotateBackups(containerId, retentionDays || 7);
    res.json({ success: true, deleted, message: `Rotated backups, deleted ${deleted} old backups` });
  } catch (error) {
    logger.error(`Error rotating backups for ${containerId}:`, error);
    res.status(500).json({ error: 'Error rotating backups' });
  }
});

// Verify backup
backupStrategiesRouter.post('/verify/:backupId', requireAuth, async (req, res) => {
  const { backupId } = req.params;
  try {
    const isValid = await verifyBackup(backupId);
    res.json({ verified: isValid, message: isValid ? 'Backup is valid' : 'Backup verification failed' });
  } catch (error) {
    logger.error(`Error verifying backup ${backupId}:`, error);
    res.status(500).json({ error: 'Error verifying backup' });
  }
});

// Get all backups for a container
backupStrategiesRouter.get('/:containerId/backups', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const backups = await getContainerBackups(containerId);
    res.json(backups);
  } catch (error) {
    logger.error(`Error fetching backups for ${containerId}:`, error);
    res.status(500).json({ error: 'Error fetching backups' });
  }
});

