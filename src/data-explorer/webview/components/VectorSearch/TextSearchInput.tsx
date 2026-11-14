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
      <label htmlFor="text-search-query" className="input-label">
        SEMANTIC QUERY
      </label>

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

      <div className="input-meta">
        {vectorizerName ? (
          <span id="vectorizer-info">
            Embedding: <strong>{vectorizerName}</strong>
          </span>
        ) : (
          <span />
        )}
        <span>Natural language search</span>
      </div>
    </div>
  );
}
