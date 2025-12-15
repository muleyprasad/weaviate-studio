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

interface RestoreData {
  backupId: string;
  backend: string;
  includeCollections?: string[];
  excludeCollections?: string[];
  cpuPercentage?: number;
  path?: string;
  rolesOptions?: string;
  usersOptions?: string;
  waitForCompletion?: boolean;
}

interface BackupDetails {
  id: string;
  backend: string;
  status: string;
  error?: string;
  path?: string;
  duration?: string;
  classes?: string[];
}

interface RestoreStatus {
  id: string;
  backend: string;
  status: string;
  error?: string;
  path?: string;
}

function BackupRestoreWebview() {
  const [backupId, setBackupId] = useState<string>('');
  const [backend, setBackend] = useState<string>('');
  const [collections, setCollections] = useState<string[]>([]);
  const [backupDetails, setBackupDetails] = useState<BackupDetails | null>(null);
  const [collectionMode, setCollectionMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);
  const [cpuPercentage, setCpuPercentage] = useState<string>('');
  const [path, setPath] = useState<string>('');
  const [rolesOptions, setRolesOptions] = useState<string>('noRestore');
  const [usersOptions, setUsersOptions] = useState<string>('noRestore');
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>(false);
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null);
  const [showForm, setShowForm] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5);

  // Validate and handle CPU percentage input (1-80)
  const handleCpuPercentageChange = (value: string): void => {
    // Allow empty string
    if (value === '') {
      setCpuPercentage('');
      return;
    }

    // Only allow numeric input
    const numValue = parseInt(value);
    if (isNaN(numValue)) {
      return;
    }

    // Constrain to valid range (1-80)
    if (numValue >= 1 && numValue <= 80) {
      setCpuPercentage(value);
    } else if (numValue > 80) {
      setCpuPercentage('80');
    } else if (numValue < 1 && value.length > 0) {
      setCpuPercentage('1');
    }
  };

  useEffect(() => {
    // Request initial data from extension
    if (vscode) {
      try {
        vscode.postMessage({ command: 'ready' });
      } catch (e) {
        console.error('[BackupRestore] Failed to post ready message', e);
      }
    }

    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'initData':
          setBackupId(message.backupId || '');
          setBackend(message.backend || '');
          setCollections(message.collections || []);
          setBackupDetails(message.backupDetails || null);
          break;
        case 'backupRestored':
          setIsRestoring(false);
          setError('');
          setShowForm(false);
          setAutoRefresh(true);
          // Fetch initial status - use values from current state that should be set by initData
          // Wait a tick to ensure state is updated
          setTimeout(() => {
            fetchRestoreStatus(backupId, backend);
          }, 0);
          break;
        case 'restoreStatus':
          setRestoreStatus(message.status);
          // If restore is completed or failed, stop auto-refresh
          if (
            message.status &&
            (message.status.status === 'SUCCESS' || message.status.status === 'FAILED')
          ) {
            setAutoRefresh(false);
          }
          break;
        case 'error':
          setIsRestoring(false);
          setError(message.message);
          break;
        case 'resetForm':
          // Reset form to initial state
          setCollectionMode('all');
          setSelectedCollections([]);
          setIsRestoring(false);
          setError('');
          setCpuPercentage('');
          setPath('');
          setRolesOptions('noRestore');
          setUsersOptions('noRestore');
          setWaitForCompletion(false);
          setShowAdvancedConfig(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Auto-refresh effect - refresh restore status when enabled
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchRestoreStatus();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, backupId, backend]);

  const fetchRestoreStatus = (bid?: string, bknd?: string) => {
    const useBackupId = bid || backupId;
    const useBackend = bknd || backend;

    if (vscode && useBackupId && useBackend) {
      console.log('[BackupRestore] Fetching restore status for:', useBackupId, useBackend);
      vscode.postMessage({
        command: 'fetchRestoreStatus',
        backupId: useBackupId,
        backend: useBackend,
      });
    } else {
      console.warn(
        '[BackupRestore] Cannot fetch restore status - missing backupId or backend:',
        useBackupId,
        useBackend
      );
    }
  };

  const handleCollectionToggle = (collection: string) => {
    setSelectedCollections((prev) =>
      prev.includes(collection) ? prev.filter((c) => c !== collection) : [...prev, collection]
    );
  };

  const handleRestoreBackup = () => {
    if (!backupId.trim()) {
      setError('Backup ID is required');
      return;
    }
    if (!backend) {
      setError('Backend is required');
      return;
    }

    setError('');
    setIsRestoring(true);

    const restoreData: RestoreData = {
      backupId: backupId.trim(),
      backend: backend,
      waitForCompletion: waitForCompletion,
    };

    if (collectionMode === 'include' && selectedCollections.length > 0) {
      restoreData.includeCollections = selectedCollections;
    } else if (collectionMode === 'exclude' && selectedCollections.length > 0) {
      restoreData.excludeCollections = selectedCollections;
    }

    // Add optional configuration parameters
    if (cpuPercentage) {
      restoreData.cpuPercentage = parseInt(cpuPercentage);
    }
    if (path && path.trim() && backend === 'filesystem') {
      restoreData.path = path.trim();
    }
    if (rolesOptions && rolesOptions !== 'noRestore') {
      restoreData.rolesOptions = rolesOptions;
    }
    if (usersOptions && usersOptions !== 'noRestore') {
      restoreData.usersOptions = usersOptions;
    }

    if (vscode) {
      vscode.postMessage({
        command: 'restoreBackup',
        restoreData,
      });

      // Immediately fetch status after initiating restore
      setTimeout(() => {
        fetchRestoreStatus(restoreData.backupId, restoreData.backend);
      }, 100);
    }
  };

  const handleCancel = () => {
    if (vscode) {
      vscode.postMessage({
        command: 'cancel',
      });
    }
  };

  const handleStartNewRestore = () => {
    setShowForm(true);
    setRestoreStatus(null);
    setAutoRefresh(false);
    setIsRestoring(false);
    setError('');
    setCollectionMode('all');
    setSelectedCollections([]);
    setCpuPercentage('');
    setPath('');
    setRolesOptions('noRestore');
    setUsersOptions('noRestore');
    setWaitForCompletion(false);
    setShowAdvancedConfig(false);
  };

  return (
    <div className="backup-restore-container">
      <div className="backup-restore-header">
        <h1>Restore Backup: {backupId}</h1>
        {!showForm && (
          <button className="theme-button" onClick={handleStartNewRestore}>
            Start New Restore
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {backupDetails && (
        <div className="backup-details-section">
          <h2>Backup Details</h2>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Backup ID:</span>
              <span className="detail-value">{backupDetails.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Backend:</span>
              <span className="detail-value">{backupDetails.backend}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className={`detail-value status-${backupDetails.status.toLowerCase()}`}>
                {backupDetails.status}
              </span>
            </div>
            {backupDetails.duration && (
              <div className="detail-item">
                <span className="detail-label">Duration:</span>
                <span className="detail-value">{backupDetails.duration}</span>
              </div>
            )}
            {backupDetails.path && (
              <div className="detail-item">
                <span className="detail-label">Path:</span>
                <span className="detail-value">{backupDetails.path}</span>
              </div>
            )}
            {backupDetails.classes && backupDetails.classes.length > 0 && (
              <div className="detail-item full-width">
                <span className="detail-label">Collections:</span>
                <span className="detail-value">{backupDetails.classes.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <div className="restore-status-section">
          <div className="status-header">
            <h2>Restore Status</h2>
            <div className="auto-refresh-controls">
              <label className="refresh-label">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span>Auto-refresh every</span>
              </label>
              <select
                className="refresh-interval"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                disabled={!autoRefresh}
              >
                <option value="2">2s</option>
                <option value="5">5s</option>
                <option value="10">10s</option>
                <option value="30">30s</option>
              </select>
              <button
                className="refresh-button"
                onClick={() => fetchRestoreStatus()}
                disabled={autoRefresh}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {restoreStatus ? (
            <>
              <div className="status-details">
                <div className="status-item">
                  <span className="status-label">Status:</span>
                  <span className={`status-value status-${restoreStatus.status.toLowerCase()}`}>
                    {restoreStatus.status}
                  </span>
                </div>
                {restoreStatus.error && (
                  <div className="status-item full-width">
                    <span className="status-label">Error:</span>
                    <span className="status-value error-text">{restoreStatus.error}</span>
                  </div>
                )}
                {restoreStatus.path && (
                  <div className="status-item">
                    <span className="status-label">Path:</span>
                    <span className="status-value">{restoreStatus.path}</span>
                  </div>
                )}
              </div>

              {restoreStatus.status === 'SUCCESS' && (
                <div className="success-message">✓ Backup restored successfully!</div>
              )}

              {restoreStatus.status === 'FAILED' && (
                <div className="error-message">
                  ✗ Backup restore failed. Check the error details above.
                </div>
              )}

              {restoreStatus.status === 'STARTED' && (
                <div className="info-message">⏳ Backup restore is in progress...</div>
              )}

              {restoreStatus.status === 'TRANSFERRING' && (
                <div className="info-message">📦 Transferring backup data...</div>
              )}
            </>
          ) : null}
        </div>
      )}

      {showForm && (
        <>
          <div className="form-section">
            <label htmlFor="collectionMode" className="form-label">
              Collections to Restore:
            </label>
            <select
              id="collectionMode"
              className="form-select"
              value={collectionMode}
              onChange={(e) => setCollectionMode(e.target.value as 'all' | 'include' | 'exclude')}
              disabled={isRestoring}
            >
              <option value="all">All Collections</option>
              <option value="include">Include Specific Collections</option>
              <option value="exclude">Exclude Specific Collections</option>
            </select>
          </div>

          {collectionMode !== 'all' && collections.length > 0 && (
            <div className="form-section">
              <label className="form-label">
                Select Collections to {collectionMode === 'include' ? 'Include' : 'Exclude'}:
              </label>
              <div className="collections-list">
                {collections.map((collection) => (
                  <label key={collection} className="collection-item">
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(collection)}
                      onChange={() => handleCollectionToggle(collection)}
                      disabled={isRestoring}
                    />
                    <span>{collection}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-section">
            <label className="form-label checkbox-label">
              <input
                type="checkbox"
                checked={waitForCompletion}
                onChange={(e) => setWaitForCompletion(e.target.checked)}
                disabled={isRestoring}
              />
              <span>Wait for completion (blocking operation)</span>
            </label>
          </div>

          <div className="form-section">
            <button
              className="toggle-button"
              onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              disabled={isRestoring}
            >
              {showAdvancedConfig ? '▼' : '►'} Advanced Configuration
            </button>
          </div>

          {showAdvancedConfig && (
            <div className="advanced-config">
              <div className="form-section">
                <label htmlFor="cpuPercentage" className="form-label">
                  CPU Percentage (1-80):
                </label>
                <input
                  id="cpuPercentage"
                  type="number"
                  className="form-input"
                  value={cpuPercentage}
                  onChange={(e) => handleCpuPercentageChange(e.target.value)}
                  placeholder="Default: 50%"
                  min="1"
                  max="80"
                  disabled={isRestoring}
                />
                <small className="form-hint">
                  Set the desired CPU core utilization. Default is 50%.
                </small>
              </div>

              {backend === 'filesystem' && (
                <div className="form-section">
                  <label htmlFor="path" className="form-label">
                    Custom Path (filesystem only):
                  </label>
                  <input
                    id="path"
                    type="text"
                    className="form-input"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/custom/backup/path"
                    disabled={isRestoring}
                  />
                  <small className="form-hint">
                    Manually set the backup location. If not provided, the default location will be
                    used.
                  </small>
                </div>
              )}

              <div className="form-section">
                <label htmlFor="rolesOptions" className="form-label">
                  RBAC Roles Options:
                </label>
                <select
                  id="rolesOptions"
                  className="form-select"
                  value={rolesOptions}
                  onChange={(e) => setRolesOptions(e.target.value)}
                  disabled={isRestoring}
                >
                  <option value="noRestore">No Restore</option>
                  <option value="all">Restore All</option>
                </select>
                <small className="form-hint">
                  Set if RBAC roles will be restored. Default is "noRestore".
                </small>
              </div>

              <div className="form-section">
                <label htmlFor="usersOptions" className="form-label">
                  RBAC Users Options:
                </label>
                <select
                  id="usersOptions"
                  className="form-select"
                  value={usersOptions}
                  onChange={(e) => setUsersOptions(e.target.value)}
                  disabled={isRestoring}
                >
                  <option value="noRestore">No Restore</option>
                  <option value="all">Restore All</option>
                </select>
                <small className="form-hint">
                  Set if RBAC users will be restored. Default is "noRestore".
                </small>
              </div>
            </div>
          )}

          <div className="button-group">
            <button
              className="theme-button primary-button"
              onClick={handleRestoreBackup}
              disabled={isRestoring}
            >
              {isRestoring ? 'Restoring...' : 'Restore Backup'}
            </button>
            <button
              className="theme-button cancel-button"
              onClick={handleCancel}
              disabled={isRestoring}
            >
              Cancel
            </button>
          </div>

          {isRestoring && (
            <div className="status-message">
              <div className="loading-indicator"></div>
              <p>Initiating backup restore... This may take a while.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<BackupRestoreWebview />);
}
