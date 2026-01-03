import { Router } from 'express';
import { listImages, getImageInfo, removeUnusedImages, removeImage } from '../services/dockerService';
import { dbRun, dbAll, dbGet } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const imageRouter = Router();

// List all images
imageRouter.get('/', requireAuth, async (req, res) => {
  try {
    const images = await listImages();
    const containers = await import('../services/dockerService').then(m => m.listContainers());
    const imagesInUse = new Set(containers.map((c: any) => c.ImageID));
    
    // Optimized: Process images in parallel and use RepoTags directly
    const imageUpdates = images.map(async (image: any) => {
      const imageName = image.RepoTags?.[0] || image.RepoDigests?.[0] || image.Id;
      const [name, tag] = imageName.includes(':') 
        ? imageName.split(':') 
        : [imageName, 'latest'];
      
      const inUse = imagesInUse.has(image.Id);
      
      await dbRun(
        `INSERT OR REPLACE INTO images (image_id, image_name, image_tag, image_size, created_at, last_used, in_use)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          image.Id,
          name,
          tag,
          image.Size || 0,
          new Date(image.Created * 1000).toISOString(),
          inUse ? new Date().toISOString() : null,
          inUse ? 1 : 0
        ]
      );
    });
    
    await Promise.all(imageUpdates);
    
    // Get images from database
    const dbImages = await dbAll(
      `SELECT * FROM images ORDER BY last_used DESC, created_at DESC LIMIT 1000`
    );
    
    res.json(dbImages);
  } catch (error) {
    logger.error('Error listing images:', error);
    res.status(500).json({ error: 'Error listing images' });
  }
});

// Get image information
imageRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const info = await getImageInfo(id);
    res.json(info);
  } catch (error) {
    logger.error(`Error fetching image info for ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error fetching image information' });
  }
});

// Remove unused images
imageRouter.post('/cleanup', requireAuth, async (req, res) => {
  try {
    const result = await removeUnusedImages();
    
    // Remove from database
    await dbRun(`DELETE FROM images WHERE in_use = 0`);
    
    res.json({
      success: true,
      removed: result.removed,
      spaceReclaimed: result.spaceReclaimed,
      message: `Removed ${result.removed} unused images, reclaimed ${(result.spaceReclaimed / 1024 / 1024).toFixed(2)} MB`
    });
  } catch (error) {
    logger.error('Error cleaning up images:', error);
    res.status(500).json({ error: 'Error cleaning up images' });
  }
});

// Remove specific image
imageRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    
    await removeImage(id, force === 'true');
    
    // Remove from database
    await dbRun(`DELETE FROM images WHERE image_id = ?`, [id]);
    
    res.json({ success: true, message: 'Image removed successfully' });
  } catch (error) {
    logger.error(`Error removing image ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error removing image' });
  }
});

// Get unused images
imageRouter.get('/unused/list', requireAuth, async (req, res) => {
  try {
    const unused = await dbAll(
      `SELECT * FROM images WHERE in_use = 0 ORDER BY created_at_db DESC`
    );
    res.json(unused);
  } catch (error) {
    logger.error('Error fetching unused images:', error);
    res.status(500).json({ error: 'Error fetching unused images' });
  }
});

