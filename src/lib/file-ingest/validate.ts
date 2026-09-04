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
  system_file: 'Hidden system file, such as .DS_Store or Thumbs.db',
};

/** Files an operating system leaves in every folder it touches. */
const SYSTEM_FILE_NAMES = new Set(['thumbs.db', 'desktop.ini']);

// Pulls the lowercased extension, or an empty string when there is none.
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Whether a file is the operating system's rather than the operator's.
 *
 * A folder dragged from a Mac carries a `.DS_Store` at every level and a `._`
 * shadow beside every file it was ever copied to a memory stick with. Counted
 * as "not a document format" they read as documents that were lost.
 */
export function isSystemFile(name: string): boolean {
  return name.startsWith('.') || SYSTEM_FILE_NAMES.has(name.toLowerCase());
}

/**
 * Checks a file before it is queued.
 *
 * Rejecting here rather than on the server means an operator learns a folder
 * held 200 spreadsheets while the walk is still running, instead of after
 * uploading them.
 */
export function rejectionFor(name: string, size: number): RejectionReason | null {
  if (isSystemFile(name)) return 'system_file';
  if (size <= 0) return 'empty_file';
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(name) as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return 'unsupported_format';
  }
  if (size > MAX_FILE_BYTES) return 'file_too_large';

  return null;
}

/** The `accept` attribute for the file input behind the drop zone. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
