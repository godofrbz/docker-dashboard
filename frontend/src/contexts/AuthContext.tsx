import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, settingsService } from '../services/api';
import { useTranslation } from 'react-i18next';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  sessionTimeout: number;
  lastActivity: number;
  updateActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(30 * 60 * 1000); // 30 minutes in ms
  const [lastActivity, setLastActivity] = useState(Date.now());
  const { i18n } = useTranslation();
  
  // Dispatch event to reload theme after login
  const reloadTheme = () => {
    window.dispatchEvent(new CustomEvent('theme:reload'));
  };

  const checkAuth = async () => {
    try {
      const response = await authService.check();
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        setLastActivity(Date.now());
        
          // Load settings (session timeout, language, theme)
          try {
            const settingsResponse = await settingsService.get();
            const settings = settingsResponse.data;
            if (settings.sessionTimeoutMinutes) {
              setSessionTimeout(settings.sessionTimeoutMinutes * 60 * 1000);
            }
            if (settings.language) {
              i18n.changeLanguage(settings.language);
            }
            // Trigger theme reload
            reloadTheme();
          } catch (err) {
            console.error('Error loading settings:', err);
          }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await authService.login(username, password);
      if (response.data.success) {
        // Setze Authentifizierung sofort
        setIsAuthenticated(true);
        setLastActivity(Date.now());
        localStorage.setItem('authenticated', 'true');
        
        // Warte kurz, damit die Session-Cookies gesetzt werden
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Prüfe die Session, um sicherzustellen, dass sie gesetzt ist
        try {
          const checkResponse = await authService.check();
            if (!checkResponse.data.authenticated) {
              // Session was not set - try again
              console.warn('Session check failed, retrying...');
              await new Promise(resolve => setTimeout(resolve, 300));
              const retryCheck = await authService.check();
              if (!retryCheck.data.authenticated) {
                setIsAuthenticated(false);
                localStorage.removeItem('authenticated');
                throw new Error('Session could not be confirmed. Please try again.');
              }
            }
          
          // Load settings after login (session timeout, language, theme)
          try {
            const settingsResponse = await settingsService.get();
            const settings = settingsResponse.data;
            if (settings.sessionTimeoutMinutes) {
              setSessionTimeout(settings.sessionTimeoutMinutes * 60 * 1000);
            }
            if (settings.language) {
              i18n.changeLanguage(settings.language);
            }
            // Trigger theme reload after login
            reloadTheme();
          } catch (err) {
            console.error('Error loading settings:', err);
          }
        } catch (err: any) {
          console.error('Error checking session:', err);
          // If session check fails but login was successful,
          // still set as authenticated (cookie might not be set yet)
          // The next API request will check the session
        }
      } else {
        throw new Error('Login failed');
      }
    } catch (err: any) {
      setIsAuthenticated(false);
      localStorage.removeItem('authenticated');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsAuthenticated(false);
      localStorage.removeItem('authenticated');
      // Use window.location for full reload
      window.location.href = '/login';
    }
  };

  const updateActivity = () => {
    setLastActivity(Date.now());
  };

  // Prüfe Session-Timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkTimeout = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      
      if (timeSinceLastActivity > sessionTimeout) {
        // Session abgelaufen
        logout();
      }
    };

    const interval = setInterval(checkTimeout, 60000); // Prüfe jede Minute

    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity, sessionTimeout]);

  // Prüfe Authentifizierung beim Start
  useEffect(() => {
    // Prüfe nur, wenn nicht bereits authentifiziert
    if (!isAuthenticated) {
      checkAuth();
    }
  }, []);

  // Aktualisiere letzte Aktivität bei Benutzerinteraktionen
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const updateActivityHandler = () => {
      updateActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, updateActivityHandler);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivityHandler);
      });
    };
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        sessionTimeout,
        lastActivity,
        updateActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

