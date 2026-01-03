import React, { useState, useEffect } from 'react';
import { notificationService, authService, settingsService } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import { Save as SaveIcon, Lock as LockIcon, Email as EmailIcon, Brightness4, Brightness7 } from '@mui/icons-material';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useTheme();
  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: false,
    emailAddress: '',
    webEnabled: true,
  });
  const [passwordSettings, setPasswordSettings] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [appSettings, setAppSettings] = useState({
    sessionTimeoutMinutes: 30,
    language: 'en',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Lade Benachrichtigungseinstellungen
      const notificationResponse = await notificationService.getSettings();
      setNotificationSettings({
        emailEnabled: notificationResponse.data.email_enabled === 1,
        emailAddress: notificationResponse.data.email_address || '',
        webEnabled: notificationResponse.data.web_enabled === 1,
      });

      // Lade App-Einstellungen
      const appResponse = await settingsService.get();
      setAppSettings({
        sessionTimeoutMinutes: appResponse.data.sessionTimeoutMinutes || 30,
        language: appResponse.data.language || 'en',
      });

      // Setze Sprache
      i18n.changeLanguage(appResponse.data.language || 'en');
      
      // Theme wird automatisch vom ThemeContext geladen

      setError(null);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await notificationService.updateSettings(notificationSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await settingsService.update(appSettings);
      i18n.changeLanguage(appSettings.language);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Seite neu laden, um Session-Timeout zu aktualisieren
      window.location.reload();
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailError(null);
    setTestEmailSuccess(false);
    try {
      await notificationService.sendTestEmail();
      setTestEmailSuccess(true);
      setTimeout(() => setTestEmailSuccess(false), 5000);
    } catch (err: any) {
      setTestEmailError(err.response?.data?.error || err.message || t('settings.testEmailError'));
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordSettings.newPassword !== passwordSettings.confirmPassword) {
      setPasswordError(t('settings.passwordMismatch'));
      return;
    }

    if (passwordSettings.newPassword.length < 8) {
      setPasswordError(t('settings.passwordTooShort'));
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword(
        passwordSettings.oldPassword,
        passwordSettings.newPassword
      );
      setPasswordSuccess(true);
      setPasswordSettings({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setPasswordError(t('settings.invalidOldPassword'));
      } else {
        setPasswordError(err.response?.data?.error || t('common.error'));
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('settings.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('common.success')}
        </Alert>
      )}

      {/* Passwort-Änderung */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <LockIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {t('settings.changePassword')}
            </Typography>
          </Box>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}

          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {t('settings.passwordChanged')}
            </Alert>
          )}

          <TextField
            fullWidth
            label={t('settings.oldPassword')}
            type="password"
            value={passwordSettings.oldPassword}
            onChange={(e) =>
              setPasswordSettings({ ...passwordSettings, oldPassword: e.target.value })
            }
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('settings.newPassword')}
            type="password"
            value={passwordSettings.newPassword}
            onChange={(e) =>
              setPasswordSettings({ ...passwordSettings, newPassword: e.target.value })
            }
            margin="normal"
            helperText={t('settings.passwordTooShort')}
          />

          <TextField
            fullWidth
            label={t('settings.confirmPassword')}
            type="password"
            value={passwordSettings.confirmPassword}
            onChange={(e) =>
              setPasswordSettings({ ...passwordSettings, confirmPassword: e.target.value })
            }
            margin="normal"
          />

          <Box mt={3}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleChangePassword}
              disabled={
                savingPassword ||
                !passwordSettings.oldPassword ||
                !passwordSettings.newPassword ||
                !passwordSettings.confirmPassword
              }
            >
              {savingPassword ? <CircularProgress size={24} /> : t('common.save')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* App-Einstellungen */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('settings.title')} - App
          </Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('settings.language')}</InputLabel>
            <Select
              value={appSettings.language}
              onChange={(e) =>
                setAppSettings({ ...appSettings, language: e.target.value as string })
              }
              label={t('settings.language')}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="de">Deutsch</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={mode === 'dark'}
                  onChange={toggleTheme}
                  icon={<Brightness7 />}
                  checkedIcon={<Brightness4 />}
                />
              }
              label={t('settings.theme')}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {mode === 'dark' ? t('settings.darkTheme') : t('settings.lightTheme')}
            </Typography>
          </Box>

          <TextField
            fullWidth
            label={t('settings.sessionTimeout')}
            type="number"
            value={appSettings.sessionTimeoutMinutes}
            onChange={(e) =>
              setAppSettings({
                ...appSettings,
                sessionTimeoutMinutes: parseInt(e.target.value) || 30,
              })
            }
            margin="normal"
            inputProps={{ min: 5, max: 480 }}
            helperText="5-480 Minuten"
          />

          <Box mt={3}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveAppSettings}
              disabled={saving}
            >
              {saving ? <CircularProgress size={24} /> : t('common.save')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* Benachrichtigungseinstellungen */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('settings.notificationSettings')}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={notificationSettings.webEnabled}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    webEnabled: e.target.checked,
                  })
                }
              />
            }
            label={t('settings.webNotifications')}
            sx={{ display: 'block', mb: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={notificationSettings.emailEnabled}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    emailEnabled: e.target.checked,
                  })
                }
              />
            }
            label={t('settings.emailNotifications')}
            sx={{ display: 'block', mb: 2 }}
          />

          {notificationSettings.emailEnabled && (
            <>
              <TextField
                fullWidth
                label={t('settings.emailAddress')}
                type="email"
                value={notificationSettings.emailAddress}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    emailAddress: e.target.value,
                  })
                }
                margin="normal"
                required
                helperText={t('settings.emailAddressHelper')}
              />
              
              {testEmailSuccess && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {t('settings.testEmailSuccess')}
                </Alert>
              )}
              
              {testEmailError && (
                <Alert severity="error" sx={{ mt: 2 }} onClose={() => setTestEmailError(null)}>
                  {testEmailError}
                </Alert>
              )}

              <Box mt={2}>
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !notificationSettings.emailAddress || saving}
                >
                  {sendingTestEmail ? <CircularProgress size={24} /> : t('settings.sendTestEmail')}
                </Button>
              </Box>
            </>
          )}

          <Box mt={3}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveNotifications}
              disabled={saving || (notificationSettings.emailEnabled && !notificationSettings.emailAddress)}
            >
              {saving ? <CircularProgress size={24} /> : t('common.save')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;
