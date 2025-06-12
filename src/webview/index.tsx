import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { MonacoGraphQLEditor } from './MonacoGraphQLEditor';
import * as monaco from 'monaco-editor';

// Define the generateGraphQLQuery function directly in the webview since importing from utils may not work
// due to webview bundle isolation
/**
 * Interface for type safety in component props and state
 */
interface SchemaProperty {
  name: string;
  dataType: string[];
}

interface SchemaClass {
  class: string;
  properties: SchemaProperty[];
}

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

// Configure Monaco environment for web workers
try {
  // Only set up the Monaco environment if it hasn't been configured yet
  if (!window.MonacoEnvironment) {
    window.MonacoEnvironment = {
      getWorkerUrl: function (moduleId, label) {
        if (label === 'graphql') {
          return './graphql.worker.js';
        }
        return './editor.worker.js';
      }
    };
  }
} catch (error) {
  console.error('Failed to configure Monaco environment:', error);
}

// Custom styles defined inline



// Define styles for various UI elements
// Styles for the UI components
const styles = {
  container: {
    padding: '10px',
    fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", monospace',
    height: '100vh',
    overflow: 'auto',
    backgroundColor: '#1E1E1E',
    color: '#D4D4D4',
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '15px'
  },
  header: {
    borderBottom: '1px solid #333',
    paddingBottom: '10px',
    marginBottom: '5px',
    fontSize: '18px',
    fontWeight: 500 as 500
  },
  splitContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '10px',
    height: 'calc(100vh - 80px)'
  },
  queryContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '10px',
    minHeight: '200px',
    flex: '0 0 40%'
  },
  queryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333',
    paddingBottom: '5px'
  },
  resultContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '10px',
    flex: '1',
    overflow: 'auto'
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333',
    paddingBottom: '5px'
  },
  textarea: {
    backgroundColor: '#252526',
    color: '#D4D4D4',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '10px',
    fontFamily: 'monospace',
    fontSize: '14px',
    resize: 'none' as 'none',
    flex: '1',
    minHeight: '150px',
    outline: 'none',
    overflowY: 'auto' as 'auto'
  },
  jsonContainer: {
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '10px',
    overflow: 'auto',
    backgroundColor: '#252526',
    flex: '1',
    minHeight: '200px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center' as 'center'
  },
  button: {
    backgroundColor: '#0E639C',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500 as 500
  },
  toolbar: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '5px'
  },
  error: {
    color: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '10px',
    border: '1px solid rgba(231, 76, 60, 0.3)'
  },
  loading: {
    color: '#3498db',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }
};

const App = () => {
  const [jsonData, setJsonData] = useState<JsonData>(null);
  const [title, setTitle] = useState<string>('Weaviate Data Viewer');
  const [collection, setCollection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [initialQuerySent, setInitialQuerySent] = useState<boolean>(false);
  const [schema, setSchema] = useState<any>(null);
  const [schemaConfig, setSchemaConfig] = useState<any>(null);

  // Request a default query from the backend when collection is set and query is empty
  useEffect(() => {
    if (collection && !queryText && !initialQuerySent && vscode) {
      // Request sample query from backend instead of generating it here
      vscode.postMessage({ type: 'requestSampleQuery', collection });
      // We'll receive the sample query via the message handler
    }
  }, [collection, queryText, initialQuerySent]);

  // Handle running the query
  const handleRunQuery = () => {
    if (!queryText.trim()) {
      setError('Query cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInitialQuerySent(true);

    // Send the query to the extension host
    if (vscode) {
      vscode.postMessage({
        type: 'runQuery',
        query: queryText,
        options: {}
      });
    }
  };

  // Generate sample query button handler - requests from backend
  const handleGenerateQuery = () => {
    if (collection && vscode) {
      // Request sample query from backend instead of generating it
      vscode.postMessage({ type: 'requestSampleQuery', collection });
    } else {
      setError('No collection selected');
    }
  };

  // Setup message listener to receive data from extension
  // Helper function to extract data from Weaviate response formats
  const extractWeaviateData = (data: any, collection?: string): any => {
    // Case 1: Pre-extracted collection data
    if (data?.collection && data?.results) {
      console.log('Using pre-extracted collection data');
      return data.results;
    }
    
    // Case 2: Standard nested Weaviate response format
    if (data?.data?.Get && collection) {
      console.log('Extracting from nested data.data.Get structure');
      const collectionData = data.data.Get[collection];
      if (Array.isArray(collectionData) && collectionData.length > 0) {
        return collectionData;
      }
    }
    
    // Case 3: Alternative format sometimes returned
    if (data?.Get && collection) {
      console.log('Extracting from data.Get structure');
      const collectionData = data.Get[collection];
      if (Array.isArray(collectionData) && collectionData.length > 0) {
        return collectionData;
      }
    }
    
    // Fallback: Return the raw data
    console.log('Using raw data as fallback');
    return data;
  };

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message:', message);

      // Process different message types from the backend
      switch (message.type) {
        case 'update':
          setJsonData(message.data);
          setIsLoading(false);
          if (message.title) {
            setTitle(message.title);
          }
          // Check if the update includes a sample query to display
          if (message.data && message.data.sampleQuery) {
            console.log('Setting query from update message:', message.data.sampleQuery);
            setQueryText(message.data.sampleQuery);
            setInitialQuerySent(true); // Mark that we've received an initial query
          }
          break;

        case 'initialData':
          // Store the schema and setup a default query
          console.log('Received schema for collection:', message.collection);
          setCollection(message.collection);
          setTitle(`Weaviate Collection: ${message.collection}`);
          
          // Store schema for backend query generation (via requestSampleQuery)
          if (message.schema) {
            console.log('Received schema data for initialData');
            try {
              // Store schema for future use
              setSchema(message.schema);
              
              // We'll get the query from backend
              if (message.collection && !initialQuerySent) {
                // Request a sample query if one wasn't sent already
                vscode.postMessage({ 
                  type: 'requestSampleQuery', 
                  collection: message.collection 
                });
                setInitialQuerySent(true);  // Mark that we've requested an initial query
              }
            } catch (err) {
              console.error('Error processing schema:', err);
            }
          } else {
            console.log('No schema in initialData message');
          }
          
          // Don't reset loading here as we might be waiting for sample data
          break;

        case 'queryResult':
          // Display the query results
          console.log('Received query results for collection:', message.collection);
          
          // Always stop loading when we get results
          setIsLoading(false);
          
          try {
            const extractedData = extractWeaviateData(message.data, message.collection);
            console.log('Extracted data:', extractedData);
            setJsonData(extractedData);
          } catch (err) {
            console.error('Error extracting data from response:', err);
            setJsonData(message.data);
          }

          if (message.collection) {
            setCollection(message.collection);
            setTitle(`Weaviate Collection: ${message.collection}`);
          }
          setError(null); // Clear any previous errors
          break;

        case 'sampleQuery':
          // Handle sample query message from backend
          console.log('Received sample query from backend:', message.data?.sampleQuery);
          if (message.data && message.data.sampleQuery) {
            setQueryText(message.data.sampleQuery);
            console.log('Query text state updated with sample query');
          } else {
            console.warn('Received sampleQuery message but no query was included');
          }
          setIsLoading(false);
          break;

        case 'queryError':
        case 'explainError': // Restored handler for explainError
          // Display error message from failed query
          console.error(`${message.type}:`, message.error);
          setError(message.error || 'Unknown query error');
          setIsLoading(false);
          break;

        case 'explainResult':
          // Handle explain plan results
          console.log('Received explain plan:', message.data);
          setJsonData(message.data);
          setTitle('Query Plan Explanation');
          setError(null);
          setIsLoading(false);
          break;
          
        case 'schemaResult': // Added handler for schemaResult
          // Handle schema results
          console.log('Received schema for collection:', message.collection);
          setJsonData(message.schema);
          
          // Store schema (backend will handle query generation)
          console.log('Processing schema from schemaResult:',
            message.schema ? 'Schema received' : 'No schema received');
          try {
            // Log some info about the schema structure
            console.log('Schema keys:', Object.keys(message.schema));
            if (message.schema.classes) {
              console.log('Classes count:', message.schema.classes.length);
              const matchingClass = message.schema.classes.find(
                (c: any) => c.class === message.collection
              );
              if (matchingClass) {
                console.log('Found matching class with properties:', matchingClass.properties?.length || 0);
              }
            }
            
            setSchema(message.schema);
            
            // Create GraphQL schema config for Monaco editor
            if (message.schema && message.schema.classes && message.schema.classes.length > 0) {
              // Build a simplified GraphQL introspection schema for monaco-graphql
              const introspectionJSON = {
                __schema: {
                  types: [
                    // Add standard Weaviate query types
                    { name: 'Query', kind: 'OBJECT' },
                    { name: 'Get', kind: 'OBJECT' },
                    { name: 'Aggregate', kind: 'OBJECT' },
                    { name: 'Explore', kind: 'OBJECT' },
                    // Add all collection classes as types
                    ...(message.schema.classes || []).map((cls: any) => ({
                      name: cls.class,
                      kind: 'OBJECT',
                      fields: [
                        // Add standard fields available on all objects
                        { name: 'id', type: { name: 'String', kind: 'SCALAR' } },
                        { name: '_additional', type: { name: 'Additional', kind: 'OBJECT' } },
                        // Add all properties as fields
                        ...(cls.properties || []).map((prop: any) => ({
                          name: prop.name,
                          type: {
                            name: prop.dataType[0],
                            kind: 'SCALAR'
                          },
                          description: prop.description || `${prop.name} (${prop.dataType.join(', ')})`
                        }))
                      ]
                    }))
                  ]
                }
              };
              
              // Set the schema configuration for the Monaco editor
              setSchemaConfig({
                uri: 'weaviate://graphql',
                schema: message.schema,
                fileMatch: ['*.graphql', '*.gql'],
                introspectionJSON
              });
            }
            
            // We'll rely on backend for query generation
            if (message.collection && !initialQuerySent) {
              // Request a sample query if one wasn't sent already
              vscode.postMessage({ 
                type: 'requestSampleQuery', 
                collection: message.collection 
              });
              setInitialQuerySent(true);  // Mark that we've requested an initial query
            }
          } catch (err) {
            console.error('Error processing schema in schemaResult:', err);
          }
          
          setTitle(`Schema: ${message.collection}`);
          setError(null);
          setIsLoading(false);
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
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>{title}</h1>

      {/* Display error messages if present */}
      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Simple layout with query editor and results */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
        {/* Query editor section */}
        <div style={{ ...styles.queryContainer, flex: '0 0 50%', minHeight: '200px', maxHeight: '50%' }}>
          <div style={styles.queryHeader}>
            <span>Query Editor</span>
          </div>

          <div style={{ flex: 1, minHeight: '200px' }}>
            <MonacoGraphQLEditor
              initialValue={queryText}
              onChange={(value) => setQueryText(value)}
              onRunQuery={handleRunQuery}
              onGenerateSample={handleGenerateQuery}
              schemaConfig={schemaConfig}
              collectionName={collection || undefined}
            />
          </div>
        </div>

        {/* Results section */}
        <div style={{ ...styles.resultContainer, flex: '0 0 50%', minHeight: '200px', maxHeight: '50%' }}>
          <div style={styles.resultHeader}>
            <span>Results</span>
            {isLoading && <span style={styles.loading}>Loading...</span>}
          </div>

          {/* Display JSON data when available */}
          {jsonData ? (
            <div style={styles.jsonContainer}>
              {/* Check if we have an empty result with just _errors array */}
              {jsonData._errors !== undefined && Object.keys(jsonData).length === 1 && jsonData._errors.length === 0 ? (
                <div style={styles.emptyState}>
                  <p>No data found in collection: {collection}</p>
                  <p>This collection exists but appears to be empty.</p>
                  <p style={{ fontSize: '14px', color: '#888' }}>
                    Try adding some data to this collection or select a different collection.
                  </p>
                </div>
              ) : (
                /* Use a simple pre-formatted JSON display as a reliable fallback */
                <pre style={{
                  backgroundColor: '#252526',
                  color: '#D4D4D4',
                  padding: '12px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  height: '100%'
                }}>
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <p>No results to display yet</p>
              {collection ? (
                <p>Try running a query for collection: {collection}</p>
              ) : (
                <p>Select a collection from the sidebar to view data</p>
              )}
            </div>
          )}
        </div>
      </div>
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
