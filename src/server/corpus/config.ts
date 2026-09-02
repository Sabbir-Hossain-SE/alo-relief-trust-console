export const DEFAULT_SEED = 20260901;
export const DEFAULT_ARCHIVE_SIZE = 100_000;

// The archive spans roughly two and a half years of field work.
export const ARCHIVE_SPAN_DAYS = 900;
export const ARCHIVE_END = Date.UTC(2026, 8, 1);

export const MIN_SIZE_BYTES = 40_000;
export const SIZE_RANGE_BYTES = 4_000_000;
export const MAX_PAGES = 12;

// Weights for a partly-digitized archive: most of it is through, a slice is
// still queued, and a minority needs a person to look at it.
export const STATUS_WEIGHTS = [
  ['completed', 0.72],
  ['needs_review', 0.08],
  ['failed', 0.07],
  ['pending', 0.11],
  ['processing', 0.02],
] as const;
