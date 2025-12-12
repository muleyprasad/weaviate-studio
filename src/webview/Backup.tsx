import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Setup VS Code API for message passing with the extension host
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

// Get VS Code API reference for messaging
let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
}

interface BackupData {
  backupId: string;
  backend: string;
  includeCollections?: string[];
  excludeCollections?: string[];
}

interface BackupStatus {
  id: string;
  backend: string;
  status: string;
  error?: string;
}

function NewBackupWebview() {
  const [collections, setCollections] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<any>(null);
  const [backupId, setBackupId] = useState<string>('');
  const [selectedBackend, setSelectedBackend] = useState<string>('');
  const [collectionMode, setCollectionMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [backups, setBackups] = useState<BackupStatus[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5);
  const [showForm, setShowForm] = useState<boolean>(true);
  const [currentBackupId, setCurrentBackupId] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);

  // Sanitize backup ID to only allow lowercase, 0-9, _, -
  const sanitizeBackupId = (value: string): string => {
    return value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  };

  // Generate default backup ID in format weaviate-YYYYMMDD-HH:MM:SS
  const generateBackupId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `weaviate-${year}${month}${day}-${hours}_${minutes}_${seconds}`;
  };

  useEffect(() => {
    // Request initial data from extension
    if (vscode) {
      try {
        vscode.postMessage({ command: 'ready' });
      } catch (e) {
        console.error('[Backup] Failed to post ready message', e);
      }
    }

    // Set default backup ID
    setBackupId(generateBackupId());

    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'initData':
          setCollections(message.collections || []);
          setAvailableModules(message.availableModules || {});
          // Clear backup list when initializing
          setBackups([]);
          setCurrentBackupId('');
          // Set default backend if available
          const backupModules =
            message.availableModules?.['backup-filesystem'] ||
            message.availableModules?.['backup-s3'] ||
            message.availableModules?.['backup-gcs'] ||
            message.availableModules?.['backup-azure'];
          if (backupModules) {
            // Extract backend name from module name (e.g., 'backup-filesystem' -> 'filesystem')
            const moduleName = Object.keys(message.availableModules).find((key) =>
              key.startsWith('backup-')
            );
            if (moduleName) {
              setSelectedBackend(moduleName.replace('backup-', ''));
            }
          }
          break;
        case 'backupCreated':
          setIsCreating(false);
          setCurrentBackupId(message.backupId);
          setShowForm(false);
          // Refresh backup list
          fetchBackups();
          break;
        case 'backupsList':
          setBackups(message.backups || []);
          setIsLoadingBackups(false);
          break;
        case 'error':
          setIsCreating(false);
          setIsLoadingBackups(false);
          setError(message.message);
          break;
        case 'resetForm':
          // Reset form to initial state
          setBackupId(generateBackupId());
          setCollectionMode('all');
          setSelectedCollections([]);
          setIsCreating(false);
          setCurrentBackupId('');
          setShowForm(true);
          setError('');
          // Clear backup list
          setBackups([]);
          // Reset backend to default if available
          const resetBackupModules =
            availableModules?.['backup-filesystem'] ||
            availableModules?.['backup-s3'] ||
            availableModules?.['backup-gcs'] ||
            availableModules?.['backup-azure'];
          if (resetBackupModules) {
            const moduleName = Object.keys(availableModules).find((key) =>
              key.startsWith('backup-')
            );
            if (moduleName) {
              setSelectedBackend(moduleName.replace('backup-', ''));
            }
          }
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Auto-refresh effect - refresh when a backup has been created or showAll is enabled
  useEffect(() => {
    if (!autoRefresh || (showForm && !showAll)) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchBackups();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, showForm, showAll]);

  // Fetch backups when showAll is enabled
  useEffect(() => {
    if (showAll && backups.length === 0) {
      fetchBackups();
    }
  }, [showAll]);

  const handleCollectionToggle = (collection: string) => {
    setSelectedCollections((prev) =>
      prev.includes(collection) ? prev.filter((c) => c !== collection) : [...prev, collection]
    );
  };

  const handleCreateBackup = () => {
    if (!backupId.trim()) {
      setError('Backup ID is required');
      return;
    }
    if (!selectedBackend) {
      setError('Backend is required');
      return;
    }

    setError('');
    setIsCreating(true);

    const backupData: BackupData = {
      backupId: backupId.trim(),
      backend: selectedBackend,
    };

    if (collectionMode === 'include' && selectedCollections.length > 0) {
      backupData.includeCollections = selectedCollections;
    } else if (collectionMode === 'exclude' && selectedCollections.length > 0) {
      backupData.excludeCollections = selectedCollections;
    }

    if (vscode) {
      vscode.postMessage({
        command: 'createBackup',
        backupData,
      });
    }
  };

  const fetchBackups = () => {
    setIsLoadingBackups(true);
    if (vscode) {
      vscode.postMessage({
        command: 'fetchBackups',
      });
    }
  };

  const handleCancel = () => {
    if (vscode) {
      vscode.postMessage({
        command: 'cancel',
      });
    }
  };

  const getBackendOptions = () => {
    if (!availableModules) return [];
    return Object.keys(availableModules)
      .filter((key) => key.startsWith('backup-'))
      .map((key) => key.replace('backup-', ''));
  };

  const backendOptions = getBackendOptions();

  // Filter backups based on showAll, showForm, and currentBackupId
  // Priority: showAll > showForm > currentBackupId
  const displayedBackups = showAll
    ? backups
    : showForm
      ? []
      : currentBackupId
        ? backups.filter((backup) => backup.id === currentBackupId)
        : backups;

  return (
    <div className="backup-container">
      {showForm && (
        <>
          <div className="backup-header">
            <h1>Create Backup</h1>
          </div>

          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="form-section">
            <label htmlFor="backupId" className="form-label">
              Backup ID:
            </label>
            <input
              id="backupId"
              type="text"
              className="form-input"
              value={backupId}
              onChange={(e) => setBackupId(sanitizeBackupId(e.target.value))}
              placeholder="weaviate-yyyymmdd-hh_mm_ss"
              disabled={isCreating}
            />
          </div>

          <div className="form-section">
            <label htmlFor="backend" className="form-label">
              Backend:
            </label>
            <select
              id="backend"
              className="form-input"
              value={selectedBackend}
              onChange={(e) => setSelectedBackend(e.target.value)}
              disabled={isCreating || backendOptions.length === 0}
            >
              <option value="">Select backend...</option>
              {backendOptions.map((backend) => (
                <option key={backend} value={backend}>
                  {backend}
                </option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <h3 className="collections-section-title">Collections (optional):</h3>
            <p className="muted-text collections-hint">
              Include and exclude options are mutually exclusive. Select one or leave as "All
              Collections".
            </p>

            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="collectionMode"
                  value="all"
                  className="radio-input"
                  checked={collectionMode === 'all'}
                  onChange={() => {
                    setCollectionMode('all');
                    setSelectedCollections([]);
                  }}
                  disabled={isCreating}
                />
                <span>All Collections</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="collectionMode"
                  value="include"
                  className="radio-input"
                  checked={collectionMode === 'include'}
                  onChange={() => {
                    setCollectionMode('include');
                    setSelectedCollections([]);
                  }}
                  disabled={isCreating}
                />
                <span>Include specific collections</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="collectionMode"
                  value="exclude"
                  className="radio-input"
                  checked={collectionMode === 'exclude'}
                  onChange={() => {
                    setCollectionMode('exclude');
                    setSelectedCollections([]);
                  }}
                  disabled={isCreating}
                />
                <span>Exclude specific collections</span>
              </label>
            </div>

            {collectionMode !== 'all' && (
              <div className="collections-list">
                {collections.length === 0 ? (
                  <p className="muted-text collections-empty">No collections available</p>
                ) : (
                  collections.map((collection) => (
                    <label key={collection} className="collection-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(collection)}
                        onChange={() => handleCollectionToggle(collection)}
                        disabled={isCreating}
                      />
                      <span className="collection-name">{collection}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="button-group">
            <button
              className="theme-button"
              onClick={handleCreateBackup}
              disabled={isCreating || !backupId.trim() || !selectedBackend}
            >
              {isCreating ? 'Creating...' : 'Create Backup'}
            </button>
            <button className="theme-button-secondary" onClick={handleCancel} disabled={isCreating}>
              Cancel
            </button>
          </div>
        </>
      )}

      {!showForm && <hr className="section-divider" />}

      <div className={`backups-status-section ${!showForm ? 'expanded' : ''}`}>
        <div className="status-header">
          <h2 className="status-title">{showForm ? 'Backups Status' : 'Backup Status'}</h2>
          <div className="status-controls">
            <label className="auto-refresh-label">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                disabled={isLoadingBackups}
              />
              <span>Show all</span>
            </label>
            <label className="auto-refresh-label">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                disabled={isLoadingBackups}
              />
              <span>Auto-refresh</span>
            </label>
            {autoRefresh && (
              <select
                className="refresh-interval-select"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                disabled={isLoadingBackups}
              >
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            )}
            <button
              className="theme-button-secondary-compact"
              onClick={fetchBackups}
              disabled={isLoadingBackups}
            >
              {isLoadingBackups ? 'Loading...' : 'Reload'}
            </button>
          </div>
        </div>

        {displayedBackups.length === 0 ? (
          <p className="muted-text backups-empty">
            {isLoadingBackups
              ? 'Loading backups...'
              : 'No backups found. Click Reload to fetch backups.'}
          </p>
        ) : (
          <table className="theme-table">
            <thead>
              <tr className="theme-table-header">
                <th className="theme-table-cell">Backup ID</th>
                <th className="theme-table-cell">Backend</th>
                <th className="theme-table-cell">Status</th>
                <th className="theme-table-cell">Error</th>
              </tr>
            </thead>
            <tbody>
              {displayedBackups.map((backup) => (
                <tr key={`${backup.id}-${backup.backend}`} className="theme-table-row">
                  <td className="theme-table-cell">{backup.id}</td>
                  <td className="theme-table-cell">{backup.backend}</td>
                  <td className="theme-table-cell">
                    <span className={`status-badge status-${backup.status.toLowerCase()}`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="theme-table-cell">{backup.error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Mount the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<NewBackupWebview />);
}
