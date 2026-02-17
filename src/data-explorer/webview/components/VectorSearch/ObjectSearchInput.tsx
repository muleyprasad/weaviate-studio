/**
 * ObjectSearchInput - Input for finding similar objects by UUID
 * Allows users to find objects similar to a specified reference object
 */

import React, { useCallback, useState } from 'react';
import type { WeaviateObject } from '../../../types';

interface ObjectSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  selectedObject?: WeaviateObject | null;
  isSearching: boolean;
  onClearSelection?: () => void;
}

export function ObjectSearchInput({
  value,
  onChange,
  onSearch,
  selectedObject,
  isSearching,
  onClearSelection,
}: ObjectSearchInputProps) {
  const [isEditing, setIsEditing] = useState(!selectedObject);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        onSearch();
      }
    },
    [onSearch, value]
  );

  const handleChangeObject = useCallback(() => {
    setIsEditing(true);
    onClearSelection?.();
  }, [onClearSelection]);

  // Get display title from object
  const getObjectTitle = (obj: WeaviateObject): string => {
    const props = obj.properties;
    // Try common title fields
    const titleFields = ['title', 'name', 'headline', 'subject', 'label'];
    for (const field of titleFields) {
      if (props[field] && typeof props[field] === 'string') {
        return props[field] as string;
      }
    }
    // Fallback to first text property
    for (const [key, val] of Object.entries(props)) {
      if (typeof val === 'string' && val.length > 0 && val.length < 100) {
        return val;
      }
    }
    return obj.uuid;
  };

  return (
    <div className="object-search-input">
      <label htmlFor="object-search-uuid" className="input-label">
        <span className="codicon codicon-references" aria-hidden="true"></span>
        REFERENCE OBJECT
      </label>

      {selectedObject && !isEditing ? (
        <div className="selected-object-preview">
          <div className="object-preview-header">
            <span className="object-preview-id">
              <code>{selectedObject.uuid.substring(0, 8)}...</code>
            </span>
          </div>
          <div className="object-preview-title">{getObjectTitle(selectedObject)}</div>
          <button type="button" className="change-object-btn" onClick={handleChangeObject}>
            <span className="codicon codicon-edit" aria-hidden="true"></span>
            Change Object
          </button>
        </div>
      ) : (
        <>
          <input
            id="object-search-uuid"
            type="text"
            className="object-uuid-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter or paste object UUID..."
            disabled={isSearching}
          />
          <p className="input-hint">
            Paste a UUID or click "Find Similar" on any object in the table
          </p>
        </>
      )}
    </div>
  );
}
