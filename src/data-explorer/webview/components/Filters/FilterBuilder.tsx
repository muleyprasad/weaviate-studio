/**
 * FilterBuilder component - main filter UI
 */

import React from 'react';
import { useDataExplorer } from '../../DataExplorer';
import type { Filter, PropertySchema } from '../../../types';
import { FilterRule } from './FilterRule';
import { getOperatorsForType, getDefaultValue } from '../../../utils/filterUtils';

export function FilterBuilder() {
  const { state, dispatch } = useDataExplorer();

  if (!state.schema) {
    return null;
  }

  const handleAddFilter = () => {
    // Get first filterable property
    const filterableProperties = state.schema!.properties.filter(
      (prop) => prop.indexFilterable !== false
    );

    if (filterableProperties.length === 0) {
      return;
    }

    const firstProperty = filterableProperties[0];
    const availableOperators = getOperatorsForType(firstProperty.dataType);
    const defaultOperator = availableOperators[0];
    const defaultValue = getDefaultValue(firstProperty.dataType);

    const newFilter: Filter = {
      id: `filter-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      property: firstProperty.name,
      operator: defaultOperator,
      value: defaultValue,
      dataType: firstProperty.dataType,
    };

    dispatch({ type: 'ADD_FILTER', payload: newFilter });
  };

  const handleUpdateFilter = (filterId: string, updates: Partial<Filter>) => {
    dispatch({
      type: 'UPDATE_FILTER',
      payload: { id: filterId, filter: updates },
    });
  };

  const handleRemoveFilter = (filterId: string) => {
    dispatch({ type: 'REMOVE_FILTER', payload: filterId });
  };

  const handleClearAll = () => {
    dispatch({ type: 'CLEAR_FILTERS' });
  };

  const handleApplyFilters = () => {
    dispatch({ type: 'APPLY_FILTERS' });
  };

  const hasFilters = state.filters.length > 0;
  const hasUnappliedChanges = JSON.stringify(state.filters) !== JSON.stringify(state.activeFilters);

  return (
    <div className="filter-builder" role="region" aria-label="Filter builder">
      <div className="filter-header">
        <h3 className="filter-title">Filters</h3>
        <span className="filter-match-mode">Match ALL of the following:</span>
      </div>

      <div className="filter-list">
        {state.filters.map((filter) => (
          <FilterRule
            key={filter.id}
            filter={filter}
            properties={state.schema!.properties}
            onChange={(updates) => handleUpdateFilter(filter.id, updates)}
            onRemove={() => handleRemoveFilter(filter.id)}
          />
        ))}

        {state.filters.length === 0 && (
          <div className="filter-empty-state">
            No filters applied. Click "Add Filter" to get started.
          </div>
        )}
      </div>

      <div className="filter-actions">
        <button
          className="filter-add-button"
          onClick={handleAddFilter}
          aria-label="Add new filter"
        >
          + Add Filter
        </button>

        {hasFilters && (
          <div className="filter-action-buttons">
            <button
              className="filter-clear-button"
              onClick={handleClearAll}
              aria-label="Clear all filters"
            >
              Clear All
            </button>
            <button
              className="filter-apply-button primary"
              onClick={handleApplyFilters}
              disabled={!hasUnappliedChanges}
              aria-label="Apply filters"
            >
              Apply Filters
            </button>
          </div>
        )}
      </div>

      {state.activeFilters.length > 0 && (
        <div className="filter-status" role="status" aria-live="polite">
          <span className="filter-status-icon">🔍</span>
          <span className="filter-status-text">
            {state.activeFilters.length} filter{state.activeFilters.length !== 1 ? 's' : ''} active
          </span>
        </div>
      )}
    </div>
  );
}
