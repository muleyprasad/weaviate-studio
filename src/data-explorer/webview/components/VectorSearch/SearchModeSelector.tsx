/**
 * SearchModeSelector - Tabs for selecting vector search mode
 * Three modes: Text (Semantic), Similar Object, Raw Vector
 */

import React from 'react';
import type { VectorSearchMode } from '../../context';

interface SearchModeSelectorProps {
  activeMode: VectorSearchMode;
  onModeChange: (mode: VectorSearchMode) => void;
  hasVectorizer: boolean;
}

export function SearchModeSelector({
  activeMode,
  onModeChange,
  hasVectorizer,
}: SearchModeSelectorProps) {
  const modes: { id: VectorSearchMode; label: string; icon: string; disabled?: boolean }[] = [
    {
      id: 'text',
      label: 'Text (Semantic)',
      icon: 'codicon-symbol-string',
      disabled: !hasVectorizer,
    },
    { id: 'object', label: 'Similar Object', icon: 'codicon-references' },
    { id: 'vector', label: 'Raw Vector', icon: 'codicon-symbol-array' },
    {
      id: 'hybrid',
      label: 'Hybrid',
      icon: 'codicon-combine',
      disabled: !hasVectorizer,
    },
  ];

  return (
    <div className="search-mode-selector" role="tablist" aria-label="Select search mode">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="tab"
          className={`search-mode-button ${activeMode === mode.id ? 'active' : ''}`}
          onClick={() => onModeChange(mode.id)}
          aria-selected={activeMode === mode.id}
          disabled={mode.disabled}
          title={
            mode.disabled
              ? 'Text search requires a vectorizer to be configured'
              : `Search using ${mode.label}`
          }
        >
          <span className={`codicon ${mode.icon}`} aria-hidden="true"></span>
          <span className="mode-label">{mode.label}</span>
        </button>
      ))}
    </div>
  );
}
