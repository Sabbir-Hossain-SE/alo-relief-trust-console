'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CrashNotice } from './CrashNotice';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Named so the notice can say which part of the screen stopped, not just that one did. */
  title?: string;
  /**
   * Clears the error when it changes.
   *
   * Without it a boundary that has caught once shows its notice for as long as
   * it stays mounted, so a screen broken by one filter stays broken after the
   * operator picks a different one.
   */
  resetKey?: string | number;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * Keeps one failed region from taking the whole route with it.
 *
 * React unmounts the entire tree under the nearest boundary, so without one the
 * grid throwing removes the filters that could have been used to fix it — which
 * is how a page size of 200 in the address bar left an operator with the
 * browser's own error page and no way back except editing the URL.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error !== null && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  override render() {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <CrashNotice
        title={this.props.title}
        detail={error.message}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}
