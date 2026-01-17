import React, { useState, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { SearchConfigControls } from './SearchConfigControls';
import { getShortPreviewText } from '../../../utils/previewUtils';

/**
 * Object Search Mode - Find objects similar to a reference object
 *
 * Uses nearObject query with a reference object's UUID
 */
export function ObjectSearchMode() {
  const { state, postMessage, dispatch } = useDataExplorer();
  const { vectorSearch, objects } = state;
  const [objectId, setObjectId] = useState(vectorSearch.config.referenceObjectId || '');

  // Sync input with config when it changes externally (e.g., "Find Similar" button)
  useEffect(() => {
    if (vectorSearch.config.referenceObjectId && vectorSearch.config.referenceObjectId !== objectId) {
      setObjectId(vectorSearch.config.referenceObjectId);
    }
  }, [vectorSearch.config.referenceObjectId]);

  // UUID validation regex
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const handleSearch = () => {
    const id = objectId.trim();
    if (!id) {
      return;
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      dispatch({
        type: 'SET_VECTOR_SEARCH_ERROR',
        payload: '[Object Search] Invalid UUID format. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      });
      return;
    }

    // Clear any previous errors and results
    dispatch({ type: 'CLEAR_VECTOR_SEARCH' });

    // Set loading state
    dispatch({ type: 'SET_VECTOR_SEARCH_LOADING', payload: true });

    // Send vector search request to extension
    postMessage({
      command: 'vectorSearch',
      data: {
        mode: 'object',
        referenceObjectId: id,
        limit: vectorSearch.config.limit,
        distance: vectorSearch.config.useDistanceMetric ? vectorSearch.config.distance : undefined,
        certainty: !vectorSearch.config.useDistanceMetric ? vectorSearch.config.certainty : undefined,
      },
    });
  };

  // Find the reference object in current data for preview
  const referenceObject = objects.find((obj) => obj.uuid === objectId);
  const previewText = getShortPreviewText(referenceObject);
  const hasPreview = !!previewText;

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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
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
