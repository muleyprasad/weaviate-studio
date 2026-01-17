/**
 * AdvancedFilterBuilder - Filter builder with nested groups support
 */

import React, { useState } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import type { FilterGroup, FilterTemplate, Filter, FilterGroupOperator } from '../../../types';
import { FilterGroupComponent } from './FilterGroupComponent';
import { FilterTemplates } from './FilterTemplates';
import { createFilterGroup, countFiltersInGroup } from '../../../utils/filterGroupUtils';

export function AdvancedFilterBuilder() {
  const { state, dispatch } = useDataExplorer();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!state.schema) {
    return null;
  }

  const initializeGroup = () => {
    if (!state.filterGroup) {
      dispatch({
        type: 'SET_FILTER_GROUP',
        payload: createFilterGroup('AND'),
      });
    }
  };

  const handleUpdateOperator = (groupId: string, operator: FilterGroupOperator) => {
    dispatch({
      type: 'UPDATE_GROUP_OPERATOR',
      payload: { groupId, operator },
    });
  };

  const handleAddFilter = (groupId: string, filter: Filter) => {
    dispatch({
      type: 'ADD_FILTER_TO_GROUP',
      payload: { groupId, filter },
    });
  };

  const handleRemoveFilter = (groupId: string, filterId: string) => {
    dispatch({
      type: 'REMOVE_FILTER_FROM_GROUP',
      payload: { groupId, filterId },
    });
  };

  const handleUpdateFilter = (groupId: string, filterId: string, updates: Partial<Filter>) => {
    // Find and update the filter within the group
    // This is a bit complex, so we'll need to traverse the group tree
    // For now, we'll use a simpler approach: remove and re-add
    if (!state.filterGroup) return;

    // Helper to find and update filter recursively
    const updateFilterInGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          filters: group.filters.map((f) =>
            f.id === filterId ? { ...f, ...updates } : f
          ),
        };
      }
      return {
        ...group,
        groups: group.groups.map(updateFilterInGroup),
      };
    };

    dispatch({
      type: 'SET_FILTER_GROUP',
      payload: updateFilterInGroup(state.filterGroup),
    });
  };

  const handleAddGroup = (parentId: string, newGroup: FilterGroup) => {
    dispatch({
      type: 'ADD_GROUP_TO_GROUP',
      payload: { parentId, group: newGroup },
    });
  };

  const handleRemoveGroup = (parentId: string, groupId: string) => {
    dispatch({
      type: 'REMOVE_GROUP_FROM_GROUP',
      payload: { parentId, groupId },
    });
  };

  const handleClearAll = () => {
    dispatch({ type: 'CLEAR_FILTER_GROUP' });
  };

  const handleApplyFilters = () => {
    dispatch({ type: 'APPLY_FILTER_GROUP' });
  };

  const handleSaveTemplate = (name: string, description: string) => {
    if (!state.filterGroup || !state.collectionName) {
      return;
    }

    const template: FilterTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name,
      description,
      collectionName: state.collectionName,
      group: state.filterGroup,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dispatch({ type: 'SAVE_FILTER_TEMPLATE', payload: template });
  };

  const handleLoadTemplate = (templateId: string) => {
    dispatch({ type: 'LOAD_FILTER_TEMPLATE', payload: templateId });
  };

  const handleDeleteTemplate = (templateId: string) => {
    dispatch({ type: 'DELETE_FILTER_TEMPLATE', payload: templateId });
  };

  const hasFilterGroup = state.filterGroup !== null;
  const filterCount = hasFilterGroup ? countFiltersInGroup(state.filterGroup!) : 0;
  const hasActiveFilters = state.activeFilterGroup !== null;
  const hasUnappliedChanges =
    JSON.stringify(state.filterGroup) !== JSON.stringify(state.activeFilterGroup);

  // Show toggle between simple and advanced modes
  if (!showAdvanced) {
    return (
      <div className="filter-builder advanced" role="region" aria-label="Advanced filter builder">
        <div className="filter-header">
          <h3 className="filter-title">Advanced Filters</h3>
          <button
            className="filter-mode-toggle"
            onClick={() => {
              setShowAdvanced(true);
              initializeGroup();
            }}
          >
            ⚙️ Enable Advanced Mode
          </button>
        </div>
        <div className="filter-info">
          <p>
            Advanced mode allows you to create complex nested filter groups with AND/OR/NOT logic.
          </p>
          <p>Click "Enable Advanced Mode" to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="filter-builder advanced" role="region" aria-label="Advanced filter builder">
      <div className="filter-header">
        <h3 className="filter-title">Advanced Filters</h3>
        <button
          className="filter-mode-toggle"
          onClick={() => {
            if (filterCount > 0) {
              if (window.confirm('Switching modes will clear your current filters. Continue?')) {
                handleClearAll();
                setShowAdvanced(false);
              }
            } else {
              setShowAdvanced(false);
            }
          }}
        >
          ← Simple Mode
        </button>
      </div>

      {/* Filter Templates */}
      <FilterTemplates
        templates={state.filterTemplates}
        collectionName={state.collectionName}
        currentGroup={state.filterGroup}
        onSave={handleSaveTemplate}
        onLoad={handleLoadTemplate}
        onDelete={handleDeleteTemplate}
      />

      {/* Filter Group */}
      {hasFilterGroup && state.filterGroup && (
        <div className="filter-group-container">
          <FilterGroupComponent
            group={state.filterGroup}
            properties={state.schema.properties}
            depth={0}
            onUpdateOperator={handleUpdateOperator}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            onUpdateFilter={handleUpdateFilter}
            onAddGroup={handleAddGroup}
            onRemoveGroup={handleRemoveGroup}
          />
        </div>
      )}

      {!hasFilterGroup && (
        <div className="filter-empty-state">
          No filter groups yet. Click "Add Filter" in the group above to get started.
        </div>
      )}

      {/* Actions */}
      <div className="filter-actions">
        {hasFilterGroup && (
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

      {/* Status */}
      {hasActiveFilters && (
        <div className="filter-status" role="status" aria-live="polite">
          <span className="filter-status-icon">🔍</span>
          <span className="filter-status-text">
            Advanced filters active ({countFiltersInGroup(state.activeFilterGroup!)} conditions)
          </span>
        </div>
      )}
    </div>
  );
}
