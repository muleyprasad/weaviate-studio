import React, { useState } from 'react';
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
  const { state } = useDataExplorer();
  const { vectorSearch } = state;
  const [activeMode, setActiveMode] = useState<VectorSearchMode>('text');

  if (!vectorSearch.isActive) {
    return null;
  }

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
          onClick={() => setActiveMode('text')}
          title="Search by text using semantic understanding"
        >
          📝 Text (Semantic)
        </button>
        <button
          className={`mode-tab ${activeMode === 'object' ? 'active' : ''}`}
          onClick={() => setActiveMode('object')}
          title="Find objects similar to a reference object"
        >
          🔗 Similar Object
        </button>
        <button
          className={`mode-tab ${activeMode === 'vector' ? 'active' : ''}`}
          onClick={() => setActiveMode('vector')}
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
