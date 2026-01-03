import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { updateService, excludedService, updateStrategiesService, containerService } from '../services/api';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import { Update as UpdateIcon, CheckCircle, Block as BlockIcon, CheckCircleOutline, Settings as SettingsIcon } from '@mui/icons-material';

interface AvailableUpdate {
  id: number;
  container_id: string;
  container_name: string;
  current_image: string;
  available_image: string;
  detected_at: string;
  notified: boolean;
}

// Hilfsfunktion zum Extrahieren der Version aus einem Image-String
const extractVersion = (image: string): string => {
  // Extrahiere Tag/Version aus Image-String
  // Format: image:tag oder image@sha256:hash
  const parts = image.split(':');
  if (parts.length > 1) {
    const tag = parts[parts.length - 1];
    // Entferne SHA256-Hash falls vorhanden
    if (tag.includes('@')) {
      return tag.split('@')[0];
    }
    return tag;
  }
  return 'latest';
};

// Hilfsfunktion zum Extrahieren des Image-Namens ohne Tag
const extractImageName = (image: string): string => {
  const parts = image.split(':');
  if (parts.length > 1) {
    return parts.slice(0, -1).join(':');
  }
  return image;
};

interface UpdateStrategy {
  id?: number;
  containerId: string;
  updatePolicy: 'manual' | 'auto' | 'scheduled';
  autoRollback: boolean;
  rollbackOnFailure: boolean;
}

const Updates: React.FC = () => {
  const { t } = useTranslation();
  const [updates, setUpdates] = useState<AvailableUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [excludedContainers, setExcludedContainers] = useState<Set<string>>(new Set());
  const [excludeDialogOpen, setExcludeDialogOpen] = useState(false);
  const [containerToExclude, setContainerToExclude] = useState<{ id: string; name: string } | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [strategies, setStrategies] = useState<Map<string, UpdateStrategy>>(new Map());
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<UpdateStrategy | null>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [selectedStrategyContainers, setSelectedStrategyContainers] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditStrategy, setBulkEditStrategy] = useState<Partial<UpdateStrategy>>({
    updatePolicy: 'manual',
    autoRollback: false,
    rollbackOnFailure: true
  });

  const loadUpdates = useCallback(async () => {
    try {
      const response = await updateService.getAvailable();
      setUpdates(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('updates.errorLoading'));
    }
  }, [t]);

  const loadExcluded = useCallback(async () => {
    try {
      const response = await excludedService.getAll();
      const excluded = new Set<string>(response.data.map((e: any) => e.container_id as string));
      setExcludedContainers(excluded);
    } catch (err: any) {
      // Ignore errors loading excluded containers
    }
  }, []);

  const loadStrategies = useCallback(async () => {
    try {
      setLoading(true);
      const [strategiesRes, containersRes] = await Promise.all([
        updateStrategiesService.getAll(),
        containerService.getAll()
      ]);
      
      const strategiesMap = new Map<string, UpdateStrategy>();
      strategiesRes.data.forEach((s: UpdateStrategy) => {
        strategiesMap.set(s.containerId, s);
      });
      setStrategies(strategiesMap);
      setContainers(containersRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tabValue === 0) {
      loadUpdates();
      loadExcluded();
    } else if (tabValue === 1) {
      loadStrategies();
    }
  }, [tabValue, loadUpdates, loadExcluded, loadStrategies]);

  const handleEditStrategy = async (containerId: string) => {
    try {
      const response = await updateStrategiesService.getByContainer(containerId);
      setEditingStrategy(response.data);
      setStrategyDialogOpen(true);
    } catch (err: any) {
      // Strategy doesn't exist, create default
      setEditingStrategy({
        containerId,
        updatePolicy: 'manual',
        autoRollback: false,
        rollbackOnFailure: true
      });
      setStrategyDialogOpen(true);
    }
  };

  const handleSaveStrategy = async () => {
    if (!editingStrategy) return;
    
    try {
      setLoading(true);
      await updateStrategiesService.update(editingStrategy.containerId, {
        updatePolicy: editingStrategy.updatePolicy,
        autoRollback: editingStrategy.autoRollback,
        rollbackOnFailure: editingStrategy.rollbackOnFailure
      });
      setStrategyDialogOpen(false);
      setEditingStrategy(null);
      await loadStrategies();
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExcludeContainer = async () => {
    if (!containerToExclude) return;

    setLoading(true);
    try {
      await excludedService.exclude(
        containerToExclude.id,
        containerToExclude.name
      );
      await loadExcluded();
      setExcludeDialogOpen(false);
      setContainerToExclude(null);
    } catch (err: any) {
      setError(err.message || t('updates.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleIncludeContainer = async (containerId: string) => {
    setLoading(true);
    try {
      await excludedService.include(containerId);
      await loadExcluded();
    } catch (err: any) {
      setError(err.message || t('updates.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAll = async () => {
    setLoading(true);
    try {
      await updateService.checkAll();
      await loadUpdates();
    } catch (err: any) {
      setError(err.message || t('updates.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdate = async (containerId: string) => {
    setLoading(true);
    try {
      await updateService.apply(containerId);
      setDialogOpen(false);
      setSelectedContainers(new Set());
      await loadUpdates();
    } catch (err: any) {
      setError(err.message || t('updates.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBatchUpdate = async () => {
    if (selectedContainers.size === 0) return;

    setLoading(true);
    try {
      await updateService.applyBatch(Array.from(selectedContainers));
      setBatchDialogOpen(false);
      setSelectedContainers(new Set());
      await loadUpdates();
    } catch (err: any) {
      setError(err.message || t('updates.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContainer = (containerId: string) => {
    const newSelection = new Set(selectedContainers);
    if (newSelection.has(containerId)) {
      newSelection.delete(containerId);
    } else {
      newSelection.add(containerId);
    }
    setSelectedContainers(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedContainers.size === updates.length) {
      setSelectedContainers(new Set());
    } else {
      setSelectedContainers(new Set(updates.map(u => u.container_id)));
    }
  };

  const openDialog = (containerId: string) => {
    setSelectedContainers(new Set([containerId]));
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('updates.title')}</Typography>
        {tabValue === 0 && (
          <Box>
            {selectedContainers.size > 0 && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setBatchDialogOpen(true)}
                disabled={loading}
                sx={{ mr: 2 }}
              >
                {t('updates.applySelected')} ({selectedContainers.size})
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<UpdateIcon />}
              onClick={handleCheckAll}
              disabled={loading}
            >
              {t('updates.checkAll')}
            </Button>
          </Box>
        )}
      </Box>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label={t('updates.available')} />
        <Tab label={t('updateStrategies.title')} />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {tabValue === 1 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">{t('updateStrategies.title')}</Typography>
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setBulkEditDialogOpen(true)}
                disabled={selectedStrategyContainers.size === 0 || loading}
                startIcon={<SettingsIcon />}
              >
                {t('updateStrategies.bulkEdit')}
                {selectedStrategyContainers.size > 0 && ` (${selectedStrategyContainers.size})`}
              </Button>
              <Button
                variant="outlined"
                onClick={loadStrategies}
                disabled={loading}
              >
                {t('common.refresh')}
              </Button>
            </Box>
          </Box>

          {loading && strategies.size === 0 ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedStrategyContainers.size > 0 && selectedStrategyContainers.size < containers.length}
                        checked={containers.length > 0 && selectedStrategyContainers.size === containers.length}
                        onChange={() => {
                          if (selectedStrategyContainers.size === containers.length) {
                            setSelectedStrategyContainers(new Set());
                          } else {
                            setSelectedStrategyContainers(new Set(containers.map(c => c.Id)));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>{t('updateStrategies.container')}</TableCell>
                    <TableCell>{t('updateStrategies.updatePolicy')}</TableCell>
                    <TableCell>{t('updateStrategies.autoRollback')}</TableCell>
                    <TableCell>{t('updateStrategies.rollbackOnFailure')}</TableCell>
                    <TableCell align="right">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {containers.map((container) => {
                    const strategy = strategies.get(container.Id);
                    const containerName = container.Names[0]?.replace('/', '') || container.Id.substring(0, 12);
                    const isSelected = selectedStrategyContainers.has(container.Id);
                    
                    return (
                      <TableRow key={container.Id} selected={isSelected}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => {
                              const newSelection = new Set(selectedStrategyContainers);
                              if (isSelected) {
                                newSelection.delete(container.Id);
                              } else {
                                newSelection.add(container.Id);
                              }
                              setSelectedStrategyContainers(newSelection);
                            }}
                          />
                        </TableCell>
                        <TableCell>{containerName}</TableCell>
                        <TableCell>
                          {strategy ? t(`updateStrategies.${strategy.updatePolicy}`) : t('updateStrategies.manual')}
                        </TableCell>
                        <TableCell>{strategy ? (strategy.autoRollback ? t('common.yes') : t('common.no')) : t('common.no')}</TableCell>
                        <TableCell>{strategy ? (strategy.rollbackOnFailure ? t('common.yes') : t('common.no')) : t('common.yes')}</TableCell>
                        <TableCell align="right">
                          <Button
                            startIcon={<SettingsIcon />}
                            onClick={() => handleEditStrategy(container.Id)}
                            size="small"
                          >
                            {t('common.edit')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Dialog open={strategyDialogOpen} onClose={() => setStrategyDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{t('updateStrategies.title')}</DialogTitle>
            <DialogContent>
              {editingStrategy && (
                <Box sx={{ pt: 2 }}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>{t('updateStrategies.updatePolicy')}</InputLabel>
                    <Select
                      value={editingStrategy.updatePolicy}
                      onChange={(e) => setEditingStrategy({
                        ...editingStrategy,
                        updatePolicy: e.target.value as 'manual' | 'auto' | 'scheduled'
                      })}
                      label={t('updateStrategies.updatePolicy')}
                    >
                      <MenuItem value="manual">{t('updateStrategies.manual')}</MenuItem>
                      <MenuItem value="auto">{t('updateStrategies.auto')}</MenuItem>
                      <MenuItem value="scheduled">{t('updateStrategies.scheduled')}</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingStrategy.autoRollback}
                        onChange={(e) => setEditingStrategy({
                          ...editingStrategy,
                          autoRollback: e.target.checked
                        })}
                      />
                    }
                    label={t('updateStrategies.autoRollback')}
                    sx={{ mt: 2, display: 'block' }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingStrategy.rollbackOnFailure}
                        onChange={(e) => setEditingStrategy({
                          ...editingStrategy,
                          rollbackOnFailure: e.target.checked
                        })}
                      />
                    }
                    label={t('updateStrategies.rollbackOnFailure')}
                    sx={{ mt: 1, display: 'block' }}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStrategyDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveStrategy} variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={24} /> : t('common.save')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Bulk Edit Dialog */}
          <Dialog open={bulkEditDialogOpen} onClose={() => setBulkEditDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{t('updateStrategies.bulkEdit')}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                {t('updateStrategies.bulkEditDescription', { count: selectedStrategyContainers.size })}
              </DialogContentText>
              <Box sx={{ pt: 1 }}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>{t('updateStrategies.updatePolicy')}</InputLabel>
                  <Select
                    value={bulkEditStrategy.updatePolicy}
                    onChange={(e) => setBulkEditStrategy({
                      ...bulkEditStrategy,
                      updatePolicy: e.target.value as 'manual' | 'auto' | 'scheduled'
                    })}
                    label={t('updateStrategies.updatePolicy')}
                  >
                    <MenuItem value="manual">{t('updateStrategies.manual')}</MenuItem>
                    <MenuItem value="auto">{t('updateStrategies.auto')}</MenuItem>
                    <MenuItem value="scheduled">{t('updateStrategies.scheduled')}</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={bulkEditStrategy.autoRollback || false}
                      onChange={(e) => setBulkEditStrategy({
                        ...bulkEditStrategy,
                        autoRollback: e.target.checked
                      })}
                    />
                  }
                  label={t('updateStrategies.autoRollback')}
                  sx={{ mt: 2, display: 'block' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={bulkEditStrategy.rollbackOnFailure !== undefined ? bulkEditStrategy.rollbackOnFailure : true}
                      onChange={(e) => setBulkEditStrategy({
                        ...bulkEditStrategy,
                        rollbackOnFailure: e.target.checked
                      })}
                    />
                  }
                  label={t('updateStrategies.rollbackOnFailure')}
                  sx={{ mt: 1, display: 'block' }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setBulkEditDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button
                onClick={async () => {
                  if (selectedStrategyContainers.size === 0) return;
                  
                  setLoading(true);
                  try {
                    const promises = Array.from(selectedStrategyContainers).map(containerId =>
                      updateStrategiesService.update(containerId, {
                        updatePolicy: bulkEditStrategy.updatePolicy,
                        autoRollback: bulkEditStrategy.autoRollback,
                        rollbackOnFailure: bulkEditStrategy.rollbackOnFailure
                      })
                    );
                    
                    await Promise.all(promises);
                    setBulkEditDialogOpen(false);
                    setSelectedStrategyContainers(new Set());
                    await loadStrategies();
                  } catch (err: any) {
                    setError(err.message || t('common.error'));
                  } finally {
                    setLoading(false);
                  }
                }}
                variant="contained"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : t('updateStrategies.applyToSelected')}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {tabValue === 0 && (
        <Box>
          {loading && updates.length === 0 ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : updates.length === 0 ? (
        <Alert severity="info">
          {t('updates.noUpdates')}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedContainers.size > 0 && selectedContainers.size < updates.length}
                    checked={updates.length > 0 && selectedContainers.size === updates.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>{t('updates.container')}</TableCell>
                <TableCell>Current Image</TableCell>
                <TableCell>{t('updates.currentVersion')}</TableCell>
                <TableCell>Available Image</TableCell>
                <TableCell>{t('updates.newVersion')}</TableCell>
                <TableCell>Detected</TableCell>
                <TableCell>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {updates.map((update) => {
                const currentVersion = extractVersion(update.current_image);
                const newVersion = extractVersion(update.available_image);
                const currentImageName = extractImageName(update.current_image);
                const newImageName = extractImageName(update.available_image);
                const isSelected = selectedContainers.has(update.container_id);

                return (
                  <TableRow key={update.id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectContainer(update.container_id)}
                      />
                    </TableCell>
                    <TableCell>{update.container_name || update.container_id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {currentImageName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={currentVersion} size="small" color="default" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {newImageName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={newVersion} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      {new Date(update.detected_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Button
                          variant="outlined"
                          color="primary"
                          startIcon={<CheckCircle />}
                          onClick={() => openDialog(update.container_id)}
                          disabled={loading}
                          size="small"
                        >
                          {t('updates.apply')}
                        </Button>
                        {excludedContainers.has(update.container_id) ? (
                          <Tooltip title={t('dashboard.included')}>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleIncludeContainer(update.container_id)}
                              disabled={loading}
                            >
                              <CheckCircleOutline />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title={t('dashboard.excluded')}>
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => {
                                setContainerToExclude({
                                  id: update.container_id,
                                  name: update.container_name || update.container_id
                                });
                                setExcludeDialogOpen(true);
                              }}
                              disabled={loading}
                            >
                              <BlockIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog für einzelnes Update */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{t('updates.applyUpdate')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('updates.confirmApply')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={() => handleApplyUpdate(Array.from(selectedContainers)[0])} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('updates.apply')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog für Batch-Updates */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)}>
        <DialogTitle>{t('updates.applySelectedUpdates')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('updates.confirmApplySelected', { count: selectedContainers.size })}
            <br />
            <br />
            Selected containers:
            <ul>
              {Array.from(selectedContainers).map(containerId => {
                const update = updates.find(u => u.container_id === containerId);
                return (
                  <li key={containerId}>
                    {update?.container_name || containerId}
                  </li>
                );
              })}
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleApplyBatchUpdate} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('updates.applySelected')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog für Container-Ausschluss */}
      <Dialog open={excludeDialogOpen} onClose={() => setExcludeDialogOpen(false)}>
        <DialogTitle>{t('updates.excludeContainer')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('updates.confirmExclude')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setExcludeDialogOpen(false);
            setContainerToExclude(null);
          }}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleExcludeContainer} 
            variant="contained" 
            color="warning"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('dashboard.excluded')}
          </Button>
        </DialogActions>
      </Dialog>
        </Box>
      )}
    </Box>
  );
};

export default Updates;
