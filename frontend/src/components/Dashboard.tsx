import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { containerService, excludedService, backupService } from '../services/api';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material';
import { Storage as ContainerIcon, Block as BlockIcon, CheckCircleOutline, Backup as BackupIcon } from '@mui/icons-material';

interface Container {
  Id: string;
  Names: string[];
  Image: string;
  Status: string;
  State: string;
  Created: number;
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excludedContainers, setExcludedContainers] = useState<Set<string>>(new Set());
  const [updatingExclusion, setUpdatingExclusion] = useState<Set<string>>(new Set());
  const [creatingBackup, setCreatingBackup] = useState<Set<string>>(new Set());

  const loadContainers = useCallback(async () => {
    try {
      const response = await containerService.getAll();
      setContainers(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('dashboard.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadExcluded = useCallback(async () => {
    try {
      const response = await excludedService.getAll();
      const excluded = new Set<string>(response.data.map((e: any) => e.container_id as string));
      setExcludedContainers(excluded);
    } catch (err: any) {
      // Ignoriere Fehler beim Laden der ausgeschlossenen Container
    }
  }, []);

  useEffect(() => {
    loadContainers();
    loadExcluded();
    const interval = setInterval(() => {
      loadContainers();
      loadExcluded();
    }, 10000); // Alle 10 Sekunden aktualisieren (Performance-Optimierung)
    return () => clearInterval(interval);
  }, [loadContainers, loadExcluded]);

  const handleToggleExclusion = async (containerId: string, containerName: string) => {
    const isExcluded = excludedContainers.has(containerId);
    setUpdatingExclusion(prev => new Set(prev).add(containerId));

    try {
      if (isExcluded) {
        await excludedService.include(containerId);
      } else {
        await excludedService.exclude(containerId, containerName);
      }
      await loadExcluded();
    } catch (err: any) {
      setError(err.message || t('dashboard.errorLoading'));
    } finally {
      setUpdatingExclusion(prev => {
        const newSet = new Set(prev);
        newSet.delete(containerId);
        return newSet;
      });
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'running':
        return 'success';
      case 'exited':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleCreateBackup = async (containerId: string, containerName: string) => {
    setCreatingBackup(prev => new Set(prev).add(containerId));

    try {
      const response = await backupService.create(containerId);
      alert(response.data.message || t('dashboard.backupCreated'));
    } catch (err: any) {
      alert(err.response?.data?.error || t('dashboard.backupError'));
    } finally {
      setCreatingBackup(prev => {
        const newSet = new Set(prev);
        newSet.delete(containerId);
        return newSet;
      });
    }
  };

  const runningCount = containers.filter(c => c.State === 'running').length;
  const stoppedCount = containers.filter(c => c.State !== 'running').length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">
          {t('dashboard.containerOverview')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    {t('dashboard.total')}
                  </Typography>
                  <Typography variant="h4">{containers.length}</Typography>
                </Box>
                <ContainerIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    {t('dashboard.running')}
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {runningCount}
                  </Typography>
                </Box>
                <ContainerIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    {t('dashboard.stopped')}
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stoppedCount}
                  </Typography>
                </Box>
                <ContainerIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('dashboard.name')}</TableCell>
              <TableCell>{t('dashboard.image')}</TableCell>
              <TableCell>{t('dashboard.status')}</TableCell>
              <TableCell>{t('dashboard.state')}</TableCell>
              <TableCell>{t('dashboard.created')}</TableCell>
              <TableCell align="center">{t('dashboard.updates')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {containers.map((container) => {
              const containerName = container.Names[0]?.replace('/', '') || t('dashboard.unknown');
              const isExcluded = excludedContainers.has(container.Id);
              const isUpdating = updatingExclusion.has(container.Id);

              return (
                <TableRow key={container.Id}>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => navigate(`/containers/${container.Id}/stats`)}
                      sx={{ textTransform: 'none' }}
                    >
                      {containerName}
                    </Button>
                  </TableCell>
                  <TableCell>{container.Image}</TableCell>
                  <TableCell>{container.Status}</TableCell>
                  <TableCell>
                    <Chip
                      label={container.State}
                      color={getStatusColor(container.State) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(container.Created * 1000).toLocaleString()}
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" gap={2} justifyContent="center">
                      <Tooltip title={t('dashboard.createBackup')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleCreateBackup(container.Id, containerName)}
                          disabled={creatingBackup.has(container.Id)}
                        >
                          {creatingBackup.has(container.Id) ? (
                            <CircularProgress size={20} />
                          ) : (
                            <BackupIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={isExcluded ? t('dashboard.enableUpdates') : t('dashboard.disableUpdates')}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!isExcluded}
                              onChange={() => handleToggleExclusion(container.Id, containerName)}
                              disabled={isUpdating}
                              size="small"
                            />
                          }
                          label={isExcluded ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <BlockIcon fontSize="small" color="warning" />
                              <Typography variant="body2" color="textSecondary">
                                {t('dashboard.excluded')}
                              </Typography>
                            </Box>
                          ) : (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <CheckCircleOutline fontSize="small" color="success" />
                              <Typography variant="body2" color="textSecondary">
                                {t('dashboard.included')}
                              </Typography>
                            </Box>
                          )}
                          labelPlacement="end"
                        />
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      </Box>
    </Box>
  );
};

export default Dashboard;

