export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accent: string;
  sidebar: string;
  sidebarText: string;
  sidebarActive: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
};

export type ThemeDef = {
  id: string;
  name: string;
  light: Palette;
  dark: Palette;
};

const status = {
  light: { success: '#1E8E5A', warning: '#C77700', danger: '#C93B3B', info: '#2D6CDF' },
  dark: { success: '#4CC38A', warning: '#F5A524', danger: '#F06A6A', info: '#6EA2FF' },
};

function make(
  id: string,
  name: string,
  primary: string,
  accent: string,
  primarySoftLight: string,
  primaryDark: string,
  primarySoftDark: string,
  sidebar: string,
): ThemeDef {
  return {
    id,
    name,
    light: {
      bg: '#F4F6FA',
      surface: '#FFFFFF',
      surfaceAlt: '#EEF1F6',
      border: '#E1E6EE',
      text: '#18212F',
      textMuted: '#667085',
      primary,
      primaryText: '#FFFFFF',
      primarySoft: primarySoftLight,
      accent,
      sidebar,
      sidebarText: '#D5DDEA',
      sidebarActive: 'rgba(255,255,255,0.12)',
      ...status.light,
    },
    dark: {
      bg: '#0E131B',
      surface: '#161D28',
      surfaceAlt: '#1D2633',
      border: '#2A3443',
      text: '#E8EDF5',
      textMuted: '#93A0B4',
      primary: primaryDark,
      primaryText: '#0E131B',
      primarySoft: primarySoftDark,
      accent,
      sidebar: '#0A0F16',
      sidebarText: '#B8C3D4',
      sidebarActive: 'rgba(255,255,255,0.08)',
      ...status.dark,
    },
  };
}

// Brand navy is taken from the Jadah Al Khozama logo.
export const THEMES: ThemeDef[] = [
  make('khozama', 'Khozama Navy', '#2C4F82', '#E8A33D', '#E3EBF7', '#7FA6E0', '#1F2C42', '#1C3354'),
  make('lavender', 'Khozama Lavender', '#6B4FA0', '#E8A33D', '#EEE8F8', '#B49AE6', '#2A2340', '#3A2A5C'),
  make('safety', 'Site Orange', '#D9661F', '#2C4F82', '#FCEBDF', '#F59A5B', '#3A2618', '#2B2B2B'),
  make('emerald', 'Emerald', '#13795B', '#E8A33D', '#DFF3EC', '#4CC9A0', '#163329', '#0F3B2E'),
  make('sand', 'Desert Sand', '#9A6B2F', '#2C4F82', '#F5EBDD', '#D9A866', '#33291C', '#3B2E1E'),
  make('steel', 'Steel Grey', '#3D4B5C', '#E8A33D', '#E6EAF0', '#A3B3C7', '#232B36', '#232B36'),
];

export type ColorMode = 'system' | 'light' | 'dark';
