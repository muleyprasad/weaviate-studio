/**
 * CategoryBreakdown - Displays top values for categorical properties
 * Shows value name, count, percentage with visual progress bar
 */

import React from 'react';
import type { PropertyTopValues } from '../../../types';

export interface CategoryBreakdownProps {
  data: PropertyTopValues;
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (!data.values || data.values.length === 0) {
    return null;
  }

  // Get the max count for relative bar sizing
  const maxCount = Math.max(...data.values.map((v) => v.count));

  return (
    <div className="category-breakdown">
      <h4 className="property-name">
        <span className="codicon codicon-tag" aria-hidden="true"></span>
        {data.property}
        <span className="property-badge">top {data.values.length}</span>
      </h4>
      <div className="category-values">
        {data.values.map((item, index) => (
          <div key={`${item.value}-${index}`} className="category-item">
            <div className="category-item-header">
              <span className="category-value" title={item.value}>
                {item.value}
              </span>
              <span className="category-stats">
                <span className="category-percentage">{item.percentage}%</span>
                <span className="category-count">({item.count.toLocaleString()})</span>
              </span>
            </div>
            <div className="category-bar" role="progressbar" aria-valuenow={item.percentage}>
              <div
                className="category-bar-fill"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryBreakdown;
