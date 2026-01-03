import { Router } from 'express';
import { dbAll, dbRun, dbGet } from '../database/db-helpers';
import { logger } from '../utils/logger';

export const excludedRouter = Router();

// Alle ausgeschlossenen Container abrufen
excludedRouter.get('/', async (req, res) => {
  try {
    const excluded = await dbAll(`SELECT * FROM excluded_containers ORDER BY created_at DESC`);
    res.json(excluded);
  } catch (error) {
    logger.error('Fehler beim Abrufen der ausgeschlossenen Container:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der ausgeschlossenen Container' });
  }
});

// Container ausschließen
excludedRouter.post('/', async (req, res) => {
  try {
    const { containerId, containerName, reason } = req.body;
    
    if (!containerId) {
      return res.status(400).json({ error: 'containerId is required' });
    }

    await dbRun(
      `INSERT OR REPLACE INTO excluded_containers (container_id, container_name, reason)
       VALUES (?, ?, ?)`,
      [containerId, containerName || null, reason || null]
    );

    logger.info(`Container ${containerId} von Updates ausgeschlossen`);
    res.json({ success: true, message: 'Container successfully excluded' });
  } catch (error) {
    logger.error('Fehler beim Ausschließen des Containers:', error);
    res.status(500).json({ error: 'Fehler beim Ausschließen des Containers' });
  }
});

// Container wieder einschließen
excludedRouter.delete('/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;
    
    await dbRun(`DELETE FROM excluded_containers WHERE container_id = ?`, [containerId]);

    logger.info(`Container ${containerId} wieder für Updates eingeschlossen`);
    res.json({ success: true, message: 'Container successfully included' });
  } catch (error) {
    logger.error('Fehler beim Einschließen des Containers:', error);
    res.status(500).json({ error: 'Fehler beim Einschließen des Containers' });
  }
});

// Prüfen ob Container ausgeschlossen ist
excludedRouter.get('/check/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;
    
    const excluded = await dbGet(
      `SELECT * FROM excluded_containers WHERE container_id = ?`,
      [containerId]
    );

    res.json({ excluded: !!excluded });
  } catch (error) {
    logger.error('Fehler beim Prüfen des Ausschlusses:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen des Ausschlusses' });
  }
});




