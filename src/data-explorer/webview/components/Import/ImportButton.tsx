/**
 * ImportButton - Toolbar button for opening the import dialog
 */

import React from 'react';

export interface ImportButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ImportButton({ onClick, disabled = false }: ImportButtonProps) {
  return (
    <button
      type="button"
      className="export-toolbar-btn"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Import is disabled on read-only connections' : 'Import data'}
      aria-label="Import data"
    >
      <span className="codicon codicon-cloud-upload" aria-hidden="true"></span>
      Import
    </button>
  );
}

export default ImportButton;
