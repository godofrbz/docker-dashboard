import cron from 'node-cron';
import { dbAll, dbRun, dbGet } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { checkForUpdates, createBackup, stopContainer, startContainer, getContainerInfo } from './dockerService';
import { sendNotification } from './notificationService';

interface Schedule {
  id: number;
  container_id: string;
  day_of_week: number;
  hour: number;
  minute: number;
  enabled: number;
}

let scheduledTasks: Map<number, cron.ScheduledTask> = new Map();

/**
 * Applies an update to a container (similar to /api/updates/apply)
 */
async function applyUpdate(containerId: string, containerName: string): Promise<boolean> {
  try {
    // Create backup
    logger.info(`[Scheduler] Creating backup for container ${containerId}`);
    const backupId = await createBackup(containerId);
    
    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'backup', 'success', `Backup created: ${backupId}`]
    );

    // Stop container
    await stopContainer(containerId);
    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'stop', 'success', 'Container stopped']
    );

    // Start container
    let updateSuccessful = false;
    try {
      await startContainer(containerId);
      
      // Check if container started successfully
      const containerInfo = await getContainerInfo(containerId);
      const containerState = containerInfo.State;
      
      if (containerState.Running) {
        updateSuccessful = true;
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'start', 'success', 'Container started']
        );
        
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'update_applied', 'success', `Update successfully applied. New image: ${containerInfo.Config.Image}`]
        );
      } else {
        updateSuccessful = false;
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'start', 'failed', `Container could not be started. Status: ${containerState.Status}`]
        );
        
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'update_applied', 'failed', 'Update failed: Container is not running']
        );
      }
    } catch (startError) {
      updateSuccessful = false;
      await dbRun(
        `INSERT INTO logs (container_id, action, status, message)
         VALUES (?, ?, ?, ?)`,
        [containerId, 'update_applied', 'failed', `Update failed: ${(startError as Error).message}`]
      );
    }

    // Remove update entry
    await dbRun(`DELETE FROM available_updates WHERE container_id = ?`, [containerId]);

    await sendNotification({
      type: updateSuccessful ? 'update_applied' : 'update_failed',
      containerId,
      containerName,
      message: updateSuccessful 
        ? `Container ${containerName} successfully updated via scheduled task`
        : `Update for container ${containerName} failed via scheduled task`
    });

    return updateSuccessful;
  } catch (error) {
    logger.error(`[Scheduler] Error applying update for container ${containerId}:`, error);
    
    try {
      await dbRun(
        `INSERT INTO logs (container_id, action, status, message)
         VALUES (?, ?, ?, ?)`,
        [containerId, 'update_applied', 'failed', `Update failed: ${(error as Error).message}`]
      );
    } catch (logError) {
      logger.error('[Scheduler] Error logging update failure:', logError);
    }
    
    return false;
  }
}

export function startScheduler(): void {
  logger.info('Scheduler started');
  loadSchedules();
  
  // Daily at 2 AM check all containers for updates
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting daily update check for all containers');
    try {
      const { listContainers } = await import('./dockerService');
      const containers = await listContainers();
      
      for (const container of containers) {
        try {
          const hasUpdate = await checkForUpdates(container.Id);
          if (hasUpdate) {
            await sendNotification({
              type: 'update_available',
              containerId: container.Id,
              containerName: container.Names[0],
              message: `Update available for container: ${container.Names[0]}`
            });
          }
        } catch (error) {
          logger.error(`Error checking container ${container.Id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error during daily update check:', error);
    }
  });
}

export function loadSchedules(): void {
  // Remove old tasks
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks.clear();

  dbAll(`SELECT * FROM schedules WHERE enabled = 1`)
    .then(async (schedules: Schedule[]) => {
      // Get excluded containers
      const { dbAll: dbAllExcluded } = await import('../database/db-helpers');
      const excluded = await dbAllExcluded(`SELECT container_id FROM excluded_containers`);
      const excludedIds = new Set(excluded.map((e: any) => e.container_id));

      schedules.forEach((schedule: Schedule) => {
        const cronExpression = `${schedule.minute} ${schedule.hour} * * ${schedule.day_of_week}`;
        
        const task = cron.schedule(cronExpression, async () => {
          try {
            // If container_id is null, check all containers
            if (!schedule.container_id) {
              logger.info(`[Scheduler] Executing scheduled update check for all containers`);
              const { listContainers } = await import('./dockerService');
              const containers = await listContainers();
              
              for (const container of containers) {
                const containerId = container.Id;
                const containerName = container.Names[0] || containerId;
                const isExcluded = excludedIds.has(containerId);
                
                try {
                  // Check ALL containers for updates (including excluded ones)
                  const hasUpdate = await checkForUpdates(containerId);
                  
                  if (hasUpdate) {
                    if (isExcluded) {
                      // Excluded containers: Only notification, no update
                      logger.info(`[Scheduler] Update available for excluded container ${containerName}, skipping update`);
                      await sendNotification({
                        type: 'scheduled_update_check',
                        containerId,
                        containerName,
                        message: `Update available for excluded container: ${containerName} (not applied)`
                      });
                    } else {
                      // Non-excluded containers: Apply update directly
                      logger.info(`[Scheduler] Update available for container ${containerName}, applying update`);
                      
                      // Save update entry in database (if not already present)
                      const existingUpdate = await dbGet(
                        `SELECT * FROM available_updates WHERE container_id = ?`,
                        [containerId]
                      );
                      
                      if (!existingUpdate) {
                        const info = await getContainerInfo(containerId);
                        await dbRun(
                          `INSERT INTO available_updates (container_id, container_name, current_image, available_image)
                           VALUES (?, ?, ?, ?)`,
                          [containerId, containerName, info.Config.Image, `${info.Config.Image}:latest`]
                        );
                      }
                      
                      // Apply update
                      const updateSuccess = await applyUpdate(containerId, containerName);
                      if (updateSuccess) {
                        logger.info(`[Scheduler] Successfully applied update for container ${containerName}`);
                      } else {
                        logger.error(`[Scheduler] Failed to apply update for container ${containerName}`);
                      }
                    }
                  }
                } catch (error) {
                  logger.error(`[Scheduler] Error during scheduled update check for ${containerId}:`, error);
                }
              }
            } else {
              // Check only the specific container
              const containerId = schedule.container_id;
              const isExcluded = excludedIds.has(containerId);
              
              logger.info(`[Scheduler] Executing scheduled update check for container ${containerId}`);
              
              try {
                // Check container for updates (even if excluded)
                const hasUpdate = await checkForUpdates(containerId);
                
                if (hasUpdate) {
                  const { listContainers } = await import('./dockerService');
                  const containers = await listContainers();
                  const container = containers.find(c => c.Id === containerId);
                  const containerName = container?.Names[0] || containerId;
                  
                  if (isExcluded) {
                    // Excluded containers: Only notification, no update
                    logger.info(`[Scheduler] Update available for excluded container ${containerName}, skipping update`);
                    await sendNotification({
                      type: 'scheduled_update_check',
                      containerId,
                      containerName,
                      message: `Update available for excluded container: ${containerName} (not applied)`
                    });
                  } else {
                    // Non-excluded containers: Apply update directly
                    logger.info(`[Scheduler] Update available for container ${containerName}, applying update`);
                    
                    // Save update entry in database (if not already present)
                    const existingUpdate = await dbGet(
                      `SELECT * FROM available_updates WHERE container_id = ?`,
                      [containerId]
                    );
                    
                    if (!existingUpdate) {
                      const info = await getContainerInfo(containerId);
                      await dbRun(
                        `INSERT INTO available_updates (container_id, container_name, current_image, available_image)
                         VALUES (?, ?, ?, ?)`,
                        [containerId, containerName, info.Config.Image, `${info.Config.Image}:latest`]
                      );
                    }
                    
                    // Apply update
                    const updateSuccess = await applyUpdate(containerId, containerName);
                    if (updateSuccess) {
                      logger.info(`[Scheduler] Successfully applied update for container ${containerName}`);
                    } else {
                      logger.error(`[Scheduler] Failed to apply update for container ${containerName}`);
                    }
                  }
                }
              } catch (error) {
                logger.error(`[Scheduler] Error during scheduled update check for ${containerId}:`, error);
              }
            }
          } catch (error) {
            logger.error(`[Scheduler] Error during scheduled update check:`, error);
          }
        }, {
          scheduled: true,
          timezone: 'Europe/Berlin'
        });

        scheduledTasks.set(schedule.id, task);
        const scope = schedule.container_id ? `Container ${schedule.container_id}` : 'all containers';
        logger.info(`Schedule ${schedule.id} loaded: ${cronExpression} for ${scope}`);
      });
    })
    .catch((error) => {
      logger.error('Error loading schedules:', error);
    });
}

export function updateScheduler(): void {
  logger.info('Updating scheduler');
  loadSchedules();
}

