import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeMode = 'gold' | 'moonlight' | 'olive' | 'wine' | 'cyan' | 'purple' | 'blue' | 'caramel';
export type ColorMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'gold',
  setTheme: () => {},
  colorMode: 'dark',
  setColorMode: () => {},
});

const THEME_KEY = 'quest-sim-theme';
const COLOR_MODE_KEY = 'quest-sim-color-mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (['moonlight', 'olive', 'wine', 'cyan', 'purple', 'blue', 'caramel'].includes(stored || '')) return stored as ThemeMode;
    return 'gold';
  });

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const stored = localStorage.getItem(COLOR_MODE_KEY);
    return (stored === 'light' ? 'light' : 'dark') as ColorMode;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', colorMode);
    localStorage.setItem(COLOR_MODE_KEY, colorMode);
  }, [colorMode]);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme: setThemeState,
      colorMode,
      setColorMode: setColorModeState,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
