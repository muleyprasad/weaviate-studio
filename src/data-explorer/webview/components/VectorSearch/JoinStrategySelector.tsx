/**
 * JoinStrategySelector - Select join strategy for multi-target vector search
 * Provides dropdown with strategies and conditionally renders weight editor
 */

import React, { useCallback } from 'react';
import type { JoinStrategy } from '../../../types';
import { WeightEditor } from './WeightEditor';
import './JoinStrategySelector.css';

interface JoinStrategySelectorProps {
  selectedVectors: string[];
  joinStrategy: JoinStrategy;
  vectorWeights: Record<string, number>;
  onStrategyChange: (strategy: JoinStrategy) => void;
  onWeightChange: (vectorName: string, weight: number) => void;
  onNormalize: () => void;
  versionSupported: boolean;
  disabled?: boolean;
}

const STRATEGY_DESCRIPTIONS: Record<JoinStrategy, string> = {
  minimum: 'Default conservative merge',
  sum: 'Sum of distances',
  average: 'Average of distances',
  'manual-weights': 'Weighted raw distances',
  'relative-score': 'Weighted normalized distances',
};

export function JoinStrategySelector({
  selectedVectors,
  joinStrategy,
  vectorWeights,
  onStrategyChange,
  onWeightChange,
  onNormalize,
  versionSupported,
  disabled = false,
}: JoinStrategySelectorProps) {
  const handleStrategyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onStrategyChange(e.target.value as JoinStrategy);
    },
    [onStrategyChange]
  );

  const isWeightedStrategy = joinStrategy === 'manual-weights' || joinStrategy === 'relative-score';

  // Ensure all selected vectors have weights initialized
  const initializedWeights: Record<string, number> = {};
  selectedVectors.forEach((vector) => {
    initializedWeights[vector] = vectorWeights[vector] ?? 0.5;
  });

  if (!versionSupported) {
    return (
      <div className="join-strategy-unsupported">
        <p>
          Multi-target vector search requires Weaviate v1.26+ for near queries or v1.27+ for hybrid
          search.
        </p>
      </div>
    );
  }

  return (
    <div className="join-strategy-selector">
      <div className="join-strategy-control">
        <label htmlFor="join-strategy-select">Join Strategy</label>
        <select
          id="join-strategy-select"
          value={joinStrategy}
          onChange={handleStrategyChange}
          disabled={disabled || selectedVectors.length < 2}
          className="join-strategy-select"
          aria-label="Select join strategy for multi-target search"
        >
          {Object.entries(STRATEGY_DESCRIPTIONS).map(([strategy, description]) => (
            <option key={strategy} value={strategy}>
              {strategy.charAt(0).toUpperCase() + strategy.slice(1).replace('-', ' ')} -{' '}
              {description}
            </option>
          ))}
        </select>
      </div>

      {isWeightedStrategy && selectedVectors.length > 0 && (
        <WeightEditor
          selectedVectors={selectedVectors}
          weights={initializedWeights}
          onWeightChange={onWeightChange}
          onNormalize={onNormalize}
          disabled={disabled}
        />
      )}
    </div>
  );
}
