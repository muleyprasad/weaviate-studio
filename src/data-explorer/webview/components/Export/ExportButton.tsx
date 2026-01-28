/**
 * ExportButton - Toolbar button for opening the export dialog
 */

import React from 'react';

export interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ExportButton({ onClick, disabled = false }: ExportButtonProps) {
  return (
    <button
      type="button"
      className="export-toolbar-btn"
      onClick={onClick}
      disabled={disabled}
      title="Export data"
      aria-label="Export data"
    >
      <span className="codicon codicon-cloud-download" aria-hidden="true"></span>
      Export
    </button>
  );
}

export default ExportButton;
