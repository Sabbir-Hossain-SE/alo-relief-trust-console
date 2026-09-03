import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { theme } from '@/theme/theme';

/**
 * Renders inside the Daylight theme.
 *
 * Components read status tokens straight off the palette, and the stock MUI
 * theme has none of them, so a bare render fails on styling rather than on
 * anything the test is about.
 */
export function renderWithTheme(ui: ReactElement, options?: RenderOptions): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
