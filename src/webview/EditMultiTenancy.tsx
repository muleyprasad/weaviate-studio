import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './EditMultiTenancy.css';

let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
}

interface InitData {
  connectionId: string;
  collectionName: string;
  enabled: boolean;
  autoTenantCreation: boolean;
  autoTenantActivation: boolean;
  readOnly: boolean;
}

function EditMultiTenancyWebview() {
  const [collectionName, setCollectionName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [autoTenantCreation, setAutoTenantCreation] = useState(false);
  const [autoTenantActivation, setAutoTenantActivation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyInit = useCallback((data: InitData) => {
    setCollectionName(data.collectionName);
    setEnabled(data.enabled);
    setReadOnly(data.readOnly);
    setAutoTenantCreation(data.autoTenantCreation);
    setAutoTenantActivation(data.autoTenantActivation);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message?.command) {
        case 'initData':
          applyInit(message as InitData);
          break;
        case 'saved':
          setIsSaving(false);
          break;
        case 'error':
          setIsSaving(false);
          setError(message.message ?? 'Unknown error');
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, [applyInit]);

  const handleSave = () => {
    setError(null);
    setIsSaving(true);
    vscode?.postMessage({
      command: 'save',
      autoTenantCreation,
      autoTenantActivation,
    });
  };

  const handleCancel = () => {
    vscode?.postMessage({ command: 'cancel' });
  };

  return (
    <div className="mt-form">
      <h1>Edit Multi-Tenancy</h1>
      <p className="mt-collection-name">
        Collection <code>{collectionName || '…'}</code>
      </p>

      {!enabled && (
        <div className="mt-disabled-note">
          Multi-tenancy is <strong>disabled</strong> on this collection. Auto-tenant options only
          take effect for multi-tenant collections and cannot be enabled after creation.
        </div>
      )}

      <div className="mt-option">
        <input
          id="autoTenantCreation"
          type="checkbox"
          checked={autoTenantCreation}
          disabled={!enabled || readOnly}
          onChange={(e) => setAutoTenantCreation(e.target.checked)}
        />
        <div className="mt-option-text">
          <label className="mt-option-label" htmlFor="autoTenantCreation">
            Auto Tenant Creation
          </label>
          <div className="mt-option-desc">
            Automatically create a tenant the first time data is written to it, so clients don't
            have to create tenants explicitly before inserting.
          </div>
        </div>
      </div>

      <div className="mt-option">
        <input
          id="autoTenantActivation"
          type="checkbox"
          checked={autoTenantActivation}
          disabled={!enabled || readOnly}
          onChange={(e) => setAutoTenantActivation(e.target.checked)}
        />
        <div className="mt-option-text">
          <label className="mt-option-label" htmlFor="autoTenantActivation">
            Auto Tenant Activation
          </label>
          <div className="mt-option-desc">
            Automatically load an INACTIVE tenant back into memory when it is accessed, instead of
            returning a "tenant is inactive" error.
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="mt-disabled-note">
          This connection is <strong>read-only</strong>. Enable write access to change these
          settings.
        </div>
      )}

      {error && <div className="mt-error">{error}</div>}

      <div className="mt-actions">
        <button
          className="mt-button mt-button--primary"
          onClick={handleSave}
          disabled={!enabled || readOnly || isSaving}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="mt-button mt-button--secondary"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<EditMultiTenancyWebview />);
}
