import { dbRun, dbGet, dbAll } from '../database/db-helpers';
import { logger } from '../utils/logger';

export type WidgetType = 'container-list' | 'stats-overview' | 'updates-available' | 'recent-logs' | 'favorites';

export interface DashboardWidget {
  id?: number;
  widgetType: WidgetType;
  widgetConfig: string; // JSON string
  position: number;
  visible: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get all dashboard widgets
 */
export async function getDashboardWidgets(): Promise<DashboardWidget[]> {
  const widgets = await dbAll(
    `SELECT * FROM dashboard_widgets WHERE visible = 1 ORDER BY position ASC`
  ) as any[];
  
  return widgets.map(w => ({
    id: w.id,
    widgetType: w.widget_type as WidgetType,
    widgetConfig: w.widget_config || '{}',
    position: w.position,
    visible: w.visible === 1,
    createdAt: w.created_at,
    updatedAt: w.updated_at
  }));
}

/**
 * Create or update dashboard widget
 */
export async function saveDashboardWidget(widget: DashboardWidget): Promise<number> {
  const configJson = typeof widget.widgetConfig === 'string' 
    ? widget.widgetConfig 
    : JSON.stringify(widget.widgetConfig);
  
  if (widget.id) {
    await dbRun(
      `UPDATE dashboard_widgets 
       SET widget_type = ?, widget_config = ?, position = ?, visible = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [widget.widgetType, configJson, widget.position, widget.visible ? 1 : 0, widget.id]
    );
    return widget.id;
  } else {
    const result = await dbRun(
      `INSERT INTO dashboard_widgets (widget_type, widget_config, position, visible)
       VALUES (?, ?, ?, ?)`,
      [widget.widgetType, configJson, widget.position || 0, widget.visible ? 1 : 0]
    );
    return (result as any).lastID;
  }
}

/**
 * Delete dashboard widget
 */
export async function deleteDashboardWidget(widgetId: number): Promise<void> {
  await dbRun(`DELETE FROM dashboard_widgets WHERE id = ?`, [widgetId]);
}

/**
 * Reorder widgets
 */
export async function reorderWidgets(widgetIds: number[]): Promise<void> {
  for (let i = 0; i < widgetIds.length; i++) {
    await dbRun(
      `UPDATE dashboard_widgets SET position = ? WHERE id = ?`,
      [i, widgetIds[i]]
    );
  }
}

/**
 * Favorite containers
 */
export async function addFavoriteContainer(containerId: string, containerName: string): Promise<void> {
  try {
    await dbRun(
      `INSERT OR IGNORE INTO favorite_containers (container_id, container_name)
       VALUES (?, ?)`,
      [containerId, containerName]
    );
  } catch (error) {
    logger.error(`Error adding favorite container:`, error);
  }
}

export async function removeFavoriteContainer(containerId: string): Promise<void> {
  await dbRun(`DELETE FROM favorite_containers WHERE container_id = ?`, [containerId]);
}

export async function getFavoriteContainers(): Promise<any[]> {
  return await dbAll(`SELECT * FROM favorite_containers ORDER BY created_at DESC`);
}

export async function isFavoriteContainer(containerId: string): Promise<boolean> {
  const result = await dbGet(
    `SELECT id FROM favorite_containers WHERE container_id = ?`,
    [containerId]
  );
  return !!result;
}

/**
 * Initialize default widgets if none exist
 */
export async function initializeDefaultWidgets(): Promise<void> {
  const existing = await dbAll(`SELECT COUNT(*) as count FROM dashboard_widgets`);
  const count = (existing[0] as any)?.count || 0;
  
  if (count === 0) {
    // Create default widgets
    const defaultWidgets = [
      { widgetType: 'stats-overview' as WidgetType, widgetConfig: '{"title": "Container Overview"}', position: 0 },
      { widgetType: 'container-list' as WidgetType, widgetConfig: '{"title": "Containers", "limit": 5}', position: 1 },
      { widgetType: 'updates-available' as WidgetType, widgetConfig: '{"title": "Available Updates", "limit": 5}', position: 2 },
      { widgetType: 'recent-logs' as WidgetType, widgetConfig: '{"title": "Recent Logs", "limit": 5}', position: 3 },
    ];
    
    for (const widget of defaultWidgets) {
      await saveDashboardWidget({
        widgetType: widget.widgetType,
        widgetConfig: widget.widgetConfig,
        position: widget.position,
        visible: true
      });
    }
    
    logger.info('Default dashboard widgets initialized');
  }
}

