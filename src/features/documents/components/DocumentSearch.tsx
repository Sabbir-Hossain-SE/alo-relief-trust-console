'use client';

import { useEffect, useState } from 'react';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';

const DEBOUNCE_MS = 250;

type DocumentSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Search box whose input is local and whose commits are debounced.
 *
 * The committed value drives a URL change and a refetch, so committing on every
 * keystroke would push a history entry and a request per character. The field
 * stays controlled locally so typing never waits for either.
 */
export function DocumentSearch({ value, onChange }: DocumentSearchProps) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);

  // Follow the URL when it changes from elsewhere — a cleared filter, a back
  // navigation. Adjusted during render rather than in an effect, so the field
  // never shows a stale value for a frame.
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === committed) return;

    const timer = setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, committed, onChange]);

  return (
    <TextField
      size="small"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder="Search name, location or ID"
      sx={{ minWidth: { xs: '100%', sm: 280 } }}
      slotProps={{
        // On the input itself. Set on the TextField it lands on the wrapper
        // div, where assistive technology will not find it.
        htmlInput: { 'aria-label': 'Search documents' },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment:
            draft.length > 0 ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => setDraft('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
        },
      }}
    />
  );
}
