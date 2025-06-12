import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { MonacoQueryEditor } from '../query-editor/enhanced/MonacoQueryEditor';
import { processTemplate, queryTemplates } from '../query-editor/enhanced/queryTemplates';
import FormatButton from './FormatButton';
import ErrorBoundary from './ErrorBoundary';
import LoadingIndicator from './LoadingIndicator';
import './FormatButton.css';

interface QuickInsertButtonProps {
  label: string;
  template: string;
  description?: string;
  onClick: (template: string) => void;
}

const QuickInsertButton: React.FC<QuickInsertButtonProps> = ({ label, template, description, onClick }) => {
  return (
    <button
      className="quick-insert-button"
      title={description || label}
      onClick={() => onClick(template)}
      style={{
        backgroundColor: '#3c3c3c',
        color: '#cccccc',
        border: '1px solid #555',
        borderRadius: '4px',
        padding: '4px 8px',
        marginRight: '8px',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
};

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
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

  // Set selected collection name in the queryContext when it changes
  useEffect(() => {
    if (editorRef.current) {
      // Update the query template when the collection name changes
      // setQueryContext(prevContext => ({
      //   ...prevContext,
      //   collection: collectionName || ''
      // }));
      
      // Set collection name for template system
      editorRef.current.setCollectionName(collectionName || 'Article');
    }
  }, [collectionName, editorRef]);

  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateName = e.target.value;
    setSelectedTemplate(templateName);
    
    if (templateName && collectionName && editorRef.current) {
      const template = queryTemplates.find(t => t.name === templateName);
      if (template) {
        const processedTemplate = processTemplate(template.template, collectionName);
        editorRef.current.setValue(processedTemplate);
      }
    }
  };

  // Format the current query
  const handleFormatQuery = async () => {
    if (editorRef.current) {
      try {
        setIsLoading(true);
        setLoadingMessage('Formatting query...');
        await editorRef.current.formatQuery();
      } catch (error) {
        console.error('Error formatting query:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <ErrorBoundary>
      <div className="monaco-graphql-editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div className="editor-toolbar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px',
        backgroundColor: '#252526',
        borderBottom: '1px solid #333'
      }}>
        <div className="left-tools">
          <select
            value={selectedTemplate}
            onChange={handleTemplateChange}
            style={{
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #555',
              borderRadius: '4px',
              padding: '4px 8px',
              marginRight: '8px'
            }}
          >
            <option value="">Select Template...</option>
            {queryTemplates.map((template, index) => (
              <option key={index} value={template.name}>
                {template.name}
              </option>
            ))}
          </select>
          
          <FormatButton onClick={handleFormatQuery} disabled={!isEditorReady} />
        </div>
        
        <div className="right-tools">
          <button
            onClick={onGenerateSample}
            style={{
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #555',
              borderRadius: '4px',
              padding: '4px 8px',
              marginRight: '8px'
            }}
          >
            Generate Sample
          </button>
          
          <button
            onClick={onRunQuery}
            style={{
              backgroundColor: '#0e639c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px'
            }}
          >
            Run Query
          </button>
        </div>
      </div>
      
      <div
        ref={containerRef}
        className="monaco-editor-container"
        style={{ flex: 1, minHeight: '200px' }}
      />
      
      <div className="quick-insert-toolbar" style={{
        display: 'flex',
        padding: '8px',
        backgroundColor: '#252526',
        borderTop: '1px solid #333',
        overflowX: 'auto'
      }}>
        {isEditorReady && editorRef.current && (
          <>
            <QuickInsertButton
              label="Add Vector Search"
              template={`nearVector: {
  vector: []
}`}
              description="Insert a nearVector search parameter"
              onClick={(template) => editorRef.current?.insertTextAtCursor(template)}
            />
            
            <QuickInsertButton
              label="Add Text Search"
              template={`nearText: {
  concepts: [""]
}`}
              description="Insert a nearText search parameter"
              onClick={(template) => editorRef.current?.insertTextAtCursor(template)}
            />
            
            <QuickInsertButton
              label="Add Filter"
              template={`where: {
  operator: Equal,
  path: [""],
  valueString: ""
}`}
              description="Insert a where filter clause"
              onClick={(template) => editorRef.current?.insertTextAtCursor(template)}
            />
            
            <QuickInsertButton
              label="Add Metadata"
              template={`_additional {
  id
  certainty
  distance
}`}
              description="Insert _additional metadata fields"
              onClick={(template) => editorRef.current?.insertTextAtCursor(template)}
            />
          </>
        )}
      </div>
      <LoadingIndicator isVisible={isLoading} message={loadingMessage} />
      </div>
    </ErrorBoundary>
  );
};

export default MonacoGraphQLEditor;
