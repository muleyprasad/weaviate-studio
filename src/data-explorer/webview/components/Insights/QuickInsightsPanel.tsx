/**
 * QuickInsightsPanel - Display collection insights and aggregations
 */

import React, { useEffect, useState } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import type {
  CategoricalAggregation,
  NumericAggregation,
  DateAggregation,
  PropertySchema,
} from '../../../types';

export function QuickInsightsPanel() {
  const { state, dispatch } = useDataExplorer();
  const [showConfig, setShowConfig] = useState(false);

  // Auto-initialize insights config when schema loads
  useEffect(() => {
    if (!state.schema || state.insights.config.categoricalProperties.length > 0) {
      return;
    }

    // Auto-select first few categorical and numeric properties
    const categoricalProps: string[] = [];
    const numericProps: string[] = [];
    const dateProps: string[] = [];

    state.schema.properties.forEach((prop) => {
      if (prop.indexFilterable === false) return;

      if (prop.dataType === 'text' && categoricalProps.length < 3) {
        categoricalProps.push(prop.name);
      } else if (
        (prop.dataType === 'int' || prop.dataType === 'number') &&
        numericProps.length < 2
      ) {
        numericProps.push(prop.name);
      } else if (prop.dataType === 'date' && dateProps.length < 1) {
        dateProps.push(prop.name);
      }
    });

    dispatch({
      type: 'UPDATE_INSIGHTS_CONFIG',
      payload: {
        categoricalProperties: categoricalProps,
        numericProperties: numericProps,
        dateProperties: dateProps,
      },
    });
  }, [state.schema, state.insights.config.categoricalProperties.length, dispatch]);

  const handleRefresh = () => {
    dispatch({ type: 'REFRESH_INSIGHTS' });
  };

  const handleToggleProperty = (
    type: 'categorical' | 'numeric' | 'date',
    propertyName: string
  ) => {
    const configKey =
      type === 'categorical'
        ? 'categoricalProperties'
        : type === 'numeric'
        ? 'numericProperties'
        : 'dateProperties';

    const currentList = state.insights.config[configKey];
    const newList = currentList.includes(propertyName)
      ? currentList.filter((p) => p !== propertyName)
      : [...currentList, propertyName];

    dispatch({
      type: 'UPDATE_INSIGHTS_CONFIG',
      payload: { [configKey]: newList },
    });
  };

  if (!state.schema) {
    return null;
  }

  const hasData =
    state.insights.categoricalAggregations.length > 0 ||
    state.insights.numericAggregations.length > 0 ||
    state.insights.dateAggregations.length > 0;

  return (
    <div className="insights-panel" role="region" aria-label="Quick insights panel">
      <div className="insights-header">
        <h3 className="insights-title">
          📊 Collection Insights: {state.collectionName}
        </h3>
        <div className="insights-actions">
          <button
            className="insights-action-button"
            onClick={() => setShowConfig(!showConfig)}
            aria-label="Configure metrics"
          >
            ⚙️ Configure
          </button>
          <button
            className="insights-action-button primary"
            onClick={handleRefresh}
            disabled={state.insights.loading}
            aria-label="Refresh insights"
          >
            {state.insights.loading ? '⟳ Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="insights-config">
          <InsightsConfigPanel
            schema={state.schema}
            config={state.insights.config}
            onToggleProperty={handleToggleProperty}
          />
        </div>
      )}

      {/* Loading State */}
      {state.insights.loading && (
        <div className="insights-loading">
          <div className="loading-spinner"></div>
          <p>Analyzing collection data...</p>
        </div>
      )}

      {/* Error State */}
      {state.insights.error && (
        <div className="insights-error" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{state.insights.error}</span>
        </div>
      )}

      {/* Insights Data */}
      {!state.insights.loading && hasData && (
        <div className="insights-content">
          {/* Total Count */}
          <div className="insights-total">
            <strong>Total Objects:</strong> {state.insights.totalCount.toLocaleString()}
          </div>

          {/* Categorical Aggregations */}
          {state.insights.categoricalAggregations.length > 0 && (
            <div className="insights-section">
              <div className="insights-categorical-grid">
                {state.insights.categoricalAggregations.map((agg) => (
                  <CategoricalCard key={agg.property} aggregation={agg} />
                ))}
              </div>
            </div>
          )}

          {/* Numeric Aggregations */}
          {state.insights.numericAggregations.length > 0 && (
            <div className="insights-section">
              {state.insights.numericAggregations.map((agg) => (
                <NumericCard key={agg.property} aggregation={agg} />
              ))}
            </div>
          )}

          {/* Date Aggregations */}
          {state.insights.dateAggregations.length > 0 && (
            <div className="insights-section">
              {state.insights.dateAggregations.map((agg) => (
                <DateCard key={agg.property} aggregation={agg} />
              ))}
            </div>
          )}

          {/* Last Refreshed */}
          {state.insights.lastRefreshed && (
            <div className="insights-meta">
              Last refreshed: {new Date(state.insights.lastRefreshed).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!state.insights.loading && !hasData && !state.insights.error && (
        <div className="insights-empty">
          <p>Click "Refresh" to load collection insights.</p>
          <p>Configure which properties to analyze using the "Configure" button.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Configuration panel for selecting properties to analyze
 */
interface InsightsConfigPanelProps {
  schema: { properties: PropertySchema[] };
  config: {
    categoricalProperties: string[];
    numericProperties: string[];
    dateProperties: string[];
  };
  onToggleProperty: (
    type: 'categorical' | 'numeric' | 'date',
    propertyName: string
  ) => void;
}

function InsightsConfigPanel({
  schema,
  config,
  onToggleProperty,
}: InsightsConfigPanelProps) {
  const categoricalProps = schema.properties.filter(
    (p) => p.dataType === 'text' && p.indexFilterable !== false
  );
  const numericProps = schema.properties.filter(
    (p) =>
      (p.dataType === 'int' || p.dataType === 'number') &&
      p.indexFilterable !== false
  );
  const dateProps = schema.properties.filter(
    (p) => p.dataType === 'date' && p.indexFilterable !== false
  );

  return (
    <div className="insights-config-panel">
      <h4>Select Properties to Analyze</h4>

      {categoricalProps.length > 0 && (
        <div className="config-section">
          <h5>Categorical (Text)</h5>
          {categoricalProps.map((prop) => (
            <label key={prop.name} className="config-checkbox">
              <input
                type="checkbox"
                checked={config.categoricalProperties.includes(prop.name)}
                onChange={() => onToggleProperty('categorical', prop.name)}
              />
              <span>{prop.name}</span>
            </label>
          ))}
        </div>
      )}

      {numericProps.length > 0 && (
        <div className="config-section">
          <h5>Numeric (Int/Number)</h5>
          {numericProps.map((prop) => (
            <label key={prop.name} className="config-checkbox">
              <input
                type="checkbox"
                checked={config.numericProperties.includes(prop.name)}
                onChange={() => onToggleProperty('numeric', prop.name)}
              />
              <span>{prop.name}</span>
            </label>
          ))}
        </div>
      )}

      {dateProps.length > 0 && (
        <div className="config-section">
          <h5>Date</h5>
          {dateProps.map((prop) => (
            <label key={prop.name} className="config-checkbox">
              <input
                type="checkbox"
                checked={config.dateProperties.includes(prop.name)}
                onChange={() => onToggleProperty('date', prop.name)}
              />
              <span>{prop.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Card for displaying categorical aggregation
 */
interface CategoricalCardProps {
  aggregation: CategoricalAggregation;
}

function CategoricalCard({ aggregation }: CategoricalCardProps) {
  return (
    <div className="categorical-card">
      <h4 className="card-title">{aggregation.property}</h4>
      <div className="categorical-list">
        {aggregation.topOccurrences.slice(0, 10).map((item, index) => (
          <div key={index} className="categorical-item">
            <span className="categorical-value">{item.value || '(empty)'}</span>
            <span className="categorical-count">
              {item.count.toLocaleString()}
              {item.percentage !== undefined && ` (${item.percentage.toFixed(1)}%)`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Card for displaying numeric aggregation
 */
interface NumericCardProps {
  aggregation: NumericAggregation;
}

function NumericCard({ aggregation }: NumericCardProps) {
  return (
    <div className="numeric-card">
      <h4 className="card-title">{aggregation.property} (numeric stats)</h4>
      <div className="numeric-stats">
        <div className="stat-row">
          <div className="stat-item">
            <span className="stat-label">Count:</span>
            <span className="stat-value">{aggregation.count.toLocaleString()}</span>
          </div>
          {aggregation.min !== undefined && (
            <div className="stat-item">
              <span className="stat-label">Min:</span>
              <span className="stat-value">{aggregation.min.toLocaleString()}</span>
            </div>
          )}
          {aggregation.max !== undefined && (
            <div className="stat-item">
              <span className="stat-label">Max:</span>
              <span className="stat-value">{aggregation.max.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="stat-row">
          {aggregation.mean !== undefined && (
            <div className="stat-item">
              <span className="stat-label">Mean:</span>
              <span className="stat-value">{aggregation.mean.toFixed(2)}</span>
            </div>
          )}
          {aggregation.median !== undefined && (
            <div className="stat-item">
              <span className="stat-label">Median:</span>
              <span className="stat-value">{aggregation.median.toLocaleString()}</span>
            </div>
          )}
          {aggregation.mode !== undefined && (
            <div className="stat-item">
              <span className="stat-label">Mode:</span>
              <span className="stat-value">{aggregation.mode.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Distribution */}
      {aggregation.distribution && aggregation.distribution.length > 0 && (
        <div className="numeric-distribution">
          <h5>Distribution:</h5>
          {aggregation.distribution.map((bucket, index) => (
            <div key={index} className="distribution-bucket">
              <span className="bucket-range">{bucket.range}:</span>
              <div className="bucket-bar-container">
                <div
                  className="bucket-bar"
                  style={{ width: `${bucket.percentage}%` }}
                  aria-label={`${bucket.percentage.toFixed(1)}%`}
                ></div>
              </div>
              <span className="bucket-stats">
                {bucket.count.toLocaleString()} ({bucket.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Card for displaying date aggregation
 */
interface DateCardProps {
  aggregation: DateAggregation;
}

function DateCard({ aggregation }: DateCardProps) {
  return (
    <div className="date-card">
      <h4 className="card-title">{aggregation.property} Range</h4>
      <div className="date-range">
        {aggregation.earliest && (
          <div className="date-item">
            <span className="date-label">Earliest:</span>
            <span className="date-value">
              {new Date(aggregation.earliest).toLocaleDateString()}
            </span>
          </div>
        )}
        {aggregation.latest && (
          <div className="date-item">
            <span className="date-label">Latest:</span>
            <span className="date-value">
              {new Date(aggregation.latest).toLocaleDateString()}
            </span>
          </div>
        )}
        <div className="date-item">
          <span className="date-label">Count:</span>
          <span className="date-value">{aggregation.count.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
