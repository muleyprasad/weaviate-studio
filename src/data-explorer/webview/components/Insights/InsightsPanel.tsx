/**
 * InsightsPanel - Collapsible panel showing aggregation statistics
 * Displays total count, top values, numeric stats, date ranges, and boolean counts
 */

import React, { useState, useCallback, useEffect } from 'react';
import type {
  AggregationResult,
  CollectionConfig,
  FilterCondition,
  FilterMatchMode,
} from '../../../types';
import { CategoryBreakdown } from './CategoryBreakdown';
import { NumericStats } from './NumericStats';
import { DateRangeDisplay } from './DateRangeDisplay';
import { BooleanStats } from './BooleanStats';
import { postMessageToExtension } from '../../utils/vscodeApi';

export interface InsightsPanelProps {
  collectionName: string;
  schema: CollectionConfig | null;
  totalCount: number;
  activeFilters?: FilterCondition[];
  matchMode?: FilterMatchMode;
}

export function InsightsPanel({
  collectionName,
  schema,
  totalCount,
  activeFilters,
  matchMode,
}: InsightsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [aggregations, setAggregations] = useState<AggregationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // Fetch aggregations when collection or filters change
  const fetchAggregations = useCallback(() => {
    if (!collectionName) return;

    setLoading(true);
    setError(null);

    postMessageToExtension({
      command: 'getAggregations',
      aggregationParams: {
        collectionName,
        where: activeFilters,
        matchMode: matchMode,
      },
      requestId: `agg-${Date.now()}`,
    });
  }, [collectionName, activeFilters, matchMode]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === 'aggregationsLoaded') {
        setAggregations(message.aggregations);
        setLoading(false);
      } else if (message.command === 'error' && message.requestId?.startsWith('agg-')) {
        setError(message.error);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchAggregations();
  }, [fetchAggregations]);

  // Don't render if no schema
  if (!schema) return null;

  const hasTopValues = aggregations?.topValues && aggregations.topValues.length > 0;
  const hasNumericStats = aggregations?.numericStats && aggregations.numericStats.length > 0;
  const hasDateRanges = aggregations?.dateRange && aggregations.dateRange.length > 0;
  const hasBooleanCounts = aggregations?.booleanCounts && aggregations.booleanCounts.length > 0;
  const hasAnyData = hasTopValues || hasNumericStats || hasDateRanges || hasBooleanCounts;

  return (
    <div className={`insights-panel ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="insights-header"
        onClick={toggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggleCollapse()}
        aria-expanded={!collapsed}
        aria-controls="insights-body"
      >
        <h3>
          <span className="codicon codicon-graph" aria-hidden="true"></span>
          Quick Insights
        </h3>
        <div className="insights-header-right">
          {!collapsed && (
            <button
              type="button"
              className="refresh-btn"
              onClick={(e) => {
                e.stopPropagation();
                fetchAggregations();
              }}
              title="Refresh aggregations"
              disabled={loading}
            >
              <span
                className={`codicon codicon-refresh ${loading ? 'spin' : ''}`}
                aria-hidden="true"
              ></span>
            </button>
          )}
          <span
            className={`codicon ${collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}`}
            aria-hidden="true"
          ></span>
        </div>
      </div>

      {!collapsed && (
        <div className="insights-body" id="insights-body">
          {loading && !aggregations ? (
            <div className="insights-loading">
              <div className="loading-spinner small"></div>
              <span>Loading insights...</span>
            </div>
          ) : error ? (
            <div className="insights-error">
              <span className="codicon codicon-warning" aria-hidden="true"></span>
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Total Count */}
              <div className="insight-row total-count">
                <span className="insight-label">Total Objects</span>
                <span className="insight-value">
                  {(aggregations?.totalCount ?? totalCount).toLocaleString()}
                </span>
              </div>

              {/* Categorical/Top Values */}
              {hasTopValues && (
                <div className="insights-section">
                  {aggregations!.topValues!.map((category) => (
                    <CategoryBreakdown key={category.property} data={category} />
                  ))}
                </div>
              )}

              {/* Numeric Stats */}
              {hasNumericStats && (
                <div className="insights-section">
                  {aggregations!.numericStats!.map((stats) => (
                    <NumericStats key={stats.property} data={stats} />
                  ))}
                </div>
              )}

              {/* Date Ranges */}
              {hasDateRanges && (
                <div className="insights-section">
                  {aggregations!.dateRange!.map((range) => (
                    <DateRangeDisplay key={range.property} data={range} />
                  ))}
                </div>
              )}

              {/* Boolean Counts */}
              {hasBooleanCounts && (
                <div className="insights-section">
                  {aggregations!.booleanCounts!.map((counts) => (
                    <BooleanStats key={counts.property} data={counts} />
                  ))}
                </div>
              )}

              {/* No data message */}
              {!hasAnyData && !loading && (
                <div className="insights-empty">
                  <span className="codicon codicon-info" aria-hidden="true"></span>
                  <span>No aggregation data available</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default InsightsPanel;
