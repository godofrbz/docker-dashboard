import axios from 'axios';

// Verwende relative URL, da Frontend vom Backend serviert wird
// In Entwicklung: http://localhost:3001/api
// In Production: /api (relativ zur aktuellen Domain)
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Wichtig für Session-Cookies
});

// Interceptor für 401-Fehler (Session abgelaufen)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Session abgelaufen - zur Login-Seite weiterleiten
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('authenticated');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const containerService = {
  getAll: () => api.get('/containers'),
  getById: (id: string) => api.get(`/containers/${id}`),
  getStats: (id: string) => api.get(`/containers/${id}/stats`),
  getFormattedStats: (id: string) => api.get(`/containers/${id}/stats/formatted`),
  getStatsHistory: (id: string, hours: number = 24) => api.get(`/containers/${id}/stats/history`, { params: { hours } }),
  getAllLatestStats: () => api.get('/containers/stats/latest'),
};

export const updateService = {
  check: (containerId: string) => api.post('/updates/check', { containerId }),
  checkAll: () => api.post('/updates/check-all'),
  apply: (containerId: string) => api.post('/updates/apply', { containerId }),
  applyBatch: (containerIds: string[]) => api.post('/updates/apply-batch', { containerIds }),
  getAvailable: () => api.get('/updates/available'),
};

export const scheduleService = {
  getAll: () => api.get('/schedule'),
  create: (data: any) => api.post('/schedule', { 
    container_id: data.container_id || null,
    dayOfWeek: data.day_of_week,
    hour: data.hour,
    minute: data.minute,
    enabled: data.enabled
  }),
  update: (id: number, data: any) => api.put(`/schedule/${id}`, {
    container_id: data.container_id || null,
    dayOfWeek: data.day_of_week,
    hour: data.hour,
    minute: data.minute,
    enabled: data.enabled
  }),
  delete: (id: number) => api.delete(`/schedule/${id}`),
};

export const notificationService = {
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data: any) => api.put('/notifications/settings', data),
  sendTestEmail: () => api.post('/notifications/test-email'),
};

export const logService = {
  getAll: (containerId?: string, limit?: number) => 
    api.get('/logs', { params: { containerId, limit } }),
  getByContainer: (containerId: string, limit?: number) =>
    api.get(`/logs/container/${containerId}`, { params: { limit } }),
};

export const backupService = {
  getAll: () => api.get('/backups'),
  create: (containerId: string) => api.post('/backups/create', { containerId }),
  delete: (backupId: string) => api.delete(`/backups/${backupId}`),
  deleteMultiple: (backupIds: string[]) => api.post('/backups/delete-multiple', { backupIds }),
  verify: (backupId: string) => api.post(`/backups/${backupId}/verify`),
  restore: (backupId: string) => api.post(`/backups/${backupId}/restore`),
};

export const excludedService = {
  getAll: () => api.get('/excluded'),
  exclude: (containerId: string, containerName?: string, reason?: string) => 
    api.post('/excluded', { containerId, containerName, reason }),
  include: (containerId: string) => api.delete(`/excluded/${containerId}`),
  check: (containerId: string) => api.get(`/excluded/check/${containerId}`),
};

export const authService = {
  login: (username: string, password: string) => 
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  check: () => api.get('/auth/check'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),
};

export const settingsService = {
  get: () => api.get('/settings'),
  update: (data: { sessionTimeoutMinutes?: number; language?: string; theme?: string }) =>
    api.put('/settings', data),
};

export const updateStrategiesService = {
  getAll: () => api.get('/update-strategies'),
  getByContainer: (containerId: string) => api.get(`/update-strategies/${containerId}`),
  update: (containerId: string, data: { updatePolicy?: string; autoRollback?: boolean; rollbackOnFailure?: boolean }) =>
    api.put(`/update-strategies/${containerId}`, data),
  delete: (containerId: string) => api.delete(`/update-strategies/${containerId}`),
};

export const dashboardService = {
  getWidgets: () => api.get('/dashboard/widgets'),
  saveWidget: (data: { widgetType: string; widgetConfig: any; position?: number; visible?: boolean }) =>
    api.post('/dashboard/widgets', data),
  updateWidget: (id: number, data: { widgetType?: string; widgetConfig?: any; position?: number; visible?: boolean }) =>
    api.put(`/dashboard/widgets/${id}`, data),
  deleteWidget: (id: number) => api.delete(`/dashboard/widgets/${id}`),
  reorderWidgets: (widgetIds: number[]) => api.post('/dashboard/widgets/reorder', { widgetIds }),
  getFavorites: () => api.get('/dashboard/favorites'),
  addFavorite: (containerId: string, containerName?: string) => api.post(`/dashboard/favorites/${containerId}`, { containerName }),
  removeFavorite: (containerId: string) => api.delete(`/dashboard/favorites/${containerId}`),
  checkFavorite: (containerId: string) => api.get(`/dashboard/favorites/${containerId}/check`),
};

export default api;

