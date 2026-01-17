import React, { useState, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import type { VectorSearchMode } from '../../../types';
import { TextSearchMode } from './TextSearchMode';
import { ObjectSearchMode } from './ObjectSearchMode';
import { VectorSearchMode as VectorModeComponent } from './VectorSearchMode';
import { SearchResults } from './SearchResults';

/**
 * Vector Search Panel - Main component for vector similarity search
 *
 * Features:
 * - Three search modes: Text (semantic), Similar Object, Raw Vector
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
      <div className="search-mode-tabs">
        <button
          className={`mode-tab ${activeMode === 'text' ? 'active' : ''}`}
          onClick={() => handleModeChange('text')}
          title="Search by text using semantic understanding"
        >
          📝 Text (Semantic)
        </button>
        <button
          className={`mode-tab ${activeMode === 'object' ? 'active' : ''}`}
          onClick={() => handleModeChange('object')}
          title="Find objects similar to a reference object"
        >
          🔗 Similar Object
        </button>
        <button
          className={`mode-tab ${activeMode === 'vector' ? 'active' : ''}`}
          onClick={() => handleModeChange('vector')}
          title="Search using raw vector embeddings"
        >
          🎯 Raw Vector
        </button>
      </div>

      {/* Search Mode Content */}
      <div className="search-mode-content">
        {activeMode === 'text' && <TextSearchMode />}
        {activeMode === 'object' && <ObjectSearchMode />}
        {activeMode === 'vector' && <VectorModeComponent />}
      </div>

      {/* Search Results */}
      {vectorSearch.results.length > 0 && <SearchResults />}

      {/* Loading State */}
      {vectorSearch.loading && (
        <div className="vector-search-loading">
          <div className="loading-spinner"></div>
          <p>Searching for similar objects...</p>
        </div>
      )}

      {/* Error State */}
      {vectorSearch.error && (
        <div className="vector-search-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{vectorSearch.error}</span>
        </div>
      )}
    </div>
  );
}
