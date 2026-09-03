import { describe, expect, it } from 'vitest';
import { REJECTION_REASONS } from './types';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  REJECTION_LABELS,
  extensionOf,
  rejectionFor,
} from './validate';

describe('extensionOf', () => {
  it('lowercases what it finds', () => {
    expect(extensionOf('SCAN.PDF')).toBe('pdf');
  });

  it('takes the last extension of several', () => {
    expect(extensionOf('intake.form.tiff')).toBe('tiff');
  });

  it('reports nothing for a name that has none', () => {
    expect(extensionOf('scan')).toBe('');
    expect(extensionOf('scan.')).toBe('');
  });

  // A dotfile's leading dot does not introduce an extension.
  it('does not read a leading dot as an extension', () => {
    expect(extensionOf('.gitkeep')).toBe('');
  });
});

describe('rejectionFor', () => {
  it('accepts every format the pipeline claims to read', () => {
    for (const extension of ACCEPTED_EXTENSIONS) {
      expect(rejectionFor(`scan.${extension}`, 1024)).toBeNull();
    }
  });

  it('rejects a format the pipeline cannot read', () => {
    expect(rejectionFor('roster.xlsx', 1024)).toBe('unsupported_format');
  });

  // Checked before the format, because an empty file is the more specific
  // complaint and naming it saves an operator looking for the wrong problem.
  it('reports an empty file as empty rather than as the wrong format', () => {
    expect(rejectionFor('roster.xlsx', 0)).toBe('empty_file');
  });

  it('holds the size limit exactly', () => {
    expect(rejectionFor('scan.pdf', MAX_FILE_BYTES)).toBeNull();
    expect(rejectionFor('scan.pdf', MAX_FILE_BYTES + 1)).toBe('file_too_large');
  });
});

describe('REJECTION_LABELS', () => {
  // A reason with no label reaches the operator as an empty line in the ingest
  // summary, which reads as a bug in the count rather than a missing string.
  it('names every reason a file can be rejected for', () => {
    for (const reason of REJECTION_REASONS) {
      expect(REJECTION_LABELS[reason]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('ACCEPT_ATTRIBUTE', () => {
  it('offers the picker exactly what the walk accepts', () => {
    expect(ACCEPT_ATTRIBUTE.split(',')).toEqual(ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`));
  });
});
