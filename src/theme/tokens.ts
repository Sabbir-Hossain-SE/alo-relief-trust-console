import type { ProcessingStatus } from '@/domain/status';

// Warm neutrals. The archive holds people's records, so the console reads as
// paper rather than as a control panel.
export const surfaces = {
  light: {
    ground: '#FBF9F6',
    surface: '#FFFFFF',
    raised: '#F5F2ED',
    hairline: 'rgba(31, 30, 28, 0.10)',
    text: '#1F1E1C',
    textMuted: '#6B6862',
  },
  dark: {
    ground: '#1A1917',
    surface: '#232220',
    raised: '#2C2A27',
    hairline: 'rgba(240, 237, 232, 0.12)',
    text: '#F0EDE8',
    textMuted: '#A8A39A',
  },
} as const;

export const brand = {
  primary: { light: '#2F6F63', dark: '#5FA394' },
  accent: { light: '#E8A55C', dark: '#E8A55C' },
} as const;

// Desaturated on purpose: a grid full of these should read as calm, not as an
// incident board.
export const statusColors: Record<ProcessingStatus, string> = {
  pending: '#8B8B85',
  processing: '#D99A4E',
  completed: '#5C8A6E',
  failed: '#C4685A',
  needs_review: '#8878A8',
};

export const radii = {
  chip: 6,
  card: 10,
  overlay: 12,
} as const;

export const motion = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const fontStacks = {
  display: 'var(--font-display), Georgia, "Times New Roman", serif',
  body: 'var(--font-body), system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
} as const;
