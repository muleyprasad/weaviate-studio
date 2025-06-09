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

/**
 * Sanitizes data for display by removing any potential sensitive information
 * This acts as a second layer of security in case any sensitive data made it through the backend filtering
 */
const sanitizeDataForDisplay = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Function to recursively scrub sensitive data
  const scrub = (obj: any) => {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    // List of keys that might contain sensitive information
    const sensitiveKeys = ['apiKey', 'api_key', 'key', 'token', 'password', 'secret', 'auth', 'authorization'];
    
    // Check if object is an array
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item && typeof item === 'object') {
          scrub(item);
        }
      });
      return;
    }
    
    // Process object properties
    for (const key of Object.keys(obj)) {
      // Check for sensitive key names (case insensitive)
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        // Redact the value
        obj[key] = '[REDACTED]';
      } 
      // Special handling for client object which often contains credentials
      else if (key === 'client' && obj[key] && typeof obj[key] === 'object') {
        // Either remove client entirely or sanitize it
        if (Object.keys(obj[key]).some(clientKey => 
          sensitiveKeys.some(sk => clientKey.toLowerCase().includes(sk.toLowerCase())))) {
          // If client contains sensitive keys, replace with safe version
          const host = obj[key].host || 'unknown';
          obj[key] = {
            host: host,
            info: 'Connection details redacted for security',
          };
        } else {
          // Still recursively check other client properties
          scrub(obj[key]);
        }
      } 
      // Recursively check nested objects
      else if (obj[key] && typeof obj[key] === 'object') {
        scrub(obj[key]);
      }
    }
  };
  
  // Apply the sanitization
  scrub(sanitized);
  return sanitized;
};

// Define styles for various UI elements
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
  const [collection, setCollection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Setup message listener to receive data from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      // SECURITY: Sanitize message before logging
      const sanitizedMessage = { ...message };
      if (sanitizedMessage.data) {
        sanitizedMessage.data = sanitizeDataForDisplay(sanitizedMessage.data);
      }
      console.log('Received message:', sanitizedMessage);
      
      // Process different message types from the backend
      switch(sanitizedMessage.type) {
        case 'update':
          setJsonData(sanitizedMessage.data);
          if (sanitizedMessage.title) {
            setTitle(sanitizedMessage.title);
          }
          break;

        case 'initialData':
          // Just store the schema, don't display yet
          console.log('Received schema for collection:', sanitizedMessage.collection);
          setCollection(sanitizedMessage.collection);
          setTitle(`Weaviate Collection: ${sanitizedMessage.collection}`);
          break;

        case 'queryResult':
          // Display the query results
          console.log('Received query results for collection:', sanitizedMessage.collection);
          console.log('Sanitized query result data:', JSON.stringify(sanitizeDataForDisplay(sanitizedMessage.data), null, 2));
          
          // Extract the actual data from Weaviate's response structure
          // Weaviate typically returns a nested structure with results inside data.data.Get[Collection]
          let extractedData;
          try {
            // First check if we already have a simplified result structure
            if (sanitizedMessage.data && sanitizedMessage.data.collection && sanitizedMessage.data.results) {
              console.log('Using pre-extracted collection data');
              extractedData = sanitizedMessage.data.results;
            } 
            // Check for standard Weaviate nested response format with data.Get
            else if (sanitizedMessage.data && sanitizedMessage.data.data && sanitizedMessage.data.data.Get && sanitizedMessage.collection) {
              console.log('Extracting from nested data.data.Get structure');
              const collectionData = sanitizedMessage.data.data.Get[sanitizedMessage.collection];
              if (Array.isArray(collectionData) && collectionData.length > 0) {
                extractedData = collectionData;
              } else {
                console.log('Collection data not found in expected structure, using raw data');
                extractedData = sanitizedMessage.data;
              }
            } 
            // Alternative format sometimes returned
            else if (message.data && message.data.Get && message.collection) {
              console.log('Extracting from data.Get structure');
              const collectionData = message.data.Get[message.collection];
              if (Array.isArray(collectionData) && collectionData.length > 0) {
                extractedData = collectionData;
              } else {
                console.log('Collection data not found in expected structure, using raw data');
                extractedData = message.data;
              }
            } 
            // If all else fails, use the raw data
            else {
              console.log('Using raw message data as fallback');
              extractedData = message.data;
            }
            console.log('Extracted data:', extractedData);
            setJsonData(extractedData);
          } catch (err) {
            console.error('Error extracting data from response:', err);
            // Fallback to using the entire response if extraction fails
            setJsonData(message.data);
          }
          
          if (message.collection) {
            setCollection(message.collection);
            setTitle(`Weaviate Collection: ${message.collection}`);
          }
          setError(null); // Clear any previous errors
          break;

        case 'queryError':
          // Show error message
          console.error('Query error:', message.error);
          setError(message.error);
          break;

        case 'explainResult':
          // Handle explain plan results
          console.log('Received explain plan:', message.data);
          setJsonData(message.data);
          setTitle('Query Plan Explanation');
          setError(null);
          break;
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
  
  // Error message styling
  const errorStyle: React.CSSProperties = {
    color: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '20px',
    border: '1px solid rgba(231, 76, 60, 0.3)',
  };

  // Load indicator styling
  const loadingStyle: React.CSSProperties = {
    color: '#3498db',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>{title}</h1>
      
      {/* Display error messages if present */}
      {error && (
        <div style={errorStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Display JSON data when available */}
      {jsonData ? (
        <div style={jsonContainerStyle}>
          {/* Check if we have an empty result with just _errors array */}
          {jsonData._errors !== undefined && Object.keys(jsonData).length === 1 && jsonData._errors.length === 0 ? (
            <div style={emptyStateStyle}>
              <p>No data found in collection: {collection}</p>
              <p>This collection exists but appears to be empty.</p>
              <p style={{fontSize: '14px', color: '#888'}}>
                Try adding some data to this collection or select a different collection.
              </p>
            </div>
          ) : (
            /* Use a simple pre-formatted JSON display as a reliable fallback */
            <pre style={{
              backgroundColor: '#1E1E1E',
              color: '#D4D4D4',
              padding: '12px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: '70vh'
            }}>
              {JSON.stringify(sanitizeDataForDisplay(jsonData), null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div style={emptyStateStyle}>
          {/* Context-aware empty state message based on state */}
          <p>No data to display</p>
          {collection ? (
            <p>Loading data for collection: {collection}...</p>
          ) : (
            <p>Select a Weaviate collection to view data</p>
          )}
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
