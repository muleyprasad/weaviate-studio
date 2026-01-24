/**
 * ErrorBoundary - Catches and displays errors gracefully
 * Prevents entire UI from crashing when a component fails
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[DataExplorer] Error caught by boundary:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <span className="codicon codicon-error" aria-hidden="true"></span>
          <h3>{this.props.fallbackMessage || 'Something went wrong'}</h3>
          <p className="error-message">{this.state.error?.message}</p>
          <button
            type="button"
            className="error-retry-btn"
            onClick={this.handleRetry}
            aria-label="Try again"
          >
            <span className="codicon codicon-refresh" aria-hidden="true"></span>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
