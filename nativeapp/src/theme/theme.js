import { MD3LightTheme } from 'react-native-paper';

import { brand, surface } from './colors';
import { fontFamily } from './typography';

const fonts = Object.fromEntries(
  Object.keys(MD3LightTheme.fonts).map((variant) => [
    variant,
    {
      ...MD3LightTheme.fonts[variant],
      fontFamily: fontFamily.regular,
    },
  ])
);

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 3,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary.main,
    onPrimary: brand.primary.contrastText,
    primaryContainer: brand.primary.lighter,
    onPrimaryContainer: brand.primary.darker,
    secondary: brand.secondary.main,
    onSecondary: brand.secondary.contrastText,
    secondaryContainer: brand.secondary.lighter,
    onSecondaryContainer: brand.secondary.darker,
    background: surface.background,
    onBackground: brand.grey[800],
    surface: surface.card,
    onSurface: brand.grey[800],
    surfaceVariant: brand.grey[100],
    onSurfaceVariant: brand.grey[600],
    outline: surface.border,
    outlineVariant: surface.divider,
    error: brand.error.main,
    onError: brand.error.contrastText,
    errorContainer: brand.error.lighter,
    onErrorContainer: brand.error.darker,
  },
};

export const radius = {
  sm: 8,
  md: 12,
  card: 16,
  pill: 999,
};

export const spacing = (factor) => factor * 8;
