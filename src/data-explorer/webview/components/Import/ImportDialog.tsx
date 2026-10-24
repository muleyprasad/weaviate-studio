/**
 * ImportDialog - Modal dialog for importing data into a collection
 * Supports three sources (file, URL, paste) and JSON/CSV formats.
 * Parsing and insertion happen in the extension host; this dialog
 * only collects the payload and reports the result.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ImportSource, ImportFormat, ImportResult } from '../../../types';
import { postMessageToExtension } from '../../utils/vscodeApi';

export interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  onImported: () => void;
}

/** Client-side payload cap mirrors the host limit (10 MB) */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ImportDialog({ isOpen, onClose, collectionName, onImported }: ImportDialogProps) {
  const [source, setSource] = useState<ImportSource>('file');
  const [format, setFormat] = useState<ImportFormat>('json');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = useCallback(() => {
    setFileName(null);
    setFileText(null);
    setUrl('');
    setPasteText('');
    setImporting(false);
    setError(null);
    setResult(null);
    requestIdRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }

      if (!isOpen || message.requestId !== requestIdRef.current) {
        return;
      }

      if (message.command === 'importComplete') {
        setImporting(false);
        requestIdRef.current = null;
        const importResult = message.importResult as ImportResult | undefined;
        if (importResult && importResult.importedCount > 0) {
          onImported();
        }
        if (importResult && (importResult.failedCount > 0 || importResult.errors.length > 0)) {
          // Partial failure: stay open and show the summary
          setResult(importResult);
        } else {
          resetForm();
          onClose();
        }
      } else if (message.command === 'error' && message.requestId?.startsWith('import-')) {
        setError(message.error);
        setImporting(false);
        requestIdRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onClose, onImported, resetForm]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    setFileName(null);
    setFileText(null);
    if (!file) {
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File exceeds the 10 MB import limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setFileText(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const currentPayload = source === 'file' ? fileText : source === 'url' ? url.trim() : pasteText;

  const canImport =
    !importing &&
    ((source === 'file' && !!fileText) ||
      (source === 'url' && url.trim().length > 0) ||
      (source === 'paste' && pasteText.trim().length > 0));

  const handleImport = useCallback(() => {
    if (!currentPayload || !canImport) {
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);

    const requestId = `import-${Date.now()}`;
    requestIdRef.current = requestId;

    postMessageToExtension({
      command: 'importObjects',
      importParams: {
        collectionName,
        source,
        format,
        payload: source === 'file' ? (fileText as string) : currentPayload,
      },
      requestId,
    });
  }, [canImport, collectionName, currentPayload, fileText, format, source]);

  const handleClose = useCallback(() => {
    if (!importing) {
      resetForm();
      onClose();
    }
  }, [importing, resetForm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) {
        handleClose();
      }
    },
    [handleClose, importing]
  );

  const handleBackdropClick = useCallback(() => {
    if (!importing) {
      handleClose();
    }
  }, [handleClose, importing]);

  const handleDone = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="export-dialog-overlay" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div
        className="export-dialog import-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <div className="dialog-header">
          <h2 id="import-dialog-title">Import Data into {collectionName}</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={handleClose}
            disabled={importing}
            aria-label="Close dialog"
          >
            <span className="codicon codicon-close" aria-hidden="true"></span>
          </button>
        </div>

        <div className="dialog-body">
          {/* Source tabs */}
          <div className="export-section">
            <h3 className="section-title">SOURCE</h3>
            <div className="import-source-tabs" role="tablist" aria-label="Import source">
              {(
                [
                  { value: 'file', label: 'File' },
                  { value: 'url', label: 'URL' },
                  { value: 'paste', label: 'Paste' },
                ] as { value: ImportSource; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={source === tab.value}
                  className={`import-source-tab ${source === tab.value ? 'selected' : ''}`}
                  onClick={() => setSource(tab.value)}
                  disabled={importing}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {source === 'file' && (
              <div className="import-source-pane">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleFileChange}
                  disabled={importing}
                  aria-label="Choose import file"
                />
                {fileName && (
                  <p className="import-file-name">
                    {fileName}
                    {fileText ? ` (${(fileText.length / 1024).toFixed(1)} KB)` : ''}
                  </p>
                )}
              </div>
            )}

            {source === 'url' && (
              <div className="import-source-pane">
                <input
                  type="url"
                  className="import-url-input"
                  placeholder="https://example.com/data.json"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={importing}
                  aria-label="Import URL"
                />
                <p className="import-hint">The file is fetched by the extension (30s timeout).</p>
              </div>
            )}

            {source === 'paste' && (
              <div className="import-source-pane">
                <textarea
                  className="import-paste-area"
                  placeholder='[{"title": "Hello"}, ...] or CSV with a header row'
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={importing}
                  rows={6}
                  aria-label="Pasted import payload"
                />
              </div>
            )}
          </div>

          {/* Format section */}
          <div className="export-section">
            <h3 className="section-title">FORMAT</h3>
            <div className="format-options">
              <label className={`format-option ${format === 'json' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="import-format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  disabled={importing}
                />
                <span className="format-label">JSON (array or single object)</span>
              </label>
              <label className={`format-option ${format === 'csv' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="import-format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  disabled={importing}
                />
                <span className="format-label">CSV (header row required)</span>
              </label>
            </div>
            <p className="import-hint">
              Use <code>id</code> and <code>vector</code> keys in JSON to set IDs and bring your own
              vectors. Non-vectorized rows are vectorized at import time by the collection&apos;s
              vectorizer.
            </p>
          </div>

          {error && (
            <div className="export-error">
              <span className="codicon codicon-error" aria-hidden="true"></span>
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="import-result">
              <p>
                Imported {result.importedCount} object{result.importedCount === 1 ? '' : 's'}
                {result.failedCount > 0 && `, ${result.failedCount} failed`}.
              </p>
              {result.errors.length > 0 && (
                <ul>
                  {result.errors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="dialog-btn secondary"
            onClick={handleClose}
            disabled={importing}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {result ? (
            <button type="button" className="dialog-btn primary" onClick={handleDone}>
              Done
            </button>
          ) : (
            <button
              type="button"
              className="dialog-btn primary"
              onClick={handleImport}
              disabled={!canImport}
            >
              {importing ? (
                <>
                  <span className="loading-spinner small"></span>
                  Importing...
                </>
              ) : (
                <>
                  <span className="codicon codicon-cloud-upload" aria-hidden="true"></span>
                  Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;
