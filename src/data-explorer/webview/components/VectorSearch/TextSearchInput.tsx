/**
 * TextSearchInput - Input for semantic text search
 * Allows users to enter natural language queries for vector similarity search
 */

import React, { useCallback } from 'react';

interface TextSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  vectorizerName?: string;
  isSearching: boolean;
}

export function TextSearchInput({
  value,
  onChange,
  onSearch,
  vectorizerName,
  isSearching,
}: TextSearchInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
        e.preventDefault();
        onSearch();
      }
    },
    [onSearch, value]
  );

  return (
    <div className="text-search-input">
      <div className="input-label-row">
        <label htmlFor="text-search-query" className="input-label">
          <span className="codicon codicon-search" aria-hidden="true"></span>
          SEMANTIC QUERY
        </label>
        {vectorizerName && (
          <span id="vectorizer-info" className="embedding-info">
            Embedding: <strong>{vectorizerName}</strong>
          </span>
        )}
      </div>

      <textarea
        id="text-search-query"
        className="text-search-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter your search query..."
        rows={3}
        disabled={isSearching}
        aria-describedby="vectorizer-info"
      />

      <p className="input-hint">Natural language search</p>
    </div>
  );
}
