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
              ✕
            </button>
          )}
        </div>
      )}
      <div className="collapse-panel-content">{children}</div>
    </div>
  );
}
