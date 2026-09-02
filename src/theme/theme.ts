import { createTheme } from '@mui/material/styles';
import type { ProcessingStatus } from '@/domain/status';
import { brand, fontStacks, motion, radii, statusColors, surfaces } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    status: Record<ProcessingStatus, string>;
    accent: string;
    hairline: string;
  }
  interface PaletteOptions {
    status?: Record<ProcessingStatus, string>;
    accent?: string;
    hairline?: string;
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: brand.primary.light },
        accent: brand.accent.light,
        status: statusColors,
        hairline: surfaces.light.hairline,
        background: { default: surfaces.light.ground, paper: surfaces.light.surface },
        text: { primary: surfaces.light.text, secondary: surfaces.light.textMuted },
        divider: surfaces.light.hairline,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: brand.primary.dark },
        accent: brand.accent.dark,
        status: statusColors,
        hairline: surfaces.dark.hairline,
        background: { default: surfaces.dark.ground, paper: surfaces.dark.surface },
        text: { primary: surfaces.dark.text, secondary: surfaces.dark.textMuted },
        divider: surfaces.dark.hairline,
      },
    },
  },

  shape: { borderRadius: radii.card },

  typography: {
    fontFamily: fontStacks.body,
    // Fraunces carries titles and hero figures only. Everything else is Inter.
    h1: { fontFamily: fontStacks.display, fontSize: '2.5rem', lineHeight: 1.15, fontWeight: 600 },
    h2: { fontFamily: fontStacks.display, fontSize: '1.75rem', lineHeight: 1.2, fontWeight: 600 },
    h3: { fontFamily: fontStacks.display, fontSize: '1.25rem', lineHeight: 1.3, fontWeight: 600 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 500 },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
  },

  transitions: {
    duration: { standard: motion.duration },
    easing: { easeInOut: motion.easing },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Numbers in tables must not jitter as they tick up.
        '.tabular': { fontFamily: fontStacks.mono, fontVariantNumeric: 'tabular-nums' },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: radii.chip } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme: t }) => ({
          backgroundImage: 'none',
          border: `1px solid ${t.palette.divider}`,
        }),
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: radii.chip, fontWeight: 500 } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { borderRadius: 0 } },
    },
  },
});
