import React, { useState, useEffect, useRef } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { SearchConfigControls } from './SearchConfigControls';
import {
  TEXT_SEARCH_LIMITS,
  HYBRID_SEARCH_DEFAULTS,
  ALPHA_THRESHOLDS,
} from '../../../constants';

/**
 * Hybrid Search Mode - Combine keyword (BM25) and semantic (vector) search
 *
 * Allows balancing between keyword matching and semantic understanding using
 * an alpha parameter (0 = pure keyword, 1 = pure semantic)
 */
export function HybridSearchMode() {
  const { state, postMessage, dispatch } = useDataExplorer();
  const { schema, vectorSearch } = state;
  const [searchText, setSearchText] = useState(vectorSearch.config.searchText || '');
  const [localAlpha, setLocalAlpha] = useState(
    vectorSearch.config.alpha ?? HYBRID_SEARCH_DEFAULTS.ALPHA
  );
  const [queryRewriting, setQueryRewriting] = useState(
    vectorSearch.config.enableQueryRewriting ?? HYBRID_SEARCH_DEFAULTS.QUERY_REWRITING
  );
  const [selectedProperties, setSelectedProperties] = useState<string[]>(
    vectorSearch.config.searchProperties || []
  );
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const alphaTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync input with config when it changes externally
  useEffect(() => {
    if (vectorSearch.config.searchText && vectorSearch.config.searchText !== searchText) {
      setSearchText(vectorSearch.config.searchText);
    }
  }, [vectorSearch.config.searchText]);

  useEffect(() => {
    setLocalAlpha(vectorSearch.config.alpha ?? HYBRID_SEARCH_DEFAULTS.ALPHA);
  }, [vectorSearch.config.alpha]);

  useEffect(() => {
    setQueryRewriting(
      vectorSearch.config.enableQueryRewriting ?? HYBRID_SEARCH_DEFAULTS.QUERY_REWRITING
    );
  }, [vectorSearch.config.enableQueryRewriting]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (alphaTimeoutRef.current) clearTimeout(alphaTimeoutRef.current);
    };
  }, []);

  // Get text properties from schema for property selection
  const textProperties =
    schema?.properties.filter(
      (prop) =>
        prop.dataType === 'text' ||
        prop.dataType === 'text[]' ||
        (prop.indexSearchable !== false && prop.dataType === 'string')
    ) || [];

  const handleAlphaChange = (value: number) => {
    setLocalAlpha(value); // Update local state immediately for responsive UI

    // Clear existing timeout
    if (alphaTimeoutRef.current) {
      clearTimeout(alphaTimeoutRef.current);
    }

    // Dispatch update after debounce delay
    alphaTimeoutRef.current = setTimeout(() => {
      dispatch({
        type: 'SET_VECTOR_SEARCH_CONFIG',
        payload: {
          alpha: value,
        },
      });
    }, 150); // 150ms debounce
  };

  const handlePropertyToggle = (propertyName: string) => {
    const newSelection = selectedProperties.includes(propertyName)
      ? selectedProperties.filter((p) => p !== propertyName)
      : [...selectedProperties, propertyName];

    setSelectedProperties(newSelection);
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        searchProperties: newSelection.length > 0 ? newSelection : undefined,
      },
    });
  };

  const handleQueryRewritingToggle = () => {
    const newValue = !queryRewriting;
    setQueryRewriting(newValue);
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        enableQueryRewriting: newValue,
      },
    });
  };

  const handleSearch = () => {
    const text = searchText.trim();
    if (!text) {
      return;
    }

    // Validate minimum length
    if (text.length < TEXT_SEARCH_LIMITS.MIN_LENGTH) {
      dispatch({
        type: 'SET_VECTOR_SEARCH_ERROR',
        payload: `[Hybrid Search] Search text must be at least ${TEXT_SEARCH_LIMITS.MIN_LENGTH} characters`,
      });
      return;
    }

    // Validate maximum length
    if (text.length > TEXT_SEARCH_LIMITS.MAX_LENGTH) {
      dispatch({
        type: 'SET_VECTOR_SEARCH_ERROR',
        payload: `[Hybrid Search] Search text must not exceed ${TEXT_SEARCH_LIMITS.MAX_LENGTH} characters`,
      });
      return;
    }

    // Clear any previous errors and results
    dispatch({ type: 'CLEAR_VECTOR_SEARCH' });

    // Set loading state
    dispatch({ type: 'SET_VECTOR_SEARCH_LOADING', payload: true });

    // Send hybrid search request to extension
    postMessage({
      command: 'vectorSearch',
      data: {
        mode: 'hybrid',
        searchText: text,
        alpha: localAlpha,
        searchProperties: selectedProperties.length > 0 ? selectedProperties : undefined,
        enableQueryRewriting: queryRewriting,
        limit: vectorSearch.config.limit,
        distance: vectorSearch.config.useDistanceMetric
          ? vectorSearch.config.distance
          : undefined,
        certainty: !vectorSearch.config.useDistanceMetric
          ? vectorSearch.config.certainty
          : undefined,
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

  // Calculate keyword and semantic percentages for display
  const keywordPercentage = ((1 - localAlpha) * 100).toFixed(0);
  const semanticPercentage = (localAlpha * 100).toFixed(0);

  return (
    <div className="hybrid-search-mode">
      <div className="search-input-section">
        <label htmlFor="hybrid-search-text" className="search-label">
          Enter search query:
        </label>
        <textarea
          id="hybrid-search-text"
          className="search-textarea"
          placeholder="e.g., climate change policy"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className="search-hint">
          Combines keyword (BM25) and semantic (vector) search
        </div>
      </div>

      {/* Alpha Slider - Balance between keyword and semantic */}
      <div className="config-section hybrid-alpha-section">
        <label htmlFor="alpha-slider" className="config-label">
          Search Strategy:
        </label>
        <div className="alpha-balance-display">
          <div className="balance-labels">
            <span className="balance-label keyword">
              Keyword (BM25): {keywordPercentage}%
            </span>
            <span className="balance-label semantic">
              Semantic (Vector): {semanticPercentage}%
            </span>
          </div>
          <input
            id="alpha-slider"
            type="range"
            className="config-slider alpha-slider"
            min={ALPHA_THRESHOLDS.MIN}
            max={ALPHA_THRESHOLDS.MAX}
            step={ALPHA_THRESHOLDS.STEP}
            value={localAlpha}
            onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
            aria-label={`Alpha: ${localAlpha.toFixed(2)}`}
            aria-valuemin={ALPHA_THRESHOLDS.MIN}
            aria-valuemax={ALPHA_THRESHOLDS.MAX}
            aria-valuenow={localAlpha}
            aria-valuetext={`${localAlpha.toFixed(2)} - ${semanticPercentage}% semantic, ${keywordPercentage}% keyword`}
          />
          <div className="slider-labels">
            <span>0.0 (Pure Keyword)</span>
            <span className="alpha-value">α = {localAlpha.toFixed(2)}</span>
            <span>1.0 (Pure Semantic)</span>
          </div>
        </div>
      </div>

      {/* Query Rewriting Toggle */}
      <div className="config-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={queryRewriting}
            onChange={handleQueryRewritingToggle}
          />
          <span>Enable query rewriting (improve semantic understanding)</span>
        </label>
      </div>

      {/* Property Selection */}
      {textProperties.length > 0 && (
        <div className="config-section">
          <button
            className="property-selector-toggle"
            onClick={() => setShowPropertySelector(!showPropertySelector)}
            aria-expanded={showPropertySelector}
          >
            Search in properties:{' '}
            {selectedProperties.length === 0
              ? 'All'
              : `${selectedProperties.length} selected`}
            <span className="toggle-icon">{showPropertySelector ? '▼' : '▶'}</span>
          </button>
          {showPropertySelector && (
            <div className="property-selector-list">
              {textProperties.map((prop) => (
                <label key={prop.name} className="checkbox-label property-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedProperties.includes(prop.name)}
                    onChange={() => handlePropertyToggle(prop.name)}
                  />
                  <span>{prop.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="search-hint">
        <strong>Vectorizer:</strong> {vectorizerName}
        {vectorizer?.dimensions && <span> ({vectorizer.dimensions} dimensions)</span>}
      </div>

      {/* Common search configuration controls */}
      <SearchConfigControls />

      <div className="search-actions">
        <button
          className="search-button primary"
          onClick={handleSearch}
          disabled={!searchText.trim() || vectorSearch.loading}
        >
          🔍 Hybrid Search
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
