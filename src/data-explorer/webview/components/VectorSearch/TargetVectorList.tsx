/**
 * TargetVectorList - Checkbox list of available named vectors
 * Allows user to select which vectors to target in multi-target search
 */

import React, { useCallback } from 'react';
import type { CollectionConfig, NamedVectorInfo } from '../../../types';
import { MuveraBadge } from './MuveraBadge';
import './TargetVectorList.css';

interface TargetVectorListProps {
  availableVectors: NamedVectorInfo[];
  selectedVectors: string[];
  onSelectionChange: (vectors: string[]) => void;
  disabled?: boolean;
}

export function TargetVectorList({
  availableVectors,
  selectedVectors,
  onSelectionChange,
  disabled = false,
}: TargetVectorListProps) {
  const handleCheckChange = useCallback(
    (vectorName: string, checked: boolean) => {
      if (checked) {
        onSelectionChange([...selectedVectors, vectorName]);
      } else {
        onSelectionChange(selectedVectors.filter((v) => v !== vectorName));
      }
    },
    [selectedVectors, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    onSelectionChange(availableVectors.map((v) => v.name));
  }, [availableVectors, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  if (availableVectors.length === 0) {
    return <div className="target-vector-list-empty">No named vectors available</div>;
  }

  return (
    <div className="target-vector-list">
      <div className="target-vector-controls">
        <button
          className="target-vector-action"
          onClick={handleSelectAll}
          disabled={disabled}
          aria-label="Select all vectors"
        >
          Select All
        </button>
        <button
          className="target-vector-action"
          onClick={handleDeselectAll}
          disabled={disabled}
          aria-label="Deselect all vectors"
        >
          Deselect All
        </button>
      </div>

      <div className="target-vector-items">
        {availableVectors.map((vector) => (
          <div key={vector.name} className="target-vector-item">
            <label className="target-vector-checkbox-label">
              <input
                type="checkbox"
                checked={selectedVectors.includes(vector.name)}
                onChange={(e) => handleCheckChange(vector.name, e.target.checked)}
                disabled={disabled}
                aria-label={`Select ${vector.name} vector`}
              />
              <span className="target-vector-name">{vector.name}</span>
            </label>

            <div className="target-vector-metadata">
              {vector.vectorizerName && (
                <span className="target-vector-vectorizer">{vector.vectorizerName}</span>
              )}
              {vector.isMuvera && <MuveraBadge className="target-vector-muvera" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
