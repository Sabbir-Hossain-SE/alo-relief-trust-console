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
 *
 * MUI has no search component; a `TextField` with a leading adornment is the
 * pattern its own documentation uses, so the work here is in matching the field
 * beside it rather than in reaching for a different component.
 */
export function DocumentSearch({ value, onChange }: DocumentSearchProps) {
  const [draft, setDraft] = useState(value);
  /** The last term handed to `onChange`, whether or not the URL shows it yet. */
  const [committed, setCommitted] = useState(value);
  /** The last URL value seen, so a change from elsewhere can be told apart. */
  const [seen, setSeen] = useState(value);

  // Follow the URL when it changes from elsewhere — a cleared filter, a back
  // navigation. Adjusted during render rather than in an effect, so the field
  // never shows a stale value for a frame.
  //
  // Compared against what was committed, not merely against the draft. The URL
  // arrives a router transition after the commit that asked for it, and a
  // keystroke typed in that gap used to be thrown away when the older value
  // landed and was mistaken for someone else's change.
  if (value !== seen) {
    setSeen(value);

    if (value !== committed) {
      setCommitted(value);
      setDraft(value);
    }
  }

  useEffect(() => {
    if (draft === committed) return;

    const timer = setTimeout(() => {
      setCommitted(draft);
      onChange(draft);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, committed, onChange]);

  return (
    <TextField
      size="small"
      label="Search"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      // Escape is what a keyboard operator reaches for to abandon a search, and
      // the clear button is otherwise mouse-only unless they tab onto it.
      onKeyDown={(event) => {
        if (event.key === 'Escape' && draft.length > 0) {
          event.preventDefault();
          setDraft('');
        }
      }}
      placeholder="Name, location or ID"
      // Flexible rather than fixed: at a fixed 280 the row it sits in wrapped
      // by a handful of pixels on a small laptop with the navigation expanded,
      // which put the type filter on a line of its own.
      sx={{ flex: '1 1 200px', minWidth: 0, maxWidth: { xs: '100%', sm: 320 } }}
      slotProps={{
        // Held open rather than left to float. An unshrunk label would sit on
        // top of the search icon, and a label that only appears once the field
        // has content is the thing that made this row read as two different
        // kinds of control: the type filter grew a heading when it was used and
        // this one never did.
        inputLabel: { shrink: true },
        // On the input itself. Set on the TextField it lands on the wrapper
        // div, where assistive technology will not find it. It says "documents"
        // where the visible label says "Search" — the visible text has to be
        // part of the accessible name, and it is.
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
