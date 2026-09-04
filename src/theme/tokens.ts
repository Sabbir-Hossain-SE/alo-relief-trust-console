import type { ConfidenceBand } from '@/domain/confidence';
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
  // The apricot is a fill, not a text colour — it sits at 2:1 on paper. Anything
  // that has to be read uses accentInk instead.
  accent: { light: '#E8A55C', dark: '#E8A55C' },
  accentInk: { light: '#D27C1E', dark: '#E8A55C' },
} as const;

/**
 * The logo: a sun rising over a horizon, which doubles as the edge of a page.
 *
 * Only the horizon changes between schemes, and it is the part that carries the
 * mark: 14:1 on paper and 16:1 in the dark. The sun stays the same in both — at
 * 1.8:1 on paper it is decoration rather than a graphic conveying anything, the
 * same trade `accent` already records, and inverting it would cost the mark its
 * identity to fix a threshold it is not held to.
 */
export const brandMark = {
  ray: '#E9A147',
  coreTop: '#F4B15E',
  coreBottom: '#E08A2E',
  horizon: { light: '#2A2622', dark: '#F7F5F1' },
} as const;

/**
 * Two tones per status. `fill` keeps the desaturated hue so a grid full of them
 * reads as calm rather than as an incident board; `ink` is the same hue pushed
 * far enough to clear 4.5:1 for label text. The original single-tone palette
 * looked right but failed contrast everywhere, so the split is what lets the
 * design stay calm and remain readable.
 */
export type StatusTone = { fill: string; ink: string };

export const statusTones: Record<'light' | 'dark', Record<ProcessingStatus, StatusTone>> = {
  light: {
    pending: { fill: '#8B8B85', ink: '#6E6E68' },
    processing: { fill: '#D99A4E', ink: '#9A631F' },
    completed: { fill: '#5C8A6E', ink: '#4C7159' },
    failed: { fill: '#C4685A', ink: '#B04A3B' },
    needs_review: { fill: '#8878A8', ink: '#736294' },
  },
  dark: {
    pending: { fill: '#8B8B85', ink: '#A5A59E' },
    processing: { fill: '#D99A4E', ink: '#E0AE6E' },
    completed: { fill: '#5C8A6E', ink: '#7BA98C' },
    failed: { fill: '#C4685A', ink: '#D98E80' },
    needs_review: { fill: '#8878A8', ink: '#A99BC4' },
  },
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

/**
 * Confidence reuses the status palette on purpose: "trustworthy", "check this"
 * and "do not rely on this" should look the same wherever they appear, and a
 * second parallel palette would be one more thing to keep in contrast.
 */
export const CONFIDENCE_BAND_STATUS: Record<ConfidenceBand, ProcessingStatus> = {
  high: 'completed',
  medium: 'processing',
  low: 'failed',
};
