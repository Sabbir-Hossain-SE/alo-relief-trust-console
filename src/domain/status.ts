export const PROCESSING_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'needs_review',
] as const;

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  needs_review: 'Needs review',
};

// A document may only move along these edges. Anything else is a bug upstream.
const ALLOWED_TRANSITIONS: Record<ProcessingStatus, readonly ProcessingStatus[]> = {
  pending: ['processing'],
  processing: ['completed', 'failed', 'needs_review'],
  completed: [],
  failed: ['processing'],
  needs_review: ['completed', 'processing'],
};

// Reports whether a document can legally move between two states.
export function canTransition(from: ProcessingStatus, to: ProcessingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Reports whether a status still has work ahead of it.
export function isActive(status: ProcessingStatus): boolean {
  return status === 'pending' || status === 'processing';
}

// Reports whether a status needs an operator to do something.
export function needsAttention(status: ProcessingStatus): boolean {
  return status === 'failed' || status === 'needs_review';
}
