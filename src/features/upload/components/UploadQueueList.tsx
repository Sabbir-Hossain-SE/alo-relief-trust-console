'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { alpha } from '@mui/material/styles';
import { ProgressAnnouncer, decile } from '@/components/feedback/ProgressAnnouncer';
import { VirtualList } from '@/components/data/VirtualList';
import type { QueueSnapshot, QueueTask } from '@/lib/upload-queue/types';
import { formatCount, formatPercent } from '@/lib/format/number';

const ROW_HEIGHT = 44;
const LIST_HEIGHT = 320;

function TaskRow({ task }: { task: QueueTask }) {
  return (
    <Box className="flex items-center gap-3 px-3" sx={{ height: ROW_HEIGHT }}>
      <Box className="w-5 shrink-0">
        {task.status === 'succeeded' ? (
          <CheckCircleOutlinedIcon fontSize="small" sx={{ color: 'status.completed.ink' }} />
        ) : null}
        {task.status === 'failed' ? (
          <ErrorOutlinedIcon fontSize="small" sx={{ color: 'status.failed.ink' }} />
        ) : null}
      </Box>

      <Typography variant="body2" className="tabular w-0 flex-1 truncate">
        {task.label}
      </Typography>

      <Box className="w-40 shrink-0">
        {task.status === 'running' ? (
          <LinearProgress
            variant="determinate"
            value={task.progress * 100}
            aria-label={`Uploading ${task.label}`}
          />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {task.status === 'waiting'
              ? `Retrying · attempt ${task.attempts + 1}`
              : task.status === 'failed'
                ? (task.error ?? 'Failed')
                : // The tick beside a sent file is decorative to a screen
                  // reader, so the outcome has to be readable as text too.
                  task.status === 'succeeded'
                  ? 'Sent'
                  : task.status}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

type UploadQueueListProps = {
  snapshot: QueueSnapshot;
  /** The browser reports no connection. */
  offline?: boolean;
  /** The pause is the queue's own, waiting for the connection, not the operator's. */
  pausedForNetwork?: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
};

// Says why nothing is moving, since a pause the operator did not ask for needs explaining.
function pausedLabel(snapshot: QueueSnapshot, pausedForNetwork: boolean, offline: boolean): string {
  if (!snapshot.paused) return '';
  if (pausedForNetwork) return ' · paused until the connection comes back';
  // The operator's own pause stands when the connection returns, so it must
  // not read as one that will lift itself.
  return offline ? ' · paused · no connection' : ' · paused';
}

// What the run has settled for each file, in the words a screen reader gets as well.
function outcomeLabel(snapshot: QueueSnapshot): string {
  const parts = [`${formatCount(snapshot.succeeded)} sent`];
  if (snapshot.failed > 0) parts.push(`${formatCount(snapshot.failed)} failed`);
  if (snapshot.cancelled > 0) parts.push(`${formatCount(snapshot.cancelled)} cancelled`);
  return parts.join(', ');
}

export function UploadQueueList({
  snapshot,
  offline = false,
  pausedForNetwork = false,
  onPause,
  onResume,
  onCancel,
}: UploadQueueListProps) {
  const finished = snapshot.succeeded + snapshot.failed + snapshot.cancelled;

  return (
    <Paper className="flex flex-col">
      <Box className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Box>
          {/* "Done" rather than "sent": a file the queue gave up on, or was
              told to drop, is finished with but never arrived. */}
          <Typography variant="body2" className="figures">
            {formatCount(finished)} of {formatCount(snapshot.total)} done ·{' '}
            {formatPercent(finished, snapshot.total)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {outcomeLabel(snapshot)} · {formatCount(snapshot.running)} in flight
            {pausedLabel(snapshot, pausedForNetwork, offline)}
          </Typography>
        </Box>

        <Box className="flex items-center gap-2">
          {snapshot.paused ? (
            // Resuming against a dead network would only burn every file's
            // attempts; the button waits with the queue.
            <Button
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={onResume}
              disabled={offline}
            >
              Resume
            </Button>
          ) : (
            <Button size="small" startIcon={<PauseIcon />} onClick={onPause}>
              Pause
            </Button>
          )}
          <Button size="small" color="inherit" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={snapshot.completion * 100}
        aria-label="Upload progress"
        sx={(theme) => ({
          height: 4,
          backgroundColor: alpha(theme.palette.primary.main, 0.15),
        })}
      />

      {/* Virtualized: a queue can hold tens of thousands of files, and the grid
          is not the only place that has to survive that. */}
      <VirtualList
        items={snapshot.tasks}
        itemHeight={ROW_HEIGHT}
        height={LIST_HEIGHT}
        label="Upload queue"
        getKey={(task) => task.id}
        renderItem={(task) => <TaskRow task={task} />}
      />

      <ProgressAnnouncer
        step={decile(snapshot.completion)}
        message={`${formatCount(finished)} of ${formatCount(snapshot.total)} files done: ${outcomeLabel(snapshot)}.`}
        final={snapshot.settled}
      />
    </Paper>
  );
}
