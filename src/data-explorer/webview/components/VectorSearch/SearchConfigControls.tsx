import React from 'react';
import { useDataExplorer } from '../../DataExplorer';

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

  const handleDistanceCertaintyToggle = () => {
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        useDistance: !config.useDistance,
      },
    });
  };

  const handleDistanceChange = (value: number) => {
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        distance: value,
      },
    });
  };

  const handleCertaintyChange = (value: number) => {
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        certainty: value,
      },
    });
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
            className={`toggle-button ${config.useDistance ? 'active' : ''}`}
            onClick={handleDistanceCertaintyToggle}
            title="Distance: 0 = identical, higher = more different"
          >
            Distance
          </button>
          <button
            className={`toggle-button ${!config.useDistance ? 'active' : ''}`}
            onClick={handleDistanceCertaintyToggle}
            title="Certainty: 1 = identical, lower = less similar"
          >
            Certainty
          </button>
        </div>
      </div>

      {/* Threshold Slider */}
      {config.useDistance ? (
        <div className="config-section">
          <label htmlFor="distance-slider" className="config-label">
            Max Distance:
            <span className="config-value">{config.distance?.toFixed(2) || '0.50'}</span>
          </label>
          <input
            id="distance-slider"
            type="range"
            className="config-slider"
            min="0"
            max="2"
            step="0.01"
            value={config.distance || 0.5}
            onChange={(e) => handleDistanceChange(parseFloat(e.target.value))}
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
            <span className="config-value">{config.certainty?.toFixed(2) || '0.70'}</span>
          </label>
          <input
            id="certainty-slider"
            type="range"
            className="config-slider"
            min="0"
            max="1"
            step="0.01"
            value={config.certainty || 0.7}
            onChange={(e) => handleCertaintyChange(parseFloat(e.target.value))}
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
