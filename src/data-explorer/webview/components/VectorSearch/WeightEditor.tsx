/**
 * WeightEditor - Edit weights for manual-weights and relative-score join strategies
 * Provides sliders and numeric inputs for weight adjustment with normalize action
 */

import React, { useCallback, useMemo } from 'react';
import './WeightEditor.css';

interface WeightEditorProps {
  selectedVectors: string[];
  weights: Record<string, number>;
  onWeightChange: (vectorName: string, weight: number) => void;
  onNormalize: () => void;
  disabled?: boolean;
}

export function WeightEditor({
  selectedVectors,
  weights,
  onWeightChange,
  onNormalize,
  disabled = false,
}: WeightEditorProps) {
  const totalWeight = useMemo(() => {
    return Object.values(weights).reduce((sum, w) => sum + w, 0);
  }, [weights]);

  const handleSliderChange = useCallback(
    (vectorName: string, value: number) => {
      onWeightChange(vectorName, parseFloat(value.toFixed(2)));
    },
    [onWeightChange]
  );

  const handleInputChange = useCallback(
    (vectorName: string, valueStr: string) => {
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        onWeightChange(vectorName, Math.max(0, Math.min(1, value)));
      }
    },
    [onWeightChange]
  );

  const getVectorWeight = (vectorName: string): number => {
    return weights[vectorName] ?? 0.5;
  };

  const isValidWeight = (weight: number) => weight > 0;

  return (
    <div className="weight-editor">
      <div className="weight-editor-header">
        <h4>Vector Weights</h4>
        <button
          className="weight-editor-normalize-btn"
          onClick={onNormalize}
          disabled={disabled || totalWeight === 0}
          title="Normalize all weights to sum to 1.0"
        >
          Normalize
        </button>
      </div>

      <div className="weight-editor-items">
        {selectedVectors.map((vectorName) => {
          const weight = getVectorWeight(vectorName);
          const isValid = isValidWeight(weight);

          return (
            <div key={vectorName} className={`weight-editor-item ${!isValid ? 'invalid' : ''}`}>
              <label className="weight-editor-label">{vectorName}</label>

              <div className="weight-editor-controls">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={weight}
                  onChange={(e) => handleSliderChange(vectorName, parseFloat(e.target.value))}
                  disabled={disabled}
                  className="weight-editor-slider"
                  aria-label={`Weight for ${vectorName}`}
                />

                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={weight.toFixed(2)}
                  onChange={(e) => handleInputChange(vectorName, e.target.value)}
                  disabled={disabled}
                  className="weight-editor-input"
                  aria-label={`Numeric weight input for ${vectorName}`}
                />
              </div>

              {!isValid && <span className="weight-editor-warning">Weight must be &gt; 0</span>}
            </div>
          );
        })}
      </div>

      <div className="weight-editor-stats">
        <span>Total weight: {totalWeight.toFixed(2)}</span>
        {totalWeight > 0 && selectedVectors.length > 0 && (
          <span>Average: {(totalWeight / selectedVectors.length).toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
