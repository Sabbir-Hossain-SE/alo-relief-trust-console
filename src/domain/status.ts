export const PROCESSING_STATUSES = [
  'queued',
  'processing',
  'processed',
  'needs_review',
  'failed',
] as const;

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  processed: 'Processed',
  needs_review: 'Needs review',
  failed: 'Failed',
};
