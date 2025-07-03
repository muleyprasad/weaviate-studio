import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { GraphQLEditor } from '../query-editor/webview/GraphQLEditor';
import { queryTemplates, processTemplate } from '../query-editor/webview/graphqlTemplates';
import ErrorBoundary from './ErrorBoundary';
import LoadingIndicator from './LoadingIndicator';

interface MonacoGraphQLEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  onGenerateSample: () => void;
  schemaConfig?: any;
  collectionName?: string;
}

/**
 * Monaco-based GraphQL editor component for Weaviate Studio
 */
export const MonacoGraphQLEditor: React.FC<MonacoGraphQLEditorProps> = ({
  initialValue,
  onChange,
  onRunQuery,
  onGenerateSample,
  schemaConfig,
  collectionName
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<GraphQLEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing editor...');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  // Initialize editor when component mounts
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      setIsLoading(true);
      setLoadingMessage('Initializing editor...');
      
      try {
        const editor = new GraphQLEditor(containerRef.current, initialValue);
        
                  const handleEditorDidMount = (editor: GraphQLEditor) => {
          editorRef.current = editor;
          setIsEditorReady(true);
          setIsLoading(false);
          
          // Register change listener using our custom method
          editor.onDidChangeModelContent((newValue: string) => {
            // Update parent with new content
            onChange(newValue);
            
            // Trigger parameter validation
            editor.validateQueryParameters();
          });
          
          // Initial validation
          editor.validateQueryParameters();
          
          // Set initial value if provided
          if (initialValue) {
            editor.setValue(initialValue);
          }
          
          // Update theme to match VS Code (delay to ensure proper initialization)
          setTimeout(() => {
            editor.updateTheme();
          }, 100);
        };
        
        handleEditorDidMount(editor);
      } catch (error) {
        console.error('Error initializing Monaco editor:', error);
        setIsLoading(false);
        throw error; // Let the error boundary catch this
      }
    }

    return () => {
      // Clean up editor when component unmounts
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  // Configure GraphQL schema when it changes
  useEffect(() => {
    if (isEditorReady && editorRef.current && schemaConfig) {
      setIsLoading(true);
      setLoadingMessage('Configuring GraphQL language features...');
      
              editorRef.current.configureGraphQLLanguage(schemaConfig)
        .then(() => {
          // Update theme after configuration
          editorRef.current?.updateTheme();
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Error configuring GraphQL language:', error);
          setIsLoading(false);
        });
    }
  }, [isEditorReady, schemaConfig]);

  // Update editor value when initialValue prop changes
  useEffect(() => {
    if (isEditorReady && editorRef.current && initialValue !== editorRef.current.getValue()) {
      editorRef.current.setValue(initialValue);
    }
  }, [initialValue, isEditorReady]);

  // Set collection name when it changes
  useEffect(() => {
    if (editorRef.current && collectionName) {
      editorRef.current.setCollectionName(collectionName);
    }
  }, [collectionName, editorRef]);

  // Handle template selection
  const handleTemplateSelect = (templateName: string) => {
    if (templateName === 'Schema-based Sample') {
      // This is the special auto-generated sample - request it from backend
      onGenerateSample();
    } else {
      // Regular template - process it locally
      if (editorRef.current) {
        editorRef.current.insertTemplate(templateName);
      }
    }
    setShowTemplateDropdown(false);
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

  // Create enhanced template list with the schema-based sample as first option
  const enhancedTemplates = [
    {
      name: 'Schema-based Sample',
      description: 'Auto-generated query using actual collection properties and schema'
    },
    ...queryTemplates
  ];

  return (
    <ErrorBoundary>
      <div className="monaco-graphql-editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        {/* Simple toolbar with essential controls */}
        <div className="editor-toolbar" style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px 10px',
          backgroundColor: 'var(--vscode-editor-background, #1E1E1E)',
          borderBottom: '1px solid var(--vscode-panel-border, #333)'
        }}>
          <div className="right-tools" style={{ display: 'flex', alignItems: 'center' }}>
            {/* Template Dropdown */}
            <div className="template-dropdown-container" style={{ position: 'relative', marginRight: '8px' }}>
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                disabled={!collectionName}
                title={collectionName ? "Choose a query template" : "Select a collection first"}
                style={{
                  backgroundColor: 'var(--vscode-button-secondaryBackground, #2D2D2D)',
                  color: collectionName ? 'var(--vscode-button-secondaryForeground, #E0E0E0)' : 'var(--vscode-descriptionForeground, #888)',
                  border: '1px solid var(--vscode-widget-border, #444)',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  height: '24px',
                  cursor: collectionName ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                📋 Templates
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              
              {/* Dropdown Menu */}
              {showTemplateDropdown && collectionName && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  backgroundColor: 'var(--vscode-dropdown-background, #2D2D2D)',
                  border: '1px solid var(--vscode-widget-border, #444)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                  zIndex: 1000,
                  minWidth: '320px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  fontSize: '12px'
                }}>
                  {/* Dropdown Header */}
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--vscode-panel-border, #333)',
                    backgroundColor: 'var(--vscode-list-hoverBackground, #2A2D2E)',
                    color: 'var(--vscode-list-activeSelectionForeground, #FFFFFF)',
                    fontWeight: 600,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Query Templates for {collectionName}
                  </div>
                  
                  {/* Template Options */}
                  {enhancedTemplates.map((template, index) => (
                    <div
                      key={index}
                      onClick={() => handleTemplateSelect(template.name)}
                      title={template.description}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: index < enhancedTemplates.length - 1 ? '1px solid var(--vscode-panel-border, #333)' : 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--vscode-foreground, #CCCCCC)',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, #2A2D2E)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ 
                        fontWeight: 500,
                        marginBottom: '2px',
                        color: 'var(--vscode-list-activeSelectionForeground, #FFFFFF)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {template.name === 'Schema-based Sample' && <span>⭐</span>}
                        {template.name}
                      </div>
                      <div style={{ 
                        fontSize: '11px',
                        color: 'var(--vscode-descriptionForeground, #888)',
                        lineHeight: '1.3'
                      }}>
                        {template.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={onRunQuery}
              disabled={!collectionName}
              title={collectionName ? "Execute the GraphQL query" : "Select a collection first"}
              style={{
                backgroundColor: collectionName ? 'var(--vscode-button-background, #0E639C)' : 'var(--vscode-button-secondaryBackground, #2D2D2D)',
                color: collectionName ? 'var(--vscode-button-foreground, white)' : 'var(--vscode-descriptionForeground, #888)',
                border: 'none',
                borderRadius: '3px',
                padding: '3px 12px',
                fontSize: '12px',
                fontWeight: 500,
                height: '24px',
                cursor: collectionName ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ▶ Run
            </button>
          </div>
        </div>
        
        {/* Editor container */}
        <div 
          ref={containerRef} 
          className="monaco-editor-container"
          style={{ 
            flex: 1, 
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--vscode-panel-border, #333)',
            borderTop: 'none',
            minHeight: '200px'
          }}
        />
        
        <LoadingIndicator isVisible={isLoading} message={loadingMessage} />
      </div>
    </ErrorBoundary>
  );
};

export default MonacoGraphQLEditor;
