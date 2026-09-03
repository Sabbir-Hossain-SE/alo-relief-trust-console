import { createTheme } from '@mui/material/styles';
import type { ProcessingStatus } from '@/domain/status';
import {
  brand,
  brandMark,
  fontStacks,
  motion,
  radii,
  statusTones,
  surfaces,
  type StatusTone,
} from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    status: Record<ProcessingStatus, StatusTone>;
    accent: string;
    accentInk: string;
    /** The logo's horizon, the one part of the mark that follows the scheme. */
    brandHorizon: string;
    hairline: string;
  }
  interface PaletteOptions {
    status?: Record<ProcessingStatus, StatusTone>;
    accent?: string;
    accentInk?: string;
    brandHorizon?: string;
    hairline?: string;
  }
}

/** Fast enough to be imperceptible, non-zero so MUI still fires its callbacks. */
const STILL = 1;

type ThemeOptions = {
  /**
   * Shortens MUI's own timings and stops its looping animations.
   *
   * The stylesheet handles CSS, but Drawer, Tooltip and Select time their enter
   * and exit callbacks in JavaScript from these durations, and Skeleton's pulse
   * is a component default rather than a rule this app writes.
   */
  reduceMotion?: boolean;
};

export function createAppTheme({ reduceMotion = false }: ThemeOptions = {}) {
  return createTheme({
    cssVariables: { colorSchemeSelector: 'class' },
    colorSchemes: {
      light: {
        palette: {
          mode: 'light',
          primary: { main: brand.primary.light },
          accent: brand.accent.light,
          accentInk: brand.accentInk.light,
          brandHorizon: brandMark.horizon.light,
          status: statusTones.light,
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
          accentInk: brand.accentInk.dark,
          brandHorizon: brandMark.horizon.dark,
          status: statusTones.dark,
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

    transitions: reduceMotion
      ? {
          duration: {
            shortest: STILL,
            shorter: STILL,
            short: STILL,
            standard: STILL,
            complex: STILL,
            enteringScreen: STILL,
            leavingScreen: STILL,
          },
        }
      : {
          duration: { standard: motion.duration },
          easing: { easeInOut: motion.easing },
        },

    components: {
      // Both loop forever, so a shortened duration would spin them faster rather
      // than settle them. They have to be switched off at the component.
      MuiSkeleton: { defaultProps: { animation: reduceMotion ? false : 'pulse' } },
      MuiButtonBase: { defaultProps: { disableRipple: reduceMotion } },

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
}

/** The motion-enabled theme. Tests and the server render use this one. */
export const theme = createAppTheme();
