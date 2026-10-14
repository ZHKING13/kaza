import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, status } from './tokens';

export * from './tokens';

type Scheme = 'light' | 'dark';

function build(scheme: Scheme) {
  return { scheme, c: palette[scheme], status: status[scheme] };
}

export type Theme = ReturnType<typeof build>;

const themes = { light: build('light'), dark: build('dark') };
const ThemeContext = createContext<Theme>(themes.light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
