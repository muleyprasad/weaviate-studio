import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './Cluster.css';

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

function ClusterPanelWebview() {
  const [nodeStatusData, setNodeStatusData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'init':
        case 'updateData':
          setNodeStatusData(message.nodeStatusData);
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    vscode.postMessage({
      command: 'refresh',
    });
  };

  return (
    <div className="cluster-panel">
      <div className="cluster-header">
        <h1>Cluster Information</h1>
        <button onClick={handleRefresh} className="refresh-button" disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="cluster-content">
        {isLoading ? (
          <div className="loading">
            <p>Loading cluster data...</p>
          </div>
        ) : nodeStatusData ? (
          <div className="json-container">
            <h2>Node Status</h2>
            <pre className="json-display">{JSON.stringify(nodeStatusData, null, 2)}</pre>
          </div>
        ) : (
          <div className="no-data">
            <p>No cluster data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Mount the React component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ClusterPanelWebview />
    </React.StrictMode>
  );
}
