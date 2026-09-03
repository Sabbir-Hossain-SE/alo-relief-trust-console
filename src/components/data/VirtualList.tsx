'use client';

import { useState, type ReactNode, type UIEvent } from 'react';
import Box from '@mui/material/Box';

type VirtualListProps<T> = {
  items: readonly T[];
  /** Fixed row height, which is what lets the window be computed rather than measured. */
  itemHeight: number;
  height: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Rows rendered beyond the viewport, so fast scrolling does not show gaps. */
  overscan?: number;
  label?: string;
};

/**
 * Renders only the rows on screen.
 *
 * An upload queue can hold tens of thousands of files, and the grid is not the
 * only place that has to survive that — a plain list of 50,000 rows costs more
 * in DOM nodes than the entire rest of the page.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  getKey,
  renderItem,
  overscan = 6,
  label,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(height / itemHeight);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(items.length, start + visibleCount + overscan * 2);
  const window = items.slice(start, end);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  return (
    <Box
      onScroll={handleScroll}
      role="list"
      aria-label={label}
      sx={{ height, overflowY: 'auto', position: 'relative' }}
    >
      {/* Full-height spacer so the scrollbar reflects the whole queue. */}
      <Box sx={{ height: items.length * itemHeight, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: start * itemHeight, left: 0, right: 0 }}>
          {window.map((item, offset) => (
            <Box key={getKey(item, start + offset)} role="listitem" sx={{ height: itemHeight }}>
              {renderItem(item, start + offset)}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
