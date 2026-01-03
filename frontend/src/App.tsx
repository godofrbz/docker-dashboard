import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

import Dashboard from './components/Dashboard';
import Updates from './components/Updates';
import Schedule from './components/Schedule';
import Logs from './components/Logs';
import Settings from './components/Settings';
import Backups from './components/Backups';
import ContainerStats from './components/ContainerStats';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';

function NavigationTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const getTabValue = () => {
    if (location.pathname === '/') return 0;
    if (location.pathname === '/updates') return 1;
    if (location.pathname === '/schedule') return 2;
    if (location.pathname === '/logs') return 3;
    if (location.pathname === '/backups') return 4;
    if (location.pathname === '/settings') return 5;
    return -1;
  };

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    const routes = ['/', '/updates', '/schedule', '/logs', '/backups', '/settings'];
    navigate(routes[newValue]);
  };

  return (
    <Tabs value={getTabValue()} onChange={handleChange} centered variant="scrollable" scrollButtons="auto">
      <Tab label={t('dashboard.title')} />
      <Tab label={t('updates.title')} />
      <Tab label={t('schedule.title')} />
      <Tab label={t('logs.title')} />
      <Tab label={t('backups.title')} />
      <Tab label={t('settings.title')} />
    </Tabs>
  );
}

function AppContent() {
  const { logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Box sx={{ flexGrow: 1 }}>
                  <AppBar position="static">
                    <Toolbar>
                      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Docker Dashboard
                      </Typography>
                      <Button color="inherit" onClick={handleLogout}>
                        {t('common.logout')}
                      </Button>
                    </Toolbar>
                  </AppBar>
                  <NavigationTabs />
                  <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/updates" element={<Updates />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/logs" element={<Logs />} />
                      <Route path="/backups" element={<Backups />} />
                      <Route path="/containers/:id/stats" element={<ContainerStats />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Container>
                </Box>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
