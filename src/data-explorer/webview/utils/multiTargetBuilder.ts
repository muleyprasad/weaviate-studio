/**
 * Multi-target vector search payload builder
 * Transforms UI state into SDK-compatible target vector payloads
 */

import type { JoinStrategy, MultiTargetPayload } from '../../types';

/**
 * Build target vector payload from multi-target UI state
 * Returns a serializable payload that can be sent via message to extension
 *
 * @param selectedTargetVectors - List of selected vector names
 * @param joinStrategy - Join strategy for combining results
 * @param vectorWeights - Map of vector names to weights (for weighted strategies)
 * @returns Single vector name, multi-target payload, or undefined (for default behavior)
 * @throws If configuration is invalid
 */
export function buildTargetVectorPayload(
  selectedTargetVectors: string[],
  joinStrategy: JoinStrategy,
  vectorWeights: Record<string, number>
): string | MultiTargetPayload | undefined {
  // No vectors selected - use default
  if (!selectedTargetVectors || selectedTargetVectors.length === 0) {
    return undefined;
  }

  // Single vector - return as string for single-target behavior
  if (selectedTargetVectors.length === 1) {
    return selectedTargetVectors[0];
  }

  // Multiple vectors - build multi-target payload
  const payload: MultiTargetPayload = {
    combination: joinStrategy,
    targetVectors: selectedTargetVectors,
  };

  // Add weights for weighted strategies
  if (joinStrategy === 'manual-weights' || joinStrategy === 'relative-score') {
    // Validate that all selected vectors have weights
    const weights: Record<string, number> = {};
    let hasZeroWeight = false;

    selectedTargetVectors.forEach((vector) => {
      const weight = vectorWeights[vector] ?? 0.5;

      // Validate weight is positive
      if (weight <= 0) {
        hasZeroWeight = true;
      }

      weights[vector] = weight;
    });

    if (hasZeroWeight) {
      throw new Error('All vector weights must be greater than 0');
    }

    // Normalize weights to sum to 1.0 for manual-weights strategy
    if (joinStrategy === 'manual-weights') {
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
      if (totalWeight > 0) {
        Object.keys(weights).forEach((vector) => {
          weights[vector] = weights[vector] / totalWeight;
        });
      }
    }

    payload.weights = weights;
  }

  return payload;
}

/**
 * Validate multi-target configuration for errors
 * Used to disable search button when config is invalid
 */
export function validateMultiTargetConfig(
  selectedTargetVectors: string[],
  joinStrategy: JoinStrategy,
  vectorWeights: Record<string, number>
): { valid: boolean; error?: string } {
  // At least one vector must be selected (if multi-target is active)
  if (selectedTargetVectors.length === 0) {
    return { valid: false, error: 'At least one target vector must be selected' };
  }

  // For weighted strategies, all weights must be positive
  if (joinStrategy === 'manual-weights' || joinStrategy === 'relative-score') {
    for (const vector of selectedTargetVectors) {
      const weight = vectorWeights[vector];
      if (weight === undefined || weight <= 0) {
        return {
          valid: false,
          error: `Vector "${vector}" has invalid weight (must be > 0)`,
        };
      }
    }
  }

  return { valid: true };
}
