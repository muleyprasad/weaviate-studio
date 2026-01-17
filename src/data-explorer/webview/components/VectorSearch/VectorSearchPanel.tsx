import React, { useState, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import type { VectorSearchMode } from '../../../types';
import { TextSearchMode } from './TextSearchMode';
import { ObjectSearchMode } from './ObjectSearchMode';
import { VectorSearchMode as VectorModeComponent } from './VectorSearchMode';
import { HybridSearchMode } from './HybridSearchMode';
import { SearchResults } from './SearchResults';

/**
 * Vector Search Panel - Main component for vector similarity search
 *
 * Features:
 * - Four search modes: Text (semantic), Hybrid, Similar Object, Raw Vector
 * - Distance/certainty configuration
 * - Results display with similarity scores
 */
export function VectorSearchPanel() {
  const { state, dispatch } = useDataExplorer();
  const { vectorSearch } = state;
  const [activeMode, setActiveMode] = useState<VectorSearchMode>(
    vectorSearch.config.mode
  );

  // Sync local state with global state (e.g., when "Find Similar" is clicked)
  useEffect(() => {
    if (vectorSearch.config.mode !== activeMode) {
      setActiveMode(vectorSearch.config.mode);
    }
  }, [vectorSearch.config.mode]);

  if (!vectorSearch.isActive) {
    return null;
  }

  const handleModeChange = (mode: VectorSearchMode) => {
    setActiveMode(mode);
    // Update global state to keep them in sync
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: { mode },
    });
  };

  return (
    <div className="vector-search-panel">
      <div className="vector-search-header">
        <h3 className="vector-search-title">🔮 Vector Search</h3>
        <p className="vector-search-subtitle">
          Find similar objects using semantic similarity
        </p>
      </div>

      {/* Search Mode Tabs */}
      <div className="search-mode-tabs" role="tablist" aria-label="Vector search modes">
        <button
          className={`mode-tab ${activeMode === 'text' ? 'active' : ''}`}
          onClick={() => handleModeChange('text')}
          role="tab"
          aria-selected={activeMode === 'text'}
          aria-controls="search-mode-content"
          title="Search by text using semantic understanding"
        >
          <span aria-hidden="true">📝</span> Text (Semantic)
        </button>
        <button
          className={`mode-tab ${activeMode === 'hybrid' ? 'active' : ''}`}
          onClick={() => handleModeChange('hybrid')}
          role="tab"
          aria-selected={activeMode === 'hybrid'}
          aria-controls="search-mode-content"
          title="Combine keyword (BM25) and semantic (vector) search"
        >
          <span aria-hidden="true">🎯</span> Hybrid
        </button>
        <button
          className={`mode-tab ${activeMode === 'object' ? 'active' : ''}`}
          onClick={() => handleModeChange('object')}
          role="tab"
          aria-selected={activeMode === 'object'}
          aria-controls="search-mode-content"
          title="Find objects similar to a reference object"
        >
          <span aria-hidden="true">🔗</span> Similar Object
        </button>
        <button
          className={`mode-tab ${activeMode === 'vector' ? 'active' : ''}`}
          onClick={() => handleModeChange('vector')}
          role="tab"
          aria-selected={activeMode === 'vector'}
          aria-controls="search-mode-content"
          title="Search using raw vector embeddings"
        >
          <span aria-hidden="true">⚛️</span> Raw Vector
        </button>
      </div>

      {/* Search Mode Content */}
      <div className="search-mode-content" id="search-mode-content" role="tabpanel">
        {activeMode === 'text' && <TextSearchMode />}
        {activeMode === 'hybrid' && <HybridSearchMode />}
        {activeMode === 'object' && <ObjectSearchMode />}
        {activeMode === 'vector' && <VectorModeComponent />}
      </div>

      {/* Search Results */}
      {vectorSearch.results.length > 0 && <SearchResults />}

      {/* Empty State - No results found */}
      {!vectorSearch.loading &&
        !vectorSearch.error &&
        vectorSearch.results.length === 0 &&
        (vectorSearch.config.searchText ||
          vectorSearch.config.referenceObjectId ||
          vectorSearch.config.vectorInput) && (
          <div className="vector-search-empty" role="status">
            <div className="empty-icon">🔍</div>
            <h4 className="empty-title">No similar objects found</h4>
            <p className="empty-message">
              Try adjusting your search parameters:
            </p>
            <ul className="empty-suggestions">
              <li>Increase the {vectorSearch.config.useDistanceMetric ? 'distance' : 'certainty'} threshold</li>
              <li>Increase the result limit</li>
              <li>Try a different search query or object</li>
            </ul>
          </div>
        )}

      {/* Loading State */}
      {vectorSearch.loading && (
        <div className="vector-search-loading" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Searching for similar objects...</p>
        </div>
      )}

      {/* Error State */}
      {vectorSearch.error && (
        <div className="vector-search-error" role="alert" aria-live="assertive">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <span className="error-message">{vectorSearch.error}</span>
        </div>
      )}
    </div>
  );
}
