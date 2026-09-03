'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Correction } from '@/domain/document';
import { NORMALIZED_FIELD_LABELS } from '@/domain/document';
import { formatDateTime } from '@/lib/format/date';

type DocumentMetaProps = {
  pageCount: number;
  size: string;
  batchId: string | undefined;
  processedAt: number | undefined;
  corrections: readonly Correction[];
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box className="flex items-baseline justify-between gap-4 py-1">
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" className="tabular">
        {value}
      </Typography>
    </Box>
  );
}

export function DocumentMeta({
  pageCount,
  size,
  batchId,
  processedAt,
  corrections,
}: DocumentMetaProps) {
  return (
    <Box className="flex flex-col gap-4">
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          File
        </Typography>
        <Box className="mt-1">
          <Row label="Pages" value={String(pageCount)} />
          <Row label="Size" value={size} />
          {batchId ? <Row label="Batch" value={batchId} /> : null}
          {processedAt ? <Row label="Processed" value={formatDateTime(processedAt)} /> : null}
        </Box>
      </Box>

      {/* An audit trail rather than a flag: showing what a value was before an
          operator changed it is what makes the correction reviewable later. */}
      {corrections.length > 0 ? (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Corrections
          </Typography>

          <Box className="mt-1 flex flex-col gap-2">
            {corrections.map((correction, index) => (
              <Box key={`${correction.field}-${correction.correctedAt}-${index}`}>
                <Typography variant="body2">
                  {NORMALIZED_FIELD_LABELS[correction.field]}
                  {correction.previous ? (
                    <>
                      {': '}
                      <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        <s>{correction.previous}</s>
                      </Typography>
                      {' → '}
                    </>
                  ) : (
                    ': '
                  )}
                  {correction.next}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {formatDateTime(correction.correctedAt)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
