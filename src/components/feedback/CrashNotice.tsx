'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { StateView } from './StateView';

type CrashNoticeProps = {
  /** What stopped working, in the operator's terms. */
  title?: string;
  onRetry: () => void;
  retryLabel?: string;
  /** The exception's own message, for a bug report rather than for reading. */
  detail?: string;
  action?: React.ReactNode;
};

/**
 * What an operator sees when something throws where nothing was meant to.
 *
 * Every unexpected failure says the same three things, so the wording is
 * decided once: what happened, that their work is intact, and what to do next.
 * A crash is the moment an interface is least trusted, and "Something went
 * wrong" earns none of it back.
 *
 * The exception's message is carried, but folded away and labelled as
 * diagnostic. It is not the explanation — it is the thing worth pasting into a
 * bug report, and without it a report says only that a screen went blank.
 */
export function CrashNotice({
  title = 'This view could not be drawn',
  onRetry,
  retryLabel = 'Try again',
  detail,
  action,
}: CrashNoticeProps) {
  return (
    <Box>
      <StateView
        tone="error"
        icon={<ReportProblemOutlinedIcon fontSize="inherit" />}
        title={title}
        description="The screen failed part way through building itself. Nothing in the archive has been changed. Trying again rebuilds it; if it keeps failing, an unusual value in the address bar is the likeliest cause."
        action={
          <Box className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={onRetry}>
              {retryLabel}
            </Button>
            {action}
          </Box>
        }
      />

      {detail === undefined ? null : (
        <Box className="flex justify-center px-6 pb-6">
          <Box component="details" sx={{ maxWidth: 520, width: '100%' }}>
            <Typography
              component="summary"
              variant="caption"
              sx={{ color: 'text.secondary', cursor: 'pointer' }}
            >
              Technical detail
            </Typography>
            <Typography
              variant="caption"
              component="p"
              className="tabular mt-1 break-words"
              sx={{ color: 'text.secondary' }}
            >
              {detail}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
