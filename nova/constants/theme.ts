export const colors = {
  // Backgrounds
  bg: '#09090F',
  surface: '#111119',
  surfaceRaised: '#19191F',

  // Text
  textPrimary: '#F7F7F8',
  textSecondary: '#87879A',
  textDisabled: '#3E3E52',

  // Accent
  accentFrom: '#9333EA',
  accentTo: '#7C3AED',

  // Semantic
  positive: '#22C55E',
  negative: '#EF4444',
  warning: '#F59E0B',

  // Borders (subtle — used sparingly)
  border: '#1D1D2A',
  borderSubtle: '#141420',
} as const;

export const gradients = {
  accent: [colors.accentFrom, colors.accentTo] as [string, string],
} as const;

export const typography = {
  fontRegular: undefined,
  fontMedium: undefined,
  fontSemibold: undefined,
  fontBold: undefined,

  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
  '5xl': 52,
  '6xl': 64,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
