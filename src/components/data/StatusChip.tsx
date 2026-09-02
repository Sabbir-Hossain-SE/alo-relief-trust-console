'use client';

import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import { STATUS_LABELS, type ProcessingStatus } from '@/domain/status';

const STATUS_ICONS: Record<ProcessingStatus, SvgIconComponent> = {
  pending: HourglassEmptyIcon,
  processing: AutorenewIcon,
  completed: CheckCircleOutlinedIcon,
  failed: ErrorOutlinedIcon,
  needs_review: RateReviewOutlinedIcon,
};

type StatusChipProps = {
  status: ProcessingStatus;
  size?: 'small' | 'medium';
};

// Shows a processing status as icon, text and colour together, never colour alone.
export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const Icon = STATUS_ICONS[status];

  return (
    <Chip
      size={size}
      icon={<Icon fontSize="small" />}
      label={STATUS_LABELS[status]}
      sx={(theme) => ({
        color: theme.palette.status[status],
        backgroundColor: alpha(theme.palette.status[status], 0.12),
        border: `1px solid ${alpha(theme.palette.status[status], 0.24)}`,
        '& .MuiChip-icon': { color: 'inherit' },
      })}
    />
  );
}
