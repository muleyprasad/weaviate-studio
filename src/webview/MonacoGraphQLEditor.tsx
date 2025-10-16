import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { GraphQLEditor } from '../query-editor/webview/GraphQLEditor';
import { queryTemplates, processTemplate } from '../query-editor/webview/graphqlTemplates';
import ErrorBoundary from './ErrorBoundary';
import LoadingIndicator from './LoadingIndicator';

interface MonacoGraphQLEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  onGenerateSample: () => void;
  schemaConfig?: any;
  collectionName?: string;
  showTemplateDropdown?: boolean;
  onToggleTemplateDropdown?: () => void;
  onTemplateSelect?: (templateName: string) => void;
  onLanguageReady?: (ready: boolean) => void;
}

/**
 * Monaco-based GraphQL editor component for Weaviate Studio
 */
export const MonacoGraphQLEditor: React.FC<MonacoGraphQLEditorProps> = ({
  initialValue,
  onChange,
  onGenerateSample,
  schemaConfig,
  collectionName,
  showTemplateDropdown,
  onToggleTemplateDropdown,
  onTemplateSelect,
  onLanguageReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<GraphQLEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing editor...');

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
      onLanguageReady?.(false);

      editorRef.current
        .configureGraphQLLanguage(schemaConfig)
        .then(() => {
          // Update theme after configuration
          editorRef.current?.updateTheme();
          setIsLoading(false);
          onLanguageReady?.(true);
        })
        .catch((error) => {
          console.error('Error configuring GraphQL language:', error);
          setIsLoading(false);
          onLanguageReady?.(false);
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

  // Handle template selection (for external use)
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
    onTemplateSelect?.(templateName);
  };

  return (
    <ErrorBoundary>
      <div
        className="monaco-graphql-editor-container"
        style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
      >
        {/* Editor container */}
        <div
          ref={containerRef}
          className="monaco-editor-container"
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            minHeight: '200px',
          }}
        />

        <LoadingIndicator isVisible={isLoading} message={loadingMessage} />
      </div>
    </ErrorBoundary>
  );
};

export default MonacoGraphQLEditor;
