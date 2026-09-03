import type { RejectionReason } from './types';

/** Matches what the extraction pipeline claims to read. */
export const ACCEPTED_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'tif',
  'tiff',
  'webp',
  'heic',
] as const;

/** Mirrors the file_too_large failure the pipeline reports. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const REJECTION_LABELS: Record<RejectionReason, string> = {
  unsupported_format: 'Not a document format the pipeline can read',
  file_too_large: 'Larger than the 50 MB limit',
  empty_file: 'Empty file',
};

// Pulls the lowercased extension, or an empty string when there is none.
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Checks a file before it is queued.
 *
 * Rejecting here rather than on the server means an operator learns a folder
 * held 200 spreadsheets while the walk is still running, instead of after
 * uploading them.
 */
export function rejectionFor(name: string, size: number): RejectionReason | null {
  if (size <= 0) return 'empty_file';
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(name) as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return 'unsupported_format';
  }
  if (size > MAX_FILE_BYTES) return 'file_too_large';

  return null;
}

/** The `accept` attribute for the file input behind the drop zone. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
