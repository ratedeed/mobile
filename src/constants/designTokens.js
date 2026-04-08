// src/constants/designTokens.js

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8, // Base for 8pt grid
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999, // For perfect circles/pills
};

export const Colors = {
  // Primary Palette (Stripe/Apple inspired)
  primary50: '#EEF2FF',
  primary100: '#E0E7FF',
  primary200: '#C7D2FE',
  primary300: '#A5B4FC',
  primary400: '#818CF8',
  primary500: '#6366F1',
  primary600: '#4F46E5',
  primary700: '#4338CA',
  primary800: '#3730A3',
  primary900: '#312E81',

  // Neutral Palette (Notion/Figma inspired)
  neutral50: '#F9FAFB',
  neutral100: '#F3F4F6',
  neutral200: '#E5E7EB',
  neutral300: '#D1D5DB',
  neutral400: '#9CA3AF',
  neutral500: '#6B7280',
  neutral600: '#4B5563',
  neutral700: '#374151',
  neutral800: '#1F2937',
  neutral900: '#111827',

  // Success Palette (Green)
  success50: '#ECFDF5',
  success100: '#D1FAE5',
  success200: '#A7F3D0',
  success300: '#6EE7B7',
  success400: '#34D399',
  success500: '#10B981',
  success600: '#059669',
  success700: '#047857',
  success800: '#065F46',
  success900: '#064E3B',

  // Warning Palette (Amber)
  warning50: '#FFFBEB',
  warning100: '#FEF3C7',
  warning200: '#FDE68A',
  warning300: '#FCD34D',
  warning400: '#FBBF24',
  warning500: '#F59E0B',
  warning600: '#D97706',
  warning700: '#B45309',
  warning800: '#92400E',
  warning900: '#78350F',

  // Error Palette (Red)
  error50: '#FEF2F2',
  error100: '#FEE2E2',
  error200: '#FECACA',
  error300: '#FCA5A5',
  error400: '#F87171',
  error500: '#EF4444',
  error600: '#DC2626',
  error700: '#B91C1C',
  error800: '#991B1B',
  error900: '#7F1D1D',

  // Info Palette (Blue)
  info50: '#EFF6FF',
  info100: '#DBEAFE',
  info200: '#BFDBFE',
  info300: '#93C5FD',
  info400: '#60A5FA',
  info500: '#3B82F6',
  info600: '#2563EB',
  info700: '#1D4ED8',
  info800: '#1E40AF',
  info900: '#1E3A8A',

  // Accent/Feedback Colors (Legacy support)
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Gradients
  gradientPrimary: ['#6366F1', '#4F46E5'],
  gradientNeutral: ['#F9FAFB', '#E5E7EB'],

  // Opacity values for shadows/overlays
  opacity10: 'rgba(0,0,0,0.1)',
  opacity20: 'rgba(0,0,0,0.2)',
  opacity30: 'rgba(0,0,0,0.3)',
};

export const Shadows = {
  xs: {
    shadowColor: Colors.opacity10,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sm: {
    shadowColor: Colors.opacity10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  md: {
    shadowColor: Colors.opacity10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  lg: {
    shadowColor: Colors.opacity20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  xl: {
    shadowColor: Colors.opacity20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const FontFamilies = {
  primary: 'System',
  secondary: 'System',
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const Animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    spring: {
      damping: 20,
      stiffness: 150,
    },
    easeInOut: {
      duration: 300,
    },
    easeOut: {
      duration: 250,
    },
  },
};

export const Typography = {
  h1: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    lineHeight: 38,
  },
  h2: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    lineHeight: 32,
  },
  h3: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    lineHeight: 28,
  },
  body: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.regular,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    lineHeight: 20,
  },
  caption: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.regular,
    lineHeight: 16,
  },
};