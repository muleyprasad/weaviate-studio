/**
 * NumericStats - Displays statistics for numeric properties
 * Shows count, min, max, mean, median, sum
 */

import React from 'react';
import type { PropertyNumericStats } from '../../../types';

export interface NumericStatsProps {
  data: PropertyNumericStats;
}

/**
 * Formats a number for display, handling large numbers with abbreviations
 */
function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';

  // Handle very small decimal numbers
  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2);
  }

  // Format large numbers with abbreviations
  if (Math.abs(value) >= 1000000000) {
    return (value / 1000000000).toFixed(1) + 'B';
  }
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  }

  // Format with appropriate decimal places
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function NumericStats({ data }: NumericStatsProps) {
  return (
    <div className="numeric-stats">
      <h4 className="property-name">
        <span className="codicon codicon-symbol-numeric" aria-hidden="true"></span>
        {data.property}
      </h4>
      <div className="numeric-stats-grid">
        <div className="stat-item">
          <span className="stat-label">Count</span>
          <span className="stat-value">{formatNumber(data.count)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Min</span>
          <span className="stat-value">{formatNumber(data.min)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Max</span>
          <span className="stat-value">{formatNumber(data.max)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Mean</span>
          <span className="stat-value">{formatNumber(data.mean)}</span>
        </div>
        {data.median !== undefined && (
          <div className="stat-item">
            <span className="stat-label">Median</span>
            <span className="stat-value">{formatNumber(data.median)}</span>
          </div>
        )}
        {data.sum !== undefined && (
          <div className="stat-item">
            <span className="stat-label">Sum</span>
            <span className="stat-value">{formatNumber(data.sum)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default NumericStats;
