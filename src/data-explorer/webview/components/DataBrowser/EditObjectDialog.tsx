/**
 * EditObjectDialog - Modal dialog for editing a single object's properties
 * Shows properties as JSON; saving posts an updateObject message.
 * The dialog owns its extension-message listener, like Import/Export dialogs.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { WeaviateObject } from '../../../types';
import { postMessageToExtension } from '../../utils/vscodeApi';

export interface EditObjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  object: WeaviateObject | null;
  onSaved: () => void;
}

export function EditObjectDialog({
  isOpen,
  onClose,
  collectionName,
  object,
  onSaved,
}: EditObjectDialogProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // Reset state when a new object is opened
  useEffect(() => {
    if (isOpen && object) {
      setText(JSON.stringify(object.properties, null, 2));
      setSaving(false);
      setError(null);
      requestIdRef.current = null;
    }
  }, [isOpen, object]);

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
      if (message.command === 'objectUpdated') {
        setSaving(false);
        requestIdRef.current = null;
        onSaved();
        onClose();
      } else if (message.command === 'error' && message.requestId?.startsWith('edit-')) {
        setError(message.error);
        setSaving(false);
        requestIdRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onClose, onSaved]);

  const handleSave = useCallback(() => {
    if (!object || saving) {
      return;
    }
    let properties: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Properties must be a JSON object');
        return;
      }
      properties = parsed as Record<string, unknown>;
    } catch {
      setError('Invalid JSON: unable to parse properties');
      return;
    }

    setSaving(true);
    setError(null);
    const requestId = `edit-${Date.now()}`;
    requestIdRef.current = requestId;
    postMessageToExtension({
      command: 'updateObject',
      updateObjectParams: {
        collectionName,
        uuid: object.uuid,
        properties,
      },
      requestId,
    });
  }, [collectionName, object, saving, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    },
    [onClose, saving]
  );

  const handleBackdropClick = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [onClose, saving]);

  if (!isOpen || !object) {
    return null;
  }

  return (
    <div className="export-dialog-overlay" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div
        className="export-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-object-dialog-title"
      >
        <div className="dialog-header">
          <h2 id="edit-object-dialog-title">Edit Object</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
          >
            <span className="codicon codicon-close" aria-hidden="true"></span>
          </button>
        </div>

        <div className="dialog-body">
          <p className="import-hint">
            {collectionName} · <code>{object.uuid}</code>
          </p>
          <textarea
            className="import-paste-area edit-object-area"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={saving}
            rows={12}
            spellCheck={false}
            aria-label="Object properties as JSON"
          />
          {error && (
            <div className="export-error">
              <span className="codicon codicon-error" aria-hidden="true"></span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="dialog-btn secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dialog-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="loading-spinner small"></span>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditObjectDialog;
