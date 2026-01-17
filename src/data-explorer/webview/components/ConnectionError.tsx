/**
 * ConnectionError - Handles connection errors with retry functionality
 *
 * Shows when Weaviate instance is unreachable
 */

import React, { useState } from 'react';

interface ConnectionErrorProps {
  error: Error | string;
  onRetry: () => void;
  onOpenSettings?: () => void;
}

export function ConnectionError({
  error,
  onRetry,
  onOpenSettings,
}: ConnectionErrorProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      // Keep retrying state for at least 500ms to show feedback
      setTimeout(() => setRetrying(false), 500);
    }
  };

  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className="connection-error" role="alert">
      <div className="connection-error-content">
        <div className="connection-error-icon" aria-hidden="true">
          🔌
        </div>
        <h3 className="connection-error-title">Unable to connect to Weaviate</h3>
        <p className="connection-error-message">
          The connection to your Weaviate instance failed. Please check your connection
          settings and try again.
        </p>

        {errorMessage && (
          <details className="connection-error-details">
            <summary>Error details</summary>
            <p className="error-details-text">{errorMessage}</p>
          </details>
        )}

        <div className="connection-error-suggestions">
          <p className="suggestions-label">Common solutions:</p>
          <ul className="suggestions-list">
            <li>Check that Weaviate is running</li>
            <li>Verify your connection URL and credentials</li>
            <li>Check your network connection</li>
            <li>Ensure there are no firewall restrictions</li>
          </ul>
        </div>

        <div className="connection-error-actions">
          <button
            className="connection-error-button primary"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? '⟳ Retrying...' : '🔄 Retry Connection'}
          </button>
          {onOpenSettings && (
            <button
              className="connection-error-button secondary"
              onClick={onOpenSettings}
            >
              ⚙️ Connection Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
