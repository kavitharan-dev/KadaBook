import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadThemePreference, saveThemePreference, type AppTheme } from '../lib/themePreference';
import { darkPalette, lightPalette, type ColorPalette } from '../theme/palettes';

type ThemeContextValue = {
  theme: AppTheme;
  colors: ColorPalette;
  setTheme: (theme: AppTheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    loadThemePreference().then(setThemeState);
  }, []);

  const setTheme = useCallback(async (next: AppTheme) => {
    setThemeState(next);
    await saveThemePreference(next);
  }, []);

  const colors = useMemo(() => (theme === 'dark' ? darkPalette : lightPalette), [theme]);

  const value = useMemo(() => ({ theme, colors, setTheme }), [theme, colors, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
