import { describe, expect, it } from 'vitest';
import {
  PROCESSING_STATUSES,
  canTransition,
  isActive,
  needsAttention,
  type ProcessingStatus,
} from './status';

describe('canTransition', () => {
  it('lets a queued document start processing', () => {
    expect(canTransition('pending', 'processing')).toBe(true);
  });

  it('lets processing end in any of its three outcomes', () => {
    expect(canTransition('processing', 'completed')).toBe(true);
    expect(canTransition('processing', 'failed')).toBe(true);
    expect(canTransition('processing', 'needs_review')).toBe(true);
  });

  it('lets a failed document be retried', () => {
    expect(canTransition('failed', 'processing')).toBe(true);
  });

  it('lets a reviewed document be resolved or reprocessed', () => {
    expect(canTransition('needs_review', 'completed')).toBe(true);
    expect(canTransition('needs_review', 'processing')).toBe(true);
  });

  it('treats completed as final', () => {
    const others = PROCESSING_STATUSES.filter((status) => status !== 'completed');
    for (const status of others) {
      expect(canTransition('completed', status)).toBe(false);
    }
  });

  it('rejects skipping processing entirely', () => {
    expect(canTransition('pending', 'completed')).toBe(false);
    expect(canTransition('pending', 'failed')).toBe(false);
    expect(canTransition('pending', 'needs_review')).toBe(false);
  });

  it('rejects a document transitioning to itself', () => {
    for (const status of PROCESSING_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('rejects moving backwards to pending', () => {
    const others = PROCESSING_STATUSES.filter((status) => status !== 'pending');
    for (const status of others) {
      expect(canTransition(status, 'pending')).toBe(false);
    }
  });
});

describe('isActive', () => {
  it('is true only while work remains', () => {
    const active: ProcessingStatus[] = ['pending', 'processing'];

    for (const status of PROCESSING_STATUSES) {
      expect(isActive(status)).toBe(active.includes(status));
    }
  });
});

describe('needsAttention', () => {
  it('is true only for states an operator must act on', () => {
    const attention: ProcessingStatus[] = ['failed', 'needs_review'];

    for (const status of PROCESSING_STATUSES) {
      expect(needsAttention(status)).toBe(attention.includes(status));
    }
  });

  it('never overlaps with active states', () => {
    for (const status of PROCESSING_STATUSES) {
      expect(isActive(status) && needsAttention(status)).toBe(false);
    }
  });
});
