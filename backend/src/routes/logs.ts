import { Router } from 'express';
import { dbAll } from '../database/db-helpers';
import { logger } from '../utils/logger';

export const logRouter = Router();

// Alle Logs abrufen
logRouter.get('/', async (req, res) => {
  try {
    const { containerId, limit = 100 } = req.query;
    
    let query = `SELECT * FROM logs`;
    const params: any[] = [];

    if (containerId) {
      query += ` WHERE container_id = ?`;
      params.push(containerId);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const logs = await dbAll(query, params);
    res.json(logs);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Logs:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Logs' });
  }
});

// Logs für einen bestimmten Container abrufen
logRouter.get('/container/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;
    const { limit = 100 } = req.query;
    
    const query = `SELECT * FROM logs WHERE container_id = ? ORDER BY timestamp DESC LIMIT ?`;
    const logs = await dbAll(query, [containerId, limit]);

    res.json(logs);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Container-Logs:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Container-Logs' });
  }
});

