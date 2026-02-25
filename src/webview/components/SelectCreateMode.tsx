import React from 'react';
import './SelectCreateMode.css';

export type CreationMode = 'fromScratch' | 'cloneExisting' | 'importFromFile';

export interface SelectCreateModeProps {
  hasCollections: boolean;
  onSelectMode: (mode: CreationMode) => void;
  onCancel: () => void;
}

export function SelectCreateMode({
  hasCollections,
  onSelectMode,
  onCancel,
}: SelectCreateModeProps) {
  return (
    <div className="select-create-mode-container">
      <div className="select-create-mode-header">
        <h2>Create Collection</h2>
        <div className="subtitle">Choose how you want to create your new collection</div>
      </div>

      <div className="options-container">
        <div
          className="option-card"
          onClick={() => onSelectMode('fromScratch')}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && onSelectMode('fromScratch')}
        >
          <span className="option-icon">📝</span>
          <div className="option-title">From Scratch</div>
          <div className="option-description">
            Create a new collection by defining its structure, properties, and configuration from
            the ground up.
          </div>
        </div>

        <div
          className={`option-card ${!hasCollections ? 'option-card-disabled' : ''}`}
          onClick={() => hasCollections && onSelectMode('cloneExisting')}
          role="button"
          tabIndex={hasCollections ? 0 : -1}
          onKeyPress={(e) => hasCollections && e.key === 'Enter' && onSelectMode('cloneExisting')}
          aria-disabled={!hasCollections}
        >
          <span className="option-icon">📋</span>
          <div className="option-title">Clone Existing Collection</div>
          <div className="option-description">
            {hasCollections
              ? "Create a new collection based on an existing collection's schema and configuration. Perfect for creating similar collections."
              : 'No collections available to clone. Create a collection first.'}
          </div>
        </div>

        <div
          className="option-card"
          onClick={() => onSelectMode('importFromFile')}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && onSelectMode('importFromFile')}
        >
          <span className="option-icon">📁</span>
          <div className="option-title">Import from File</div>
          <div className="option-description">
            Import a collection schema from a JSON file. Useful for recreating collections or
            sharing configurations.
          </div>
        </div>
      </div>
    </div>
  );
}
