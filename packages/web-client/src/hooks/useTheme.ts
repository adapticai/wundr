import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type Theme = 'light' | 'dark' | 'system';

export interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

export function useTheme(): UseThemeReturn {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'system');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    };
    
    updateSystemTheme();
    mediaQuery.addEventListener('change', updateSystemTheme);
    
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  return {
    theme,
    setTheme,
    resolvedTheme,
  };
}