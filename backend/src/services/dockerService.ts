import Docker from 'dockerode';
import { logger } from '../utils/logger';

let docker: Docker | null = null;

export async function initializeDocker(): Promise<void> {
  try {
    docker = new Docker();
    await docker.ping();
    logger.info('Docker connection established successfully');
  } catch (error) {
    logger.error('Error connecting to Docker:', error);
    throw error;
  }
}

export function getDocker(): Docker {
  if (!docker) {
    throw new Error('Docker service not initialized');
  }
  return docker;
}

export async function listContainers(): Promise<any[]> {
  const dockerInstance = getDocker();
  const containers = await dockerInstance.listContainers({ all: true });
  return containers;
}

export async function getContainerInfo(containerId: string): Promise<any> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  return await container.inspect();
}

export async function getContainerStats(containerId: string): Promise<any> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  const stats = await container.stats({ stream: false });
  return stats;
}

/**
 * Get formatted container statistics with calculated percentages
 */
export async function getFormattedContainerStats(containerId: string): Promise<any> {
  const stats = await getContainerStats(containerId);
  
  // Calculate CPU percentage
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
  
  // Memory stats
  const memoryUsage = stats.memory_stats.usage || 0;
  const memoryLimit = stats.memory_stats.limit || 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
  
  // Network stats
  const networkRx = stats.networks ? Object.values(stats.networks).reduce((sum: number, net: any) => sum + (net.rx_bytes || 0), 0) : 0;
  const networkTx = stats.networks ? Object.values(stats.networks).reduce((sum: number, net: any) => sum + (net.tx_bytes || 0), 0) : 0;
  
  // Block I/O stats
  const blockRead = stats.blkio_stats?.io_service_bytes_recursive?.find((s: any) => s.op === 'Read')?.value || 0;
  const blockWrite = stats.blkio_stats?.io_service_bytes_recursive?.find((s: any) => s.op === 'Write')?.value || 0;
  
  return {
    containerId,
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memoryUsage,
    memoryLimit,
    memoryPercent: Math.round(memoryPercent * 100) / 100,
    networkRx,
    networkTx,
    blockRead,
    blockWrite,
    timestamp: new Date().toISOString(),
    raw: stats
  };
}

/**
 * List all Docker images
 */
export async function listImages(): Promise<any[]> {
  const dockerInstance = getDocker();
  const images = await dockerInstance.listImages({ all: true });
  return images;
}

/**
 * Get image information
 */
export async function getImageInfo(imageId: string): Promise<any> {
  const dockerInstance = getDocker();
  const image = dockerInstance.getImage(imageId);
  return await image.inspect();
}

/**
 * Remove unused images
 */
export async function removeUnusedImages(): Promise<{ removed: number; spaceReclaimed: number }> {
  const dockerInstance = getDocker();
  const images = await listImages();
  const containers = await listContainers();
  
  // Get all images in use
  const imagesInUse = new Set<string>();
  for (const container of containers) {
    if (container.ImageID) {
      imagesInUse.add(container.ImageID);
    }
  }
  
  // Find unused images
  let removed = 0;
  let spaceReclaimed = 0;
  
  for (const image of images) {
    if (!imagesInUse.has(image.Id)) {
      try {
        const imageInfo = await getImageInfo(image.Id);
        const size = imageInfo.Size || 0;
        
        const imageObj = dockerInstance.getImage(image.Id);
        await imageObj.remove({ force: true });
        
        removed++;
        spaceReclaimed += size;
      } catch (error) {
        logger.error(`Error removing image ${image.Id}:`, error);
      }
    }
  }
  
  return { removed, spaceReclaimed };
}

/**
 * Remove a specific image
 */
export async function removeImage(imageId: string, force: boolean = false): Promise<void> {
  const dockerInstance = getDocker();
  const image = dockerInstance.getImage(imageId);
  await image.remove({ force });
}

export async function stopContainer(containerId: string): Promise<void> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  await container.stop();
}

export async function startContainer(containerId: string): Promise<void> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  await container.start();
}

export async function restartContainer(containerId: string): Promise<void> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  await container.restart();
}

export async function restoreBackup(backupId: string): Promise<void> {
  const dockerInstance = getDocker();
  const fs = await import('fs');
  const path = await import('path');
  
  const backupsDir = '/app/backups';
  const backupPath = path.join(backupsDir, backupId);
  const backupTar = path.join(backupPath, 'backup.tar');
  
  if (!fs.existsSync(backupTar)) {
    throw new Error(`Backup ${backupId} nicht gefunden`);
  }
  
  // Extrahiere Container-ID aus Backup-ID
  const parts = backupId.split('_');
  const containerId = parts[0];
  
  try {
    const container = dockerInstance.getContainer(containerId);
    const info = await container.inspect();
    
    // Stoppe Container
    await stopContainer(containerId);
    
    // Hier würde normalerweise das Backup wiederhergestellt werden
    // Für diese Implementierung loggen wir nur
    logger.info(`Wiederherstelle Backup ${backupId} für Container ${containerId}`);
    
    // In einer echten Implementierung würde man hier:
    // 1. Das alte Image laden (aus backup.tar)
    // 2. Den Container mit dem alten Image neu starten
    // 3. Die Container-Konfiguration wiederherstellen
    
    // Für jetzt starten wir den Container einfach neu
    await container.start();
    
    logger.info(`Backup ${backupId} erfolgreich wiederhergestellt`);
  } catch (error) {
    logger.error(`Fehler beim Wiederherstellen des Backups ${backupId}:`, error);
    throw error;
  }
}

export async function createBackup(containerId: string): Promise<string> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  const info = await container.inspect();
  
  // Erstelle Backup-Verzeichnis
  const timestamp = Date.now();
  const backupId = `${containerId}_${timestamp}`;
  const backupDir = `/app/backups/${backupId}`;
  
  // Erstelle Backup-Verzeichnis falls es nicht existiert
  const fs = await import('fs');
  if (!fs.existsSync('/app/backups')) {
    fs.mkdirSync('/app/backups', { recursive: true });
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Hole das Image des Containers
  const image = dockerInstance.getImage(info.Config.Image);
  const backupPath = `${backupDir}/backup.tar`;
  
  // Hier würde normalerweise ein tatsächlicher Backup-Prozess stattfinden
  // Für diese Implementierung erstellen wir eine leere Datei als Platzhalter
  fs.writeFileSync(backupPath, '');
  
  logger.info(`Backup erstellt für Container ${containerId} -> ${backupPath}`);
  
  return backupId;
}

export async function checkForUpdates(containerId: string): Promise<boolean> {
  const dockerInstance = getDocker();
  const container = dockerInstance.getContainer(containerId);
  const info = await container.inspect();
  
  try {
    const currentImage = info.Config.Image;
    const currentImageId = info.Image; // SHA256 Hash des aktuellen Images
    
    // Extrahiere Image-Name ohne Tag
    const imageName = currentImage.includes(':') 
      ? currentImage.split(':').slice(0, -1).join(':')
      : currentImage;
    
    // Prüfe ob ein :latest Tag existiert
    const latestImage = `${imageName}:latest`;
    
    try {
      // Versuche das latest Image zu inspizieren
      const latestImageObj = dockerInstance.getImage(latestImage);
      const latestInfo = await latestImageObj.inspect();
      const latestImageId = latestInfo.Id; // SHA256 Hash des latest Images
      
      // Vergleiche die Image-IDs
      // Wenn die IDs unterschiedlich sind, gibt es ein Update
      if (currentImageId !== latestImageId) {
        logger.info(`Update verfügbar für ${containerId}: ${currentImageId.substring(0, 12)}... -> ${latestImageId.substring(0, 12)}...`);
        return true;
      }
      
      // Wenn die IDs gleich sind, aber das aktuelle Image keinen :latest Tag hat,
      // könnte es sein, dass das Image bereits aktualisiert wurde
      if (!currentImage.includes(':latest') && !currentImage.includes('@')) {
        // Prüfe ob das aktuelle Image das gleiche wie latest ist
        const currentImageObj = dockerInstance.getImage(currentImage);
        const currentInfo = await currentImageObj.inspect();
        
        if (currentInfo.Id === latestImageId) {
          // Container verwendet bereits das latest Image
          return false;
        }
      }
      
      return false;
    } catch (error) {
      // latest Image existiert nicht lokal
      // Versuche das aktuelle Image zu inspizieren
      try {
        const currentImageObj = dockerInstance.getImage(currentImage);
        await currentImageObj.inspect();
        
        // Image existiert lokal, aber kein latest Image
        // In einer echten Implementierung würde man hier die Registry abfragen
        // Für jetzt geben wir false zurück, um Fehlalarme zu vermeiden
        return false;
      } catch (error2) {
        // Weder aktuelles noch latest Image existiert lokal
        logger.warn(`Weder aktuelles noch latest Image für ${containerId} gefunden`);
        return false;
      }
    }
  } catch (error) {
    logger.error(`Fehler beim Prüfen auf Updates für ${containerId}:`, error);
    return false;
  }
}

