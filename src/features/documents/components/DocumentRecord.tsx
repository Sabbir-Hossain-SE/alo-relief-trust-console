'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  NORMALIZED_FIELD_KEYS,
  NORMALIZED_FIELD_LABELS,
  type DocumentDetail,
} from '@/domain/document';
import type { CorrectionInput } from '@/server/api-contract';
import { FieldRow } from './FieldRow';

/**
 * Loaded when a record is actually being corrected.
 *
 * The form brings a date picker and a numbering plan for every country on
 * earth — around a hundred kilobytes, for two fields that cannot be reached
 * until a document is open and someone has chosen to edit it. Held in the main
 * bundle, every operator paid for it on the way to a grid.
 */
const CorrectionForm = dynamic(
  () => import('./CorrectionForm').then((module) => module.CorrectionForm),
  {
    ssr: false,
    loading: () => (
      <Box className="flex flex-col gap-3">
        {NORMALIZED_FIELD_KEYS.map((key) => (
          <Skeleton key={key} variant="rounded" height={72} />
        ))}
      </Box>
    ),
  },
);

type DocumentRecordProps = {
  document: DocumentDetail;
  isSaving: boolean;
  onSave: (corrections: CorrectionInput[]) => void;
};

/**
 * The extracted record, read-only or under correction.
 *
 * A review task opens ready to be worked on, because that is the whole reason
 * it is in front of an operator. Anything else opens as a record to be read,
 * since most documents are opened to be looked at rather than edited.
 */
export function DocumentRecord({ document, isSaving, onSave }: DocumentRecordProps) {
  const [correctingId, setCorrectingId] = useState<string | null>(null);

  const underReview = document.status === 'needs_review';
  const correctable = underReview || document.status === 'completed';
  const isCorrecting = underReview || correctingId === document.id;

  return (
    <Box>
      <Box className="flex items-baseline justify-between gap-2">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Extracted information
        </Typography>

        {correctable && !isCorrecting ? (
          <Button
            size="small"
            startIcon={<EditOutlinedIcon />}
            onClick={() => setCorrectingId(document.id)}
          >
            Correct
          </Button>
        ) : null}
      </Box>

      <Box className="mt-2 flex flex-col gap-2">
        {isCorrecting ? (
          <CorrectionForm
            fields={document.fields}
            underReview={underReview}
            isSaving={isSaving}
            onSave={onSave}
          />
        ) : (
          NORMALIZED_FIELD_KEYS.map((key) => (
            <FieldRow
              key={key}
              label={NORMALIZED_FIELD_LABELS[key]}
              field={document.fields[key]}
              underReview={underReview}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
