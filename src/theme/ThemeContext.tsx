import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getJSON, setJSON } from '../lib/storage';
import { ColorMode, Palette, THEMES, ThemeDef } from './themes';

type ThemeCtx = {
  c: Palette;
  dark: boolean;
  theme: ThemeDef;
  mode: ColorMode;
  setThemeId: (id: string) => void;
  setMode: (m: ColorMode) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [themeId, setThemeIdState] = useState('khozama');
  const [mode, setModeState] = useState<ColorMode>('system');

  useEffect(() => {
    getJSON('prefs.theme', { themeId: 'khozama', mode: 'system' as ColorMode }).then((p) => {
      setThemeIdState(p.themeId);
      setModeState(p.mode);
    });
  }, []);

  const value = useMemo<ThemeCtx>(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
    return {
      c: dark ? theme.dark : theme.light,
      dark,
      theme,
      mode,
      setThemeId: (id) => {
        setThemeIdState(id);
        setJSON('prefs.theme', { themeId: id, mode });
      },
      setMode: (m) => {
        setModeState(m);
        setJSON('prefs.theme', { themeId, mode: m });
      },
    };
  }, [themeId, mode, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}
