import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { MonacoGraphQLEditor } from './MonacoGraphQLEditor';
import ResultsTable from './components/ResultsTable';
import * as monaco from 'monaco-editor';
import { queryTemplates, processTemplate } from '../query-editor/webview/graphqlTemplates';

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

// Resizable Splitter Component
const ResizableSplitter: React.FC<{
  children: [React.ReactNode, React.ReactNode];
  direction?: 'horizontal' | 'vertical';
  initialSplit?: number;
  minSize?: number;
  onSplitChange?: (split: number) => void;
}> = ({ 
  children, 
  direction = 'vertical', 
  initialSplit = 50, 
  minSize = 20,
  onSplitChange 
}) => {
  const [split, setSplit] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

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
        userSelect: isDragging ? 'none' : 'auto'
      }}
    >
      <div style={firstPaneStyle}>
        {children[0]}
      </div>
      <div 
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.04))';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      />
      <div style={secondPaneStyle}>
        {children[1]}
      </div>
    </div>
  );
};

// Styles using VS Code theme variables for proper theme integration
const styles = {
  container: {
    padding: '0',
    fontFamily: 'var(--vscode-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", monospace)',
    height: '100vh',
    overflow: 'auto',
    backgroundColor: 'var(--vscode-editor-background, #1E1E1E)',
    color: 'var(--vscode-editor-foreground, #D4D4D4)',
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0'
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
    backgroundColor: 'var(--vscode-titleBar-activeBackground, var(--vscode-sideBar-background, #252526))'
  },
  splitContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
    height: 'calc(100vh - 50px)'
  },
  queryContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
    height: '100%'
  },
  queryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeft: '3px solid var(--vscode-button-background, #0E639C)',
    padding: '6px 8px',
    marginBottom: '0',
    backgroundColor: 'var(--vscode-sideBar-background, var(--vscode-editor-background, #252526))',
    color: 'var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #CCCCCC))'
  },
  resultContainer: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '0',
    height: '100%',
    overflow: 'hidden'
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeft: '3px solid var(--vscode-button-background, #0E639C)',
    padding: '6px 8px',
    backgroundColor: 'var(--vscode-sideBar-background, var(--vscode-editor-background, #252526))',
    color: 'var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #CCCCCC))'
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
    overflowY: 'auto' as 'auto'
  },
  jsonContainer: {
    borderRadius: '0',
    padding: '12px',
    overflow: 'auto',
    backgroundColor: 'var(--vscode-editor-background, #252526)',
    flex: '1',
    minHeight: '200px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground, #666)',
    textAlign: 'center' as 'center'
  },
  button: {
    backgroundColor: 'var(--vscode-button-background, #0E639C)',
    color: 'var(--vscode-button-foreground, white)',
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
    color: 'var(--vscode-errorForeground, #e74c3c)',
    backgroundColor: 'var(--vscode-inputValidation-errorBackground, rgba(231, 76, 60, 0.1))',
    padding: '6px 10px',
    borderRadius: '4px',
    marginBottom: '6px',
    border: '1px solid var(--vscode-inputValidation-errorBorder, rgba(231, 76, 60, 0.3))'
  },
  loading: {
    color: 'var(--vscode-progressBar-background, #3498db)',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
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
  const [viewType, setViewType] = useState<'json' | 'table'>('table');
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState<boolean>(false);

  // Request a default query from the backend when collection is set and query is empty
  useEffect(() => {
    if (collection && !queryText && !initialQuerySent && vscode) {
      // Request sample query from backend instead of generating it here
      vscode.postMessage({ 
        type: 'requestSampleQuery', 
        collection: collection 
      });
      setInitialQuerySent(true);  // Mark that we've requested an initial query
    }
  }, [collection, queryText, initialQuerySent]);

  // Handle query execution
  const handleRunQuery = () => {
    if (!queryText.trim()) {
      setError('Please enter a GraphQL query');
      return;
    }

    setIsLoading(true);
    setError(null);

    if (vscode) {
      vscode.postMessage({ 
        type: 'runQuery', 
        query: queryText,
        collection: collection 
      });
    }
  };

  // Handle sample query generation
  const handleGenerateQuery = () => {
    if (!collection) {
      setError('No collection selected');
      return;
    }

    if (vscode) {
      vscode.postMessage({ 
        type: 'requestSampleQuery', 
        collection: collection 
      });
    }
  };

  // Handle template dropdown toggle
  const handleToggleTemplateDropdown = () => {
    setShowTemplateDropdown(!showTemplateDropdown);
  };

  // Handle template selection
  const handleTemplateSelect = async (templateName: string) => {
    setShowTemplateDropdown(false);
    if (templateName === 'Schema-based Sample') {
      // Show loading placeholder in the editor
      setQueryText('Loading sample query...');
      // Request auto-generated sample from backend
      handleGenerateQuery();
    } else {
      // Find the template and process it
      const template = queryTemplates.find(t => t.name === templateName);
      if (template) {
        const processed = await processTemplate(template.template, collection || '');
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
          console.log('Received sampleQuery message:', message);
          if (message.data && message.data.sampleQuery) {
            setQueryText(message.data.sampleQuery);
            console.log('Query text state updated with sample query');
          } else {
            console.warn('Received sampleQuery message but no query was included. Full message:', message);
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
          <strong>Error:</strong> {error}
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
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                background: 'var(--vscode-editorWidget-background, #1a1d21)',
                padding: '4px 12px',
                borderRadius: '4px',
                marginRight: '8px',
                display: 'inline-block',
                minWidth: '140px'
              }}>
                GraphQL Query{collection ? ` (${collection})` : ''}
              </span>
              
              {/* Template and Run buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Template Dropdown */}
                <div className="template-dropdown-container" style={{ position: 'relative' }}>
                  <button
                    onClick={handleToggleTemplateDropdown}
                    disabled={!collection}
                    title={collection ? "Choose a query template" : "Select a collection first"}
                    style={{
                      backgroundColor: 'var(--vscode-input-background, #2D2D2D)',
                      color: collection ? 'var(--vscode-input-foreground, #E0E0E0)' : 'var(--vscode-descriptionForeground, #888)',
                      border: '1px solid var(--vscode-input-border, #444)',
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
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (collection) {
                        e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, #3A3A3A)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (collection) {
                        e.currentTarget.style.backgroundColor = 'var(--vscode-input-background, #2D2D2D)';
                      }
                    }}
                  >
                    📋 Templates
                    <span style={{ fontSize: '9px' }}>▼</span>
                  </button>
                  
                  {/* Template Dropdown Menu - positioned relative to button */}
                  {showTemplateDropdown && collection && (
                    <div className="template-dropdown-menu theme-dropdown" style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      marginTop: '2px',
                      backgroundColor: 'var(--vscode-dropdown-background, var(--vscode-editor-background, #2D2D2D))',
                      border: '1px solid var(--vscode-widget-border, var(--vscode-input-border, #444))',
                      borderRadius: '4px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                      zIndex: 1000,
                      minWidth: '320px',
                      maxWidth: '400px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      fontSize: '12px',
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)'
                    }}>
                      {/* Dropdown Header */}
                      <div className="template-dropdown-header theme-dropdown-header" style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--vscode-panel-border, #333)',
                        backgroundColor: 'var(--vscode-editorWidget-background, var(--vscode-editor-background, #2D2D2D))',
                        color: 'var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                        fontWeight: 600,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Query Templates for {collection}
                      </div>
                      
                      {/* Template Options */}
                      {[
                        {
                          name: 'Schema-based Sample',
                          description: 'Auto-generated query using actual collection properties and schema'
                        },
                        ...require('../query-editor/webview/graphqlTemplates').queryTemplates
                      ].map((template, index) => (
                        <div
                          key={index}
                          className="template-dropdown-item theme-dropdown-item"
                          onClick={() => handleTemplateSelect(template.name)}
                          title={template.description}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: index < 7 ? '1px solid var(--vscode-panel-border, #333)' : 'none',
                            backgroundColor: 'transparent',
                            color: 'var(--vscode-foreground, #CCCCCC)',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.06))';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div className="template-title" style={{ 
                            fontWeight: 500,
                            marginBottom: '3px',
                            color: 'var(--vscode-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {template.name === 'Schema-based Sample' && <span>⭐</span>}
                            {template.name}
                          </div>
                          <div className="template-description" style={{ 
                            fontSize: '11px',
                            color: 'var(--vscode-descriptionForeground, #999)',
                            lineHeight: '1.4'
                          }}>
                            {template.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleRunQuery}
                  disabled={!collection}
                  title={collection ? "Execute the GraphQL query" : "Select a collection first"}
                  style={{
                    backgroundColor: collection ? 'var(--vscode-button-background, #0E639C)' : 'var(--vscode-input-background, #2D2D2D)',
                    color: collection ? 'var(--vscode-button-foreground, white)' : 'var(--vscode-descriptionForeground, #888)',
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
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (collection) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground, #1177bb)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (collection) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-background, #0E639C)';
                    }
                  }}
                >
                  ▶ Run
                </button>
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
              />
            </div>
          </div>

          {/* Query Results Section */}
          <div style={styles.resultContainer}>
            <div style={styles.resultHeader}>
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #CCCCCC))',
                background: 'var(--vscode-editorWidget-background, #1a1d21)',
                padding: '4px 12px',
                borderRadius: '4px',
                marginRight: '8px',
                display: 'inline-block',
                minWidth: '140px'
              }}>
                {jsonData ? 'Results Data loaded' : 'Results'}
              </span>
              {isLoading && <span style={styles.loading}>⏳ Executing query...</span>}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  style={{
                    ...styles.button,
                    backgroundColor: viewType === 'json' ? 'var(--vscode-button-background, #0E639C)' : 'var(--vscode-input-background, #2D2D2D)',
                    border: viewType === 'json' ? 'none' : '1px solid var(--vscode-input-border, #444)',
                    color: viewType === 'json' ? 'var(--vscode-button-foreground, white)' : 'var(--vscode-input-foreground, #E0E0E0)',
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
                      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, #3A3A3A)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewType !== 'json') {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-input-background, #2D2D2D)';
                    }
                  }}
                >
                  📄 JSON
                </button>
                <button 
                  style={{
                    ...styles.button,
                    backgroundColor: viewType === 'table' ? 'var(--vscode-button-background, #0E639C)' : 'var(--vscode-input-background, #2D2D2D)',
                    border: viewType === 'table' ? 'none' : '1px solid var(--vscode-input-border, #444)',
                    color: viewType === 'table' ? 'var(--vscode-button-foreground, white)' : 'var(--vscode-input-foreground, #E0E0E0)',
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
                      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, #3A3A3A)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewType !== 'table') {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-input-background, #2D2D2D)';
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
                    {jsonData._errors !== undefined && Object.keys(jsonData).length === 1 && jsonData._errors.length === 0 ? (
                      <div style={styles.emptyState}>
                        <p>📭 No data found in collection: {collection}</p>
                        <p>This collection exists but appears to be empty.</p>
                        <p style={{ fontSize: '14px', color: 'var(--vscode-descriptionForeground, #888)' }}>
                          💡 Try adding some data to this collection or select a different collection.
                        </p>
                      </div>
                    ) : (
                      /* Use a simple pre-formatted JSON display as a reliable fallback */
                      <pre style={{
                        backgroundColor: 'var(--vscode-editor-background, #252526)',
                        color: 'var(--vscode-editor-foreground, #D4D4D4)',
                        padding: '12px',
                        borderRadius: '4px',
                        fontFamily: 'var(--vscode-editor-font-family, monospace)',
                        overflow: 'auto',
                        height: '100%'
                      }}>
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
                    <p>Try running a query for collection: <strong>{collection}</strong></p>
                  ) : (
                    <p>Select a collection from the sidebar to get started</p>
                  )}
                  <p style={{ fontSize: '14px', color: 'var(--vscode-descriptionForeground, #888)', marginTop: '10px' }}>
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
