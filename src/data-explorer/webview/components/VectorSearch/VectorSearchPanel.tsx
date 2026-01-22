/**
 * VectorSearchPanel - Main slide-out panel for vector search
 * Supports three search modes: Text (Semantic), Similar Object, Raw Vector
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import type { CollectionConfig, WeaviateObject } from '../../../types';
import {
  useVectorSearchState,
  useVectorSearchActions,
  type VectorSearchMode,
  type DistanceMetric,
} from '../../context';
import { SearchModeSelector } from './SearchModeSelector';
import { TextSearchInput } from './TextSearchInput';
import { ObjectSearchInput } from './ObjectSearchInput';
import { VectorInput } from './VectorInput';
import { SearchResults } from './SearchResults';

interface VectorSearchPanelProps {
  isOpen: boolean;
  schema: CollectionConfig | null;
  onResultSelect: (object: WeaviateObject) => void;
  onSearch: () => void;
  preSelectedObject?: WeaviateObject | null;
}

export function VectorSearchPanel({
  isOpen,
  schema,
  onResultSelect,
  onSearch,
  preSelectedObject,
}: VectorSearchPanelProps) {
  const state = useVectorSearchState();
  const actions = useVectorSearchActions();

  const { searchMode, searchParams, searchResults, isSearching, searchError, hasSearched } = state;

  // Handle keyboard escape to close panel (only add listener when open)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        actions.closeVectorSearchPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, actions]);

  // Type for vectorizer config entries
  interface VectorizerConfigEntry {
    name?: string;
    [key: string]: unknown;
  }

  // Check if collection has a vectorizer configured
  const hasVectorizer = useMemo(() => {
    if (!schema?.vectorizerConfig) return false;
    // Check if vectorizer is configured and not 'none'
    const config = schema.vectorizerConfig as
      | VectorizerConfigEntry[]
      | Record<string, unknown>
      | undefined;
    if (Array.isArray(config)) {
      return config.length > 0;
    }
    return Object.keys(config || {}).length > 0;
  }, [schema]);

  // Get vectorizer name for display
  const vectorizerName = useMemo(() => {
    if (!schema?.vectorizerConfig) return undefined;
    const config = schema.vectorizerConfig as
      | VectorizerConfigEntry[]
      | Record<string, unknown>
      | undefined;
    if (Array.isArray(config) && config.length > 0) {
      return config[0]?.name || 'default';
    }
    return Object.keys(config || {})[0] || undefined;
  }, [schema]);

  // Get expected vector dimensions
  const expectedDimensions = useMemo(() => {
    // This would come from the schema if available
    return undefined;
  }, [schema]);

  // Handle search mode change
  const handleModeChange = useCallback(
    (mode: VectorSearchMode) => {
      actions.setSearchMode(mode);
    },
    [actions]
  );

  // Handle search parameter changes
  const handleParamChange = useCallback(
    (key: string, value: string | number) => {
      actions.setSearchParams({ [key]: value });
    },
    [actions]
  );

  // Handle search button click
  const handleSearch = useCallback(() => {
    onSearch();
  }, [onSearch]);

  // Handle result view
  const handleViewObject = useCallback(
    (object: WeaviateObject) => {
      onResultSelect(object);
    },
    [onResultSelect]
  );

  // Handle find similar on result
  const handleFindSimilar = useCallback(
    (objectId: string) => {
      actions.findSimilar(objectId);
    },
    [actions]
  );

  // Clear pre-selected object
  const handleClearPreSelection = useCallback(() => {
    actions.setSearchParams({ objectId: '' });
  }, [actions]);

  // Validate search can be performed
  const canSearch = useMemo(() => {
    if (isSearching) return false;

    switch (searchMode) {
      case 'text':
        return hasVectorizer && searchParams.query.trim().length > 0;
      case 'object':
        return searchParams.objectId.trim().length > 0;
      case 'vector':
        try {
          const parsed = JSON.parse(searchParams.vector);
          return (
            Array.isArray(parsed) && parsed.length > 0 && parsed.every((n) => typeof n === 'number')
          );
        } catch {
          return false;
        }
      default:
        return false;
    }
  }, [searchMode, searchParams, hasVectorizer, isSearching]);

  // Distance metric options
  const distanceMetrics: { value: DistanceMetric; label: string }[] = [
    { value: 'cosine', label: 'Cosine' },
    { value: 'euclidean', label: 'Euclidean' },
    { value: 'manhattan', label: 'Manhattan' },
    { value: 'dot', label: 'Dot Product' },
  ];

  // Result limit options
  const limitOptions = [10, 25, 50, 100];

  return (
    <div
      className={`vector-search-panel ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-label="Vector Search"
    >
      {/* Backdrop */}
      <div
        className="vector-search-backdrop"
        onClick={() => actions.closeVectorSearchPanel()}
        aria-hidden="true"
      />

      {/* Panel content */}
      <div className="vector-search-content">
        {/* Header */}
        <header className="vector-search-header">
          <div className="vector-search-title">
            <span className="codicon codicon-search" aria-hidden="true"></span>
            <h2>VECTOR SEARCH</h2>
          </div>
          <button
            type="button"
            className="vector-search-close"
            onClick={() => actions.closeVectorSearchPanel()}
            title="Close vector search panel"
            aria-label="Close vector search panel"
          >
            <span className="codicon codicon-close" aria-hidden="true">
              ×
            </span>
          </button>
        </header>

        {/* Search Mode Selector */}
        <SearchModeSelector
          activeMode={searchMode}
          onModeChange={handleModeChange}
          hasVectorizer={hasVectorizer}
        />

        {/* Scrollable Body */}
        <div className="vector-search-body">
          {/* Search Input Area */}
          <div className="search-input-area">
            {/* Mode-specific inputs */}
            {searchMode === 'text' && (
              <>
                {!hasVectorizer ? (
                  <div className="vectorizer-warning">
                    <span className="codicon codicon-warning" aria-hidden="true"></span>
                    <div>
                      <h4>Vectorizer Not Configured</h4>
                      <p>
                        Text search requires a vectorizer to be configured for this collection. Use
                        "Similar Object" or "Raw Vector" mode instead.
                      </p>
                    </div>
                  </div>
                ) : (
                  <TextSearchInput
                    value={searchParams.query}
                    onChange={(value) => handleParamChange('query', value)}
                    onSearch={handleSearch}
                    vectorizerName={vectorizerName}
                    isSearching={isSearching}
                  />
                )}
              </>
            )}

            {searchMode === 'object' && (
              <ObjectSearchInput
                value={searchParams.objectId}
                onChange={(value) => handleParamChange('objectId', value)}
                onSearch={handleSearch}
                selectedObject={preSelectedObject}
                isSearching={isSearching}
                onClearSelection={handleClearPreSelection}
              />
            )}

            {searchMode === 'vector' && (
              <VectorInput
                value={searchParams.vector}
                onChange={(value) => handleParamChange('vector', value)}
                onSearch={handleSearch}
                expectedDimensions={expectedDimensions}
                isSearching={isSearching}
              />
            )}
          </div>

          {/* Search Parameters */}
          <div className="search-parameters">
            <h3 className="parameters-title">
              <span className="codicon codicon-settings-gear" aria-hidden="true"></span>
              Search Parameters
            </h3>

            <div className="parameter-grid">
              {/* Distance Metric */}
              <div className="parameter-item">
                <label htmlFor="distance-metric">Distance Metric</label>
                <select
                  id="distance-metric"
                  value={searchParams.distanceMetric}
                  onChange={(e) => handleParamChange('distanceMetric', e.target.value)}
                  disabled={isSearching}
                >
                  {distanceMetrics.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max Distance */}
              <div className="parameter-item">
                <label htmlFor="max-distance">
                  Max Distance: <strong>{searchParams.maxDistance.toFixed(2)}</strong>
                </label>
                <input
                  id="max-distance"
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={searchParams.maxDistance}
                  onChange={(e) => handleParamChange('maxDistance', parseFloat(e.target.value))}
                  disabled={isSearching}
                />
                <div className="range-labels">
                  <span>0 (exact)</span>
                  <span>2 (distant)</span>
                </div>
              </div>

              {/* Result Limit */}
              <div className="parameter-item">
                <label htmlFor="result-limit">Result Limit</label>
                <select
                  id="result-limit"
                  value={searchParams.limit}
                  onChange={(e) => handleParamChange('limit', parseInt(e.target.value, 10))}
                  disabled={isSearching}
                >
                  {limitOptions.map((limit) => (
                    <option key={limit} value={limit}>
                      Top {limit} results
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Search Button */}
          <div className="search-action">
            <button
              type="button"
              className="search-btn primary"
              onClick={handleSearch}
              disabled={!canSearch}
            >
              {isSearching ? (
                <>
                  <span className="loading-spinner-small" />
                  Searching...
                </>
              ) : (
                <>
                  <span className="codicon codicon-search" aria-hidden="true"></span>
                  Run Vector Search
                </>
              )}
            </button>

            {searchResults.length > 0 && (
              <button
                type="button"
                className="clear-results-btn secondary"
                onClick={() => actions.clearSearch()}
                disabled={isSearching}
              >
                Clear Results
              </button>
            )}
          </div>

          {/* Search Results */}
          <div className="search-results-container">
            <SearchResults
              results={searchResults}
              isLoading={isSearching}
              error={searchError}
              onViewObject={handleViewObject}
              onFindSimilar={handleFindSimilar}
              hasSearched={hasSearched}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
