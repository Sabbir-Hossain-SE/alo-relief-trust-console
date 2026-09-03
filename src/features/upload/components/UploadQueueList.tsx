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
          <LinearProgress variant="determinate" value={task.progress * 100} />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {task.status === 'waiting'
              ? `Retrying · attempt ${task.attempts + 1}`
              : task.status === 'failed'
                ? (task.error ?? 'Failed')
                : task.status}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

type UploadQueueListProps = {
  snapshot: QueueSnapshot;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
};

export function UploadQueueList({ snapshot, onPause, onResume, onCancel }: UploadQueueListProps) {
  const finished = snapshot.succeeded + snapshot.failed + snapshot.cancelled;

  return (
    <Paper className="flex flex-col">
      <Box className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Box>
          {/* Announced on the tens, not on every file: a per-file update would
              make a screen reader unusable on a large upload. */}
          <Typography
            variant="body2"
            aria-live="polite"
            aria-atomic
            key={Math.floor(snapshot.completion * 10)}
          >
            {formatCount(finished)} of {formatCount(snapshot.total)} sent ·{' '}
            {formatPercent(finished, snapshot.total)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {formatCount(snapshot.running)} in flight · {formatCount(snapshot.failed)} failed
            {snapshot.paused ? ' · paused' : ''}
          </Typography>
        </Box>

        <Box className="flex items-center gap-2">
          {snapshot.paused ? (
            <Button size="small" startIcon={<PlayArrowIcon />} onClick={onResume}>
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
    </Paper>
  );
}
