import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './ConnectionForm.css';

let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
}

interface ConnectionLink {
  name: string;
  url: string;
}

interface InitConnectionData {
  name: string;
  type: 'custom' | 'cloud';
  httpHost: string;
  httpPort: number;
  httpSecure: boolean;
  grpcHost: string;
  grpcPort: number;
  grpcSecure: boolean;
  cloudUrl: string;
  autoConnect: boolean;
  openClusterViewOnConnect: boolean;
  timeoutInit: number;
  timeoutQuery: number;
  timeoutInsert: number;
  skipInitChecks: boolean;
  links: ConnectionLink[];
}

type ApiKeyAction = 'keep' | 'remove' | 'update';

function ConnectionFormWebview() {
  const [isReady, setIsReady] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState('');

  // Form fields
  const [connectionType, setConnectionType] = useState<'custom' | 'cloud'>('custom');
  const [name, setName] = useState('');
  const [httpHost, setHttpHost] = useState('localhost');
  const [httpPort, setHttpPort] = useState(8080);
  const [httpSecure, setHttpSecure] = useState(false);
  const [grpcHost, setGrpcHost] = useState('localhost');
  const [grpcPort, setGrpcPort] = useState(50051);
  const [grpcSecure, setGrpcSecure] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [autoConnect, setAutoConnect] = useState(false);
  const [openClusterViewOnConnect, setOpenClusterViewOnConnect] = useState(true);
  const [timeoutInit, setTimeoutInit] = useState(30);
  const [timeoutQuery, setTimeoutQuery] = useState(60);
  const [timeoutInsert, setTimeoutInsert] = useState(120);
  const [skipInitChecks, setSkipInitChecks] = useState(false);
  const [links, setLinks] = useState<ConnectionLink[]>([]);

  // API key state
  const [apiKeyPresent, setApiKeyPresent] = useState(false);
  const [apiKeyAction, setApiKeyAction] = useState<ApiKeyAction>('keep');
  const [apiKeyInput, setApiKeyInput] = useState('');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'initData': {
          const conn: InitConnectionData = message.connection;
          setConnectionType(conn.type || 'custom');
          setName(conn.name || '');
          setHttpHost(conn.httpHost || 'localhost');
          setHttpPort(conn.httpPort || 8080);
          setHttpSecure(conn.httpSecure || false);
          setGrpcHost(conn.grpcHost || 'localhost');
          setGrpcPort(conn.grpcPort || 50051);
          setGrpcSecure(conn.grpcSecure || false);
          setCloudUrl(conn.cloudUrl || '');
          setAutoConnect(conn.autoConnect || false);
          setOpenClusterViewOnConnect(conn.openClusterViewOnConnect !== false);
          setTimeoutInit(conn.timeoutInit || 30);
          setTimeoutQuery(conn.timeoutQuery || 60);
          setTimeoutInsert(conn.timeoutInsert || 120);
          setSkipInitChecks(conn.skipInitChecks || false);
          setLinks(conn.links || []);
          setApiKeyPresent(!!message.apiKeyPresent);
          setApiKeyAction(message.apiKeyPresent ? 'keep' : 'update');
          setIsEditMode(!!message.isEditMode);
          setConnectionVersion(message.connectionVersion || '');
          setIsReady(true);
          break;
        }
        case 'error':
          setFormError(message.message);
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    if (vscode) {
      vscode.postMessage({ command: 'ready' });
    }

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, []);

  const clearErrors = () => {
    setErrors({});
    setFormError('');
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (connectionType === 'custom') {
      if (!httpHost.trim()) {
        newErrors.httpHost = 'HTTP Host is required';
      }
    } else {
      if (!cloudUrl.trim()) {
        newErrors.cloudUrl = 'Cloud URL is required';
      }
      // For new cloud connections, or when changing from custom to cloud,
      // or when no existing API key, require an API key
      const needsApiKey =
        !isEditMode || (isEditMode && !apiKeyPresent) || (isEditMode && apiKeyAction === 'remove');

      // If this is a new cloud connection and no key is provided
      if (!isEditMode && apiKeyAction === 'update' && !apiKeyInput.trim()) {
        newErrors.apiKey = 'API Key is required for cloud connections';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildConnectionPayload = () => {
    const base = {
      name: name.trim(),
      type: connectionType,
      autoConnect,
      openClusterViewOnConnect,
      timeoutInit,
      timeoutQuery,
      timeoutInsert,
      skipInitChecks,
      links: links.filter((l) => l.name.trim() && l.url.trim()),
    };

    let payload: Record<string, unknown> = { ...base };

    if (connectionType === 'custom') {
      payload = {
        ...payload,
        httpHost: httpHost.trim(),
        httpPort,
        httpSecure,
        grpcHost: grpcHost.trim(),
        grpcPort,
        grpcSecure,
      };
    } else {
      payload = {
        ...payload,
        cloudUrl: cloudUrl.trim(),
      };
    }

    // Handle API key
    if (apiKeyAction === 'update' && apiKeyInput.trim()) {
      payload.apiKey = apiKeyInput.trim();
    }

    return payload;
  };

  const handleSave = () => {
    clearErrors();
    if (!validate()) {
      return;
    }

    const connection = buildConnectionPayload();
    const message: Record<string, unknown> = { command: 'save', connection };
    if (apiKeyAction === 'remove') {
      message.removeApiKey = true;
    }

    if (vscode) {
      vscode.postMessage(message);
    }
  };

  const handleSaveAndConnect = () => {
    clearErrors();
    if (!validate()) {
      return;
    }

    const connection = buildConnectionPayload();
    const message: Record<string, unknown> = { command: 'saveAndConnect', connection };
    if (apiKeyAction === 'remove') {
      message.removeApiKey = true;
    }

    if (vscode) {
      vscode.postMessage(message);
    }
  };

  const handleCancel = useCallback(() => {
    if (vscode) {
      vscode.postMessage({ command: 'cancel' });
    }
  }, []);

  const handleRemoveApiKey = () => {
    setApiKeyAction('remove');
    setApiKeyInput('');
  };

  const addLink = () => {
    setLinks((prev) => [...prev, { name: '', url: '' }]);
  };

  const updateLink = (index: number, field: 'name' | 'url', value: string) => {
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const getApiKeyPlaceholder = () => {
    if (connectionType === 'cloud') {
      if (!isEditMode) {
        return 'Required for cloud connections';
      }
      if (apiKeyAction === 'remove') {
        return 'Enter new key, or leave blank for anonymous access';
      }
    }
    return 'Leave empty if not required';
  };

  if (!isReady) {
    return (
      <div className="connection-form-container">
        <p style={{ color: 'var(--vscode-descriptionForeground)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="connection-form-container">
      <h1>{isEditMode ? 'Edit Connection' : 'Add Weaviate Connection'}</h1>

      {formError && <div className="form-error">{formError}</div>}

      {/* Connection type */}
      <div className="form-group">
        <label htmlFor="connectionType">Connection Type</label>
        <select
          id="connectionType"
          value={connectionType}
          onChange={(e) => {
            setConnectionType(e.target.value as 'custom' | 'cloud');
            clearErrors();
          }}
        >
          <option value="custom">Custom</option>
          <option value="cloud">Cloud</option>
        </select>
      </div>

      {/* Connection name */}
      <div className="form-group">
        <label htmlFor="connectionName">Connection Name</label>
        <input
          type="text"
          id="connectionName"
          placeholder="e.g., Production Cluster"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={errors.name ? 'input-error' : ''}
          autoFocus
        />
        {errors.name && <div className="field-error">{errors.name}</div>}
      </div>

      {/* Custom connection fields */}
      {connectionType === 'custom' && (
        <>
          <div className="form-group">
            <label htmlFor="httpHost">Weaviate HTTP Host</label>
            <input
              type="text"
              id="httpHost"
              placeholder="localhost"
              value={httpHost}
              onChange={(e) => setHttpHost(e.target.value)}
              className={errors.httpHost ? 'input-error' : ''}
            />
            {errors.httpHost && <div className="field-error">{errors.httpHost}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="httpPort">Weaviate HTTP Port</label>
            <input
              type="number"
              id="httpPort"
              placeholder="8080"
              value={httpPort}
              onChange={(e) => setHttpPort(parseInt(e.target.value, 10) || 8080)}
            />
          </div>

          <div className="form-group-inline">
            <input
              type="checkbox"
              id="httpSecure"
              checked={httpSecure}
              onChange={(e) => setHttpSecure(e.target.checked)}
            />
            <label htmlFor="httpSecure">Use Secure HTTP (HTTPS)</label>
          </div>

          <div className="form-group">
            <label htmlFor="grpcHost">Weaviate gRPC Host</label>
            <input
              type="text"
              id="grpcHost"
              placeholder="localhost"
              value={grpcHost}
              onChange={(e) => setGrpcHost(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="grpcPort">Weaviate gRPC Port</label>
            <input
              type="number"
              id="grpcPort"
              placeholder="50051"
              value={grpcPort}
              onChange={(e) => setGrpcPort(parseInt(e.target.value, 10) || 50051)}
            />
          </div>

          <div className="form-group-inline">
            <input
              type="checkbox"
              id="grpcSecure"
              checked={grpcSecure}
              onChange={(e) => setGrpcSecure(e.target.checked)}
            />
            <label htmlFor="grpcSecure">Use Secure gRPC (TLS)</label>
          </div>

          {/* API Key for custom connections */}
          <div className="form-group">
            <label>API Key (optional)</label>
            {apiKeyPresent && apiKeyAction === 'keep' ? (
              <div className="api-key-configured">
                <span>API key is configured.</span>
                <button
                  type="button"
                  className="remove-api-key-button"
                  onClick={handleRemoveApiKey}
                >
                  REMOVE API KEY
                </button>
              </div>
            ) : (
              <>
                <input
                  type="password"
                  id="apiKeyCustom"
                  placeholder={getApiKeyPlaceholder()}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setApiKeyAction('update');
                  }}
                />
                {apiKeyAction === 'remove' && (
                  <small>
                    API key will be removed. Leave blank to connect anonymously, or enter a new key.
                  </small>
                )}
                {isEditMode && apiKeyAction !== 'remove' && (
                  <small>Leave blank to keep the existing API key unchanged.</small>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Cloud connection fields */}
      {connectionType === 'cloud' && (
        <>
          <div className="form-group">
            <label htmlFor="cloudUrl">Cloud URL</label>
            <input
              type="text"
              id="cloudUrl"
              placeholder="https://your-instance.weaviate.cloud"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              className={errors.cloudUrl ? 'input-error' : ''}
            />
            {errors.cloudUrl && <div className="field-error">{errors.cloudUrl}</div>}
          </div>

          {/* API Key for cloud connections */}
          <div className="form-group">
            <label>API Key</label>
            {apiKeyPresent && apiKeyAction === 'keep' ? (
              <div className="api-key-configured">
                <span>API key is configured.</span>
                <button
                  type="button"
                  className="remove-api-key-button"
                  onClick={handleRemoveApiKey}
                >
                  REMOVE API KEY
                </button>
              </div>
            ) : (
              <>
                <input
                  type="password"
                  id="apiKeyCloud"
                  placeholder={getApiKeyPlaceholder()}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setApiKeyAction('update');
                  }}
                  className={errors.apiKey ? 'input-error' : ''}
                />
                {errors.apiKey && <div className="field-error">{errors.apiKey}</div>}
                {apiKeyAction === 'remove' && (
                  <small>
                    API key will be removed. Leave blank to connect anonymously, or enter a new key.
                  </small>
                )}
                {isEditMode && apiKeyPresent && apiKeyAction !== 'remove' && (
                  <small>Leave blank to keep the existing API key unchanged.</small>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Advanced settings */}
      <div>
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? '▾' : '▸'} {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="form-section">
            <div className="form-group-inline">
              <input
                type="checkbox"
                id="autoConnect"
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.target.checked)}
              />
              <label htmlFor="autoConnect">Auto Connect on Expand</label>
            </div>
            <small style={{ marginBottom: '12px', display: 'block' }}>
              When enabled, connection will be established automatically when expanded without
              prompting.
            </small>

            <div className="form-group-inline">
              <input
                type="checkbox"
                id="openClusterViewOnConnect"
                checked={openClusterViewOnConnect}
                onChange={(e) => setOpenClusterViewOnConnect(e.target.checked)}
              />
              <label htmlFor="openClusterViewOnConnect">Open Cluster View on Connect</label>
            </div>
            <small style={{ marginBottom: '12px', display: 'block' }}>
              Automatically open the cluster information panel when connecting (enabled by default).
            </small>

            <div className="form-group">
              <label htmlFor="timeoutInit">Timeout (Init, seconds)</label>
              <input
                type="number"
                id="timeoutInit"
                value={timeoutInit}
                onChange={(e) => setTimeoutInit(parseInt(e.target.value, 10) || 30)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="timeoutQuery">Timeout (Query, seconds)</label>
              <input
                type="number"
                id="timeoutQuery"
                value={timeoutQuery}
                onChange={(e) => setTimeoutQuery(parseInt(e.target.value, 10) || 60)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="timeoutInsert">Timeout (Insert, seconds)</label>
              <input
                type="number"
                id="timeoutInsert"
                value={timeoutInsert}
                onChange={(e) => setTimeoutInsert(parseInt(e.target.value, 10) || 120)}
              />
            </div>

            <div className="form-group-inline">
              <input
                type="checkbox"
                id="skipInitChecks"
                checked={skipInitChecks}
                onChange={(e) => setSkipInitChecks(e.target.checked)}
              />
              <label htmlFor="skipInitChecks">Skip Initial Checks</label>
            </div>
          </div>
        )}
      </div>

      {/* Connection Links */}
      <div className="form-group">
        <label>Connection Links</label>
        {links.map((link, index) => (
          <div key={index} className="link-item">
            <input
              type="text"
              placeholder="Link name"
              value={link.name}
              onChange={(e) => updateLink(index, 'name', e.target.value)}
            />
            <input
              type="url"
              placeholder="https://example.com"
              value={link.url}
              onChange={(e) => updateLink(index, 'url', e.target.value)}
            />
            <button type="button" className="remove-link-button" onClick={() => removeLink(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="add-link-button" onClick={addLink}>
          + Add Link
        </button>
      </div>

      {/* Form actions */}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={handleCancel}>
          Cancel
        </button>
        <button type="button" className="secondary-button" onClick={handleSave}>
          {isEditMode ? 'Update Connection' : 'Save Connection'}
        </button>
        <button type="button" className="primary-button" onClick={handleSaveAndConnect}>
          {isEditMode ? 'Update and Connect' : 'Save and Connect'}
        </button>
      </div>

      {connectionVersion && (
        <div className="connection-version">Connection version: {connectionVersion}</div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectionFormWebview />);
}
