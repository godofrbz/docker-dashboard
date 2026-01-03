import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { scheduleService } from '../services/api';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

interface Schedule {
  id: number;
  container_id: string | null;
  day_of_week: number;
  hour: number;
  minute: number;
  enabled: boolean;
}

const Schedule: React.FC = () => {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    container_id: '',
    day_of_week: 1,
    hour: 2,
    minute: 0,
    enabled: true,
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const response = await scheduleService.getAll();
      setSchedules(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('schedule.errorLoading'));
    }
  };

  const handleOpenDialog = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        container_id: '', // Immer leer, da nur "alle Container" unterstützt wird
        day_of_week: schedule.day_of_week,
        hour: schedule.hour,
        minute: schedule.minute,
        enabled: schedule.enabled,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        container_id: '',
        day_of_week: 1,
        hour: 2,
        minute: 0,
        enabled: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSchedule(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        container_id: '', // Immer leer, da nur "alle Container" unterstützt wird
      };
      
      if (editingSchedule) {
        await scheduleService.update(editingSchedule.id, submitData);
      } else {
        await scheduleService.create(submitData);
      }
      handleCloseDialog();
      await loadSchedules();
    } catch (err: any) {
      setError(err.message || t('schedule.errorSaving'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('schedule.confirmDelete'))) return;

    setLoading(true);
    try {
      await scheduleService.delete(id);
      await loadSchedules();
    } catch (err: any) {
      setError(err.message || t('schedule.errorDeleting'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('schedule.updateSchedules')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          {t('schedule.newSchedule')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('schedule.container')}</TableCell>
              <TableCell>{t('schedule.day')}</TableCell>
              <TableCell>{t('schedule.time')}</TableCell>
              <TableCell>{t('schedule.enabled')}</TableCell>
              <TableCell>{t('schedule.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>
                  {schedule.container_id ? (
                    <Chip label={`${schedule.container_id.substring(0, 12)}...`} size="small" />
                  ) : (
                    <Chip label={t('schedule.allContainers')} size="small" color="primary" />
                  )}
                </TableCell>
                <TableCell>{t(`schedule.days.${schedule.day_of_week}`)}</TableCell>
                <TableCell>
                  {String(schedule.hour).padStart(2, '0')}:
                  {String(schedule.minute).padStart(2, '0')}
                </TableCell>
                <TableCell>{schedule.enabled ? t('schedule.yes') : t('schedule.no')}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(schedule)}
                    color="primary"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(schedule.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSchedule ? t('schedule.editSchedule') : t('schedule.newSchedule')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('schedule.info')}
            </Alert>
            <TextField
              fullWidth
              select
              label={t('schedule.day')}
              value={formData.day_of_week}
              onChange={(e) => setFormData({ ...formData, day_of_week: Number(e.target.value) })}
              margin="normal"
              required
            >
              {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                <MenuItem key={index} value={index}>
                  {t(`schedule.days.${index}`)}
                </MenuItem>
              ))}
            </TextField>
            <Box display="flex" gap={2} mt={2}>
              <TextField
                type="number"
                label={t('schedule.hour')}
                value={formData.hour}
                onChange={(e) => setFormData({ ...formData, hour: Number(e.target.value) })}
                inputProps={{ min: 0, max: 23 }}
                required
              />
              <TextField
                type="number"
                label={t('schedule.minute')}
                value={formData.minute}
                onChange={(e) => setFormData({ ...formData, minute: Number(e.target.value) })}
                inputProps={{ min: 0, max: 59 }}
                required
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label={t('schedule.enabled')}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Schedule;

