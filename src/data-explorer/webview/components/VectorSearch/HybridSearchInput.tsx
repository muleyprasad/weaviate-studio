/**
 * HybridSearchInput - Main input component for hybrid search mode
 * Combines BM25 keyword search with vector semantic search
 * Controlled by alpha slider: 0 = pure keyword, 1 = pure vector
 */

import React, { useCallback } from 'react';
import { AlphaSlider } from './AlphaSlider';
import { PropertySelector } from './PropertySelector';

interface HybridSearchInputProps {
  query: string;
  alpha: number;
  properties: string[];
  enableQueryRewriting: boolean;
  availableProperties: string[];
  onQueryChange: (query: string) => void;
  onAlphaChange: (alpha: number) => void;
  onPropertiesChange: (properties: string[]) => void;
  onQueryRewritingToggle: () => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function HybridSearchInput({
  query,
  alpha,
  properties,
  enableQueryRewriting,
  availableProperties,
  onQueryChange,
  onAlphaChange,
  onPropertiesChange,
  onQueryRewritingToggle,
  onSearch,
  isSearching,
}: HybridSearchInputProps) {
  // Handle Enter key to trigger search
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && query.trim()) {
        e.preventDefault();
        onSearch();
      }
    },
    [onSearch, query]
  );

  return (
    <div className="hybrid-search-input">
      {/* Search Query Input */}
      <div className="search-query-section">
        <label htmlFor="hybrid-search-query" className="input-label">
          <span className="codicon codicon-search" aria-hidden="true"></span>
          SEARCH QUERY
        </label>

        <textarea
          id="hybrid-search-query"
          className="hybrid-search-textarea"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter search terms...&#10;e.g., 'machine learning healthcare applications'"
          rows={3}
          disabled={isSearching}
        />

        <p className="input-hint">
          Your query will be used for both keyword matching (BM25) and semantic similarity (vector
          search)
        </p>
      </div>

      {/* Alpha Slider - Keyword/Semantic Balance */}
      <AlphaSlider value={alpha} onChange={onAlphaChange} disabled={isSearching} />

      {/* Query Rewriting Option - Planned feature, not yet implemented in Weaviate API */}
      <div className="query-options">
        <label className="checkbox-option" title="Planned feature - not yet available">
          <input
            type="checkbox"
            checked={enableQueryRewriting}
            onChange={onQueryRewritingToggle}
            disabled={true} // Disabled until Weaviate supports query rewriting
          />
          <span className="checkbox-label" style={{ opacity: 0.5 }}>
            Enable query rewriting (coming soon)
          </span>
        </label>

        {enableQueryRewriting && (
          <div className="info-message">
            <span className="codicon codicon-info" aria-hidden="true"></span>
            Query rewriting will automatically expand your search with synonyms and related terms.
            <em> (Note: This feature is planned for a future release)</em>
          </div>
        )}
      </div>

      {/* Property Selector */}
      {availableProperties.length > 0 && (
        <PropertySelector
          selected={properties}
          available={availableProperties}
          onChange={onPropertiesChange}
          disabled={isSearching}
        />
      )}
    </div>
  );
}
