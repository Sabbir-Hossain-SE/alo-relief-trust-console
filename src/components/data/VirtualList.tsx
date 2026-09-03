'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react';
import Box from '@mui/material/Box';

/** Spread onto whatever the consumer makes focusable inside a row. */
export type VirtualRowProps = {
  tabIndex: number;
  'data-vrow': number;
};

type VirtualListProps<T> = {
  items: readonly T[];
  /** Fixed row height, which is what lets the window be computed rather than measured. */
  itemHeight: number;
  height: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number, row: VirtualRowProps) => ReactNode;
  /** Rows rendered beyond the viewport, so fast scrolling does not show gaps. */
  overscan?: number;
  label?: string;
  /**
   * Set when rows contain something focusable.
   *
   * Tab alone cannot work here: only the rows inside the window exist, so
   * tabbing reaches a handful and then leaves the list, and a row that scrolls
   * out from under the focus takes the focus with it. The list keeps one tab
   * stop and moves it with the arrow keys instead.
   */
  roving?: boolean;
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
  roving = false,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState(0);
  /** A row the keyboard just moved to, kept rendered until scrolling catches up. */
  const [anchor, setAnchor] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wantsFocus = useRef(false);

  const visibleCount = Math.ceil(height / itemHeight);

  // The queue shrinks as records are resolved, so the tab stop has to stay inside it.
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  // Anchoring the window on the row that was just focused, rather than waiting
  // for the scroll event the assignment below will raise, is what stops focus
  // being dropped when a row is unmounted out from under it.
  const from = anchor === null ? Math.floor(scrollTop / itemHeight) : anchor - overscan;
  const start = Math.max(0, Math.min(from - (anchor === null ? overscan : 0), items.length - 1));
  const end = Math.min(items.length, start + visibleCount + overscan * 2);
  const window = items.slice(start, end);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    // Real scrolling has taken over, so the anchor is no longer needed.
    setAnchor(null);
    setScrollTop(event.currentTarget.scrollTop);
  }

  /** Moves the tab stop and scrolls far enough that the row is actually rendered. */
  const moveTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      setActive(clamped);
      setAnchor(clamped);
      wantsFocus.current = true;

      const node = containerRef.current;
      if (node === null) return;

      const top = clamped * itemHeight;
      if (top < node.scrollTop) node.scrollTop = top;
      else if (top + itemHeight > node.scrollTop + height)
        node.scrollTop = top + itemHeight - height;
    },
    [items.length, itemHeight, height],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!roving) return;

    const page = Math.max(1, visibleCount - 1);
    const moves: Record<string, number | undefined> = {
      ArrowDown: activeIndex + 1,
      ArrowUp: activeIndex - 1,
      PageDown: activeIndex + page,
      PageUp: activeIndex - page,
      Home: 0,
      End: items.length - 1,
    };

    const next = moves[event.key];
    if (next === undefined) return;

    event.preventDefault();
    moveTo(next);
  }

  // Focus can only follow once the row has been windowed in, which is a render
  // later than the key press that asked for it.
  useEffect(() => {
    if (!roving || !wantsFocus.current) return;

    const row = containerRef.current?.querySelector<HTMLElement>(`[data-vrow="${activeIndex}"]`);
    if (!row) return;

    wantsFocus.current = false;
    row.focus();
  });

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      role="list"
      aria-label={label}
      // Without roving rows there is nothing focusable inside, and a scrollable
      // region no one can focus cannot be scrolled from a keyboard.
      tabIndex={roving ? -1 : 0}
      sx={{ height, overflowY: 'auto', position: 'relative' }}
    >
      {/* Presentational, so the list owns its items directly. Generic elements
          in between break the list/listitem relationship for assistive tech. */}
      <Box role="presentation" sx={{ height: items.length * itemHeight, position: 'relative' }}>
        <Box
          role="presentation"
          sx={{ position: 'absolute', top: start * itemHeight, left: 0, right: 0 }}
        >
          {window.map((item, offset) => {
            const index = start + offset;

            return (
              <Box
                key={getKey(item, index)}
                role="listitem"
                // Only a slice is rendered, so the count has to be stated or a
                // screen reader announces a 200-item queue as twenty.
                aria-setsize={items.length}
                aria-posinset={index + 1}
                onFocus={roving ? () => setActive(index) : undefined}
                sx={{ height: itemHeight }}
              >
                {renderItem(item, index, {
                  tabIndex: roving && index === activeIndex ? 0 : -1,
                  'data-vrow': index,
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
