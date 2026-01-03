import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { backupService } from '../services/api';
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
} from '@mui/material';
import { Delete as DeleteIcon, Verified as VerifiedIcon, CheckCircle, Cancel, Restore as RestoreIcon } from '@mui/icons-material';

interface Backup {
  id: string;
  containerId: string;
  containerName: string;
  path: string;
  createdAt: string;
  size?: number;
  verified?: boolean;
  updateSuccessful?: boolean;
}

const Backups: React.FC = () => {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [backupToVerify, setBackupToVerify] = useState<string | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<string | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await backupService.getAll();
      setBackups(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('backups.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleDelete = async (backupId: string) => {
    setLoading(true);
    try {
      await backupService.delete(backupId);
      await loadBackups();
      setSelectedBackups(new Set());
    } catch (err: any) {
      setError(err.message || t('backups.errorDeleting'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedBackups.size === 0) return;

    setLoading(true);
    try {
      await backupService.deleteMultiple(Array.from(selectedBackups));
      setDeleteDialogOpen(false);
      setSelectedBackups(new Set());
      await loadBackups();
    } catch (err: any) {
      setError(err.message || t('backups.errorDeleting'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (backupId: string) => {
    setLoading(true);
    try {
      await backupService.verify(backupId);
      setVerifyDialogOpen(false);
      setBackupToVerify(null);
      await loadBackups();
    } catch (err: any) {
      setError(err.message || t('backups.errorVerifying'));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!backupToRestore) return;

    setLoading(true);
    try {
      await backupService.restore(backupToRestore);
      setRestoreDialogOpen(false);
      setBackupToRestore(null);
      await loadBackups();
    } catch (err: any) {
      setError(err.message || t('backups.errorRestoring'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBackup = (backupId: string) => {
    const newSelection = new Set(selectedBackups);
    if (newSelection.has(backupId)) {
      newSelection.delete(backupId);
    } else {
      newSelection.add(backupId);
    }
    setSelectedBackups(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedBackups.size === backups.length) {
      setSelectedBackups(new Set());
    } else {
      setSelectedBackups(new Set(backups.map(b => b.id)));
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return t('backups.unknownSize');
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('backups.title')}</Typography>
        <Box>
          {selectedBackups.size > 0 && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={loading}
              sx={{ mr: 2 }}
            >
              {t('backups.deleteSelected')} ({selectedBackups.size})
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={loadBackups}
            disabled={loading}
          >
            {t('common.refresh') || 'Refresh'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box>
          {loading && backups.length === 0 ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : backups.length === 0 ? (
        <Alert severity="info">
          {t('backups.noBackups') || 'No backups found. Backups are automatically created when updates are applied.'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedBackups.size > 0 && selectedBackups.size < backups.length}
                    checked={backups.length > 0 && selectedBackups.size === backups.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>{t('backups.container')}</TableCell>
                <TableCell>{t('backups.path')}</TableCell>
                <TableCell>{t('backups.created')}</TableCell>
                <TableCell>{t('backups.size')}</TableCell>
                <TableCell>{t('backups.status')}</TableCell>
                <TableCell>{t('backups.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map((backup) => {
                const isSelected = selectedBackups.has(backup.id);
                const canDelete = backup.updateSuccessful === true;

                return (
                  <TableRow key={backup.id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectBackup(backup.id)}
                        disabled={!canDelete}
                      />
                    </TableCell>
                    <TableCell>{backup.containerName || backup.containerId}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {backup.path}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {new Date(backup.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{formatFileSize(backup.size)}</TableCell>
                    <TableCell>
                      {backup.verified === true && (
                        <Chip 
                          icon={<VerifiedIcon />} 
                          label={t('backups.verified')} 
                          size="small" 
                          color="success" 
                          sx={{ mr: 1 }}
                        />
                      )}
                      {backup.updateSuccessful === true && (
                        <Chip 
                          icon={<CheckCircle />} 
                          label={t('backups.updateSuccessful')} 
                          size="small" 
                          color="success" 
                        />
                      )}
                      {backup.updateSuccessful === false && (
                        <Chip 
                          icon={<Cancel />} 
                          label={t('backups.updateFailed')} 
                          size="small" 
                          color="error" 
                        />
                      )}
                      {backup.updateSuccessful === undefined && (
                        <Chip 
                          label={t('backups.notVerified')} 
                          size="small" 
                          color="default" 
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title={t('backups.restore')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setBackupToRestore(backup.id);
                              setRestoreDialogOpen(true);
                            }}
                            disabled={loading}
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('backups.verify')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setBackupToVerify(backup.id);
                              setVerifyDialogOpen(true);
                            }}
                            disabled={loading}
                          >
                            <VerifiedIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={canDelete ? t('backups.delete') : t('backups.deleteRestriction')}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(backup.id)}
                              disabled={loading || !canDelete}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog für Löschen mehrerer Backups */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('backups.deleteSelected')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('backups.confirmDeleteSelected', { count: selectedBackups.size })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleDeleteMultiple} 
            variant="contained" 
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog für Backup-Verifizierung */}
      <Dialog open={verifyDialogOpen} onClose={() => setVerifyDialogOpen(false)}>
        <DialogTitle>{t('backups.verify')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('backups.confirmVerify')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setVerifyDialogOpen(false);
            setBackupToVerify(null);
          }}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={() => backupToVerify && handleVerify(backupToVerify)} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('backups.verify')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog für Backup-Wiederherstellung */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)}>
        <DialogTitle>{t('backups.restore')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('backups.confirmRestore')}
            {backupToRestore && (
              <>
                <br />
                <br />
                Backup: {backupToRestore}
                <br />
                Container: {backups.find(b => b.id === backupToRestore)?.containerName || backupToRestore.split('_')[0]}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRestoreDialogOpen(false);
            setBackupToRestore(null);
          }}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleRestore} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('backups.restore')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
};

export default Backups;

