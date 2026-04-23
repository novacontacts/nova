export const colors = {
  // Backgrounds
  bg: '#0A0A0F',
  surface: '#13131A',
  surfaceRaised: '#1C1C26',

  // Text
  textPrimary: '#F5F5F7',
  textSecondary: '#8E8E93',
  textDisabled: '#48484A',

  // Accent
  accentFrom: '#A855F7',
  accentTo: '#EC4899',

  // Semantic
  positive: '#34C759',
  negative: '#FF453A',
  warning: '#FF9F0A',

  // Borders
  border: '#2C2C3A',
  borderSubtle: '#1E1E2A',
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
