/**
 * Toolbar - Unified toolbar with all Data Explorer actions
 * Provides toggle buttons for all panels and quick actions
 */

import React from 'react';

interface ToolbarButton {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}

interface ToolbarProps {
  buttons: ToolbarButton[];
  className?: string;
}

export function Toolbar({ buttons, className = '' }: ToolbarProps) {
  return (
    <nav
      className={`explorer-toolbar ${className}`}
      role="toolbar"
      aria-label="Data Explorer tools"
    >
      <div className="toolbar-buttons">
        {buttons.map((button) => (
          <button
            key={button.id}
            className={`toolbar-button ${button.isActive ? 'active' : ''}`}
            onClick={button.onClick}
            title={button.shortcut ? `${button.label} (${button.shortcut})` : button.label}
            aria-label={button.ariaLabel || button.label}
            aria-pressed={button.isActive}
            type="button"
          >
            <span className="toolbar-button-icon" aria-hidden="true">
              {button.icon}
            </span>
            <span className="toolbar-button-label">{button.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * ToolbarDivider - Visual separator between button groups
 */
export function ToolbarDivider() {
  return <div className="toolbar-divider" role="separator" aria-hidden="true" />;
}
