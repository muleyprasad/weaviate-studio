import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

type JsonData = Record<string, any> | null;

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

// Custom styles defined inline

// Styles for the container
const containerStyle: React.CSSProperties = {
  padding: '10px',
  fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", monospace',
  height: '100vh',
  overflow: 'auto',
  backgroundColor: '#1E1E1E',
  color: '#D4D4D4'
};

const jsonContainerStyle: React.CSSProperties = {
  marginTop: '20px',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '10px',
  overflow: 'auto'
};

const headerStyle: React.CSSProperties = {
  borderBottom: '1px solid #333',
  paddingBottom: '10px',
  marginBottom: '20px',
  fontSize: '18px',
  fontWeight: 500
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '300px',
  color: '#666',
  textAlign: 'center'
};

const App = () => {
  const [jsonData, setJsonData] = useState<JsonData>(null);
  const [title, setTitle] = useState<string>('Weaviate Data Viewer');
  
  // Setup message listener to receive data from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message:', message);
      
      if (message.type === 'update') {
        setJsonData(message.data);
        if (message.title) {
          setTitle(message.title);
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send ready message to extension
    if (vscode) {
      vscode.postMessage({ type: 'ready' });
    }
    
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);
  
  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>{title}</h1>
      
      {jsonData ? (
        <div style={jsonContainerStyle}>
          {/* Use a simple pre-formatted JSON display as a reliable fallback */}
          <pre style={{
            backgroundColor: '#1E1E1E',
            color: '#D4D4D4',
            padding: '12px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: '70vh'
          }}>
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        </div>
      ) : (
        <div style={emptyStateStyle}>
          <p>No data to display</p>
          <p>Select a Weaviate collection or run a query to view data</p>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Failed to find the root element for the webview.');
}
