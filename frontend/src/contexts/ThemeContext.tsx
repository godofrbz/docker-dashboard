import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createTheme, ThemeProvider as MUIThemeProvider, Theme } from '@mui/material/styles';
import { settingsService } from '../services/api';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  theme: Theme;
  reloadTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  // Function to load theme from settings
  const loadTheme = useCallback(async () => {
    try {
      const response = await settingsService.get();
      if (response.data && response.data.theme) {
        const savedTheme = response.data.theme as ThemeMode;
        if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
          setMode(savedTheme);
        } else {
          // Default to light if invalid theme
          setMode('light');
        }
      }
    } catch (error) {
      // Error loading theme (e.g., user not logged in)
      // Default remains 'light'
      console.debug('Theme could not be loaded (possibly not logged in):', error);
    }
  }, []);

  useEffect(() => {
    loadTheme();
    
    // Listen for theme reload events (e.g., after login)
    const handleThemeReload = () => {
      loadTheme();
    };
    
    window.addEventListener('theme:reload', handleThemeReload);
    
    return () => {
      window.removeEventListener('theme:reload', handleThemeReload);
    };
  }, [loadTheme]);

  const toggleTheme = async () => {
    const newMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    
    // Save theme to backend
    try {
      await settingsService.update({ theme: newMode });
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  });

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, theme, reloadTheme: loadTheme }}>
      <MUIThemeProvider theme={theme}>
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

