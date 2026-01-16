import React, { useState } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { SearchConfigControls } from './SearchConfigControls';

/**
 * Text Search Mode - Semantic search using natural language
 *
 * Uses nearText query with the collection's configured vectorizer
 */
export function TextSearchMode() {
  const { state, postMessage } = useDataExplorer();
  const { schema, vectorSearch } = state;
  const [searchText, setSearchText] = useState(vectorSearch.config.searchText || '');

  const handleSearch = () => {
    if (!searchText.trim()) {
      return;
    }

    // Send vector search request to extension
    postMessage({
      command: 'vectorSearch',
      data: {
        mode: 'text',
        searchText: searchText.trim(),
        limit: vectorSearch.config.limit,
        distance: vectorSearch.config.useDistance ? vectorSearch.config.distance : undefined,
        certainty: !vectorSearch.config.useDistance ? vectorSearch.config.certainty : undefined,
      },
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
          onKeyPress={handleKeyPress}
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
