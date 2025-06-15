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
  primary500: '#6366F1', // Current primary color, slightly adjusted
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

  // Accent/Feedback Colors
  success: '#10B981', // Green
  warning: '#F59E0B', // Amber
  error: '#EF4444',   // Red
  info: '#3B82F6',    // Blue

  // Gradients (example, can be expanded)
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
};

// Example of a global font family, assuming a system font or custom font is loaded
export const FontFamilies = {
  // You would typically load custom fonts here, e.g., 'Inter-Regular', 'Inter-Bold'
  // For now, using system defaults
  primary: 'System',
  secondary: 'System',
};