import { Router } from 'express';
import {
  getUpdateStrategy,
  getOrCreateUpdateStrategy,
  updateStrategy,
  getAllUpdateStrategies,
  deleteUpdateStrategy
} from '../services/updateStrategiesService';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const updateStrategiesRouter = Router();

// Get all update strategies
updateStrategiesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const strategies = await getAllUpdateStrategies();
    res.json(strategies);
  } catch (error) {
    logger.error('Error fetching update strategies:', error);
    res.status(500).json({ error: 'Error fetching update strategies' });
  }
});

// Get update strategy for a container
updateStrategiesRouter.get('/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const strategy = await getOrCreateUpdateStrategy(containerId);
    res.json(strategy);
  } catch (error) {
    logger.error(`Error fetching update strategy for ${containerId}:`, error);
    res.status(500).json({ error: 'Error fetching update strategy' });
  }
});

// Update strategy for a container
updateStrategiesRouter.put('/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const { updatePolicy, autoRollback, rollbackOnFailure } = req.body;
    
    await updateStrategy(containerId, {
      updatePolicy,
      autoRollback,
      rollbackOnFailure
    });
    
    res.json({ success: true, message: 'Update strategy updated successfully' });
  } catch (error) {
    logger.error(`Error updating update strategy for ${containerId}:`, error);
    res.status(500).json({ error: 'Error updating update strategy' });
  }
});

// Delete update strategy
updateStrategiesRouter.delete('/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    await deleteUpdateStrategy(containerId);
    res.json({ success: true, message: 'Update strategy deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting update strategy for ${containerId}:`, error);
    res.status(500).json({ error: 'Error deleting update strategy' });
  }
});

