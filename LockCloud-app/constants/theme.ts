/**
 * LockCloud Mobile App Theme System
 * 
 * Defines light/dark themes, colors, typography, and spacing constants
 * Aligned with the web frontend design system for consistency
 * 
 * Requirements: 12.1 - Support both light and dark themes based on system preference
 */

import { Platform } from 'react-native';

// ============================================
// PRIMARY COLORS (from web frontend)
// ============================================

const primaryColors = {
  black: '#1a1a1a',
  white: '#fafafa',
};

// ============================================
// ACCENT COLORS (from locking emoji theme)
// ============================================

const accentColors = {
  orange: '#ff8c42',
  green: '#7bc96f',
  blue: '#5fa8d3',
  gray: '#95a5a6',
};

// ============================================
// SEMANTIC COLORS
// ============================================

const semanticColors = {
  success: '#7bc96f',
  error: '#e74c3c',
  warning: '#ff8c42',
  info: '#5fa8d3',
};

// ============================================
// LIGHT THEME
// ============================================

const lightTheme = {
  // Background colors
  background: primaryColors.white,
  backgroundSecondary: '#f5f5f5',
  backgroundTertiary: '#eeeeee',
  
  // Surface colors (cards, modals)
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  
  // Text colors
  text: primaryColors.black,
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  textInverse: primaryColors.white,
  
  // Border colors
  border: 'rgba(0, 0, 0, 0.1)',
  borderSecondary: 'rgba(0, 0, 0, 0.05)',
  borderFocused: accentColors.blue,
  
  // Primary action colors
  primary: primaryColors.black,
  primaryText: primaryColors.white,
  
  // Secondary action colors
  secondary: primaryColors.white,
  secondaryText: primaryColors.black,
  
  // Accent colors
  accent: accentColors.blue,
  accentOrange: accentColors.orange,
  accentGreen: accentColors.green,
  accentGray: accentColors.gray,
  
  // Semantic colors
  success: semanticColors.success,
  error: semanticColors.error,
  warning: semanticColors.warning,
  info: semanticColors.info,
  
  // Tab bar
  tabIconDefault: '#687076',
  tabIconSelected: accentColors.blue,
  tabBackground: '#ffffff',
  tint: accentColors.blue,
  
  // Skeleton loading
  skeleton: 'rgba(0, 0, 0, 0.06)',
  skeletonHighlight: 'rgba(0, 0, 0, 0.1)',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  
  // Input
  inputBackground: '#ffffff',
  inputBorder: 'rgba(0, 0, 0, 0.2)',
  inputPlaceholder: '#9ca3af',
  
  // Card
  cardBackground: '#ffffff',
  cardBorder: 'rgba(0, 0, 0, 0.1)',
  cardShadow: 'rgba(0, 0, 0, 0.1)',
  
  // Badge
  badgeBackground: accentColors.orange,
  badgeText: primaryColors.white,
  
  // Selection
  selectionBackground: 'rgba(95, 168, 211, 0.1)',
  selectionBorder: accentColors.blue,
};

// ============================================
// DARK THEME
// ============================================

const darkTheme = {
  // Background colors
  background: '#151718',
  backgroundSecondary: '#1e2022',
  backgroundTertiary: '#252729',
  
  // Surface colors (cards, modals)
  surface: '#1e2022',
  surfaceElevated: '#252729',
  
  // Text colors
  text: '#ECEDEE',
  textSecondary: '#9BA1A6',
  textTertiary: '#6b7280',
  textInverse: primaryColors.black,
  
  // Border colors
  border: 'rgba(255, 255, 255, 0.1)',
  borderSecondary: 'rgba(255, 255, 255, 0.05)',
  borderFocused: accentColors.blue,
  
  // Primary action colors
  primary: primaryColors.white,
  primaryText: primaryColors.black,
  
  // Secondary action colors
  secondary: '#252729',
  secondaryText: '#ECEDEE',
  
  // Accent colors
  accent: accentColors.blue,
  accentOrange: accentColors.orange,
  accentGreen: accentColors.green,
  accentGray: accentColors.gray,
  
  // Semantic colors
  success: semanticColors.success,
  error: '#ff6b6b',
  warning: accentColors.orange,
  info: accentColors.blue,
  
  // Tab bar
  tabIconDefault: '#9BA1A6',
  tabIconSelected: primaryColors.white,
  tabBackground: '#151718',
  tint: accentColors.blue,
  
  // Skeleton loading
  skeleton: 'rgba(255, 255, 255, 0.06)',
  skeletonHighlight: 'rgba(255, 255, 255, 0.1)',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  
  // Input
  inputBackground: '#252729',
  inputBorder: 'rgba(255, 255, 255, 0.2)',
  inputPlaceholder: '#6b7280',
  
  // Card
  cardBackground: '#1e2022',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  cardShadow: 'rgba(0, 0, 0, 0.3)',
  
  // Badge
  badgeBackground: accentColors.orange,
  badgeText: primaryColors.white,
  
  // Selection
  selectionBackground: 'rgba(95, 168, 211, 0.2)',
  selectionBorder: accentColors.blue,
};

// ============================================
// THEME EXPORT
// ============================================

export const Colors = {
  light: lightTheme,
  dark: darkTheme,
  // Raw color values for direct access
  primary: primaryColors,
  accent: accentColors,
  semantic: semanticColors,
};

// ============================================
// TYPOGRAPHY
// ============================================

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    mono: 'Menlo',
  },
  android: {
    sans: 'Roboto',
    serif: 'serif',
    mono: 'monospace',
  },
  default: {
    sans: 'System',
    serif: 'serif',
    mono: 'monospace',
  },
});

export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const FontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const LineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.6,
  loose: 1.8,
};

// ============================================
// SPACING SYSTEM
// ============================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// ============================================
// BORDER RADIUS
// ============================================

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

// ============================================
// SHADOWS
// ============================================

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 8,
  },
};

// ============================================
// TOUCH TARGETS (WCAG 2.1 AAA compliance)
// ============================================

export const TouchTargets = {
  min: 44,
  comfortable: 48,
  large: 56,
};

// ============================================
// ANIMATION DURATIONS
// ============================================

export const AnimationDurations = {
  fast: 150,
  base: 200,
  slow: 300,
  slower: 500,
};

// ============================================
// Z-INDEX LAYERS
// ============================================

export const ZIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
};

// ============================================
// ICON SIZES
// ============================================

export const IconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
};

// ============================================
// THEME TYPE DEFINITIONS
// ============================================

export type ThemeColors = typeof lightTheme;
export type ColorScheme = 'light' | 'dark';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get theme colors based on color scheme
 */
export const getThemeColors = (colorScheme: ColorScheme): ThemeColors => {
  return colorScheme === 'dark' ? Colors.dark : Colors.light;
};

/**
 * Create a style object with theme-aware colors
 */
export const createThemedStyles = <T extends Record<string, unknown>>(
  styleCreator: (colors: ThemeColors) => T
) => {
  return {
    light: styleCreator(Colors.light),
    dark: styleCreator(Colors.dark),
  };
};
