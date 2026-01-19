/**
 * CollapsePanel - A collapsible panel wrapper with smooth animation
 * Used for Filter, Vector Search, Insights panels
 */

import React from 'react';

interface CollapsePanelProps {
  isOpen: boolean;
  title?: string;
  icon?: string;
  onClose?: () => void;
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function CollapsePanel({
  isOpen,
  title,
  icon,
  onClose,
  children,
  maxHeight = '300px',
  className = '',
}: CollapsePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`collapse-panel ${className}`}
      style={{ maxHeight }}
      role="region"
      aria-label={title || 'Collapsible panel'}
    >
      {(title || onClose) && (
        <div className="collapse-panel-header">
          <div className="collapse-panel-title">
            {icon && (
              <span className="collapse-panel-icon" aria-hidden="true">
                {icon}
              </span>
            )}
            {title && <h3>{title}</h3>}
          </div>
          {onClose && (
            <button
              className="collapse-panel-close"
              onClick={onClose}
              aria-label={`Close ${title || 'panel'}`}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 7.293l3.646-3.647.708.708L8.707 8l3.647 3.646-.708.708L8 8.707l-3.646 3.647-.708-.708L7.293 8 3.646 4.354l.708-.708L8 7.293z" />
              </svg>
            </button>
          )}
        </div>
      )}
      <div className="collapse-panel-content">{children}</div>
    </div>
  );
}
