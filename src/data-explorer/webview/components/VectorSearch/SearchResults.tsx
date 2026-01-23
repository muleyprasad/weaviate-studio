/**
 * SearchResults - Container for displaying vector search results
 * Shows list of ResultCards with sorting and empty states
 */

import React from 'react';
import type { VectorSearchResult } from '../../context';
import type { WeaviateObject } from '../../../types';
import { ResultCard } from './ResultCard';

interface SearchResultsProps {
  results: VectorSearchResult[];
  isLoading: boolean;
  error: string | null;
  onViewObject: (object: WeaviateObject) => void;
  onFindSimilar: (objectId: string) => void;
  hasSearched?: boolean;
}

export function SearchResults({
  results,
  isLoading,
  error,
  onViewObject,
  onFindSimilar,
  hasSearched = false,
}: SearchResultsProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="search-results-loading">
        <div className="loading-spinner" />
        <span>Searching for similar objects...</span>
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
    return (
      <div className="search-results-empty">
        <span className="codicon codicon-search" aria-hidden="true"></span>
        <div className="empty-content">
          {hasSearched ? (
            <>
              <h4>No Matching Objects</h4>
              <p>
                No objects found matching your search criteria. Try adjusting the distance threshold
                or search terms.
              </p>
            </>
          ) : (
            <>
              <h4>No Results Yet</h4>
              <p>Enter a search query and click "Search" to find similar objects.</p>
            </>
          )}
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
