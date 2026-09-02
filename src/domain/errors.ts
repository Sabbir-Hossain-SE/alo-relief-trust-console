export const PROCESSING_ERROR_CODES = [
  'ocr_timeout',
  'network_error',
  'unreadable_scan',
  'low_text_density',
  'unsupported_format',
  'file_too_large',
  'password_protected',
] as const;

export type ProcessingErrorCode = (typeof PROCESSING_ERROR_CODES)[number];

type ErrorSpec = {
  title: string;
  detail: string;
  remedy: string;
  retryable: boolean;
};

// Offering retry on everything hides the fact that some failures will never
// succeed on a second attempt. Each code carries its own answer.
const ERROR_SPECS: Record<ProcessingErrorCode, ErrorSpec> = {
  ocr_timeout: {
    title: 'Extraction timed out',
    detail: 'The extraction service did not respond in time.',
    remedy: 'Retry now, or leave it for the next scheduled sweep.',
    retryable: true,
  },
  network_error: {
    title: 'Upload interrupted',
    detail: 'The connection dropped before the file finished transferring.',
    remedy: 'Retry the upload.',
    retryable: true,
  },
  unreadable_scan: {
    title: 'Scan too poor to read',
    detail: 'Contrast and resolution were too low to extract text reliably.',
    remedy: 'Retry is unlikely to help. Rescan the original at a higher quality.',
    retryable: true,
  },
  low_text_density: {
    title: 'Almost no text found',
    detail: 'The page held very little machine-readable text.',
    remedy: 'Retry, or enter the details by hand if the page is handwritten.',
    retryable: true,
  },
  unsupported_format: {
    title: 'Format not supported',
    detail: 'This file type cannot be processed by the extraction pipeline.',
    remedy: 'Convert the file to PDF or an image, or enter the details by hand.',
    retryable: false,
  },
  file_too_large: {
    title: 'File too large',
    detail: 'The file exceeds the 50 MB per-document limit.',
    remedy: 'Split the document or reduce its resolution, then upload again.',
    retryable: false,
  },
  password_protected: {
    title: 'File is password protected',
    detail: 'The document could not be opened without a password.',
    remedy: 'Remove the password and upload the file again.',
    retryable: false,
  },
};

// Returns how a failure should be explained and what the operator can do about it.
export function describeError(code: ProcessingErrorCode): ErrorSpec {
  return ERROR_SPECS[code];
}

// Reports whether retrying this failure could plausibly succeed.
export function isRetryable(code: ProcessingErrorCode): boolean {
  return ERROR_SPECS[code].retryable;
}

// Narrows the retryable subset of a set of failures, for bulk retry actions.
export function retryableCodes(codes: readonly ProcessingErrorCode[]): ProcessingErrorCode[] {
  return codes.filter(isRetryable);
}
