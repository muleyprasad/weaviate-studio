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
        <span className="codicon codicon-search" aria-hidden="true"></span>
        SEMANTIC QUERY
      </label>

      <textarea
        id="text-search-query"
        className="text-search-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter your search query...&#10;e.g., 'machine learning healthcare applications'"
        rows={4}
        disabled={isSearching}
        aria-describedby="vectorizer-info"
      />

      {vectorizerName && (
        <div id="vectorizer-info" className="vectorizer-info">
          <span className="codicon codicon-info" aria-hidden="true"></span>
          <span>
            Using: <strong>{vectorizerName}</strong>
          </span>
        </div>
      )}

      <p className="input-hint">Enter natural language to find semantically similar objects</p>
    </div>
  );
}
