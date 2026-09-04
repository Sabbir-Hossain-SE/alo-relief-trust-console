import { describe, expect, it } from 'vitest';
import type { Correction } from '@/domain/document';
import { applyPatch, createOverlay, isTouched, readPatch } from './overlay';

function correction(field: Correction['field'], next: string): Correction {
  return { field, next, correctedAt: 1_700_000_000_000 };
}

describe('overlay', () => {
  it('reports nothing for an untouched document', () => {
    expect(readPatch(createOverlay(), 42)).toBeUndefined();
  });

  it('records a first patch', () => {
    const overlay = createOverlay();
    applyPatch(overlay, 42, { status: 'processing' });

    expect(readPatch(overlay, 42)?.status).toBe('processing');
  });

  it('keeps documents independent', () => {
    const overlay = createOverlay();
    applyPatch(overlay, 1, { status: 'processing' });

    expect(readPatch(overlay, 2)).toBeUndefined();
  });

  it('merges a later patch without dropping earlier keys', () => {
    const overlay = createOverlay();
    applyPatch(overlay, 7, { status: 'failed', attempts: 1 });
    applyPatch(overlay, 7, { attempts: 2 });

    const patch = readPatch(overlay, 7);
    expect(patch?.status).toBe('failed');
    expect(patch?.attempts).toBe(2);
  });

  it('merges fields rather than replacing the whole record', () => {
    const overlay = createOverlay();
    applyPatch(overlay, 7, {
      fields: { personName: { value: 'Rahim Ahmed', confidence: 1, source: 'manual' } },
    });
    applyPatch(overlay, 7, {
      fields: { phone: { value: '+8801700000000', confidence: 1, source: 'manual' } },
    });

    const fields = readPatch(overlay, 7)?.fields;
    expect(fields?.personName?.value).toBe('Rahim Ahmed');
    expect(fields?.phone?.value).toBe('+8801700000000');
  });

  it('appends corrections instead of overwriting the audit trail', () => {
    const overlay = createOverlay();
    applyPatch(overlay, 7, { corrections: [correction('personName', 'Rahim Ahmed')] });
    applyPatch(overlay, 7, { corrections: [correction('phone', '+8801700000000')] });

    const corrections = readPatch(overlay, 7)?.corrections;
    expect(corrections).toHaveLength(2);
    expect(corrections?.[0]?.field).toBe('personName');
    expect(corrections?.[1]?.field).toBe('phone');
  });

  it('preserves the audit trail through an unrelated patch', () => {
    const overlay = createOverlay();
    applyPatch(overlay, 7, { corrections: [correction('personName', 'Rahim Ahmed')] });
    applyPatch(overlay, 7, { status: 'completed' });

    expect(readPatch(overlay, 7)?.corrections).toHaveLength(1);
  });

  it('distinguishes clearing an error from leaving it alone', () => {
    const overlay = createOverlay();

    applyPatch(overlay, 7, { errorCode: 'ocr_timeout' });
    expect(readPatch(overlay, 7)?.errorCode).toBe('ocr_timeout');

    applyPatch(overlay, 7, { attempts: 2 });
    expect(readPatch(overlay, 7)?.errorCode).toBe('ocr_timeout');

    applyPatch(overlay, 7, { errorCode: null });
    expect(readPatch(overlay, 7)?.errorCode).toBeNull();
  });

  it("does not retain a reference to the caller's patch object", () => {
    const overlay = createOverlay();
    const patch = { attempts: 1 };

    applyPatch(overlay, 7, patch);
    patch.attempts = 99;

    expect(readPatch(overlay, 7)?.attempts).toBe(1);
  });

  it('stays empty until something actually changes', () => {
    expect(createOverlay().patches.size).toBe(0);
  });
});

describe('touched rows', () => {
  it('marks a patched row and no other', () => {
    const overlay = createOverlay(8);
    applyPatch(overlay, 3, { status: 'completed' });

    expect(isTouched(overlay, 3)).toBe(true);
    expect(isTouched(overlay, 2)).toBe(false);
    expect(readPatch(overlay, 2)).toBeUndefined();
  });

  it('grows to a row past its starting capacity', () => {
    const overlay = createOverlay(4);
    applyPatch(overlay, 9000, { status: 'failed' });

    expect(isTouched(overlay, 9000)).toBe(true);
    expect(readPatch(overlay, 9000)?.status).toBe('failed');
    expect(isTouched(overlay, 8999)).toBe(false);
  });
});
