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
import { NORMALIZED_FIELD_KEYS } from '@/domain/document';
import { formatDateTime } from '@/lib/format/date';
import { formatBytes } from '@/lib/format/number';
import {
  useCorrectDocumentMutation,
  useGetDocumentQuery,
  useRetryDocumentMutation,
  useSendDocumentToManualEntryMutation,
} from '@/store/api';
import { apiErrorMessage } from '@/store/apiError';
import { DocumentMeta } from './DocumentMeta';
import { DocumentRecord } from './DocumentRecord';
import { FailureNotice } from './FailureNotice';
import { ManualEntryNotice } from './ManualEntryNotice';

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
  const { data, isLoading, isError, error, refetch } = useGetDocumentQuery(documentId ?? '', {
    skip: !documentId,
  });

  const [correct, { reset: forgetCorrection, ...correctState }] = useCorrectDocumentMutation();
  const [retry, { reset: forgetRetry, ...retryState }] = useRetryDocumentMutation();
  const [sendToManualEntry, { reset: forgetManualEntry, ...manualState }] =
    useSendDocumentToManualEntryMutation();

  // The drawer never unmounts, so what was done to the last record would
  // otherwise still be reported under the next one opened. Forgotten on close,
  // in the handler: a reset in an effect keyed on the record re-ran on every
  // save, because the reset function itself is remade per request, and wiped
  // the message the save had just produced.
  const close = () => {
    forgetCorrection();
    forgetRetry();
    forgetManualEntry();
    onClose();
  };

  // Every action says what it did. A silent button leaves an operator unsure
  // whether the click registered, and clicking twice queues the work twice.
  // Only an action on this record counts, for the case where the record
  // changes underneath an open drawer — Back and Forward can do that.
  const own = (id: string | undefined) => id === documentId;
  const outcome =
    (own(correctState.originalArgs?.id) ? apiErrorMessage(correctState.error) : undefined) ??
    (own(retryState.originalArgs) ? apiErrorMessage(retryState.error) : undefined) ??
    (own(manualState.originalArgs) ? apiErrorMessage(manualState.error) : undefined) ??
    (own(correctState.originalArgs?.id) && correctState.isSuccess
      ? 'Correction saved.'
      : undefined) ??
    (own(retryState.originalArgs) && retryState.isSuccess
      ? 'Queued for another attempt.'
      : undefined) ??
    (own(manualState.originalArgs) && manualState.isSuccess
      ? 'Moved to the review queue for manual entry.'
      : undefined);

  // A record that is not there and a request that did not come back are
  // different problems: only one of them is helped by asking again.
  const missing = isError && (error as { status?: unknown }).status === 404;

  return (
    <Drawer
      anchor="right"
      open={documentId !== null}
      onClose={close}
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

        <IconButton onClick={close} aria-label="Close detail" edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {missing ? (
        <ErrorState
          title="This document is not in the archive"
          description="Nothing here carries that id. The link may have been mistyped, or it may point at a document from an earlier session."
        />
      ) : isError ? (
        <ErrorState
          title="This document could not be loaded"
          description="The request for its details did not come back."
          onRetry={() => void refetch()}
        />
      ) : isLoading || data === undefined ? (
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

          <DocumentRecord
            document={data}
            isSaving={correctState.isLoading}
            onSave={(corrections) =>
              corrections.length > 0 ? void correct({ id: data.id, corrections }) : undefined
            }
          />

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
