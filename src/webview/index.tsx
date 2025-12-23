import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MonacoGraphQLEditor } from './MonacoGraphQLEditor';
import ResultsTable from './components/ResultsTable';
import * as monaco from 'monaco-editor';
import { queryTemplates, processTemplate } from '../query-editor/webview/graphqlTemplates';

// Standardized error messages for consistency
const CONNECTION_ERROR_MESSAGE =
  'Not connected to Weaviate. Please reconnect from the Connections view.';
const CONNECTION_MISSING_MESSAGE = 'Not connected to Weaviate';

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

// VS Code webviews run on the vscode-webview:// origin which can’t load file+
// worker URLs directly. Patch Monaco so it creates classic workers from blob
// URLs that proxy to the emitted worker code via importScripts.
const patchMonacoWorkerLoading = () => {
  const env: any = (window as any).MonacoEnvironment;
  if (!env || env.__vsCodePatched) {
    return;
  }

  const originalGetWorkerUrl =
    typeof env.getWorkerUrl === 'function' ? env.getWorkerUrl.bind(env) : null;
  if (!originalGetWorkerUrl) {
    return;
  }

  const resolveAbsoluteUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    // Prefer document.baseURI so resolution respects the <base href> injected for VS Code webview
    const base =
      (typeof document !== 'undefined' && (document.baseURI || '')) || window.location.href;
    return new URL(url, base).toString();
  };

  const ensureBlobClassicUrl = (moduleId: string, label: string): string | undefined => {
    const rawUrl = originalGetWorkerUrl(moduleId, label);
    if (typeof rawUrl !== 'string') {
      return undefined;
    }
    const absoluteUrl = resolveAbsoluteUrl(rawUrl);
    // Use classic workers; the emitted Monaco workers are bundled as classic scripts.
    const script =
      `/* Monaco worker bootstrap (classic) */\n` +
      `try {\n` +
      `  // Log target for diagnostics within the worker context\n` +
      `  console.log('[MonacoWorker:bootstrap] importScripts ->', ${JSON.stringify(absoluteUrl)});\n` +
      `  importScripts(${JSON.stringify(absoluteUrl)});\n` +
      `} catch (e) {\n` +
      `  // Surface errors to the devtools console in the webview\n` +
      `  console.error('Failed to import worker script:', ${JSON.stringify(absoluteUrl)}, e);\n` +
      `  throw e;\n` +
      `}`;
    const blob = new Blob([script], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
  };

  env.getWorker = (moduleId: string, label: string) => {
    console.log('Monaco getWorker invoked for label:', label, 'module:', moduleId);
    const blobUrl = ensureBlobClassicUrl(moduleId, label);
    if (blobUrl) {
      const worker = new Worker(blobUrl /* classic by default */);
      // Extra diagnostics for hard-to-debug worker startup issues
      worker.addEventListener('error', (e) => {
        console.error('[MonacoWorker:error]', label, e);
      });
      worker.addEventListener('messageerror', (e) => {
        console.error('[MonacoWorker:messageerror]', label, e);
      });
      return worker;
    }

    const fallback = originalGetWorkerUrl(moduleId, label);
    if (fallback instanceof Worker) {
      return fallback;
    }

    if (typeof fallback === 'string') {
      const url = resolveAbsoluteUrl(fallback);
      const worker = new Worker(url);
      worker.addEventListener('error', (e) => {
        console.error('[MonacoWorker:error:fallback]', label, e);
      });
      worker.addEventListener('messageerror', (e) => {
        console.error('[MonacoWorker:messageerror:fallback]', label, e);
      });
      return worker;
    }

    throw new Error('Unable to create Monaco worker for label ' + label);
  };

  env.__vsCodePatched = true;
};

// Patch immediately if MonacoEnvironment is already set, and retry shortly after in case it initializes later.
patchMonacoWorkerLoading();
window.setTimeout(patchMonacoWorkerLoading, 0);

// Resizable Splitter Component
const ResizableSplitter: React.FC<{
  children: [React.ReactNode, React.ReactNode];
  direction?: 'horizontal' | 'vertical';
  initialSplit?: number;
  minSize?: number;
  onSplitChange?: (split: number) => void;
}> = ({ children, direction = 'vertical', initialSplit = 50, minSize = 20, onSplitChange }) => {
  const [split, setSplit] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      let newSplit: number;
      if (direction === 'vertical') {
        const y = e.clientY - rect.top;
        newSplit = (y / rect.height) * 100;
      } else {
        const x = e.clientX - rect.left;
        newSplit = (x / rect.width) * 100;
      }

      // Apply constraints
      newSplit = Math.max(minSize, Math.min(100 - minSize, newSplit));
      setSplit(newSplit);
      onSplitChange?.(newSplit);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, minSize, onSplitChange]);

  const splitterStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 10,
    cursor: direction === 'vertical' ? 'row-resize' : 'col-resize',
    transition: isDragging ? 'none' : 'background-color 0.1s ease',
  };

  if (direction === 'vertical') {
    Object.assign(splitterStyle, {
      top: `${split}%`,
      left: 0,
      right: 0,
      height: '6px',
      marginTop: '-3px',
    });
  } else {
    Object.assign(splitterStyle, {
      left: `${split}%`,
      top: 0,
      bottom: 0,
      width: '6px',
      marginLeft: '-3px',
    });
  }

  const firstPaneStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: direction === 'horizontal' ? `${100 - split}%` : 0,
    bottom: direction === 'vertical' ? `${100 - split}%` : 0,
    overflow: 'hidden',
  };

  const secondPaneStyle: React.CSSProperties = {
    position: 'absolute',
    top: direction === 'vertical' ? `${split}%` : 0,
    left: direction === 'horizontal' ? `${split}%` : 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      <div style={firstPaneStyle}>{children[0]}</div>
      <div
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor =
              'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.04))';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      />
      <div style={secondPaneStyle}>{children[1]}</div>
    </div>
  );
};

// Styles using VS Code theme variables for proper theme integration
const styles = {
  container: {
    padding: '0',
    fontFamily:
      'var(--vscode-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", monospace)',
    height: '100vh',
    overflow: 'auto',
    backgroundColor: 'var(--vscode-editor-background, #1E1E1E)',
    color: 'var(--vscode-editor-foreground, #D4D4D4)',
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
  },
  header: {
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
    paddingBottom: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    marginBottom: '0',
    fontSize: '16px',
    fontWeight: 500 as 500,
    color: 'var(--vscode-titleBar-activeForeground, var(--vscode-sideBar-foreground, #CCCCCC))',
    backgroundColor:
      'var(--vscode-titleBar-activeBackground, var(--vscode-sideBar-background, #252526))',
  },
  splitContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
    height: 'calc(100vh - 50px)',
  },
  queryContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
    height: '100%',
  },
  queryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeft: '3px solid var(--vscode-button-background, #0E639C)',
    padding: '6px 8px',
    marginBottom: '0',
    backgroundColor: 'var(--vscode-sideBar-background, var(--vscode-editor-background, #252526))',
    color: 'var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #CCCCCC))',
  },
  resultContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
    height: '100%',
    overflow: 'hidden',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeft: '3px solid var(--vscode-button-background, #0E639C)',
    padding: '6px 8px',
    backgroundColor: 'var(--vscode-sideBar-background, var(--vscode-editor-background, #252526))',
    color: 'var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #CCCCCC))',
  },
  textarea: {
    backgroundColor: 'var(--vscode-input-background, #252526)',
    color: 'var(--vscode-input-foreground, #D4D4D4)',
    border: '1px solid var(--vscode-input-border, #333)',
    borderRadius: '4px',
    padding: '10px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '14px',
    resize: 'none' as 'none',
    flex: '1',
    minHeight: '150px',
    outline: 'none',
    overflowY: 'auto' as 'auto',
  },
  jsonContainer: {
    borderRadius: '0',
    padding: '12px',
    overflow: 'auto',
    backgroundColor: 'var(--vscode-editor-background, #252526)',
    flex: '1',
    minHeight: '200px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground, #666)',
    textAlign: 'center' as 'center',
  },
  button: {
    backgroundColor: 'var(--vscode-button-background, #0E639C)',
    color: 'var(--vscode-button-foreground, white)',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500 as 500,
  },
  toolbar: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '5px',
  },
  error: {
    color: 'var(--vscode-errorForeground, #e74c3c)',
    backgroundColor: 'var(--vscode-inputValidation-errorBackground, rgba(231, 76, 60, 0.1))',
    padding: '6px 10px',
    borderRadius: '4px',
    marginBottom: '6px',
    border: '1px solid var(--vscode-inputValidation-errorBorder, rgba(231, 76, 60, 0.3))',
    maxHeight: '160px',
    overflowY: 'auto' as 'auto',
    wordBreak: 'break-word' as 'break-word',
    whiteSpace: 'pre-wrap' as 'pre-wrap',
  },
  loading: {
    color: 'var(--vscode-progressBar-background, #3498db)',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
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
  const [schemaReady, setSchemaReady] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [connectionInfo, setConnectionInfo] = useState<{ name?: string; endpoint?: string } | null>(
    null
  );
  const [viewType, setViewType] = useState<'json' | 'table'>('table');
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const errorBufferRef = useRef<string>('');

  // Keyboard shortcuts within the webview
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const hasMod = e.metaKey || e.ctrlKey;
      // Run: Cmd/Ctrl + Enter
      if (hasMod && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading) {
          handleRunQuery();
        }
        return;
      }
      // Clear: Cmd/Ctrl + K
      if (hasMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (!isLoading && !isStopping) {
          setQueryText('');
          setJsonData(null);
          setError(null);
        }
        return;
      }
      // Stop: Escape
      if (e.key === 'Escape') {
        if (isLoading && !isStopping) {
          e.preventDefault();
          handleCancelQuery();
        }
      }
    };
    // Capture phase to ensure we see it even if Monaco handles it
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isLoading, isStopping, queryText]);

  // Save current state to backend for persistence across tab switches
  const saveCurrentState = () => {
    if (vscode) {
      const currentState = {
        queryText,
        jsonData,
        collection,
        viewType,
        splitRatio,
        error,
        schema,
        schemaConfig,
      };
      vscode.postMessage({
        type: 'saveState',
        state: currentState,
      });
    }
  };

  // Auto-save state when important data changes
  useEffect(() => {
    // Debounce state saving to avoid too frequent saves
    const timeoutId = setTimeout(() => {
      if (queryText || jsonData) {
        saveCurrentState();
      }
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [queryText, jsonData, viewType, splitRatio]);

  // Request a default query from the backend when collection is set and query is empty
  useEffect(() => {
    if (collection && !queryText && !initialQuerySent && vscode) {
      // Request sample query from backend instead of generating it here
      vscode.postMessage({
        type: 'requestSampleQuery',
        collection: collection,
      });
      setInitialQuerySent(true); // Mark that we've requested an initial query
    }
  }, [collection, queryText, initialQuerySent]);

  // Handle query execution
  const handleRunQuery = () => {
    if (!isConnected) {
      setError(CONNECTION_ERROR_MESSAGE);
      return;
    }

    if (!queryText.trim()) {
      setError('Please enter a GraphQL query');
      return;
    }

    setIsLoading(true);
    setIsStopping(false);
    setError(null);
    setJsonData(null); // clear previous results

    if (vscode) {
      vscode.postMessage({
        type: 'runQuery',
        query: queryText,
        collection: collection,
      });
    }
  };

  const handleCancelQuery = () => {
    if (vscode) {
      setIsStopping(true);
      vscode.postMessage({ type: 'cancelQuery' });
    }
  };

  // Handle sample query generation
  const handleGenerateQuery = () => {
    if (!isConnected) {
      setError(CONNECTION_ERROR_MESSAGE);
      return;
    }

    if (!collection) {
      setError('No collection selected');
      return;
    }

    if (vscode) {
      vscode.postMessage({
        type: 'requestSampleQuery',
        collection: collection,
      });
    }
  };

  // Handle template dropdown toggle
  const handleToggleTemplateDropdown = () => {
    setShowTemplateDropdown(!showTemplateDropdown);
  };

  // Handle template selection
  const handleTemplateSelect = (templateName: string) => {
    setShowTemplateDropdown(false);
    if (templateName === 'Schema-based Sample') {
      // Show loading placeholder in the editor
      setQueryText('Loading sample query...');
      // Request auto-generated sample from backend
      handleGenerateQuery();
    } else {
      // Find the template and process it
      const template = queryTemplates.find((t) => t.name === templateName);
      if (template) {
        const processed = processTemplate(
          template.template,
          collection || '',
          10,
          schema || undefined
        );
        setQueryText(processed);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showTemplateDropdown && !target.closest('.template-dropdown-container')) {
        setShowTemplateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateDropdown]);

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
      const message = event.data as any;
      // Filter VS Code internal scheduling pings to avoid noise
      if (message && typeof message === 'object' && 'vscodeScheduleAsyncWork' in message) {
        return;
      }
      console.log('Received message:', message);

      // Process different message types from the backend
      switch (message?.type) {
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
          if (message.connection) {
            setConnectionInfo({
              name: message.connection.name,
              endpoint: message.connection.endpoint,
            });
          }

          // Restore saved state if available
          if (message.savedState) {
            console.log('Restoring saved state:', message.savedState);
            const state = message.savedState;

            if (state.queryText) {
              setQueryText(state.queryText);
            }
            if (state.jsonData) {
              setJsonData(state.jsonData);
            }
            if (state.viewType) {
              setViewType(state.viewType);
            }
            if (state.splitRatio) {
              setSplitRatio(state.splitRatio);
            }
            if (state.error) {
              setError(state.error);
            }
            if (state.schema) {
              setSchema(state.schema);
            }
            if (state.schemaConfig) {
              setSchemaConfig(state.schemaConfig);
            }

            // Mark as initialized if we have restored state
            if (state.queryText) {
              setInitialQuerySent(true);
            }

            // Don't request sample query if we have restored query text
            if (state.queryText) {
              break;
            }
          }

          // Store schema for backend query generation (via requestSampleQuery)
          if (message.schema) {
            console.log('Received schema data for initialData');
            try {
              // Store schema for future use
              setSchema(message.schema);

              // If GraphQL introspection was provided by backend, configure monaco-graphql now
              if (message.introspection && message.introspection.__schema) {
                const introspectionJSON = message.introspection;
                setSchemaConfig({
                  uri: 'weaviate://graphql',
                  schema: message.schema,
                  fileMatch: ['weaviate://graphql/**', '**/*.graphql', '**/*.gql'],
                  introspectionJSON,
                });
              }

              // We'll get the query from backend
              if (message.collection && !initialQuerySent) {
                // Request a sample query if one wasn't sent already
                vscode.postMessage({
                  type: 'requestSampleQuery',
                  collection: message.collection,
                });
                setInitialQuerySent(true); // Mark that we've requested an initial query
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
          setIsStopping(false);

          try {
            const extractedData = extractWeaviateData(message.data, message.collection);
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

        case 'queryCancelled':
          console.log('Query cancelled');
          setIsStopping(false);
          setIsLoading(false);
          setError(null);
          break;

        case 'sampleQuery':
          // Handle sample query message from backend
          console.log('Received sampleQuery message:', message);
          if (message.data && message.data.sampleQuery) {
            setQueryText(message.data.sampleQuery);
            console.log('Query text state updated with sample query');
          } else {
            console.warn(
              'Received sampleQuery message but no query was included. Full message:',
              message
            );
          }
          setIsLoading(false);
          break;

        case 'queryError':
        case 'explainError': // Restored handler for explainError
          // Display error message from failed query
          console.error(`${message.type}:`, message.error);
          setError(message.error || 'Unknown query error');
          setErrorDetails(message.details || null);
          setErrorId(message.errorId || null);
          errorBufferRef.current = '';
          setShowErrorDetails(false);
          setIsLoading(false);
          break;

        case 'errorDetailsChunk': {
          if (message.errorId && message.chunk !== null && message.chunk !== undefined) {
            errorBufferRef.current += String(message.chunk);
          }
          break;
        }

        case 'errorDetailsEnd': {
          if (message.errorId) {
            // If there was an error retrieving details, surface that
            if (message.error) {
              setErrorDetails(`Failed to load details: ${message.error}`);
            } else {
              setErrorDetails(errorBufferRef.current);
            }
            setLoadingDetails(false);
          }
          break;
        }

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
          console.log(
            'Processing schema from schemaResult:',
            message.schema ? 'Schema received' : 'No schema received'
          );
          try {
            // Log some info about the schema structure
            console.log('Schema keys:', Object.keys(message.schema));
            if (message.schema.classes) {
              console.log('Classes count:', message.schema.classes.length);
              const matchingClass = message.schema.classes.find(
                (c: any) => c.class === message.collection
              );
              if (matchingClass) {
                console.log(
                  'Found matching class with properties:',
                  matchingClass.properties?.length || 0
                );
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
                            kind: 'SCALAR',
                          },
                          description:
                            prop.description || `${prop.name} (${prop.dataType.join(', ')})`,
                        })),
                      ],
                    })),
                  ],
                },
              };

              // Set the schema configuration for the Monaco editor
              setSchemaConfig({
                uri: 'weaviate://graphql',
                schema: message.schema,
                fileMatch: ['*.graphql', '*.gql'],
                introspectionJSON,
              });
            }

            // We'll rely on backend for query generation
            if (message.collection && !initialQuerySent) {
              // Request a sample query if one wasn't sent already
              vscode.postMessage({
                type: 'requestSampleQuery',
                collection: message.collection,
              });
              setInitialQuerySent(true); // Mark that we've requested an initial query
            }
          } catch (err) {
            console.error('Error processing schema in schemaResult:', err);
          }

          setTitle(`Schema: ${message.collection}`);
          setError(null);
          setIsLoading(false);
          break;

        case 'runQueryShortcut':
          handleRunQuery();
          break;

        case 'stopQueryShortcut':
          handleCancelQuery();
          break;

        case 'clearQueryShortcut':
          if (!isLoading && !isStopping) {
            setQueryText('');
            setJsonData(null);
            setError(null);
          }
          break;

        case 'connectionStatusChanged':
          // Handle connection status changes
          setIsConnected(message.isConnected);
          if (!message.isConnected) {
            // Show a clear message when disconnected
            setError(CONNECTION_ERROR_MESSAGE);
          } else if (error === CONNECTION_ERROR_MESSAGE) {
            // Clear the disconnection error if we reconnect
            setError(null);
          }
          break;

        case 'ping':
          // Respond to backend ping to indicate webview is alive
          if (vscode) {
            vscode.postMessage({ type: 'pong' });
          }
          break;

        default:
          console.log('Unknown message type:', message?.type);
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
    color: 'var(--vscode-errorForeground, #e74c3c)',
    backgroundColor: 'var(--vscode-inputValidation-errorBackground, rgba(231, 76, 60, 0.1))',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '20px',
    border: '1px solid var(--vscode-inputValidation-errorBorder, rgba(231, 76, 60, 0.3))',
  };

  // Load indicator styling
  const loadingStyle: React.CSSProperties = {
    color: 'var(--vscode-progressBar-background, #3498db)',
    marginBottom: '20px',
  };

  return (
    <div style={styles.container}>
      {/* Display error messages if present */}
      {error && (
        <div style={styles.error}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <strong>Error:</strong> {error}
            </div>
            {(errorDetails || errorId) && (
              <>
                <button
                  style={{
                    ...styles.button,
                    padding: '2px 8px',
                    height: '24px',
                    fontSize: '12px',
                    backgroundColor: 'var(--vscode-input-background, #2D2D2D)',
                    color: 'var(--vscode-input-foreground, #E0E0E0)',
                    border: '1px solid var(--vscode-input-border, #444)',
                  }}
                  onClick={() => {
                    const next = !showErrorDetails;
                    setShowErrorDetails(next);
                    if (next && !errorDetails && errorId && vscode) {
                      setLoadingDetails(true);
                      vscode.postMessage({ type: 'requestErrorDetails', errorId });
                    }
                  }}
                >
                  {showErrorDetails ? 'Hide details' : 'Show details'}
                </button>
                <button
                  style={{
                    ...styles.button,
                    padding: '2px 8px',
                    height: '24px',
                    fontSize: '12px',
                    backgroundColor: 'var(--vscode-input-background, #2D2D2D)',
                    color: 'var(--vscode-input-foreground, #E0E0E0)',
                    border: '1px solid var(--vscode-input-border, #444)',
                  }}
                  onClick={() => {
                    if (vscode) {
                      const textToCopy = errorDetails || error || '';
                      vscode.postMessage({ type: 'copyToClipboard', text: textToCopy });
                    }
                  }}
                >
                  Copy
                </button>
                <button
                  style={{
                    ...styles.button,
                    padding: '2px 8px',
                    height: '24px',
                    fontSize: '12px',
                    backgroundColor: 'var(--vscode-input-background, #2D2D2D)',
                    color: 'var(--vscode-input-foreground, #E0E0E0)',
                    border: '1px solid var(--vscode-input-border, #444)',
                  }}
                  onClick={() => {
                    if (vscode) {
                      vscode.postMessage({ type: 'openOutput' });
                    }
                  }}
                >
                  Open Output
                </button>
              </>
            )}
          </div>
          {showErrorDetails && (
            <pre
              style={{
                marginTop: 8,
                maxHeight: 200,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {loadingDetails
                ? 'Loading full error details…'
                : errorDetails || 'No additional details available.'}
            </pre>
          )}
        </div>
      )}

      {/* Resizable split layout with GraphQL editor and query results */}
      <div style={{ height: 'calc(100vh - 20px)', overflow: 'hidden' }}>
        <ResizableSplitter
          direction="vertical"
          initialSplit={splitRatio}
          minSize={20}
          onSplitChange={(newSplit) => setSplitRatio(newSplit)}
        >
          {/* GraphQL Query Editor Section */}
          <div style={styles.queryContainer}>
            <div style={styles.queryHeader}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color:
                    'var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                  background: 'var(--vscode-editorWidget-background, #1a1d21)',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  marginRight: '8px',
                  display: 'inline-block',
                  minWidth: '140px',
                }}
              >
                GraphQL Query{collection ? ` (${collection})` : ''}
              </span>

              {/* Schema readiness indicator */}
              {/* Status items will be shown inside toolbar on the right */}

              {/* Template and Run buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Connection and schema status (compact) */}
                {connectionInfo && (
                  <span
                    title={connectionInfo.endpoint ? `Endpoint: ${connectionInfo.endpoint}` : ''}
                    style={{
                      fontSize: '12px',
                      color: 'var(--vscode-descriptionForeground, #999)',
                      marginRight: 6,
                    }}
                  >
                    {connectionInfo.name}
                  </span>
                )}
                {schemaConfig && (
                  <span
                    title={
                      schemaReady ? 'Schema-based language features active' : 'Applying schema…'
                    }
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: schemaReady
                        ? 'var(--vscode-testing-iconPassed, #89d185)'
                        : 'var(--vscode-descriptionForeground, #bbb)',
                      marginRight: 8,
                    }}
                  />
                )}
                {/* Template Dropdown */}
                <div className="template-dropdown-container" style={{ position: 'relative' }}>
                  <button
                    onClick={handleToggleTemplateDropdown}
                    disabled={!collection || !isConnected}
                    title={
                      !isConnected
                        ? 'Not connected to Weaviate'
                        : collection
                          ? 'Choose a query template'
                          : 'Select a collection first'
                    }
                    style={{
                      backgroundColor: 'var(--vscode-input-background, #2D2D2D)',
                      color:
                        collection && isConnected
                          ? 'var(--vscode-input-foreground, #E0E0E0)'
                          : 'var(--vscode-descriptionForeground, #888)',
                      border: '1px solid var(--vscode-input-border, #444)',
                      borderRadius: '3px',
                      padding: '4px 10px',
                      fontSize: '13px',
                      fontWeight: 500,
                      height: '28px',
                      minWidth: '42px',
                      cursor: collection && isConnected ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (collection && isConnected) {
                        e.currentTarget.style.backgroundColor =
                          'var(--vscode-list-hoverBackground, #3A3A3A)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (collection && isConnected) {
                        e.currentTarget.style.backgroundColor =
                          'var(--vscode-input-background, #2D2D2D)';
                      }
                    }}
                  >
                    📋 Templates
                    <span style={{ fontSize: '9px' }}>▼</span>
                  </button>

                  {/* Template Dropdown Menu - positioned relative to button */}
                  {showTemplateDropdown && collection && isConnected && (
                    <div
                      className="template-dropdown-menu theme-dropdown"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: '0',
                        marginTop: '2px',
                        backgroundColor:
                          'var(--vscode-dropdown-background, var(--vscode-editor-background, #2D2D2D))',
                        border:
                          '1px solid var(--vscode-widget-border, var(--vscode-input-border, #444))',
                        borderRadius: '4px',
                        boxShadow:
                          '0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        zIndex: 1000,
                        minWidth: '320px',
                        maxWidth: '400px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        fontSize: '12px',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                      }}
                    >
                      {/* Dropdown Header */}
                      <div
                        className="template-dropdown-header theme-dropdown-header"
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--vscode-panel-border, #333)',
                          backgroundColor:
                            'var(--vscode-editorWidget-background, var(--vscode-editor-background, #2D2D2D))',
                          color:
                            'var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                          fontWeight: 600,
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Query Templates for {collection}
                      </div>

                      {/* Template Options */}
                      {[
                        {
                          name: 'Schema-based Sample',
                          description:
                            'Auto-generated query using actual collection properties and schema',
                        },
                        ...require('../query-editor/webview/graphqlTemplates').queryTemplates,
                      ].map((template, index) => (
                        <div
                          key={index}
                          className="template-dropdown-item theme-dropdown-item"
                          onClick={() => handleTemplateSelect(template.name)}
                          title={template.description}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom:
                              index < 7 ? '1px solid var(--vscode-panel-border, #333)' : 'none',
                            backgroundColor: 'transparent',
                            color: 'var(--vscode-foreground, #CCCCCC)',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.06))';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div
                            className="template-title"
                            style={{
                              fontWeight: 500,
                              marginBottom: '3px',
                              color:
                                'var(--vscode-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {template.name === 'Schema-based Sample' && <span>⭐</span>}
                            {template.name}
                          </div>
                          <div
                            className="template-description"
                            style={{
                              fontSize: '11px',
                              color: 'var(--vscode-descriptionForeground, #999)',
                              lineHeight: '1.4',
                            }}
                          >
                            {template.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isLoading ? (
                  <button
                    onClick={handleCancelQuery}
                    disabled={isStopping}
                    title={isStopping ? 'Stopping…' : 'Stop the running query (Esc)'}
                    style={{
                      backgroundColor: 'var(--vscode-statusBarItem-errorBackground, #c72e0f)',
                      color: 'var(--vscode-button-foreground, #ffffff)',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '4px 10px',
                      fontSize: '13px',
                      fontWeight: 500,
                      height: '28px',
                      minWidth: '42px',
                      cursor: isStopping ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'var(--vscode-statusBarItem-errorBackground, #a1260d)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'var(--vscode-statusBarItem-errorBackground, #c72e0f)';
                    }}
                  >
                    ■ {isStopping ? 'Stopping…' : 'Stop'}
                  </button>
                ) : (
                  <button
                    onClick={handleRunQuery}
                    disabled={!collection}
                    title={
                      collection
                        ? 'Execute the GraphQL query (Ctrl/Cmd+Enter)'
                        : 'Select a collection first'
                    }
                    style={{
                      backgroundColor: collection
                        ? 'var(--vscode-button-background, #0E639C)'
                        : 'var(--vscode-input-background, #2D2D2D)',
                      color: collection
                        ? 'var(--vscode-button-foreground, white)'
                        : 'var(--vscode-descriptionForeground, #888)',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '4px 10px',
                      fontSize: '13px',
                      fontWeight: 500,
                      height: '28px',
                      minWidth: '42px',
                      cursor: collection ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (collection) {
                        e.currentTarget.style.backgroundColor =
                          'var(--vscode-button-hoverBackground, #1177bb)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (collection) {
                        e.currentTarget.style.backgroundColor =
                          'var(--vscode-button-background, #0E639C)';
                      }
                    }}
                  >
                    ▶ Run
                  </button>
                )}

                {/* Clear Button */}
                <button
                  onClick={() => {
                    setQueryText('');
                    setJsonData(null);
                    setError(null);
                  }}
                  disabled={isLoading || isStopping}
                  title={
                    isLoading || isStopping
                      ? 'Unavailable while running'
                      : 'Clear query (Ctrl/Cmd+K)'
                  }
                  style={{
                    backgroundColor: 'var(--vscode-input-background, #2D2D2D)',
                    color: 'var(--vscode-input-foreground, #E0E0E0)',
                    border: '1px solid var(--vscode-input-border, #444)',
                    borderRadius: '3px',
                    padding: '4px 10px',
                    fontSize: '13px',
                    height: '28px',
                    cursor: isLoading || isStopping ? 'not-allowed' : 'pointer',
                  }}
                >
                  🧹 Clear
                </button>

                {/* Shortcuts legend (tooltip only) */}
                <span
                  title={
                    'Shortcuts:\n' +
                    '• Run: Ctrl/Cmd+Enter\n' +
                    '• Stop: Esc\n' +
                    '• Clear: Ctrl/Cmd+K\n\n' +
                    'Features:\n' +
                    '• Templates menu: quickly insert common queries\n' +
                    '• Schema-aware autocomplete (monaco-graphql) when schema is available\n' +
                    '• Field/type suggestions, validation, and inline errors\n' +
                    '• Sample query generation based on your collection'
                  }
                  style={{
                    color: 'var(--vscode-descriptionForeground, #999)',
                    fontSize: '14px',
                    padding: '0 6px',
                    userSelect: 'none',
                    cursor: 'default',
                  }}
                  aria-label="Keyboard shortcuts and features"
                >
                  ⓘ
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: '150px', height: 'calc(100% - 30px)' }}>
              <MonacoGraphQLEditor
                initialValue={queryText}
                onChange={(value) => setQueryText(value)}
                onGenerateSample={handleGenerateQuery}
                schemaConfig={schemaConfig}
                collectionName={collection || undefined}
                showTemplateDropdown={showTemplateDropdown}
                onToggleTemplateDropdown={handleToggleTemplateDropdown}
                onTemplateSelect={handleTemplateSelect}
                onLanguageReady={(ready) => setSchemaReady(ready)}
              />
            </div>
          </div>

          {/* Query Results Section */}
          <div style={styles.resultContainer}>
            <div style={styles.resultHeader}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color:
                    'var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                  background: 'var(--vscode-editorWidget-background, #1a1d21)',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  marginRight: '8px',
                  display: 'inline-block',
                  minWidth: '140px',
                }}
              >
                {jsonData ? 'Results Data loaded' : 'Results'}
              </span>
              {isLoading && <span style={styles.loading}>⏳ Executing query...</span>}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  style={{
                    ...styles.button,
                    backgroundColor:
                      viewType === 'json'
                        ? 'var(--vscode-button-background, #0E639C)'
                        : 'var(--vscode-input-background, #2D2D2D)',
                    border:
                      viewType === 'json' ? 'none' : '1px solid var(--vscode-input-border, #444)',
                    color:
                      viewType === 'json'
                        ? 'var(--vscode-button-foreground, white)'
                        : 'var(--vscode-input-foreground, #E0E0E0)',
                    transition: 'background-color 0.2s ease',
                    fontSize: '14px',
                    fontWeight: 500,
                    padding: '6px 12px',
                    height: '32px',
                    minWidth: '48px',
                  }}
                  onClick={() => setViewType('json')}
                  onMouseEnter={(e) => {
                    if (viewType !== 'json') {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-list-hoverBackground, #3A3A3A)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewType !== 'json') {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-input-background, #2D2D2D)';
                    }
                  }}
                >
                  📄 JSON
                </button>
                <button
                  style={{
                    ...styles.button,
                    backgroundColor:
                      viewType === 'table'
                        ? 'var(--vscode-button-background, #0E639C)'
                        : 'var(--vscode-input-background, #2D2D2D)',
                    border:
                      viewType === 'table' ? 'none' : '1px solid var(--vscode-input-border, #444)',
                    color:
                      viewType === 'table'
                        ? 'var(--vscode-button-foreground, white)'
                        : 'var(--vscode-input-foreground, #E0E0E0)',
                    transition: 'background-color 0.2s ease',
                    fontSize: '14px',
                    fontWeight: 500,
                    padding: '6px 12px',
                    height: '32px',
                    minWidth: '48px',
                  }}
                  onClick={() => setViewType('table')}
                  onMouseEnter={(e) => {
                    if (viewType !== 'table') {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-list-hoverBackground, #3A3A3A)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewType !== 'table') {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-input-background, #2D2D2D)';
                    }
                  }}
                >
                  📋 Table
                </button>
              </div>
            </div>

            {/* Display data in selected format when available */}
            <div style={{ flex: 1, overflow: 'auto', height: 'calc(100% - 30px)' }}>
              {jsonData ? (
                viewType === 'json' ? (
                  <div style={styles.jsonContainer}>
                    {/* Check if we have an empty result with just _errors array */}
                    {jsonData._errors !== undefined &&
                    Object.keys(jsonData).length === 1 &&
                    jsonData._errors.length === 0 ? (
                      <div style={styles.emptyState}>
                        <p>📭 No data found in collection: {collection}</p>
                        <p>This collection exists but appears to be empty.</p>
                        <p
                          style={{
                            fontSize: '14px',
                            color: 'var(--vscode-descriptionForeground, #888)',
                          }}
                        >
                          💡 Try adding some data to this collection or select a different
                          collection.
                        </p>
                      </div>
                    ) : (
                      /* Use a simple pre-formatted JSON display as a reliable fallback */
                      <pre
                        style={{
                          backgroundColor: 'var(--vscode-editor-background, #252526)',
                          color: 'var(--vscode-editor-foreground, #D4D4D4)',
                          padding: '12px',
                          borderRadius: '4px',
                          fontFamily: 'var(--vscode-editor-font-family, monospace)',
                          overflow: 'auto',
                          height: '100%',
                        }}
                      >
                        {JSON.stringify(jsonData, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  collection && <ResultsTable data={jsonData} collectionName={collection} />
                )
              ) : (
                <div style={styles.emptyState}>
                  <p>🚀 Ready to execute your first query</p>
                  {collection ? (
                    <p>
                      Try running a query for collection: <strong>{collection}</strong>
                    </p>
                  ) : (
                    <p>Select a collection from the sidebar to get started</p>
                  )}
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--vscode-descriptionForeground, #888)',
                      marginTop: '10px',
                    }}
                  >
                    💡 Use the "Sample" button to generate example queries
                  </p>
                </div>
              )}
            </div>
          </div>
        </ResizableSplitter>
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
