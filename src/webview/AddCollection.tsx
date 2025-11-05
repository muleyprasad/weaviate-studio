import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore - JSX component without type declarations
import Collection from 'weaviate-add-collection/src/components/Collection';

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

interface AddCollectionProps {
  connectionId?: string;
  initialSchema?: any;
  availableModules?: any;
}

function AddCollectionWebview() {
  const [initialSchema, setInitialSchema] = useState<any>(null);
  const [availableModules, setAvailableModules] = useState<any>(null);
  const [vectorizers, setVectorizers] = useState<string[]>([]);
  const [serverVersion, setServerVersion] = useState<string>('unknown');
  const [collections, setCollections] = useState<string[]>([]);

  useEffect(() => {
    // Request initial data from extension
    if (vscode) {
      // Signal that the webview is ready to receive initial data
      try {
        vscode.postMessage({ command: 'ready' });
      } catch (e) {
        console.error('[AddCollection] Failed to post ready message', e);
      }
      vscode.postMessage({ command: 'getVectorizers' });
      vscode.postMessage({ command: 'getCollections' });
    }

    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'vectorizers':
          setVectorizers(message.vectorizers || []);
          // Use the modules object directly from the server metadata
          const modules = message.modules || {};
          setAvailableModules(modules);
          break;
        case 'serverVersion':
          setServerVersion(message.version || 'unknown');
          break;
        case 'collections':
          setCollections(message.collections || []);
          break;
        case 'initialSchema':
          setInitialSchema(message.schema);
          break;
        case 'error':
          alert(`Error: ${message.message}`);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const handleCreate = () => {
    // Get the generated JSON from the Collection component
    // We need to extract it from the component's state
    // For now, we'll try to parse it from the DOM
    const jsonElement = document.querySelector('.json-block');
    if (jsonElement && jsonElement.textContent) {
      try {
        const schema = JSON.parse(jsonElement.textContent);
        if (vscode) {
          vscode.postMessage({
            command: 'create',
            schema: schema,
          });
        }
      } catch (error) {
        alert('Failed to parse collection schema. Please check your input.');
        console.error('Parse error:', error);
      }
    } else {
      alert('No schema found. Please fill in the collection details.');
    }
  };

  const handleCancel = () => {
    if (vscode) {
      vscode.postMessage({ command: 'cancel' });
    }
  };

  return (
    <div className="add-collection-container">
      <div className="add-collection-header">
        <h1>Add Weaviate Collection</h1>
      </div>

      <div className="add-collection-content">
        <Collection
          key={initialSchema ? JSON.stringify(initialSchema) : 'empty'}
          initialJson={initialSchema}
          availableModules={availableModules}
        />
      </div>

      <div className="add-collection-actions">
        <button className="action-button action-button-primary" onClick={handleCreate}>
          Create Collection
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
