import { dbRun, dbGet, dbAll } from '../database/db-helpers';
import { logger } from '../utils/logger';

export type UpdatePolicy = 'manual' | 'auto' | 'scheduled';

export interface UpdateStrategy {
  id?: number;
  containerId: string;
  updatePolicy: UpdatePolicy;
  autoRollback: boolean;
  rollbackOnFailure: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get update strategy for a container
 */
export async function getUpdateStrategy(containerId: string): Promise<UpdateStrategy | null> {
  const strategy = await dbGet(
    `SELECT * FROM update_strategies WHERE container_id = ?`,
    [containerId]
  ) as any;
  
  if (strategy) {
    const autoRollback = typeof strategy.auto_rollback === 'number'
      ? strategy.auto_rollback === 1
      : Boolean(strategy.auto_rollback);
    const rollbackOnFailure = typeof strategy.rollback_on_failure === 'number'
      ? strategy.rollback_on_failure === 1
      : Boolean(strategy.rollback_on_failure);
    
    return {
      id: strategy.id,
      containerId: strategy.container_id,
      updatePolicy: (strategy.update_policy || 'manual') as UpdatePolicy,
      autoRollback,
      rollbackOnFailure,
      createdAt: strategy.created_at,
      updatedAt: strategy.updated_at
    };
  }
  
  return null;
}

/**
 * Get or create default update strategy
 */
export async function getOrCreateUpdateStrategy(containerId: string): Promise<UpdateStrategy> {
  let strategy = await getUpdateStrategy(containerId);
  
  if (!strategy) {
    // Create default strategy
    await dbRun(
      `INSERT INTO update_strategies (container_id, update_policy, auto_rollback, rollback_on_failure)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'manual', 0, 1]
    );
    
    strategy = await getUpdateStrategy(containerId);
    if (!strategy) {
      throw new Error('Failed to create update strategy');
    }
  }
  
  return strategy;
}

/**
 * Update strategy for a container
 */
export async function updateStrategy(containerId: string, strategy: Partial<UpdateStrategy>): Promise<void> {
  const existing = await getUpdateStrategy(containerId);
  
  if (existing) {
    await dbRun(
      `UPDATE update_strategies 
       SET update_policy = ?, auto_rollback = ?, rollback_on_failure = ?, updated_at = CURRENT_TIMESTAMP
       WHERE container_id = ?`,
      [
        strategy.updatePolicy || existing.updatePolicy,
        strategy.autoRollback !== undefined ? (strategy.autoRollback ? 1 : 0) : (existing.autoRollback ? 1 : 0),
        strategy.rollbackOnFailure !== undefined ? (strategy.rollbackOnFailure ? 1 : 0) : (existing.rollbackOnFailure ? 1 : 0),
        containerId
      ]
    );
  } else {
    await dbRun(
      `INSERT INTO update_strategies (container_id, update_policy, auto_rollback, rollback_on_failure)
       VALUES (?, ?, ?, ?)`,
      [
        containerId,
        strategy.updatePolicy || 'manual',
        strategy.autoRollback ? 1 : 0,
        strategy.rollbackOnFailure !== undefined ? (strategy.rollbackOnFailure ? 1 : 0) : 1
      ]
    );
  }
}

/**
 * Get all update strategies
 */
export async function getAllUpdateStrategies(): Promise<UpdateStrategy[]> {
  const strategies = await dbAll(
    `SELECT * FROM update_strategies ORDER BY updated_at DESC`
  ) as any[];
  
  return strategies.map(s => {
    const autoRollback = typeof s.auto_rollback === 'number' ? s.auto_rollback === 1 : Boolean(s.auto_rollback);
    const rollbackOnFailure = typeof s.rollback_on_failure === 'number' ? s.rollback_on_failure === 1 : Boolean(s.rollback_on_failure);
    
    return {
      id: s.id,
      containerId: s.container_id,
      updatePolicy: (s.update_policy || 'manual') as UpdatePolicy,
      autoRollback,
      rollbackOnFailure,
      createdAt: s.created_at,
      updatedAt: s.updated_at
    };
  });
}

/**
 * Delete update strategy for a container
 */
export async function deleteUpdateStrategy(containerId: string): Promise<void> {
  await dbRun(
    `DELETE FROM update_strategies WHERE container_id = ?`,
    [containerId]
  );
}

