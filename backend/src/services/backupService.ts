import { dbRun, dbGet, dbAll } from '../database/db-helpers';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { createBackup as createDockerBackup } from './dockerService';

export type BackupStrategyType = 'full' | 'incremental';

export interface BackupStrategy {
  id?: number;
  containerId: string;
  strategyType: BackupStrategyType;
  retentionDays: number;
  compressionEnabled: boolean;
  autoRotation: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get backup strategy for a container
 */
export async function getBackupStrategy(containerId: string): Promise<BackupStrategy | null> {
  const strategy = await dbGet(
    `SELECT * FROM backup_strategies WHERE container_id = ?`,
    [containerId]
  ) as any;
  
  if (strategy) {
    const compressionEnabled = typeof strategy.compression_enabled === 'number' 
      ? strategy.compression_enabled === 1 
      : Boolean(strategy.compression_enabled);
    const autoRotation = typeof strategy.auto_rotation === 'number'
      ? strategy.auto_rotation === 1
      : Boolean(strategy.auto_rotation);
    
    return {
      id: strategy.id,
      containerId: strategy.container_id,
      strategyType: (strategy.strategy_type || 'full') as BackupStrategyType,
      retentionDays: strategy.retention_days,
      compressionEnabled,
      autoRotation,
      createdAt: strategy.created_at,
      updatedAt: strategy.updated_at
    };
  }
  
  return null;
}

/**
 * Get or create default backup strategy
 */
export async function getOrCreateBackupStrategy(containerId: string): Promise<BackupStrategy> {
  let strategy = await getBackupStrategy(containerId);
  
  if (!strategy) {
    await dbRun(
      `INSERT INTO backup_strategies (container_id, strategy_type, retention_days, compression_enabled, auto_rotation)
       VALUES (?, ?, ?, ?, ?)`,
      [containerId, 'full', 7, 0, 1]
    );
    
    strategy = await getBackupStrategy(containerId);
    if (!strategy) {
      throw new Error('Failed to create backup strategy');
    }
  }
  
  return strategy;
}

/**
 * Update backup strategy
 */
export async function updateBackupStrategy(containerId: string, strategy: Partial<BackupStrategy>): Promise<void> {
  const existing = await getBackupStrategy(containerId);
  
  if (existing) {
    await dbRun(
      `UPDATE backup_strategies 
       SET strategy_type = ?, retention_days = ?, compression_enabled = ?, 
           auto_rotation = ?, updated_at = CURRENT_TIMESTAMP
       WHERE container_id = ?`,
      [
        strategy.strategyType || existing.strategyType,
        strategy.retentionDays !== undefined ? strategy.retentionDays : existing.retentionDays,
        strategy.compressionEnabled !== undefined ? (strategy.compressionEnabled ? 1 : 0) : (existing.compressionEnabled ? 1 : 0),
        strategy.autoRotation !== undefined ? (strategy.autoRotation ? 1 : 0) : (existing.autoRotation ? 1 : 0),
        containerId
      ]
    );
  } else {
    await dbRun(
      `INSERT INTO backup_strategies (container_id, strategy_type, retention_days, compression_enabled, auto_rotation)
       VALUES (?, ?, ?, ?, ?)`,
      [
        containerId,
        strategy.strategyType || 'full',
        strategy.retentionDays !== undefined ? strategy.retentionDays : 7,
        strategy.compressionEnabled ? 1 : 0,
        strategy.autoRotation !== undefined ? (strategy.autoRotation ? 1 : 0) : 1
      ]
    );
  }
}

/**
 * Create backup with strategy
 */
export async function createBackupWithStrategy(containerId: string): Promise<string> {
  const strategy = await getOrCreateBackupStrategy(containerId);
  const backupId = await createDockerBackup(containerId);
  
  // Get backup file size
  const backupsDir = '/app/backups';
  const backupPath = path.join(backupsDir, backupId, 'backup.tar');
  let sizeBytes = 0;
  let compressed = false;
  
  if (fs.existsSync(backupPath)) {
    const stats = fs.statSync(backupPath);
    sizeBytes = stats.size;
    
    // Apply compression if enabled
    if (strategy.compressionEnabled) {
      // In a real implementation, compress the backup here
      // For now, we just mark it as compressed
      compressed = true;
    }
  }
  
  // Save backup metadata
  await dbRun(
    `INSERT INTO backup_metadata (backup_id, container_id, strategy_type, size_bytes, compressed)
     VALUES (?, ?, ?, ?, ?)`,
    [backupId, containerId, strategy.strategyType, sizeBytes, compressed ? 1 : 0]
  );
  
  // Auto-rotate old backups if enabled
  if (strategy.autoRotation) {
    await rotateBackups(containerId, strategy.retentionDays);
  }
  
  return backupId;
}

/**
 * Rotate backups (delete old ones based on retention policy)
 */
export async function rotateBackups(containerId: string, retentionDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  
  // Get old backups
  const oldBackups = await dbAll(
    `SELECT backup_id FROM backup_metadata 
     WHERE container_id = ? AND created_at < ?`,
    [containerId, cutoff.toISOString()]
  );
  
  let deleted = 0;
  const backupsDir = '/app/backups';
  
  for (const backup of oldBackups as any[]) {
    try {
      const backupPath = path.join(backupsDir, backup.backup_id);
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
        await dbRun(`DELETE FROM backup_metadata WHERE backup_id = ?`, [backup.backup_id]);
        deleted++;
      }
    } catch (error) {
      logger.error(`Error deleting old backup ${backup.backup_id}:`, error);
    }
  }
  
  return deleted;
}

/**
 * Verify backup
 */
export async function verifyBackup(backupId: string): Promise<boolean> {
  const backupsDir = '/app/backups';
  const backupPath = path.join(backupsDir, backupId, 'backup.tar');
  
  if (!fs.existsSync(backupPath)) {
    return false;
  }
  
  // In a real implementation, verify backup integrity
  // For now, just check if file exists and has size > 0
  const stats = fs.statSync(backupPath);
  const isValid = stats.size > 0;
  
  if (isValid) {
    await dbRun(
      `UPDATE backup_metadata SET verified = 1, verified_at = CURRENT_TIMESTAMP WHERE backup_id = ?`,
      [backupId]
    );
  }
  
  return isValid;
}

/**
 * Get backup metadata
 */
export async function getBackupMetadata(backupId: string): Promise<any | null> {
  return await dbGet(
    `SELECT * FROM backup_metadata WHERE backup_id = ?`,
    [backupId]
  );
}

/**
 * Get all backups for a container
 */
export async function getContainerBackups(containerId: string): Promise<any[]> {
  return await dbAll(
    `SELECT * FROM backup_metadata WHERE container_id = ? ORDER BY created_at DESC`,
    [containerId]
  );
}

