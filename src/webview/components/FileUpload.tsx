import React, { useState, useRef } from 'react';
import './FileUpload.css';
import { WeaviateCollectionSchema } from '../vscodeApi';

export interface FileUploadProps {
  onSchemaLoaded: (schema: WeaviateCollectionSchema, action: 'edit' | 'create') => void;
  onBack: () => void;
  onCancel: () => void;
  externalError?: string;
}

export function FileUpload({ onSchemaLoaded, onBack, onCancel, externalError }: FileUploadProps) {
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [validSchema, setValidSchema] = useState<WeaviateCollectionSchema | null>(null);
  const [jsonText, setJsonText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Display external error if provided
  const displayError = externalError || error;

  const validateAndSetSchema = (jsonString: string) => {
    setError('');
    try {
      const schema = JSON.parse(jsonString);

      // Basic validation
      if (!schema || typeof schema !== 'object') {
        throw new Error('Invalid JSON structure');
      }

      if (!schema.class && !schema.name) {
        throw new Error('Schema must have a "class" or "name" property');
      }

      setValidSchema(schema);
      setJsonText(JSON.stringify(schema, null, 2));
    } catch (err) {
      // Provide consistent error message for JSON parse errors
      if (err instanceof SyntaxError) {
        setError('Input is not valid JSON. Please check your syntax.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid JSON');
      }
      setValidSchema(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError('');
    setIsLoading(true);

    // Validate file type
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      setIsLoading(false);
      return;
    }

    // Read file
    const reader = new FileReader();

    reader.onload = (event) => {
      setIsLoading(false);
      const content = event.target?.result as string;
      validateAndSetSchema(content);
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);

    // Clear previous validation state
    setError('');
    setValidSchema(null);

    // Only validate if there's content
    if (text.trim()) {
      validateAndSetSchema(text);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleEditBeforeCreate = () => {
    if (validSchema) {
      onSchemaLoaded(validSchema, 'edit');
    }
  };

  const handleCreateDirectly = () => {
    if (validSchema) {
      onSchemaLoaded(validSchema, 'create');
    }
  };

  return (
    <div className="file-upload-container">
      <div className="file-upload-header">
        <h2>Import Collection Schema</h2>
        <div className="subtitle">Upload a JSON file or paste your collection schema</div>
      </div>

      {displayError && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{displayError}</span>
        </div>
      )}

      {validSchema && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          <span>Valid schema loaded: {validSchema.class || validSchema.name}</span>
        </div>
      )}

      <div className="upload-section">
        <label className="form-label">Upload JSON File:</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="browse-button"
          onClick={handleBrowseClick}
          disabled={isLoading}
        >
          {isLoading ? '⏳ Loading...' : '📁 Browse Files'}
        </button>
      </div>

      <div className="divider">
        <span>OR</span>
      </div>

      <div className="textarea-section">
        <label className="form-label">Paste JSON Schema:</label>
        <textarea
          className="json-textarea"
          value={jsonText}
          onChange={handleTextareaChange}
          placeholder='Paste your collection schema here, e.g.:\n{\n  "class": "Article",\n  "properties": [...]\n}'
          rows={12}
        />
      </div>

      <div className="button-group">
        <button type="button" className="secondary-button" onClick={onBack} disabled={isLoading}>
          Back
        </button>
        {validSchema && (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={handleEditBeforeCreate}
              disabled={isLoading}
            >
              Edit Before Creating
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleCreateDirectly}
              disabled={isLoading}
            >
              Create Directly
            </button>
          </>
        )}
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
      </div>
    </div>
  );
}
