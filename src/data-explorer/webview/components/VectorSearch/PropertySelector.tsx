/**
 * PropertySelector - Multi-select component for choosing which properties to search in
 * Used in hybrid search to limit the search scope to specific text properties
 */

import React, { useCallback } from 'react';

interface PropertySelectorProps {
  selected: string[];
  available: string[];
  onChange: (properties: string[]) => void;
  disabled?: boolean;
}

export function PropertySelector({
  selected,
  available,
  onChange,
  disabled = false,
}: PropertySelectorProps) {
  // Handle selecting/deselecting "All" option
  const handleAllToggle = useCallback(() => {
    if (selected.length === 0 || selected.length === available.length) {
      // If all or none selected, toggle to none or all
      onChange(selected.length === available.length ? [] : [...available]);
    } else {
      // Select all
      onChange([...available]);
    }
  }, [selected, available, onChange]);

  // Handle individual property toggle
  const handlePropertyToggle = useCallback(
    (propertyName: string) => {
      if (selected.includes(propertyName)) {
        onChange(selected.filter((p) => p !== propertyName));
      } else {
        onChange([...selected, propertyName]);
      }
    },
    [selected, onChange]
  );

  const isAllSelected = selected.length === available.length && available.length > 0;
  const isNoneSelected = selected.length === 0;

  return (
    <div className="property-selector">
      <label className="property-selector-label">
        <span className="codicon codicon-list-selection" aria-hidden="true"></span>
        Search in properties
      </label>

      <div className="property-chips">
        {/* All option */}
        <button
          type="button"
          className={`property-chip ${isAllSelected || isNoneSelected ? 'active' : ''}`}
          onClick={handleAllToggle}
          disabled={disabled}
          title="Search in all text properties"
        >
          All
        </button>

        {/* Individual property chips */}
        {available.map((property) => (
          <button
            key={property}
            type="button"
            className={`property-chip ${selected.includes(property) ? 'active' : ''}`}
            onClick={() => handlePropertyToggle(property)}
            disabled={disabled}
            title={`Search in ${property}`}
          >
            {property}
          </button>
        ))}
      </div>

      {isNoneSelected && available.length > 0 && (
        <p className="property-hint">
          <span className="codicon codicon-info" aria-hidden="true"></span>
          No properties selected - will search all text properties
        </p>
      )}
    </div>
  );
}
