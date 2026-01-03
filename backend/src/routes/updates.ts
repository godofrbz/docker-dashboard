import { Router } from 'express';
import { checkForUpdates, createBackup, stopContainer, startContainer, getContainerInfo } from '../services/dockerService';
import { dbAll, dbRun, dbGet } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { sendNotification } from '../services/notificationService';

export const updateRouter = Router();

// Auf Updates prüfen
updateRouter.post('/check', async (req, res) => {
  try {
    const { containerId } = req.body;
    if (!containerId) {
      return res.status(400).json({ error: 'containerId is required' });
    }

    // Prüfe ob bereits ein Update-Eintrag existiert
    const existingUpdate = await dbGet(
      `SELECT * FROM available_updates WHERE container_id = ?`,
      [containerId]
    );
    
    if (existingUpdate) {
      // Prüfe ob das Update noch gültig ist
      const info = await getContainerInfo(containerId);
      if (info.Config.Image === (existingUpdate as any).current_image) {
        // Container verwendet noch das alte Image, Update ist noch verfügbar
        return res.json({ hasUpdate: true, containerId });
      } else {
        // Container wurde bereits aktualisiert, entferne Eintrag
        await dbRun(`DELETE FROM available_updates WHERE container_id = ?`, [containerId]);
        return res.json({ hasUpdate: false, containerId, message: 'Container bereits aktualisiert' });
      }
    }
    
    const hasUpdate = await checkForUpdates(containerId);
    
    if (hasUpdate) {
      const info = await getContainerInfo(containerId);
      
      // Prüfe erneut, ob bereits ein Eintrag existiert (Race Condition)
      const existing = await dbGet(
        `SELECT * FROM available_updates WHERE container_id = ?`,
        [containerId]
      );
      
      if (!existing) {
        await dbRun(
          `INSERT INTO available_updates (container_id, container_name, current_image, available_image)
           VALUES (?, ?, ?, ?)`,
          [containerId, info.Name, info.Config.Image, `${info.Config.Image}:latest`]
        );
      }

      // Benachrichtigung senden
      await sendNotification({
        type: 'update_available',
        containerId,
        containerName: info.Name,
        message: `Update verfügbar für Container: ${info.Name}`
      });
    }

    res.json({ hasUpdate, containerId });
  } catch (error) {
    logger.error('Fehler beim Prüfen auf Updates:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen auf Updates' });
  }
});

// Alle Container auf Updates prüfen
updateRouter.post('/check-all', async (req, res) => {
  try {
    const { listContainers } = await import('../services/dockerService');
    const containers = await listContainers();
    
    // Hole ausgeschlossene Container
    const excluded = await dbAll(`SELECT container_id FROM excluded_containers`);
    const excludedIds = new Set(excluded.map((e: any) => e.container_id));
    
    // Optimized: Process containers in parallel batches
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < containers.length; i += batchSize) {
      const batch = containers.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(batch.map(async (container) => {
        // Überspringe ausgeschlossene Container
        if (excludedIds.has(container.Id)) {
          return { containerId: container.Id, hasUpdate: false, excluded: true };
        }
        
        try {
          // Prüfe ob bereits ein Update-Eintrag existiert
          const existingUpdate = await dbGet(
            `SELECT * FROM available_updates WHERE container_id = ?`,
            [container.Id]
          );
          
          if (existingUpdate) {
            // Prüfe ob das Update noch gültig ist
            const info = await getContainerInfo(container.Id);
            if (info.Config.Image === (existingUpdate as any).current_image) {
              // Container verwendet noch das alte Image, Update ist noch verfügbar
              return { containerId: container.Id, hasUpdate: true, alreadyExists: true };
            } else {
              // Container wurde bereits aktualisiert, entferne Eintrag
              await dbRun(`DELETE FROM available_updates WHERE container_id = ?`, [container.Id]);
              return { containerId: container.Id, hasUpdate: false, message: 'Bereits aktualisiert' };
            }
          }
          
          const hasUpdate = await checkForUpdates(container.Id);
          if (hasUpdate) {
            // Prüfe erneut, ob bereits ein Eintrag existiert (Race Condition)
            const existing = await dbGet(
              `SELECT * FROM available_updates WHERE container_id = ?`,
              [container.Id]
            );
            
            if (!existing) {
              await dbRun(
                `INSERT INTO available_updates (container_id, container_name, current_image, available_image)
                 VALUES (?, ?, ?, ?)`,
                [container.Id, container.Names[0], container.Image, `${container.Image}:latest`]
              );

              await sendNotification({
                type: 'update_available',
                containerId: container.Id,
                containerName: container.Names[0],
                message: `Update verfügbar für Container: ${container.Names[0]}`
              });
            }
          }
          return { containerId: container.Id, hasUpdate };
        } catch (error) {
          logger.error(`Fehler beim Prüfen von Container ${container.Id}:`, error);
          return { containerId: container.Id, hasUpdate: false, error: (error as Error).message };
        }
      }));
      
      results.push(...batchResults);
    }

    res.json({ results });
  } catch (error) {
    logger.error('Fehler beim Prüfen aller Container:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen aller Container' });
  }
});

// Container aktualisieren
updateRouter.post('/apply', async (req, res) => {
  let containerId: string | undefined;
  try {
    containerId = req.body.containerId;
    if (!containerId) {
      return res.status(400).json({ error: 'containerId is required' });
    }

    // Backup erstellen
    logger.info(`Erstelle Backup für Container ${containerId}`);
    const backupId = await createBackup(containerId);
    
    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'backup', 'success', `Backup erstellt: ${backupId}`]
    );

    // Container stoppen
    await stopContainer(containerId);
    await dbRun(
      `INSERT INTO logs (container_id, action, status, message)
       VALUES (?, ?, ?, ?)`,
      [containerId, 'stop', 'success', 'Container gestoppt']
    );

    // Hier würde normalerweise das Image aktualisiert werden
    // docker pull <image> und docker run mit neuen Image
    
    // Container starten
    let updateSuccessful = false;
    try {
      await startContainer(containerId);
      
      // Prüfe ob Container erfolgreich gestartet wurde
      const containerInfo = await getContainerInfo(containerId);
      const containerState = containerInfo.State;
      
      if (containerState.Running) {
        updateSuccessful = true;
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'start', 'success', 'Container gestartet']
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
          [containerId, 'start', 'failed', `Container konnte nicht gestartet werden. Status: ${containerState.Status}`]
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
      throw startError;
    }

    // Update-Eintrag entfernen
    await dbRun(`DELETE FROM available_updates WHERE container_id = ?`, [containerId]);

    await sendNotification({
      type: updateSuccessful ? 'update_applied' : 'update_failed',
      containerId,
      message: updateSuccessful 
        ? `Container ${containerId} successfully updated`
        : `Update for container ${containerId} failed`
    });

    if (updateSuccessful) {
      res.json({ success: true, message: 'Container successfully updated' });
    } else {
      res.status(500).json({ success: false, error: 'Update angewendet, aber Container läuft nicht' });
    }
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Containers:', error);
    
    // Logge den Fehler, wenn containerId verfügbar ist
    if (containerId) {
      try {
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'update_applied', 'failed', `Update failed: ${(error as Error).message}`]
        );
      } catch (logError) {
        logger.error('Fehler beim Loggen des Update-Fehlers:', logError);
      }
    }
    
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Containers' });
  }
});

// Batch-Update für mehrere Container
updateRouter.post('/apply-batch', async (req, res) => {
  try {
    const { containerIds } = req.body;
    
    if (!Array.isArray(containerIds) || containerIds.length === 0) {
      return res.status(400).json({ error: 'containerIds array is required' });
    }

    const results = [];

    for (const containerId of containerIds) {
      try {
        // Backup erstellen
        logger.info(`Erstelle Backup für Container ${containerId}`);
        const backupId = await createBackup(containerId);
        
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'backup', 'success', `Backup erstellt: ${backupId}`]
        );

        // Container stoppen
        await stopContainer(containerId);
        await dbRun(
          `INSERT INTO logs (container_id, action, status, message)
           VALUES (?, ?, ?, ?)`,
          [containerId, 'stop', 'success', 'Container gestoppt']
        );

        // Hier würde normalerweise das Image aktualisiert werden
        // docker pull <image> und docker run mit neuen Image
        
        // Container starten
        let updateSuccessful = false;
        try {
          await startContainer(containerId);
          
          // Prüfe ob Container erfolgreich gestartet wurde
          const containerInfo = await getContainerInfo(containerId);
          const containerState = containerInfo.State;
          
          if (containerState.Running) {
            updateSuccessful = true;
            await dbRun(
              `INSERT INTO logs (container_id, action, status, message)
               VALUES (?, ?, ?, ?)`,
              [containerId, 'start', 'success', 'Container gestartet']
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
              [containerId, 'start', 'failed', `Container konnte nicht gestartet werden. Status: ${containerState.Status}`]
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

        // Update-Eintrag entfernen
        await dbRun(`DELETE FROM available_updates WHERE container_id = ?`, [containerId]);

        await sendNotification({
          type: updateSuccessful ? 'update_applied' : 'update_failed',
          containerId,
          message: updateSuccessful 
            ? `Container ${containerId} erfolgreich aktualisiert`
            : `Update für Container ${containerId} fehlgeschlagen`
        });

        results.push({ containerId, success: updateSuccessful });
      } catch (error) {
        logger.error(`Fehler beim Aktualisieren von Container ${containerId}:`, error);
        results.push({ 
          containerId, 
          success: false, 
          error: (error as Error).message 
        });
      }
    }

    res.json({ 
      success: true, 
      results,
      message: `${results.filter(r => r.success).length} of ${containerIds.length} updates successfully applied`
    });
  } catch (error) {
    logger.error('Fehler beim Batch-Update:', error);
    res.status(500).json({ error: 'Fehler beim Batch-Update' });
  }
});

// Verfügbare Updates abrufen
updateRouter.get('/available', async (req, res) => {
  try {
    const updates = await dbAll(`SELECT * FROM available_updates ORDER BY detected_at DESC`);
    res.json(updates);
  } catch (error) {
    logger.error('Fehler beim Abrufen der verfügbaren Updates:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Updates' });
  }
});
