export const KABA = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
} as const;

export const Colors = {
  primary: KABA[700],
  primaryDark: KABA[800],
  primaryLight: KABA[500],
  background: '#ffffff',
  surface: '#f9fafb',
  border: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  error: '#dc2626',
  errorBg: '#fef2f2',
  success: '#15803d',
  successBg: '#f0fdf4',
  warning: '#fbbf24',
  warningBg: '#fffbeb',
};

export default Colors;
