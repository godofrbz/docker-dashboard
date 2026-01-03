import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logService } from '../services/api';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

interface Log {
  id: number;
  container_id: string | null;
  action: string;
  status: string;
  message: string | null;
  timestamp: string;
}

const Logs: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [limit, setLimit] = useState<number>(100);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000); // Alle 10 Sekunden aktualisieren
    return () => clearInterval(interval);
  }, [filter, limit]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const containerId = filter !== 'all' ? filter : undefined;
      const response = await logService.getAll(containerId, limit);
      setLogs(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('logs.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('logs.title')}</Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('logs.filter')}</InputLabel>
            <Select
              value={filter}
              label={t('logs.filter')}
              onChange={(e) => setFilter(e.target.value)}
            >
              <MenuItem value="all">{t('logs.all')}</MenuItem>
              {/* Hier könnten Container-IDs dynamisch geladen werden */}
            </Select>
          </FormControl>
          <TextField
            type="number"
            label={t('logs.count')}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 10, max: 1000 }}
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('logs.timestamp')}</TableCell>
                <TableCell>{t('logs.containerId')}</TableCell>
                <TableCell>{t('logs.action')}</TableCell>
                <TableCell>{t('logs.status')}</TableCell>
                <TableCell>{t('logs.message')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {t('logs.noLogs')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.container_id
                        ? `${log.container_id.substring(0, 12)}...`
                        : '-'}
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.status}
                        color={getStatusColor(log.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{log.message || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default Logs;



