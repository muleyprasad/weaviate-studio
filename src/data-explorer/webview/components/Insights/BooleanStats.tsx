/**
 * BooleanStats - Displays true/false counts for boolean properties
 * Shows visual breakdown with percentages
 */

import React from 'react';
import type { PropertyBooleanCounts } from '../../../types';

export interface BooleanStatsProps {
  data: PropertyBooleanCounts;
}

export function BooleanStats({ data }: BooleanStatsProps) {
  const total = data.trueCount + data.falseCount;

  return (
    <div className="boolean-stats">
      <h4 className="property-name">
        <span className="codicon codicon-symbol-boolean" aria-hidden="true"></span>
        {data.property}
      </h4>
      <div className="boolean-breakdown">
        {/* True/False stacked bar */}
        <div className="boolean-bar" role="progressbar">
          <div
            className="boolean-bar-true"
            style={{ width: `${data.truePercentage}%` }}
            title={`True: ${data.trueCount.toLocaleString()} (${data.truePercentage}%)`}
          />
          <div
            className="boolean-bar-false"
            style={{ width: `${data.falsePercentage}%` }}
            title={`False: ${data.falseCount.toLocaleString()} (${data.falsePercentage}%)`}
          />
        </div>

        {/* Legend */}
        <div className="boolean-legend">
          <div className="boolean-legend-item">
            <span className="boolean-indicator true"></span>
            <span className="boolean-label">True</span>
            <span className="boolean-value">
              {data.trueCount.toLocaleString()} ({data.truePercentage}%)
            </span>
          </div>
          <div className="boolean-legend-item">
            <span className="boolean-indicator false"></span>
            <span className="boolean-label">False</span>
            <span className="boolean-value">
              {data.falseCount.toLocaleString()} ({data.falsePercentage}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BooleanStats;
