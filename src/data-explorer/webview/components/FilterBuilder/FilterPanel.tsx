/**
 * FilterPanel - Main slide-out panel for building filters
 * Visual design matches mockups with slide-in animation from right
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import type { PropertyConfig } from '../../../types';
import type { FilterCondition, FilterMatchMode } from '../../context';
import { useFilterContext } from '../../context';
import { FilterRule } from './FilterRule';
import { createEmptyFilter } from './filterUtils';

interface FilterPanelProps {
  isOpen: boolean;
  properties: PropertyConfig[];
}

export function FilterPanel({ isOpen, properties }: FilterPanelProps) {
  const { state, actions } = useFilterContext();
  const { pendingFilters, matchMode } = state;

  // Handle keyboard escape to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        actions.closeFilterPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, actions]);

  // Add new filter
  const handleAddFilter = useCallback(() => {
    const defaultProperty = properties[0]?.name || '';
    const defaultDataType = properties[0]?.dataType?.[0] || 'text';
    const newFilter = createEmptyFilter(defaultProperty, defaultDataType);
    actions.addPendingFilter(newFilter);
  }, [properties, actions]);

  // Remove filter
  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      actions.removePendingFilter(filterId);
    },
    [actions]
  );

  // Update filter
  const handleUpdateFilter = useCallback(
    (filterId: string, updates: Partial<FilterCondition>) => {
      actions.updatePendingFilter(filterId, updates);
    },
    [actions]
  );

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    // Filter out incomplete filters
    const validFilters = pendingFilters.filter(
      (f) =>
        f.path &&
        f.operator &&
        (f.operator === 'IsNull' || f.operator === 'IsNotNull' || f.value !== '')
    );
    actions.setFilters(validFilters);
    actions.closeFilterPanel();
  }, [pendingFilters, actions]);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    // Clear pending filters (will be reflected when panel is opened again)
    pendingFilters.forEach((f) => actions.removePendingFilter(f.id));
    // Also clear active filters
    actions.clearAllFilters();
  }, [pendingFilters, actions]);

  // Handle match mode change
  const handleMatchModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      actions.setMatchMode(e.target.value as FilterMatchMode);
    },
    [actions]
  );

  // Count valid filters
  const validFilterCount = useMemo(
    () =>
      pendingFilters.filter(
        (f) =>
          f.path &&
          f.operator &&
          (f.operator === 'IsNull' || f.operator === 'IsNotNull' || f.value !== '')
      ).length,
    [pendingFilters]
  );

  // Check if there are changes to apply
  const hasChanges = useMemo(() => {
    const activeSet = new Set(state.activeFilters.map((f) => JSON.stringify({ ...f, id: '' })));
    const pendingSet = new Set(pendingFilters.map((f) => JSON.stringify({ ...f, id: '' })));
    return (
      activeSet.size !== pendingSet.size ||
      [...activeSet].some((a) => !pendingSet.has(a)) ||
      [...pendingSet].some((p) => !activeSet.has(p))
    );
  }, [state.activeFilters, pendingFilters]);

  return (
    <div
      className={`filter-panel ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-label="Visual Filter Builder"
    >
      {/* Backdrop */}
      <div
        className="filter-panel-backdrop"
        onClick={() => actions.closeFilterPanel()}
        aria-hidden="true"
      />

      {/* Panel content */}
      <div className="filter-panel-content">
        {/* Header */}
        <header className="filter-panel-header">
          <div className="filter-panel-title">
            <span className="codicon codicon-filter" aria-hidden="true"></span>
            <h2>VISUAL FILTER BUILDER</h2>
          </div>
          <button
            type="button"
            className="filter-panel-close"
            onClick={() => actions.closeFilterPanel()}
            title="Close filter panel"
            aria-label="Close filter panel"
          >
            <span className="codicon codicon-close" aria-hidden="true">
              ×
            </span>
          </button>
        </header>

        {/* Match mode selector */}
        <div className="filter-match-mode">
          <label htmlFor="match-mode-select">MATCH:</label>
          <select
            id="match-mode-select"
            value={matchMode}
            onChange={handleMatchModeChange}
            className="match-mode-select"
          >
            <option value="AND">ALL of the following (AND)</option>
            <option value="OR">ANY of the following (OR)</option>
          </select>
        </div>

        {/* Filter rules */}
        <div className="filter-rules-container">
          {pendingFilters.length === 0 ? (
            <div className="filter-empty-state">
              <span className="codicon codicon-filter" aria-hidden="true"></span>
              <p>No filters added yet</p>
              <p className="filter-empty-hint">Click "Add Filter" to start filtering your data</p>
            </div>
          ) : (
            <div className="filter-rules-list">
              {pendingFilters.map((filter, index) => (
                <div key={filter.id} className="filter-rule-wrapper">
                  {index > 0 && (
                    <div className="filter-connector">
                      <span>{matchMode === 'AND' ? 'AND' : 'OR'}</span>
                    </div>
                  )}
                  <FilterRule
                    filter={filter}
                    properties={properties}
                    onUpdate={(updates) => handleUpdateFilter(filter.id, updates)}
                    onRemove={() => handleRemoveFilter(filter.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add filter button */}
          <button type="button" className="filter-add-btn" onClick={handleAddFilter}>
            <span className="codicon codicon-add" aria-hidden="true">
              +
            </span>
            Add Filter
          </button>
        </div>

        {/* Footer with action buttons */}
        <footer className="filter-panel-footer">
          <button
            type="button"
            className="filter-apply-btn primary"
            onClick={handleApplyFilters}
            disabled={validFilterCount === 0 && state.activeFilters.length === 0}
          >
            APPLY FILTERS
            {validFilterCount > 0 && <span className="filter-count-badge">{validFilterCount}</span>}
          </button>
          <button
            type="button"
            className="filter-clear-btn secondary"
            onClick={handleClearAll}
            disabled={pendingFilters.length === 0 && state.activeFilters.length === 0}
          >
            CLEAR ALL
          </button>
        </footer>
      </div>
    </div>
  );
}
