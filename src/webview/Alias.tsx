import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './Alias.css';

/**
 * Validate alias name
 */
function validateAliasName(aliasName: string): { valid: boolean; error?: string | null } {
  if (!aliasName || typeof aliasName !== 'string' || aliasName.trim() === '') {
    return {
      valid: false,
      error: 'Alias name cannot be empty',
    };
  }

  const trimmedName = aliasName.trim();
  const ALIAS_NAME_REGEX = /^[a-zA-Z_][_0-9A-Za-z]*$/;

  if (!ALIAS_NAME_REGEX.test(trimmedName)) {
    return {
      valid: false,
      error:
        'Alias name must start with a letter or underscore, followed by letters, numbers, or underscores',
    };
  }

  if (trimmedName.length > 256) {
    return {
      valid: false,
      error: 'Alias name cannot exceed 256 characters',
    };
  }

  return {
    valid: true,
    error: null,
  };
}

let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
}

interface AliasListItem {
  alias: string;
  collection: string;
}

type Mode = 'create' | 'edit';

function AliasWebview() {
  const [mode, setMode] = useState<Mode>('create');
  const [collections, setCollections] = useState<string[]>([]);

  // Create mode
  const [aliasName, setAliasName] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');

  // Edit mode
  const [editingAlias, setEditingAlias] = useState<AliasListItem | null>(null);
  const [newTargetCollection, setNewTargetCollection] = useState<string>('');

  // UI states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [aliasNameError, setAliasNameError] = useState<string>('');

  // Listen for messages from the extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'initData':
          const sortedCollections = (message.collections || []).sort((a: string, b: string) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
          );
          setCollections(sortedCollections);
          if (sortedCollections && sortedCollections.length > 0) {
            setSelectedCollection(sortedCollections[0]);
            setNewTargetCollection(sortedCollections[0]);
          }

          // Set initial mode based on message
          if (message.mode === 'create') {
            setMode('create');
            setAliasName('');
            setEditingAlias(null);
          } else if (message.mode === 'edit' && message.aliasToEdit) {
            setMode('edit');
            setEditingAlias(message.aliasToEdit);
            setNewTargetCollection(message.aliasToEdit.collection);
          }
          break;

        case 'setMode':
          if (message.mode === 'create') {
            setMode('create');
            setAliasName('');
            setEditingAlias(null);
            setError('');
            setSuccess('');
            setAliasNameError('');
          } else if (message.mode === 'edit' && message.aliasToEdit) {
            setMode('edit');
            setEditingAlias(message.aliasToEdit);
            setNewTargetCollection(message.aliasToEdit.collection);
            setError('');
            setSuccess('');
          }
          break;

        case 'aliasCreated':
          setIsSubmitting(false);
          setSuccess(`Alias "${message.alias}" created successfully!`);
          setError('');
          // Reset form
          setAliasName('');
          setAliasNameError('');
          break;

        case 'aliasUpdated':
          setIsSubmitting(false);
          setSuccess(`Alias "${message.alias}" updated successfully!`);
          setError('');
          break;

        case 'error':
          setIsSubmitting(false);
          setError(message.message);
          setSuccess('');
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    vscode.postMessage({ command: 'ready' });

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  const handleAliasNameChange = (value: string) => {
    setAliasName(value);
    if (value.trim()) {
      const validation = validateAliasName(value.trim());
      setAliasNameError(validation.valid ? '' : validation.error || 'Invalid alias name');
    } else {
      setAliasNameError('');
    }
  };

  const handleCreateAlias = () => {
    if (!aliasName.trim()) {
      setError('Please enter an alias name');
      return;
    }

    const validation = validateAliasName(aliasName.trim());
    if (!validation.valid) {
      setError(validation.error || 'Invalid alias name');
      return;
    }

    if (!selectedCollection) {
      setError('Please select a collection');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    vscode.postMessage({
      command: 'createAlias',
      aliasData: {
        alias: aliasName.trim(),
        collection: selectedCollection,
      },
    });
  };

  const handleUpdateAlias = () => {
    if (!editingAlias) {
      setError('No alias selected for editing');
      return;
    }

    if (!newTargetCollection) {
      setError('Please select a new target collection');
      return;
    }

    if (newTargetCollection === editingAlias.collection) {
      setError('Please select a different target collection');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    vscode.postMessage({
      command: 'updateAlias',
      aliasData: {
        alias: editingAlias.alias,
        collection: '',
        newTargetCollection: newTargetCollection,
      },
    });
  };

  return (
    <div className="alias-container">
      <h1>{mode === 'create' ? 'Create Alias' : 'Edit Alias'}</h1>

      {error && (
        <div className="message error-message">
          <span className="codicon codicon-error"></span>
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          <span className="codicon codicon-check"></span>
          {success}
        </div>
      )}

      {mode === 'create' && (
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="aliasName">Alias Name</label>
            <input
              type="text"
              id="aliasName"
              value={aliasName}
              onChange={(e) => handleAliasNameChange(e.target.value)}
              placeholder="e.g., ArticlesAlias"
              disabled={isSubmitting}
              className={aliasNameError ? 'input-error' : ''}
              autoFocus
            />
            {aliasNameError && (
              <div className="field-error">
                <span className="codicon codicon-error"></span>
                {aliasNameError}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="collection">Target Collection</label>
            <select
              id="collection"
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              disabled={isSubmitting}
            >
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </div>

          <div className="button-group">
            <button
              className="primary-button"
              onClick={handleCreateAlias}
              disabled={
                isSubmitting || !aliasName.trim() || !selectedCollection || !!aliasNameError
              }
            >
              {isSubmitting ? (
                <>
                  <span className="codicon codicon-loading codicon-modifier-spin"></span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="codicon codicon-add"></span>
                  Create Alias
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {mode === 'edit' && editingAlias && (
        <div className="form-section">
          <div className="alias-info-card">
            <h3>Alias: {editingAlias.alias}</h3>
            <p className="current-target">
              Current target: <strong>{editingAlias.collection}</strong>
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="newTargetCollection">New Target Collection</label>
            <select
              id="newTargetCollection"
              value={newTargetCollection}
              onChange={(e) => setNewTargetCollection(e.target.value)}
              disabled={isSubmitting}
            >
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </div>

          <div className="button-group">
            <button
              className="primary-button"
              onClick={handleUpdateAlias}
              disabled={
                isSubmitting ||
                !newTargetCollection ||
                newTargetCollection === editingAlias.collection
              }
            >
              {isSubmitting ? (
                <>
                  <span className="codicon codicon-loading codicon-modifier-spin"></span>
                  Updating...
                </>
              ) : (
                <>
                  <span className="codicon codicon-sync"></span>
                  Update Alias
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mount React component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AliasWebview />);
}
