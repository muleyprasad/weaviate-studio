/**
 * ExportDialog - Modal dialog for configuring and triggering data export
 * Allows users to select format, scope, and include options
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { ExportFormat, ExportScope, ExportOptions, WeaviateObject } from '../../../types';
import { postMessageToExtension } from '../../utils/vscodeApi';

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  currentPageCount: number;
  filteredCount: number;
  totalCount: number;
  currentObjects?: WeaviateObject[];
  hasFilters: boolean;
}

export function ExportDialog({
  isOpen,
  onClose,
  collectionName,
  currentPageCount,
  filteredCount,
  totalCount,
  currentObjects,
  hasFilters,
}: ExportDialogProps) {
  // Export configuration state
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>('currentPage');
  const [includeProperties, setIncludeProperties] = useState(true);
  const [includeVectors, setIncludeVectors] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [flattenNested, setFlattenNested] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setExporting(false);
      setError(null);
    }
  }, [isOpen]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === 'exportComplete') {
        setExporting(false);
        // Extension has saved the file, just close the dialog
        onClose();
      } else if (message.command === 'exportCancelled') {
        setExporting(false);
        setError('Export cancelled by user');
      } else if (message.command === 'error' && message.requestId?.startsWith('export-')) {
        setError(message.error);
        setExporting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  // Handle export
  const handleExport = useCallback(() => {
    setExporting(true);
    setError(null);

    const requestId = `export-${Date.now()}`;
    setCurrentRequestId(requestId);

    const options: ExportOptions = {
      scope,
      format,
      includeProperties,
      includeVectors,
      includeMetadata,
      flattenNested,
    };

    postMessageToExtension({
      command: 'exportObjects',
      exportParams: {
        collectionName,
        scope,
        format,
        options,
        currentObjects: scope === 'currentPage' ? currentObjects : undefined,
      },
      requestId,
    });
  }, [
    scope,
    format,
    includeProperties,
    includeVectors,
    includeMetadata,
    flattenNested,
    collectionName,
    currentObjects,
  ]);

  // Handle cancel export
  const handleCancelExport = useCallback(() => {
    if (exporting && currentRequestId) {
      postMessageToExtension({
        command: 'cancelExport',
        requestId: currentRequestId,
      });
    }
  }, [exporting, currentRequestId]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) {
        onClose();
      }
    },
    [onClose, exporting]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (!exporting) {
      onClose();
    }
  }, [onClose, exporting]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Calculate scope counts based on filter state
  const scopeOptions = [
    {
      value: 'currentPage' as ExportScope,
      label: 'Current Page',
      count: currentPageCount,
    },
    {
      value: 'filtered' as ExportScope,
      label: 'All Filtered Results',
      count: filteredCount,
      disabled: !hasFilters,
    },
    {
      value: 'all' as ExportScope,
      label: 'Entire Collection',
      count: totalCount,
    },
  ];

  const showLargeExportWarning =
    (scope === 'all' && totalCount > 10000) || (scope === 'filtered' && filteredCount > 10000);
  const showCsvVectorWarning = format === 'csv' && includeVectors;

  return (
    <div className="export-dialog-overlay" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div
        className="export-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
      >
        {/* Header */}
        <div className="dialog-header">
          <h2 id="export-dialog-title">Export Data</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span className="codicon codicon-close" aria-hidden="true"></span>
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          {/* Format Section */}
          <div className="export-section">
            <h3 className="section-title">EXPORT FORMAT</h3>
            <div className="format-options">
              <label className={`format-option ${format === 'json' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                />
                <span className="format-label">JSON (with metadata)</span>
              </label>
              <label className={`format-option ${format === 'csv' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                />
                <span className="format-label">CSV (flattened)</span>
              </label>
            </div>
          </div>

          {/* Include Section */}
          <div className="export-section">
            <h3 className="section-title">INCLUDE</h3>
            <div className="include-options">
              <label className="include-option">
                <input
                  type="checkbox"
                  checked={includeProperties}
                  onChange={(e) => setIncludeProperties(e.target.checked)}
                />
                <span>Properties</span>
              </label>
              <label className="include-option">
                <input
                  type="checkbox"
                  checked={includeVectors}
                  onChange={(e) => setIncludeVectors(e.target.checked)}
                />
                <span>Vectors</span>
              </label>
              <label className="include-option">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                />
                <span>Metadata (_id, timestamps)</span>
              </label>
              <label className="include-option">
                <input
                  type="checkbox"
                  checked={flattenNested}
                  onChange={(e) => setFlattenNested(e.target.checked)}
                />
                <span>Flatten nested objects</span>
              </label>
            </div>
          </div>

          {/* Scope Section */}
          <div className="export-section">
            <h3 className="section-title">SCOPE</h3>
            <div className="scope-options">
              {scopeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`scope-option ${scope === option.value ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    disabled={option.disabled}
                  />
                  <span className="scope-label">{option.label}</span>
                  <span className="scope-count">{option.count.toLocaleString()} objects</span>
                </label>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {showLargeExportWarning && (
            <div className="export-warning">
              <span className="codicon codicon-warning" aria-hidden="true"></span>
              <span>Exporting large datasets ({'>'}10k objects) may take several minutes.</span>
            </div>
          )}

          {showCsvVectorWarning && (
            <div className="export-warning">
              <span className="codicon codicon-warning" aria-hidden="true"></span>
              <span>
                Vectors are large and will only be indicated as present in CSV format. Consider
                using JSON for full vector data.
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="export-error">
              <span className="codicon codicon-error" aria-hidden="true"></span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button
            type="button"
            className="dialog-btn secondary"
            onClick={exporting ? handleCancelExport : onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dialog-btn primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <span className="loading-spinner small"></span>
                Exporting...
              </>
            ) : (
              <>
                <span className="codicon codicon-cloud-download" aria-hidden="true"></span>
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
