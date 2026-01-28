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
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate trackable error ID
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Enhanced error logging with trackable ID and context
    const errorContext = {
      errorId: this.state.errorId,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      // User context (collection, operation) can be added here if available via props
    };

    console.error('[DataExplorer] Error caught by boundary:', errorContext);

    // TODO: Integrate with Sentry or other error tracking service
    // Example: Sentry.captureException(error, { contexts: { errorBoundary: errorContext } });
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
          {this.state.errorId && (
            <p className="error-id" style={{ fontSize: '0.85em', opacity: 0.7 }}>
              Error ID: {this.state.errorId}
            </p>
          )}
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
