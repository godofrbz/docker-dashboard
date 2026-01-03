import { Router } from 'express';
import { listContainers, getContainerInfo, getContainerStats, getFormattedContainerStats } from '../services/dockerService';
import { saveContainerStats, getContainerStatsHistory, getLatestContainerStats, getAllContainersLatestStats } from '../services/statsService';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const containerRouter = Router();

// List all containers
containerRouter.get('/', requireAuth, async (req, res) => {
  try {
    const containers = await listContainers();
    res.json(containers);
  } catch (error) {
    logger.error('Error fetching containers:', error);
    res.status(500).json({ error: 'Error fetching containers' });
  }
});

// Get container information
containerRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const info = await getContainerInfo(id);
    res.json(info);
  } catch (error) {
    logger.error(`Error fetching container info for ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error fetching container information' });
  }
});

// Get container statistics (raw)
containerRouter.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getContainerStats(id);
    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching stats for ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error fetching container statistics' });
  }
});

// Get formatted container statistics
containerRouter.get('/:id/stats/formatted', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getFormattedContainerStats(id);
    
    // Save stats to database for history
    await saveContainerStats(id).catch(err => {
      logger.error(`Error saving stats:`, err);
    });
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching formatted stats for ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error fetching container statistics' });
  }
});

// Get container statistics history
containerRouter.get('/:id/stats/history', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;
    const history = await getContainerStatsHistory(id, hours);
    res.json(history);
  } catch (error) {
    logger.error(`Error fetching stats history for ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error fetching statistics history' });
  }
});

// Get latest statistics for all containers
containerRouter.get('/stats/latest', requireAuth, async (req, res) => {
  try {
    const stats = await getAllContainersLatestStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching latest stats:', error);
    res.status(500).json({ error: 'Error fetching latest statistics' });
  }
});




