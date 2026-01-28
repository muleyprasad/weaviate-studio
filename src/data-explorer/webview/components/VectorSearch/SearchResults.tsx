/**
 * SearchResults - Container for displaying vector search results
 * Shows list of ResultCards with sorting and empty states
 */

import React from 'react';
import type { VectorSearchResult } from '../../context';
import type { WeaviateObject } from '../../../types';
import { ResultCard } from './ResultCard';
import { SkeletonResultCard, NoSearchResultsEmptyState } from '../common';

interface SearchResultsProps {
  results: VectorSearchResult[];
  isLoading: boolean;
  error: string | null;
  onViewObject: (object: WeaviateObject) => void;
  onFindSimilar: (objectId: string) => void;
  hasSearched?: boolean;
  searchMode?: string;
  onClearSearch?: () => void;
}

export function SearchResults({
  results,
  isLoading,
  error,
  onViewObject,
  onFindSimilar,
  hasSearched = false,
  searchMode,
  onClearSearch,
}: SearchResultsProps) {
  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="search-results-loading" role="status" aria-label="Searching">
        <div className="loading-spinner" />
        <span className="loading-message">Searching for similar objects...</span>
        <div className="skeleton-results">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonResultCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="search-results-error">
        <span className="codicon codicon-error" aria-hidden="true"></span>
        <div className="error-content">
          <h4>Search Error</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (results.length === 0) {
    if (hasSearched) {
      return <NoSearchResultsEmptyState onClearSearch={onClearSearch} searchMode={searchMode} />;
    }

    return (
      <div className="search-results-empty">
        <span className="codicon codicon-search" aria-hidden="true"></span>
        <div className="empty-content">
          <h4>No Results Yet</h4>
          <p>Enter a search query and click "Search" to find similar objects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      <div className="results-header">
        <h3>
          <span className="codicon codicon-list-unordered" aria-hidden="true"></span>
          Search Results
        </h3>
        <span className="results-count">{results.length} found</span>
      </div>

      <div className="results-list" role="list">
        {results.map((result, index) => (
          <ResultCard
            key={result.object.uuid}
            object={result.object}
            distance={result.distance}
            certainty={result.certainty}
            rank={index + 1}
            onView={() => onViewObject(result.object)}
            onFindSimilar={() => onFindSimilar(result.object.uuid)}
            explainScore={result.explainScore}
          />
        ))}
      </div>
    </div>
  );
}
