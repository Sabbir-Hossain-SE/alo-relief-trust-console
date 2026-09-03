'use client';

import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { StatusChip } from '@/components/data/StatusChip';
import { ActionOutcome } from '@/components/feedback/ActionOutcome';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NORMALIZED_FIELD_KEYS, NORMALIZED_FIELD_LABELS } from '@/domain/document';
import { formatDateTime } from '@/lib/format/date';
import { formatBytes } from '@/lib/format/number';
import {
  useGetDocumentQuery,
  useRetryDocumentMutation,
  useSendDocumentToManualEntryMutation,
} from '@/store/api';
import { apiErrorMessage } from '@/store/apiError';
import { DocumentMeta } from './DocumentMeta';
import { FailureNotice } from './FailureNotice';
import { ManualEntryNotice } from './ManualEntryNotice';
import { FieldRow } from './FieldRow';

type DocumentDrawerProps = {
  documentId: string | null;
  onClose: () => void;
};

const WIDTH = { xs: '100%', sm: 460 };

/**
 * Detail view for one document.
 *
 * MUI's Drawer is a modal: it traps focus while open, restores focus to the
 * trigger on close, and closes on Escape. That is why it is used here rather
 * than a hand-rolled panel — those three behaviours are the ones most often
 * missing from a custom implementation.
 */
export function DocumentDrawer({ documentId, onClose }: DocumentDrawerProps) {
  const { data, isLoading, isError, refetch } = useGetDocumentQuery(documentId ?? '', {
    skip: documentId === null,
  });

  const [retry, retryState] = useRetryDocumentMutation();
  const [sendToManualEntry, manualState] = useSendDocumentToManualEntryMutation();

  // Every action says what it did. A silent button leaves an operator unsure
  // whether the click registered, and clicking twice queues the work twice.
  const outcome =
    apiErrorMessage(retryState.error) ??
    apiErrorMessage(manualState.error) ??
    (retryState.isSuccess ? 'Queued for another attempt.' : undefined) ??
    (manualState.isSuccess ? 'Moved to the review queue for manual entry.' : undefined);

  return (
    <Drawer
      anchor="right"
      open={documentId !== null}
      onClose={onClose}
      // The role has to be set explicitly. MUI's Modal marks its root
      // presentational and gives the paper no role of its own, so an aria-label
      // alone lands on a plain div and is never announced.
      slotProps={{
        paper: {
          sx: { width: WIDTH },
          role: 'dialog',
          'aria-modal': true,
          'aria-label': 'Document detail',
        },
      }}
    >
      <Box className="flex items-start justify-between gap-2 p-4">
        <Box className="min-w-0">
          <Typography variant="caption" className="tabular" sx={{ color: 'text.secondary' }}>
            {documentId}
          </Typography>
          <Typography variant="h3" component="h2" className="truncate">
            {data?.fileName ?? 'Document'}
          </Typography>
        </Box>

        <IconButton onClick={onClose} aria-label="Close detail" edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {isError ? (
        <ErrorState
          title="This document could not be loaded"
          description="The request for its details did not come back."
          onRetry={() => void refetch()}
        />
      ) : null}

      {isLoading || data === undefined ? (
        <Box className="flex flex-col gap-3 p-4">
          {NORMALIZED_FIELD_KEYS.map((key) => (
            <Skeleton key={key} variant="rounded" height={72} />
          ))}
        </Box>
      ) : (
        <Box className="flex flex-col gap-4 overflow-y-auto p-4">
          <Box className="flex flex-wrap items-center gap-2">
            <StatusChip status={data.status} size="medium" />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Uploaded {formatDateTime(data.uploadedAt)}
            </Typography>
          </Box>

          <ActionOutcome lines={outcome === undefined ? [] : [outcome]} />

          {data.status === 'failed' && data.errorCode !== undefined ? (
            <FailureNotice
              errorCode={data.errorCode}
              attempts={data.attempts}
              isRetrying={retryState.isLoading}
              isSending={manualState.isLoading}
              onRetry={() => void retry(data.id)}
              onManualEntry={() => void sendToManualEntry(data.id)}
            />
          ) : null}

          {data.status === 'needs_review' && data.errorCode !== undefined ? (
            <ManualEntryNotice errorCode={data.errorCode} />
          ) : null}

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Extracted information
            </Typography>

            <Box className="mt-2 flex flex-col gap-2">
              {NORMALIZED_FIELD_KEYS.map((key) => (
                <FieldRow
                  key={key}
                  label={NORMALIZED_FIELD_LABELS[key]}
                  field={data.fields[key]}
                  underReview={data.status === 'needs_review'}
                />
              ))}
            </Box>
          </Box>

          <DocumentMeta
            pageCount={data.pageCount}
            size={formatBytes(data.sizeBytes)}
            batchId={data.batchId}
            processedAt={data.processedAt}
            corrections={data.corrections}
          />
        </Box>
      )}
    </Drawer>
  );
}
