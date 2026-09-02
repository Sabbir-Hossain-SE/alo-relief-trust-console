import type { ProcessingErrorCode } from './errors';
import type { ExtractedField } from './field';
import type { ProcessingStatus } from './status';

export const DOCUMENT_TYPES = [
  'enrollment_form',
  'medical_intake',
  'id_scan',
  'handwritten_note',
  'consent_form',
  'distribution_log',
  'attendance_sheet',
  'referral_letter',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  enrollment_form: 'Enrollment form',
  medical_intake: 'Medical intake',
  id_scan: 'ID scan',
  handwritten_note: 'Handwritten note',
  consent_form: 'Consent form',
  distribution_log: 'Distribution log',
  attendance_sheet: 'Attendance sheet',
  referral_letter: 'Referral letter',
};

// The normalized shape a processed document produces. Every field is optional
// and carries its own confidence, because extraction is routinely incomplete.
export type NormalizedRecord = {
  personName: ExtractedField<string>;
  phone: ExtractedField<string>;
  location: ExtractedField<string>;
  programName: ExtractedField<string>;
  documentDate: ExtractedField<string>;
};

// Stable order for the normalized fields, so generation and rendering agree.
export const NORMALIZED_FIELD_KEYS = [
  'personName',
  'phone',
  'location',
  'programName',
  'documentDate',
] as const satisfies readonly (keyof NormalizedRecord)[];

export const NORMALIZED_FIELD_LABELS: Record<keyof NormalizedRecord, string> = {
  personName: 'Person name',
  phone: 'Phone',
  location: 'Location',
  programName: 'Program',
  documentDate: 'Document date',
};

export type Correction = {
  field: keyof NormalizedRecord;
  previous?: string;
  next: string;
  correctedAt: number;
};

// A row in the documents grid. Kept flat so the grid never walks nested objects.
export type DocumentSummary = {
  id: string;
  index: number;
  fileName: string;
  documentType: DocumentType;
  status: ProcessingStatus;
  confidence: number;
  uploadedAt: number;
  personName?: string;
  location?: string;
  errorCode?: ProcessingErrorCode;
  attempts: number;
};

// Everything the detail view needs, materialized only for the open document.
export type DocumentDetail = DocumentSummary & {
  sizeBytes: number;
  pageCount: number;
  batchId?: string;
  processedAt?: number;
  fields: NormalizedRecord;
  corrections: Correction[];
};

// Averages field confidence, which is what the grid sorts and filters on.
export function overallConfidence(fields: NormalizedRecord): number {
  const values = Object.values(fields);
  const total = values.reduce((sum, field) => sum + field.confidence, 0);
  return total / values.length;
}
