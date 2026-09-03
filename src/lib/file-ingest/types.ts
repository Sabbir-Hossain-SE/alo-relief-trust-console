export type IngestedFile = {
  /** Path relative to what was dropped, so folder structure survives. */
  path: string;
  name: string;
  size: number;
};

export const REJECTION_REASONS = ['unsupported_format', 'file_too_large', 'empty_file'] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export type RejectedFile = {
  path: string;
  reason: RejectionReason;
};

export type IngestProgress = {
  /** Entries examined so far, including folders and rejects. */
  scanned: number;
  accepted: number;
  rejected: number;
};

export type IngestResult = IngestProgress & {
  files: IngestedFile[];
  /** The rejected entries themselves; `rejected` above is their count. */
  rejections: RejectedFile[];
  /** True when the walk stopped early because the operator asked it to. */
  cancelled: boolean;
};

/**
 * The parts of the File System Entry API this walk uses.
 *
 * Declared structurally rather than taken from lib.dom so the walk can be
 * driven by a fake in tests. The real objects satisfy these shapes.
 */
export type FsFileEntry = {
  isFile: true;
  isDirectory: false;
  name: string;
  fullPath: string;
  file: (onSuccess: (file: File) => void, onError?: (error: unknown) => void) => void;
};

export type FsDirectoryEntry = {
  isFile: false;
  isDirectory: true;
  name: string;
  fullPath: string;
  createReader: () => FsDirectoryReader;
};

export type FsDirectoryReader = {
  readEntries: (
    onSuccess: (entries: FsEntry[]) => void,
    onError?: (error: unknown) => void,
  ) => void;
};

export type FsEntry = FsFileEntry | FsDirectoryEntry;
