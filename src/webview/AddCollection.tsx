import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore - JSX component without type declarations
import Collection from 'weaviate-add-collection';
import { SelectCreateMode, CreationMode } from './components/SelectCreateMode';
import { FileUpload } from './components/FileUpload';
import { CloneCollection } from './components/CloneCollection';
import { getVscodeApi } from './vscodeApi';

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

// Get VS Code API reference for messaging (shared across all components)
const vscode = getVscodeApi();

type AppMode = 'select' | CreationMode;

function AddCollectionWebview() {
  const [mode, setMode] = useState<AppMode>('select');
  const [initialSchema, setInitialSchema] = useState<any>(null);
  const [availableModules, setAvailableModules] = useState<any>(null);
  const [nodesNumber, setNodesNumber] = useState<number>(1);
  const [currentSchema, setCurrentSchema] = useState<any>(null);
  const [hasCollections, setHasCollections] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Request initial data from extension
    if (vscode) {
      // Signal that the webview is ready to receive initial data
      try {
        vscode.postMessage({ command: 'ready' });
      } catch (e) {
        console.error('[AddCollection] Failed to post ready message', e);
      }
    }

    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'availableModules':
          // Use the modules object directly from the server metadata
          const modules = message.modules || {};
          setAvailableModules(modules);
          break;
        case 'initialSchema':
          setInitialSchema(message.schema);
          // If we receive an initial schema, go straight to fromScratch mode
          if (message.schema) {
            setMode('fromScratch');
          }
          break;
        case 'nodesNumber':
          setNodesNumber(message.nodesNumber || 1);
          break;
        case 'hasCollections':
          setHasCollections(message.hasCollections || false);
          break;
        case 'error':
          setError(message.message || 'An error occurred');
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const handleModeSelect = (selectedMode: CreationMode) => {
    setError('');
    setMode(selectedMode);
  };

  const handleFileLoaded = (schema: any, action: 'edit' | 'create') => {
    setError('');
    if (action === 'edit') {
      setInitialSchema(schema);
      setMode('fromScratch');
    } else if (action === 'create') {
      // Create directly without editing
      if (vscode) {
        vscode.postMessage({
          command: 'create',
          schema: schema,
        });
      }
    }
  };

  const handleCreate = () => {
    // Use the schema from the onChange/onSubmit callback
    if (currentSchema) {
      setError('');
      if (vscode) {
        vscode.postMessage({
          command: 'create',
          schema: currentSchema,
        });
      }
    } else {
      setError('No schema found. Please fill in the collection details.');
    }
  };

  const handleSchemaChange = (schema: any) => {
    // Store the schema whenever it changes
    setCurrentSchema(schema);
  };

  const handleSchemaSubmit = (schema: any) => {
    // Handle submission directly from the component
    if (vscode) {
      vscode.postMessage({
        command: 'create',
        schema: schema,
      });
    }
  };

  const handleCancel = () => {
    if (vscode) {
      vscode.postMessage({ command: 'cancel' });
    }
  };

  const handleBack = () => {
    setError('');
    setMode('select');
    setInitialSchema(null);
  };

  // Render based on current mode
  if (mode === 'select') {
    return (
      <>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '20px',
              background: 'var(--vscode-inputValidation-errorBackground)',
              border: '1px solid var(--vscode-inputValidation-errorBorder)',
              borderRadius: '4px',
              color: 'var(--vscode-errorForeground)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px 8px',
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        <SelectCreateMode
          hasCollections={hasCollections}
          onSelectMode={handleModeSelect}
          onCancel={handleCancel}
        />
      </>
    );
  }

  if (mode === 'importFromFile') {
    return (
      <FileUpload
        onSchemaLoaded={handleFileLoaded}
        onBack={handleBack}
        onCancel={handleCancel}
        externalError={error}
      />
    );
  }

  if (mode === 'cloneExisting') {
    return (
      <CloneCollection
        onSchemaLoaded={handleFileLoaded}
        onBack={handleBack}
        onCancel={handleCancel}
        externalError={error}
      />
    );
  }

  // Default: fromScratch mode
  return (
    <div className="add-collection-container">
      <div className="add-collection-header">
        <h1>Add Weaviate Collection</h1>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            background: 'var(--vscode-inputValidation-errorBackground)',
            border: '1px solid var(--vscode-inputValidation-errorBorder)',
            borderRadius: '4px',
            color: 'var(--vscode-errorForeground)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px 8px',
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="add-collection-content">
        <Collection
          key={initialSchema ? JSON.stringify(initialSchema) : 'empty'}
          initialJson={initialSchema}
          availableModules={availableModules}
          nodesNumber={nodesNumber}
          onChange={handleSchemaChange}
          onSubmit={handleSchemaSubmit}
          hideCreateButton={true}
        />
      </div>

      <div className="add-collection-actions">
        <button className="action-button action-button-primary" onClick={handleCreate}>
          Create Collection
        </button>
        <button className="action-button action-button-secondary" onClick={handleBack}>
          Back
        </button>
        <button className="action-button action-button-secondary" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AddCollectionWebview />);
}
