import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { containerService } from '../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  LinearProgress,
  Paper,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StatsData {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
  timestamp: string;
}

const ContainerStats: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadStats();
      loadHistory();
      const interval = setInterval(() => {
        loadStats();
        loadHistory();
      }, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadStats = async () => {
    if (!id) return;
    try {
      const response = await containerService.getFormattedStats(id);
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!id) return;
    try {
      const response = await containerService.getStatsHistory(id, 24);
      setHistory(response.data);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading && !stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !stats) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!stats) {
    return <Alert severity="info">{t('stats.noData')}</Alert>;
  }

  const chartData = history.map((h: any) => ({
    time: new Date(h.timestamp).toLocaleTimeString(),
    cpu: parseFloat(h.cpu_percent) || 0,
    memory: parseFloat(h.memory_percent) || 0,
  }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {t('stats.title')} - {id?.substring(0, 12)}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* CPU Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('stats.cpuUsage')}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(stats.cpuPercent, 100)}
                  color={stats.cpuPercent > 80 ? 'error' : stats.cpuPercent > 50 ? 'warning' : 'success'}
                  sx={{ height: 20, borderRadius: 1 }}
                />
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {stats.cpuPercent.toFixed(2)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('stats.memoryUsage')}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(stats.memoryPercent, 100)}
                  color={stats.memoryPercent > 80 ? 'error' : stats.memoryPercent > 50 ? 'warning' : 'success'}
                  sx={{ height: 20, borderRadius: 1 }}
                />
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {stats.memoryPercent.toFixed(2)}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {formatBytes(stats.memoryUsage)} / {formatBytes(stats.memoryLimit)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Network */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('stats.network')}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">
                  {t('stats.received')}: {formatBytes(stats.networkRx)}
                </Typography>
                <Typography variant="body1">
                  {t('stats.sent')}: {formatBytes(stats.networkTx)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Block I/O */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('stats.blockIO')}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">
                  {t('stats.read')}: {formatBytes(stats.blockRead)}
                </Typography>
                <Typography variant="body1">
                  {t('stats.write')}: {formatBytes(stats.blockWrite)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* History Chart */}
        {chartData.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('stats.history')} (24h)
                </Typography>
                <Box sx={{ mt: 2, height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="cpu" stroke="#8884d8" name={t('stats.cpu')} />
                      <Line type="monotone" dataKey="memory" stroke="#82ca9d" name={t('stats.memory')} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ContainerStats;

