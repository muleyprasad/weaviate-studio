/**
 * FilterChips - Displays active filter chips bar below toolbar
 * Shows applied filters with remove buttons and a "Clear all" option
 */

import React from 'react';
import type { FilterCondition } from '../../context';
import { getOperatorLabel } from './filterUtils';

interface FilterChipsProps {
  filters: FilterCondition[];
  onRemove: (filterId: string) => void;
  onClearAll: () => void;
  onChipClick?: (filterId: string) => void;
}

/**
 * Format filter value for display in chip
 */
function formatValue(value: unknown, valueType?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (valueType === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (valueType === 'date' && typeof value === 'string') {
    try {
      const date = new Date(value);
      return date.toLocaleDateString();
    } catch {
      return String(value);
    }
  }

  if (typeof value === 'string') {
    // Truncate long values
    return value.length > 20 ? `${value.slice(0, 20)}...` : value;
  }

  return String(value);
}

export function FilterChips({ filters, onRemove, onClearAll, onChipClick }: FilterChipsProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="filter-chips-bar">
      <span className="filter-chips-label">
        <span className="codicon codicon-filter" aria-hidden="true"></span>
        Active Filters:
      </span>
      <div className="filter-chips">
        {filters.map((filter) => {
          const operatorLabel = getOperatorLabel(filter.operator);
          const displayValue = formatValue(filter.value, filter.valueType);
          const showValue = filter.operator !== 'IsNull' && filter.operator !== 'IsNotNull';

          return (
            <div
              key={filter.id}
              className="filter-chip"
              onClick={() => onChipClick?.(filter.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onChipClick?.(filter.id);
                }
              }}
            >
              <span className="filter-chip-content">
                <span className="filter-chip-property">{filter.path}</span>
                <span className="filter-chip-operator">{operatorLabel}</span>
                {showValue && displayValue && (
                  <span className="filter-chip-value">"{displayValue}"</span>
                )}
              </span>
              <button
                type="button"
                className="filter-chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(filter.id);
                }}
                title={`Remove filter: ${filter.path}`}
                aria-label={`Remove filter: ${filter.path} ${operatorLabel} ${displayValue}`}
              >
                <span className="codicon codicon-close" aria-hidden="true">
                  ×
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="filter-chips-clear-all"
        onClick={onClearAll}
        title="Clear all filters"
      >
        Clear all
      </button>
    </div>
  );
}
