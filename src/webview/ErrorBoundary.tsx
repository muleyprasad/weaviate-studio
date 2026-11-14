import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and handle React errors gracefully
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <div
            className="error-boundary-fallback"
            style={{
              padding: '16px',
              margin: '8px',
              backgroundColor:
                'var(--vscode-inputValidation-errorBackground, rgba(231, 76, 60, 0.1))',
              border: '1px solid var(--vscode-inputValidation-errorBorder, rgba(231, 76, 60, 0.3))',
              borderRadius: '4px',
              color: 'var(--vscode-errorForeground, #e74c3c)',
            }}
          >
            <h3>Something went wrong</h3>
            <details>
              <summary>View error details</summary>
              <pre>{this.state.error?.toString()}</pre>
            </details>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground, #3c3c3c)',
                color: 'var(--vscode-button-secondaryForeground, #cccccc)',
                border: '1px solid var(--vscode-button-border, #555)',
                borderRadius: '4px',
                padding: '4px 8px',
                marginTop: '8px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
