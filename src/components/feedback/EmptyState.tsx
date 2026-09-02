'use client';

import type { ReactNode } from 'react';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { StateView } from './StateView';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

// Says what a screen is for and offers the next action, rather than "no data".
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <StateView
      icon={icon ?? <InboxOutlinedIcon fontSize="inherit" />}
      title={title}
      description={description}
      action={action}
    />
  );
}
