import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkColors, ColorScale } from '../theme/colors';

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorScale;
  /** Convenience: returns one of two values based on the current scheme */
  select: <T>(light: T, dark: T) => T;
  /** Toggle between light and dark. Overrides the OS-level scheme. */
  toggleTheme: () => void;
  /** Reset to light mode (call on sign-out so login screen is always light) */
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  }
  isDark: false,
  colors,
  select: (light) => light,
  toggleTheme: () => {},
  resetTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const osScheme = useColorScheme();

  // null means "follow OS"; true/false means "manual override"
  const [manualDark, setManualDark] = useState<boolean | null>(null);

  const isDark = manualDark !== null ? manualDark : osScheme === 'dark';
  const themeColors = isDark ? (darkColors as unknown as ColorScale) : colors;

  const select = <T,>(light: T, dark: T): T => (isDark ? dark : light);

  const toggleTheme = () => setManualDark((prev) => {
    // First tap: lock to the opposite of current resolved value
    return prev !== null ? !prev : !(osScheme === 'dark');
  });

  const resetTheme = () => setManualDark(false);

  return (
    <ThemeContext.Provider value={{ isDark, colors: themeColors, select, toggleTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

}