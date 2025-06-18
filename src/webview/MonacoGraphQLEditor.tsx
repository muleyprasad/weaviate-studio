import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { MonacoQueryEditor } from '../query-editor/enhanced/MonacoQueryEditor';
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
  const editorRef = useRef<MonacoQueryEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing editor...');

  // Initialize editor when component mounts
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      setIsLoading(true);
      setLoadingMessage('Initializing editor...');
      
      try {
        const editor = new MonacoQueryEditor(containerRef.current, initialValue);
        
        const handleEditorDidMount = (editor: MonacoQueryEditor) => {
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

  // No formatting functionality needed

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
            <button
              onClick={onGenerateSample}
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground, #2D2D2D)',
                color: 'var(--vscode-button-secondaryForeground, #E0E0E0)',
                border: '1px solid var(--vscode-widget-border, #444)',
                borderRadius: '3px',
                padding: '3px 8px',
                marginRight: '8px',
                fontSize: '12px',
                height: '24px'
              }}
            >
              Sample
            </button>
            
            <button
              onClick={onRunQuery}
              style={{
                backgroundColor: 'var(--vscode-button-background, #0E639C)',
                color: 'var(--vscode-button-foreground, white)',
                border: 'none',
                borderRadius: '3px',
                padding: '3px 10px',
                fontSize: '12px',
                height: '24px',
                fontWeight: 'bold'
              }}
            >
              Run
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
