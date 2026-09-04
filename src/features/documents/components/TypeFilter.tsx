'use client';

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from '@/domain/document';

type TypeFilterProps = {
  selected: DocumentType | undefined;
  onChange: (type: DocumentType | undefined) => void;
  fullWidth?: boolean;
};

// The document-type filter, in the bar on a wide screen and in the sheet on a phone.
export function TypeFilter({ selected, onChange, fullWidth = false }: TypeFilterProps) {
  return (
    <TextField
      select
      size="small"
      label="Type"
      fullWidth={fullWidth}
      value={selected ?? ''}
      onChange={(event) => onChange((event.target.value || undefined) as DocumentType | undefined)}
      sx={fullWidth ? undefined : { minWidth: 190 }}
      slotProps={{
        // The same held-open label as the search beside it, so the pair reads as
        // one row of controls. Without `displayEmpty` the select renders nothing
        // at all under a shrunk label, which looks like a field that failed to
        // load rather than one nothing is set on.
        inputLabel: { shrink: true },
        select: { displayEmpty: true },
      }}
    >
      <MenuItem value="">All types</MenuItem>
      {DOCUMENT_TYPES.map((type) => (
        <MenuItem key={type} value={type}>
          {DOCUMENT_TYPE_LABELS[type]}
        </MenuItem>
      ))}
    </TextField>
  );
}
