import { dbRun, dbAll, dbGet } from '../database/db-helpers';
import { getFormattedContainerStats } from './dockerService';
import { logger } from '../utils/logger';

/**
 * Save container statistics to database
 */
export async function saveContainerStats(containerId: string): Promise<void> {
  try {
    const stats = await getFormattedContainerStats(containerId);
    
    await dbRun(
      `INSERT INTO container_stats (
        container_id, cpu_percent, memory_usage, memory_limit, memory_percent,
        network_rx, network_tx, block_read, block_write
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        containerId,
        stats.cpuPercent,
        stats.memoryUsage,
        stats.memoryLimit,
        stats.memoryPercent,
        stats.networkRx,
        stats.networkTx,
        stats.blockRead,
        stats.blockWrite
      ]
    );
  } catch (error) {
    logger.error(`Error saving stats for container ${containerId}:`, error);
  }
}

/**
 * Get container statistics history
 */
export async function getContainerStatsHistory(
  containerId: string,
  hours: number = 24
): Promise<any[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);
  
  const stats = await dbAll(
    `SELECT * FROM container_stats 
     WHERE container_id = ? AND timestamp > ? 
     ORDER BY timestamp ASC`,
    [containerId, since.toISOString()]
  );
  
  return stats;
}

/**
 * Get latest statistics for a container
 */
export async function getLatestContainerStats(containerId: string): Promise<any | null> {
  const stats = await dbAll(
    `SELECT * FROM container_stats 
     WHERE container_id = ? 
     ORDER BY timestamp DESC 
     LIMIT 1`,
    [containerId]
  );
  
  return stats.length > 0 ? stats[0] : null;
}

/**
 * Get statistics for all containers
 */
export async function getAllContainersLatestStats(): Promise<any[]> {
  const stats = await dbAll(
    `SELECT cs1.* FROM container_stats cs1
     INNER JOIN (
       SELECT container_id, MAX(timestamp) as max_timestamp
       FROM container_stats
       GROUP BY container_id
     ) cs2 ON cs1.container_id = cs2.container_id 
     AND cs1.timestamp = cs2.max_timestamp`
  );
  
  return stats;
}

/**
 * Clean up old statistics (keep only last N days)
 */
export async function cleanupOldStats(days: number = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const result = await dbRun(
    `DELETE FROM container_stats WHERE timestamp < ?`,
    [cutoff.toISOString()]
  );
  
  return (result as any).changes || 0;
}

