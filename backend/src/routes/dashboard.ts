import { Router } from 'express';
import {
  getDashboardWidgets,
  saveDashboardWidget,
  deleteDashboardWidget,
  reorderWidgets,
  addFavoriteContainer,
  removeFavoriteContainer,
  getFavoriteContainers,
  isFavoriteContainer
} from '../services/dashboardService';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

// Get all dashboard widgets
dashboardRouter.get('/widgets', requireAuth, async (req, res) => {
  try {
    const widgets = await getDashboardWidgets();
    res.json(widgets);
  } catch (error) {
    logger.error('Error fetching dashboard widgets:', error);
    res.status(500).json({ error: 'Error fetching dashboard widgets' });
  }
});

// Create or update dashboard widget
dashboardRouter.post('/widgets', requireAuth, async (req, res) => {
  try {
    const { widgetType, widgetConfig, position, visible } = req.body;
    const widgetId = await saveDashboardWidget({
      widgetType,
      widgetConfig: typeof widgetConfig === 'string' ? widgetConfig : JSON.stringify(widgetConfig),
      position: position || 0,
      visible: visible !== false
    });
    res.json({ success: true, widgetId, message: 'Widget saved successfully' });
  } catch (error) {
    logger.error('Error saving dashboard widget:', error);
    res.status(500).json({ error: 'Error saving dashboard widget' });
  }
});

// Update dashboard widget
dashboardRouter.put('/widgets/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { widgetType, widgetConfig, position, visible } = req.body;
    await saveDashboardWidget({
      id: parseInt(id),
      widgetType,
      widgetConfig: typeof widgetConfig === 'string' ? widgetConfig : JSON.stringify(widgetConfig),
      position,
      visible
    });
    res.json({ success: true, message: 'Widget updated successfully' });
  } catch (error) {
    logger.error(`Error updating dashboard widget ${id}:`, error);
    res.status(500).json({ error: 'Error updating dashboard widget' });
  }
});

// Delete dashboard widget
dashboardRouter.delete('/widgets/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDashboardWidget(parseInt(id));
    res.json({ success: true, message: 'Widget deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting dashboard widget ${id}:`, error);
    res.status(500).json({ error: 'Error deleting dashboard widget' });
  }
});

// Reorder widgets
dashboardRouter.post('/widgets/reorder', requireAuth, async (req, res) => {
  try {
    const { widgetIds } = req.body;
    if (!Array.isArray(widgetIds)) {
      return res.status(400).json({ error: 'widgetIds must be an array' });
    }
    await reorderWidgets(widgetIds);
    res.json({ success: true, message: 'Widgets reordered successfully' });
  } catch (error) {
    logger.error('Error reordering widgets:', error);
    res.status(500).json({ error: 'Error reordering widgets' });
  }
});

// Favorite containers
dashboardRouter.get('/favorites', requireAuth, async (req, res) => {
  try {
    const favorites = await getFavoriteContainers();
    res.json(favorites);
  } catch (error) {
    logger.error('Error fetching favorite containers:', error);
    res.status(500).json({ error: 'Error fetching favorite containers' });
  }
});

dashboardRouter.post('/favorites/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const { containerName } = req.body;
    await addFavoriteContainer(containerId, containerName || containerId);
    res.json({ success: true, message: 'Container added to favorites' });
  } catch (error) {
    logger.error(`Error adding favorite container ${containerId}:`, error);
    res.status(500).json({ error: 'Error adding favorite container' });
  }
});

dashboardRouter.delete('/favorites/:containerId', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    await removeFavoriteContainer(containerId);
    res.json({ success: true, message: 'Container removed from favorites' });
  } catch (error) {
    logger.error(`Error removing favorite container ${containerId}:`, error);
    res.status(500).json({ error: 'Error removing favorite container' });
  }
});

dashboardRouter.get('/favorites/:containerId/check', requireAuth, async (req, res) => {
  const { containerId } = req.params;
  try {
    const isFavorite = await isFavoriteContainer(containerId);
    res.json({ isFavorite });
  } catch (error) {
    logger.error(`Error checking favorite status for ${containerId}:`, error);
    res.status(500).json({ error: 'Error checking favorite status' });
  }
});

