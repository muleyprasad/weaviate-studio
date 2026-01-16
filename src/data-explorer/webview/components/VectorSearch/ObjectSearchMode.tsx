import React, { useState } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { SearchConfigControls } from './SearchConfigControls';

/**
 * Object Search Mode - Find objects similar to a reference object
 *
 * Uses nearObject query with a reference object's UUID
 */
export function ObjectSearchMode() {
  const { state, postMessage } = useDataExplorer();
  const { vectorSearch, objects } = state;
  const [objectId, setObjectId] = useState(vectorSearch.config.referenceObjectId || '');

  const handleSearch = () => {
    if (!objectId.trim()) {
      return;
    }

    // Send vector search request to extension
    postMessage({
      command: 'vectorSearch',
      data: {
        mode: 'object',
        referenceObjectId: objectId.trim(),
        limit: vectorSearch.config.limit,
        distance: vectorSearch.config.useDistance ? vectorSearch.config.distance : undefined,
        certainty: !vectorSearch.config.useDistance ? vectorSearch.config.certainty : undefined,
      },
    });
  };

  // Find the reference object in current data for preview
  const referenceObject = objects.find((obj) => obj.uuid === objectId);
  const hasPreview = referenceObject && referenceObject.properties;

  // Get a preview string from the reference object
  const getPreviewText = () => {
    if (!referenceObject || !referenceObject.properties) {
      return null;
    }

    // Try common text properties
    const props = referenceObject.properties as Record<string, unknown>;
    const textProps = ['title', 'name', 'description', 'content', 'text'];

    for (const prop of textProps) {
      if (props[prop] && typeof props[prop] === 'string') {
        const text = props[prop] as string;
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      }
    }

    // Fallback: show first property
    const firstProp = Object.entries(props)[0];
    if (firstProp) {
      const [key, value] = firstProp;
      return `${key}: ${String(value).substring(0, 50)}...`;
    }

    return null;
  };

  const previewText = getPreviewText();

  return (
    <div className="object-search-mode">
      <div className="search-input-section">
        <label htmlFor="object-id" className="search-label">
          Reference Object UUID:
        </label>
        <input
          id="object-id"
          type="text"
          className="search-input"
          placeholder="e.g., abc-123-def-456"
          value={objectId}
          onChange={(e) => setObjectId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <div className="search-hint">
          Enter the UUID of an object to find similar ones
        </div>
      </div>

      {/* Object Preview */}
      {hasPreview && previewText && (
        <div className="object-preview">
          <div className="preview-header">
            <span className="preview-icon">👁️</span>
            <span className="preview-label">Preview:</span>
          </div>
          <div className="preview-content">
            <div className="preview-text">{previewText}</div>
            <div className="preview-uuid">UUID: {objectId}</div>
          </div>
        </div>
      )}

      {/* Common search configuration controls */}
      <SearchConfigControls />

      <div className="search-actions">
        <button
          className="search-button primary"
          onClick={handleSearch}
          disabled={!objectId.trim() || vectorSearch.loading}
        >
          🔍 Find Similar Objects
        </button>
        <button
          className="search-button secondary"
          onClick={() => setObjectId('')}
          disabled={!objectId}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
