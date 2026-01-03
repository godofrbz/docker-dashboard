import { Router } from 'express';
import { dbAll, dbRun } from '../database/db-helpers';
import { logger } from '../utils/logger';
import { updateScheduler } from '../services/schedulerService';

export const scheduleRouter = Router();

// Zeitplan erstellen
scheduleRouter.post('/', async (req, res) => {
  try {
    const { container_id, dayOfWeek, hour, minute, enabled } = req.body;
    
    // container_id ist optional (null = für alle Container)
    if (dayOfWeek === undefined || hour === undefined || minute === undefined) {
      return res.status(400).json({ error: 'dayOfWeek, hour und minute sind erforderlich' });
    }

    const result = await dbRun(
      `INSERT INTO schedules (container_id, day_of_week, hour, minute, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [
        container_id && container_id.trim() !== '' ? container_id : null,
        dayOfWeek, 
        hour, 
        minute, 
        enabled !== undefined ? enabled : 1
      ]
    );

    // Scheduler neu laden
    updateScheduler();

    res.json({ success: true, id: result.lastID });
  } catch (error) {
    logger.error('Fehler beim Erstellen des Zeitplans:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Zeitplans' });
  }
});

// Alle Zeitpläne abrufen
scheduleRouter.get('/', async (req, res) => {
  try {
    const schedules = await dbAll(`SELECT * FROM schedules ORDER BY day_of_week, hour, minute`);
    res.json(schedules);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Zeitpläne:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Zeitpläne' });
  }
});

// Zeitplan aktualisieren
scheduleRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { container_id, dayOfWeek, hour, minute, enabled } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (container_id !== undefined) {
      updates.push('container_id = ?');
      values.push(container_id && container_id.trim() !== '' ? container_id : null);
    }
    if (dayOfWeek !== undefined) {
      updates.push('day_of_week = ?');
      values.push(dayOfWeek);
    }
    if (hour !== undefined) {
      updates.push('hour = ?');
      values.push(hour);
    }
    if (minute !== undefined) {
      updates.push('minute = ?');
      values.push(minute);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben' });
    }

    values.push(id);
    await dbRun(
      `UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    updateScheduler();
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Zeitplans:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Zeitplans' });
  }
});

// Zeitplan löschen
scheduleRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(`DELETE FROM schedules WHERE id = ?`, [id]);
    updateScheduler();
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Löschen des Zeitplans:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Zeitplans' });
  }
});
