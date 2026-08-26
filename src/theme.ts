export type ThemeColorId =
  | 'pink'
  | 'purple'
  | 'blue'
  | 'green'
  | 'red'
  | 'orange'
  | 'dark-pink'
  | 'dark-purple';

export interface ThemeColor {
  id: ThemeColorId;
  label: string;
  /** Fills: headers, progress bars, buttons, avatars. */
  primary: string;
  /** Text on light surfaces, where `primary` would be too pale. */
  deep: string;
  /** Text on dark surfaces, where `primary` would be too dark. */
  bright: string;
}

/**
 * The eight colours a person can pick. Two members of a pair may never share
 * one, which is enforced client-side in the picker and again in the security
 * rules, so the whole UI can identify who owns something by colour alone.
 */
export const THEME_COLORS: ThemeColor[] = [
  { id: 'pink', label: 'Pink', primary: '#F472B6', deep: '#DB2777', bright: '#F9A8D4' },
  { id: 'purple', label: 'Purple', primary: '#8B5CF6', deep: '#6D28D9', bright: '#C4B5FD' },
  { id: 'blue', label: 'Blue', primary: '#3B82F6', deep: '#1D4ED8', bright: '#93C5FD' },
  { id: 'green', label: 'Green', primary: '#10B981', deep: '#047857', bright: '#6EE7B7' },
  { id: 'red', label: 'Red', primary: '#EF4444', deep: '#B91C1C', bright: '#FCA5A5' },
  { id: 'orange', label: 'Orange', primary: '#F97316', deep: '#C2410C', bright: '#FDBA74' },
  { id: 'dark-pink', label: 'Dark Pink', primary: '#BE185D', deep: '#831843', bright: '#F0ABCC' },
  { id: 'dark-purple', label: 'Dark Purple', primary: '#5B21B6', deep: '#3B0F73', bright: '#B5A0EA' },
];

export const DEFAULT_THEME_COLOR: ThemeColorId = 'purple';

const THEME_BY_ID = new Map(THEME_COLORS.map((theme) => [theme.id, theme]));

/** Falls back to the default rather than throwing on an unknown stored id. */
export function getTheme(id: ThemeColorId | null | undefined): ThemeColor {
  return (id && THEME_BY_ID.get(id)) || THEME_BY_ID.get(DEFAULT_THEME_COLOR)!;
}

export function isThemeColorId(value: unknown): value is ThemeColorId {
  return typeof value === 'string' && THEME_BY_ID.has(value as ThemeColorId);
}

function channels(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return null;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/**
 * Theme colours are chosen at runtime, so Tailwind never sees them at build
 * time and cannot generate opacity utilities for them. Tints are built here
 * and applied as inline styles instead.
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = channels(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Text colour that stays legible on top of `hex`. */
export function readableOn(hex: string): string {
  const rgb = channels(hex);
  if (!rgb) return '#ffffff';
  // Perceived luminance (ITU-R BT.601); the pale themes need dark text.
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.65 ? '#1f2937' : '#ffffff';
}

/** A theme's text shade for the current mode, against a neutral background. */
export function themeText(theme: ThemeColor, isDarkMode: boolean): string {
  return isDarkMode ? theme.bright : theme.deep;
}
