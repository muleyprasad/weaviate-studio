/**
 * ExportDialog - Dialog for exporting data in various formats
 */

import React, { useState } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import type { ExportFormat, ExportScope, ExportOptions } from '../../../types';

export function ExportDialog() {
  const { state, dispatch } = useDataExplorer();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>('page');
  const [includeProperties, setIncludeProperties] = useState(true);
  const [includeVectors, setIncludeVectors] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(false);

  if (!state.showExportDialog) {
    return null;
  }

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_EXPORT_DIALOG', payload: false });
  };

  const handleExport = () => {
    const options: ExportOptions = {
      format,
      scope,
      includeProperties,
      includeVectors,
      includeMetadata,
      includeReferences,
    };

    dispatch({ type: 'START_EXPORT', payload: options });
  };

  // Calculate object counts for each scope
  const currentPageCount = state.objects.length;
  const filteredCount =
    state.activeFilters.length > 0 || state.activeFilterGroup
      ? state.totalCount
      : 0;
  const totalCount = state.totalCount;

  return (
    <div className="export-dialog-overlay" onClick={handleClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <h3>Export Data</h3>
          <button
            className="export-dialog-close"
            onClick={handleClose}
            aria-label="Close export dialog"
          >
            ✕
          </button>
        </div>

        <div className="export-dialog-content">
          {/* Export Format */}
          <div className="export-section">
            <h4 className="export-section-title">Export Format</h4>
            <div className="export-options">
              <label className="export-radio-option">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                />
                <div className="option-content">
                  <span className="option-label">JSON (with metadata)</span>
                  <span className="option-description">
                    Complete data export including all metadata and structure
                  </span>
                </div>
              </label>

              <label className="export-radio-option">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                />
                <div className="option-content">
                  <span className="option-label">CSV (flattened)</span>
                  <span className="option-description">
                    Spreadsheet format with flattened nested objects
                  </span>
                </div>
              </label>

              <label className="export-radio-option">
                <input
                  type="radio"
                  name="format"
                  value="xlsx"
                  checked={format === 'xlsx'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                />
                <div className="option-content">
                  <span className="option-label">Excel (.xlsx)</span>
                  <span className="option-description">
                    Excel workbook with formatted sheets
                  </span>
                </div>
              </label>

              <label className="export-radio-option">
                <input
                  type="radio"
                  name="format"
                  value="parquet"
                  checked={format === 'parquet'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                />
                <div className="option-content">
                  <span className="option-label">Parquet (for data analysis)</span>
                  <span className="option-description">
                    Efficient binary format for data science workflows
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Include Options */}
          <div className="export-section">
            <h4 className="export-section-title">Include</h4>
            <div className="export-checkboxes">
              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={includeProperties}
                  onChange={(e) => setIncludeProperties(e.target.checked)}
                />
                <span>Properties</span>
              </label>

              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={includeVectors}
                  onChange={(e) => setIncludeVectors(e.target.checked)}
                />
                <span>Vectors</span>
              </label>

              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                />
                <span>Metadata (_id, timestamps)</span>
              </label>

              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={includeReferences}
                  onChange={(e) => setIncludeReferences(e.target.checked)}
                />
                <span>References (as UUIDs)</span>
              </label>
            </div>
          </div>

          {/* Export Scope */}
          <div className="export-section">
            <h4 className="export-section-title">Scope</h4>
            <div className="export-options">
              <label className="export-radio-option">
                <input
                  type="radio"
                  name="scope"
                  value="page"
                  checked={scope === 'page'}
                  onChange={(e) => setScope(e.target.value as ExportScope)}
                />
                <div className="option-content">
                  <span className="option-label">
                    Current Page ({currentPageCount} objects)
                  </span>
                  <span className="option-description">
                    Export only the objects visible on the current page
                  </span>
                </div>
              </label>

              <label className="export-radio-option">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === 'filtered'}
                  onChange={(e) => setScope(e.target.value as ExportScope)}
                  disabled={filteredCount === 0}
                />
                <div className="option-content">
                  <span className="option-label">
                    All Filtered Results (
                    {filteredCount > 0 ? `${filteredCount} objects` : 'no filters active'}
                    )
                  </span>
                  <span className="option-description">
                    Export all objects matching current filters
                  </span>
                </div>
              </label>

              <label className="export-radio-option">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={(e) => setScope(e.target.value as ExportScope)}
                />
                <div className="option-content">
                  <span className="option-label">
                    Entire Collection ({totalCount.toLocaleString()} objects)
                  </span>
                  <span className="option-description">
                    Export all objects in the collection (may take time for large
                    collections)
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="export-dialog-actions">
          <button className="export-button secondary" onClick={handleClose}>
            Cancel
          </button>
          <button className="export-button primary" onClick={handleExport}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
