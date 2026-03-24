import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BACKUP_CONFIG } from '../constants/backupConfig';
import './theme.css';
import './Backup.css';

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
  cpuPercentage?: number;
  compressionLevel?: string;
  path?: string;
}

interface BackupStatus {
  id: string;
  backend: string;
  status: string;
  error?: string;
  path?: string;
  duration?: string;
  size?: number;
}

function formatSize(gibs?: number): string {
  if (gibs === null || gibs === undefined) {
    return '-';
  }
  if (gibs === 0) {
    return '0 B';
  }
  const bytes = gibs * 1024 * 1024 * 1024; // API returns size in GiB
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

function NewBackupWebview() {
  const [collections, setCollections] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<any>(null);
  const [backupId, setBackupId] = useState<string>('');
  const [selectedBackend, setSelectedBackend] = useState<string>('');
  const [collectionMode, setCollectionMode] = useState<'all' | 'include' | 'exclude' | 'wildcard'>(
    'all'
  );
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [wildcardPattern, setWildcardPattern] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [backups, setBackups] = useState<BackupStatus[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(
    BACKUP_CONFIG.REFRESH_INTERVAL.DEFAULT
  );
  const [showForm, setShowForm] = useState<boolean>(true);
  const [currentBackupId, setCurrentBackupId] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);
  const [cpuPercentage, setCpuPercentage] = useState<string>('');
  const [compressionLevel, setCompressionLevel] = useState<string>(
    BACKUP_CONFIG.COMPRESSION_LEVELS[0]
  );
  const [path, setPath] = useState<string>('');

  // Match a collection name against a wildcard pattern (* = any chars, ? = single char)
  const matchWildcard = (pattern: string, str: string): boolean => {
    if (!pattern) {
      return false;
    }
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(str);
  };

  const wildcardMatches =
    collectionMode === 'wildcard'
      ? collections.filter((c) => matchWildcard(wildcardPattern, c))
      : [];

  // Sanitize backup ID to only allow lowercase, 0-9, _, -
  const sanitizeBackupId = (value: string): string => {
    return value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  };

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

    // Constrain to valid range
    const { MIN, MAX } = BACKUP_CONFIG.CPU_PERCENTAGE;
    if (numValue >= MIN && numValue <= MAX) {
      setCpuPercentage(value);
    } else if (numValue > MAX) {
      setCpuPercentage(MAX.toString());
    } else if (numValue < MIN && value.length > 0) {
      setCpuPercentage(MIN.toString());
    }
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
        case 'collectionsUpdated':
          setCollections(message.collections || []);
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
          setWildcardPattern('');
          setIsCreating(false);
          setCurrentBackupId('');
          setShowForm(true);
          setError('');
          // Clear backup list
          setBackups([]);
          // Reset advanced config fields
          setCpuPercentage('');
          setCompressionLevel(BACKUP_CONFIG.COMPRESSION_LEVELS[0]);
          setPath('');
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
    if (!autoRefresh || isPaused || (showForm && !showAll)) {
      return;
    }

    // Don't auto-refresh if current backup is in terminal state
    const currentBackup = backups.find((b) => b.id === currentBackupId);
    if (currentBackup && ['SUCCESS', 'FAILED', 'CANCELED'].includes(currentBackup.status)) {
      setAutoRefresh(false);
      return;
    }

    const intervalId = setInterval(() => {
      fetchBackups();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, isPaused, refreshInterval, showForm, showAll, currentBackupId, backups]);

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
    } else if (collectionMode === 'wildcard' && wildcardMatches.length > 0) {
      backupData.includeCollections = wildcardMatches;
    }

    // Add optional configuration parameters
    if (cpuPercentage) {
      backupData.cpuPercentage = parseInt(cpuPercentage);
    }
    if (compressionLevel && compressionLevel !== BACKUP_CONFIG.COMPRESSION_LEVELS[0]) {
      backupData.compressionLevel = compressionLevel;
    }
    if (path && path.trim() && selectedBackend === 'filesystem') {
      backupData.path = path.trim();
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

  const handleCancelBackup = (backupId: string, backend: string) => {
    if (vscode) {
      vscode.postMessage({
        command: 'cancelBackup',
        backupId,
        backend,
      });
      // Refresh backups after a short delay
      setTimeout(() => {
        fetchBackups();
      }, 1000);
    }
  };

  const handleCancel = () => {
    if (vscode) {
      vscode.postMessage({
        command: 'cancel',
      });
    }
  };

  const handleCreateNewBackup = () => {
    // Reset form to initial state
    setBackupId(generateBackupId());
    setCollectionMode('all');
    setSelectedCollections([]);
    setWildcardPattern('');
    setIsCreating(false);
    setCurrentBackupId('');
    setShowForm(true);
    setError('');
    setCpuPercentage('');
    setCompressionLevel(BACKUP_CONFIG.COMPRESSION_LEVELS[0]);
    setPath('');
    setShowAdvancedConfig(false);
  };

  const getBackendOptions = () => {
    if (!availableModules) {
      return [];
    }
    return Object.keys(availableModules)
      .filter((key) => key.startsWith('backup-'))
      .map((key) => key.replace('backup-', ''));
  };

  const backendOptions = getBackendOptions();
  const hasBackupModule = backendOptions.length > 0;

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
      {!hasBackupModule ? (
        <div className="backup-header">
          <h1>Backup</h1>
          <div
            className="error-message"
            style={{
              backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
              borderColor: 'var(--vscode-inputValidation-warningBorder)',
            }}
          >
            <strong>⚠️ No Backup Module Found</strong>
            <p style={{ marginTop: '8px', marginBottom: '8px' }}>
              No backup module is installed in your Weaviate instance. Backup functionality requires
              one of the following modules:
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '8px' }}>
              <li>backup-filesystem</li>
              <li>backup-s3</li>
              <li>backup-gcs</li>
              <li>backup-azure</li>
            </ul>
            <p style={{ marginTop: '8px' }}>
              Please refer to the{' '}
              <a
                href="https://docs.weaviate.io/deploy/configuration/backups"
                style={{ color: 'var(--vscode-textLink-foreground)', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.preventDefault();
                  if (vscode) {
                    vscode.postMessage({
                      command: 'openExternal',
                      url: 'https://docs.weaviate.io/deploy/configuration/backups',
                    });
                  }
                }}
              >
                Weaviate backup configuration documentation
              </a>{' '}
              for more information.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!showForm && (
            <div className="new-backup-header">
              <h1>Backup Status</h1>
              <button className="theme-button" onClick={handleCreateNewBackup}>
                Create New Backup
              </button>
            </div>
          )}

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
                  disabled={isCreating || !hasBackupModule}
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
                  disabled={isCreating || !hasBackupModule}
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
                <div
                  className="collapsible-header"
                  onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowAdvancedConfig(!showAdvancedConfig);
                    }
                  }}
                >
                  <h3 className="collections-section-title">
                    <span className={`collapse-icon ${showAdvancedConfig ? 'expanded' : ''}`}>
                      ▶
                    </span>
                    Advanced Configuration (optional)
                  </h3>
                </div>

                {showAdvancedConfig && (
                  <div className="advanced-config-grid">
                    <div className="form-field">
                      <label htmlFor="cpuPercentage" className="form-label-small">
                        CPU Percentage (1-80%):
                      </label>
                      <input
                        id="cpuPercentage"
                        type="number"
                        className="form-input-small"
                        value={cpuPercentage}
                        onChange={(e) => handleCpuPercentageChange(e.target.value)}
                        placeholder="50"
                        min="1"
                        max="80"
                        disabled={isCreating}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="compressionLevel" className="form-label-small">
                        Compression Level:
                      </label>
                      <select
                        id="compressionLevel"
                        className="form-input-small"
                        value={compressionLevel}
                        onChange={(e) => setCompressionLevel(e.target.value)}
                        disabled={isCreating}
                      >
                        <option value="DefaultCompression">Default Compression</option>
                        <option value="BestSpeed">Best Speed</option>
                        <option value="BestCompression">Best Compression</option>
                      </select>
                    </div>

                    {selectedBackend === 'filesystem' && (
                      <div className="form-field">
                        <label htmlFor="path" className="form-label-small">
                          Path (filesystem only):
                        </label>
                        <input
                          id="path"
                          type="text"
                          className="form-input-small"
                          value={path}
                          onChange={(e) => setPath(e.target.value)}
                          placeholder="/custom/backup/path"
                          disabled={isCreating}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="collections-section-title" style={{ margin: 0 }}>
                    Collections (optional):
                  </h3>
                  <button
                    className="theme-button-secondary-compact"
                    onClick={() => vscode && vscode.postMessage({ command: 'refreshCollections' })}
                    disabled={isCreating}
                    title="Refresh collection list"
                  >
                    Refresh
                  </button>
                </div>
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

                  <label className="radio-label">
                    <input
                      type="radio"
                      name="collectionMode"
                      value="wildcard"
                      className="radio-input"
                      checked={collectionMode === 'wildcard'}
                      onChange={() => {
                        setCollectionMode('wildcard');
                        setSelectedCollections([]);
                      }}
                      disabled={isCreating}
                    />
                    <span>Wildcard filter</span>
                  </label>
                </div>

                {collectionMode === 'wildcard' && (
                  <div className="collections-list">
                    <div className="form-field" style={{ marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={wildcardPattern}
                        onChange={(e) => setWildcardPattern(e.target.value)}
                        placeholder="e.g. Article*, *Document*, Test?"
                        disabled={isCreating}
                      />
                    </div>
                    {wildcardPattern && (
                      <>
                        <p className="muted-text" style={{ marginBottom: '4px' }}>
                          {wildcardMatches.length === 0
                            ? 'No collections match this pattern'
                            : `${wildcardMatches.length} collection(s) will be included:`}
                        </p>
                        <div>
                          {wildcardMatches.map((collection) => (
                            <div
                              key={collection}
                              className="collection-checkbox"
                              style={{ cursor: 'default' }}
                            >
                              <span className="collection-name">{collection}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {(collectionMode === 'include' || collectionMode === 'exclude') && (
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
                  disabled={
                    isCreating ||
                    !backupId.trim() ||
                    !selectedBackend ||
                    !hasBackupModule ||
                    (collectionMode === 'wildcard' && wildcardMatches.length === 0)
                  }
                >
                  {isCreating ? 'Creating...' : 'Create Backup'}
                </button>
                <button
                  className="theme-button-secondary"
                  onClick={handleCancel}
                  disabled={isCreating}
                >
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
                  <>
                    <button
                      className="theme-button-secondary-compact"
                      onClick={() => setIsPaused(!isPaused)}
                      disabled={isLoadingBackups}
                      title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
                    >
                      {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                    </button>
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
                  </>
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
                  : showAll
                    ? 'No backups to list'
                    : 'No backups to list. Try clicking on show all to list all backups'}
              </p>
            ) : (
              <table className="theme-table">
                <thead>
                  <tr className="theme-table-header">
                    <th className="theme-table-cell">Backup ID</th>
                    <th className="theme-table-cell">Backend</th>
                    <th className="theme-table-cell">Status</th>
                    <th className="theme-table-cell">Duration</th>
                    <th className="theme-table-cell">Size</th>
                    <th className="theme-table-cell">Error</th>
                    <th className="theme-table-cell">Actions</th>
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
                      <td className="theme-table-cell">{backup.duration || '-'}</td>
                      <td className="theme-table-cell">{formatSize(backup.size)}</td>
                      <td className="theme-table-cell">{backup.error || '-'}</td>
                      <td className="theme-table-cell">
                        {backup.status === 'STARTED' && (
                          <button
                            className="theme-button-secondary-compact"
                            onClick={() => handleCancelBackup(backup.id, backup.backend)}
                            title="Cancel backup"
                          >
                            Cancel
                          </button>
                        )}
                        {backup.status === 'SUCCESS' && (
                          <button
                            className="theme-button-compact"
                            onClick={() => {
                              if (vscode) {
                                vscode.postMessage({
                                  command: 'viewBackup',
                                  backupId: backup.id,
                                  backend: backup.backend,
                                });
                              }
                            }}
                            title="View backup details"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Mount the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<NewBackupWebview />);
}
