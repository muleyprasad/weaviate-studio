import React, { useState, useEffect } from 'react';
import './CloneCollection.css';
import { getVscodeApi, WeaviateCollectionSchema } from '../vscodeApi';

export interface CloneCollectionProps {
  onSchemaLoaded: (schema: WeaviateCollectionSchema, action: 'edit' | 'create') => void;
  onBack: () => void;
  onCancel: () => void;
  externalError?: string;
}

// Get shared VS Code API instance
const vscode = getVscodeApi();

export function CloneCollection({
  onSchemaLoaded,
  onBack,
  onCancel,
  externalError,
}: CloneCollectionProps) {
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [schema, setSchema] = useState<WeaviateCollectionSchema | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);

  // Display external error if provided
  const displayError = externalError || error;

  useEffect(() => {
    // Request collections list from extension
    if (vscode) {
      vscode.postMessage({ command: 'getCollections' });
    }

    // Handle messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'collections':
          setCollections(message.collections || []);
          setIsLoadingCollections(false);
          break;
        case 'schema':
          setSchema(message.schema);
          setIsLoading(false);
          break;
        case 'error':
          setError(message.message || 'An error occurred');
          setIsLoading(false);
          setIsLoadingCollections(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const collectionName = e.target.value;
    setSelectedCollection(collectionName);
    setError('');
    setSchema(null);

    // Auto-suggest a name for the new collection
    if (collectionName) {
      setNewCollectionName(`${collectionName}Copy`);

      // Request schema from extension
      setIsLoading(true);
      if (vscode) {
        vscode.postMessage({
          command: 'getSchema',
          collectionName: collectionName,
        });
      }
    }
  };

  const handleNewNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCollectionName(e.target.value);
    setError('');
  };

  const validateInputs = (): boolean => {
    if (!selectedCollection) {
      setError('Please select a collection to clone');
      return false;
    }

    if (!newCollectionName.trim()) {
      setError('Please enter a name for the new collection');
      return false;
    }

    if (collections.includes(newCollectionName)) {
      setError('A collection with this name already exists');
      return false;
    }

    if (!schema) {
      setError('Schema not loaded yet. Please wait.');
      return false;
    }

    return true;
  };

  const handleEditBeforeCreate = () => {
    if (!validateInputs()) return;

    // Clone the schema with the new name
    const clonedSchema = {
      ...schema,
      class: newCollectionName,
    };

    onSchemaLoaded(clonedSchema, 'edit');
  };

  const handleCreateDirectly = () => {
    if (!validateInputs()) return;

    // Clone the schema with the new name
    const clonedSchema = {
      ...schema,
      class: newCollectionName,
    };

    onSchemaLoaded(clonedSchema, 'create');
  };

  const isValid = selectedCollection && newCollectionName.trim() && schema && !isLoading;

  return (
    <div className="clone-collection-container">
      <div className="clone-collection-header">
        <h2>Clone Existing Collection</h2>
        <div className="subtitle">
          Create a new collection based on an existing collection's schema
        </div>
      </div>

      {displayError && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{displayError}</span>
        </div>
      )}

      {!isLoadingCollections && collections.length === 0 && (
        <div className="info-message">
          <span className="info-icon">ℹ️</span>
          <span>No collections found. Create a collection first before you can clone one.</span>
        </div>
      )}

      <div className="form-section">
        <label className="form-label">
          Source Collection:
          {isLoadingCollections && <span className="loading-text"> (Loading...)</span>}
        </label>
        <select
          className="form-select"
          value={selectedCollection}
          onChange={handleCollectionChange}
          disabled={isLoadingCollections || collections.length === 0}
        >
          <option value="">
            {collections.length === 0 ? 'No collections available' : 'Select a collection to clone'}
          </option>
          {collections.map((collection) => (
            <option key={collection} value={collection}>
              {collection}
            </option>
          ))}
        </select>
      </div>

      {selectedCollection && (
        <>
          <div className="form-section">
            <label className="form-label">
              New Collection Name:
              {isLoading && <span className="loading-text"> (Loading schema...)</span>}
            </label>
            <input
              type="text"
              className="form-input"
              value={newCollectionName}
              onChange={handleNewNameChange}
              placeholder="Enter new collection name"
              disabled={isLoading}
            />
          </div>

          {schema && (
            <div className="schema-preview">
              <div className="preview-header">
                <span className="preview-icon">✓</span>
                <span>Schema loaded successfully</span>
              </div>
              <div className="preview-details">
                <div className="preview-item">
                  <strong>Properties:</strong> {schema.properties?.length || 0}
                </div>
                {schema.vectorizer && (
                  <div className="preview-item">
                    <strong>Vectorizer:</strong> {schema.vectorizer}
                  </div>
                )}
                {schema.vectorIndexType && (
                  <div className="preview-item">
                    <strong>Index Type:</strong> {schema.vectorIndexType}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="button-group">
        <button type="button" className="secondary-button" onClick={onBack} disabled={isLoading}>
          Back
        </button>
        {isValid && (
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
