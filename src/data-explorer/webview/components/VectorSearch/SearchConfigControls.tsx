import React, { useState, useEffect, useRef } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { DISTANCE_THRESHOLDS, CERTAINTY_THRESHOLDS } from '../../../constants';

/**
 * Search Configuration Controls - Common settings for all vector search modes
 *
 * Provides controls for:
 * - Distance vs Certainty toggle
 * - Distance/Certainty threshold
 * - Result limit
 */
export function SearchConfigControls() {
  const { state, dispatch } = useDataExplorer();
  const { vectorSearch } = state;
  const { config } = vectorSearch;

  // Local state for debounced slider values
  const [localDistance, setLocalDistance] = useState(config.distance ?? 0.5);
  const [localCertainty, setLocalCertainty] = useState(config.certainty ?? 0.7);
  const distanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const certaintyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with config when it changes externally
  useEffect(() => {
    setLocalDistance(config.distance ?? 0.5);
  }, [config.distance]);

  useEffect(() => {
    setLocalCertainty(config.certainty ?? 0.7);
  }, [config.certainty]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (distanceTimeoutRef.current) clearTimeout(distanceTimeoutRef.current);
      if (certaintyTimeoutRef.current) clearTimeout(certaintyTimeoutRef.current);
    };
  }, []);

  const handleDistanceCertaintyToggle = () => {
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        useDistanceMetric: !config.useDistanceMetric,
      },
    });
  };

  const handleDistanceChange = (value: number) => {
    setLocalDistance(value); // Update local state immediately for responsive UI

    // Clear existing timeout
    if (distanceTimeoutRef.current) {
      clearTimeout(distanceTimeoutRef.current);
    }

    // Dispatch update after debounce delay
    distanceTimeoutRef.current = setTimeout(() => {
      dispatch({
        type: 'SET_VECTOR_SEARCH_CONFIG',
        payload: {
          distance: value,
        },
      });
    }, 150); // 150ms debounce
  };

  const handleCertaintyChange = (value: number) => {
    setLocalCertainty(value); // Update local state immediately for responsive UI

    // Clear existing timeout
    if (certaintyTimeoutRef.current) {
      clearTimeout(certaintyTimeoutRef.current);
    }

    // Dispatch update after debounce delay
    certaintyTimeoutRef.current = setTimeout(() => {
      dispatch({
        type: 'SET_VECTOR_SEARCH_CONFIG',
        payload: {
          certainty: value,
        },
      });
    }, 150); // 150ms debounce
  };

  const handleLimitChange = (value: number) => {
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        limit: value,
      },
    });
  };

  return (
    <div className="search-config-controls">
      {/* Distance vs Certainty Toggle */}
      <div className="config-section">
        <label className="config-label">Similarity Metric:</label>
        <div className="metric-toggle">
          <button
            className={`toggle-button ${config.useDistanceMetric ? 'active' : ''}`}
            onClick={handleDistanceCertaintyToggle}
            title="Distance: 0 = identical, higher = more different"
          >
            Distance
          </button>
          <button
            className={`toggle-button ${!config.useDistanceMetric ? 'active' : ''}`}
            onClick={handleDistanceCertaintyToggle}
            title="Certainty: 1 = identical, lower = less similar"
          >
            Certainty
          </button>
        </div>
      </div>

      {/* Threshold Slider */}
      {config.useDistanceMetric ? (
        <div className="config-section">
          <label htmlFor="distance-slider" className="config-label">
            Max Distance:
            <span className="config-value">{localDistance.toFixed(2)}</span>
          </label>
          <input
            id="distance-slider"
            type="range"
            className="config-slider"
            min={DISTANCE_THRESHOLDS.MIN}
            max={DISTANCE_THRESHOLDS.MAX}
            step={DISTANCE_THRESHOLDS.STEP}
            value={localDistance}
            onChange={(e) => handleDistanceChange(parseFloat(e.target.value))}
            aria-label={`Maximum distance threshold: ${localDistance.toFixed(2)}`}
            aria-valuemin={DISTANCE_THRESHOLDS.MIN}
            aria-valuemax={DISTANCE_THRESHOLDS.MAX}
            aria-valuenow={localDistance}
            aria-valuetext={`${localDistance.toFixed(2)} - Objects with distance greater than this will be excluded`}
          />
          <div className="slider-labels">
            <span>0.0 (identical)</span>
            <span>2.0 (very different)</span>
          </div>
          <div className="config-hint">
            Objects with distance greater than this will be excluded
          </div>
        </div>
      ) : (
        <div className="config-section">
          <label htmlFor="certainty-slider" className="config-label">
            Min Certainty:
            <span className="config-value">{localCertainty.toFixed(2)}</span>
          </label>
          <input
            id="certainty-slider"
            type="range"
            className="config-slider"
            min={CERTAINTY_THRESHOLDS.MIN}
            max={CERTAINTY_THRESHOLDS.MAX}
            step={CERTAINTY_THRESHOLDS.STEP}
            value={localCertainty}
            onChange={(e) => handleCertaintyChange(parseFloat(e.target.value))}
            aria-label={`Minimum certainty threshold: ${localCertainty.toFixed(2)}`}
            aria-valuemin={CERTAINTY_THRESHOLDS.MIN}
            aria-valuemax={CERTAINTY_THRESHOLDS.MAX}
            aria-valuenow={localCertainty}
            aria-valuetext={`${localCertainty.toFixed(2)} - Objects with certainty lower than this will be excluded`}
          />
          <div className="slider-labels">
            <span>0.0 (low confidence)</span>
            <span>1.0 (identical)</span>
          </div>
          <div className="config-hint">
            Objects with certainty lower than this will be excluded
          </div>
        </div>
      )}

      {/* Result Limit */}
      <div className="config-section">
        <label htmlFor="limit-select" className="config-label">
          Limit Results:
        </label>
        <select
          id="limit-select"
          className="config-select"
          value={config.limit}
          onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>
  );
}
