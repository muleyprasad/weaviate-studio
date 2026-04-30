/**
 * VectorOptionsDrawer - Main container for vector options (multi-target search)
 * Collapsible drawer that appears only for multi-vector collections
 */

import React, { useCallback } from 'react';
import type { CollectionConfig, JoinStrategy, NamedVectorInfo } from '../../../types';
import { TargetVectorList } from './TargetVectorList';
import { JoinStrategySelector } from './JoinStrategySelector';
import './VectorOptionsDrawer.css';

interface VectorOptionsDrawerProps {
  availableVectors: NamedVectorInfo[];
  expanded: boolean;
  selectedVectors: string[];
  joinStrategy: JoinStrategy;
  vectorWeights: Record<string, number>;
  onExpandedChange: (expanded: boolean) => void;
  onSelectedVectorsChange: (vectors: string[]) => void;
  onJoinStrategyChange: (strategy: JoinStrategy) => void;
  onWeightChange: (vectorName: string, weight: number) => void;
  onNormalize: () => void;
  versionSupported: boolean;
  disabled?: boolean;
}

export function VectorOptionsDrawer({
  availableVectors,
  expanded,
  selectedVectors,
  joinStrategy,
  vectorWeights,
  onExpandedChange,
  onSelectedVectorsChange,
  onJoinStrategyChange,
  onWeightChange,
  onNormalize,
  versionSupported,
  disabled = false,
}: VectorOptionsDrawerProps) {
  const handleToggle = useCallback(() => {
    onExpandedChange(!expanded);
  }, [expanded, onExpandedChange]);

  // Only show drawer if there are multiple vectors
  if (availableVectors.length < 2) {
    return null;
  }

  return (
    <div className="vector-options-drawer">
      <button
        className="vector-options-header"
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls="vector-options-content"
      >
        <span className="vector-options-chevron">{expanded ? '▼' : '▸'}</span>
        <span className="vector-options-title">Vector Options</span>
        <span className="vector-options-count">({availableVectors.length} vectors)</span>
      </button>

      {expanded && (
        <div id="vector-options-content" className="vector-options-content">
          <div className="vector-options-section">
            <h4 className="vector-options-section-title">Target Vectors</h4>
            <TargetVectorList
              availableVectors={availableVectors}
              selectedVectors={selectedVectors}
              onSelectionChange={onSelectedVectorsChange}
              disabled={disabled}
            />
          </div>

          {selectedVectors.length > 0 && (
            <>
              <div className="vector-options-divider"></div>
              <div className="vector-options-section">
                <h4 className="vector-options-section-title">Join Strategy</h4>
                <JoinStrategySelector
                  selectedVectors={selectedVectors}
                  joinStrategy={joinStrategy}
                  vectorWeights={vectorWeights}
                  onStrategyChange={onJoinStrategyChange}
                  onWeightChange={onWeightChange}
                  onNormalize={onNormalize}
                  versionSupported={versionSupported}
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
