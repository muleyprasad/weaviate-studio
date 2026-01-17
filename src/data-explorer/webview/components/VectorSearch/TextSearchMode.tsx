import React, { useState, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { SearchConfigControls } from './SearchConfigControls';
import { TEXT_SEARCH_LIMITS } from '../../../constants';

/**
 * Text Search Mode - Semantic search using natural language
 *
 * Uses nearText query with the collection's configured vectorizer
 */
export function TextSearchMode() {
  const { state, postMessage, dispatch } = useDataExplorer();
  const { schema, vectorSearch } = state;
  const [searchText, setSearchText] = useState(vectorSearch.config.searchText || '');

  // Sync input with config when it changes externally
  useEffect(() => {
    if (vectorSearch.config.searchText && vectorSearch.config.searchText !== searchText) {
      setSearchText(vectorSearch.config.searchText);
    }
  }, [vectorSearch.config.searchText]);

  const handleSearch = () => {
    const text = searchText.trim();
    if (!text) {
      return;
    }

    // Validate minimum length
    if (text.length < TEXT_SEARCH_LIMITS.MIN_LENGTH) {
      dispatch({
        type: 'SET_VECTOR_SEARCH_ERROR',
        payload: `[Text Search] Search text must be at least ${TEXT_SEARCH_LIMITS.MIN_LENGTH} characters`,
      });
      return;
    }

    // Validate maximum length
    if (text.length > TEXT_SEARCH_LIMITS.MAX_LENGTH) {
      dispatch({
        type: 'SET_VECTOR_SEARCH_ERROR',
        payload: `[Text Search] Search text must not exceed ${TEXT_SEARCH_LIMITS.MAX_LENGTH} characters`,
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
        mode: 'text',
        searchText: text,
        limit: vectorSearch.config.limit,
        distance: vectorSearch.config.useDistanceMetric ? vectorSearch.config.distance : undefined,
        certainty: !vectorSearch.config.useDistanceMetric ? vectorSearch.config.certainty : undefined,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Get vectorizer info from schema
  const vectorizer = schema?.vectorizers?.[0];
  const vectorizerName = vectorizer?.vectorizer || 'Not configured';

  return (
    <div className="text-search-mode">
      <div className="search-input-section">
        <label htmlFor="search-text" className="search-label">
          Enter search text:
        </label>
        <textarea
          id="search-text"
          className="search-textarea"
          placeholder="e.g., artificial intelligence in healthcare"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className="search-hint">
          Vectorizer: <strong>{vectorizerName}</strong>
          {vectorizer?.dimensions && (
            <span> ({vectorizer.dimensions} dimensions)</span>
          )}
        </div>
      </div>

      {/* Common search configuration controls */}
      <SearchConfigControls />

      <div className="search-actions">
        <button
          className="search-button primary"
          onClick={handleSearch}
          disabled={!searchText.trim() || vectorSearch.loading}
        >
          🔍 Search
        </button>
        <button
          className="search-button secondary"
          onClick={() => setSearchText('')}
          disabled={!searchText}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
