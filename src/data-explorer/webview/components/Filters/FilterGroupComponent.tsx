/**
 * FilterGroupComponent - Recursive component for nested filter groups
 */

import React from 'react';
import type { FilterGroup, FilterGroupOperator, Filter, PropertySchema } from '../../../types';
import { FilterRule } from './FilterRule';
import { getOperatorsForType, getDefaultValue } from '../../../utils/filterUtils';

interface FilterGroupComponentProps {
  group: FilterGroup;
  properties: PropertySchema[];
  depth: number;
  onUpdateOperator: (groupId: string, operator: FilterGroupOperator) => void;
  onAddFilter: (groupId: string, filter: Filter) => void;
  onRemoveFilter: (groupId: string, filterId: string) => void;
  onUpdateFilter: (groupId: string, filterId: string, updates: Partial<Filter>) => void;
  onAddGroup: (parentId: string, group: FilterGroup) => void;
  onRemoveGroup: (parentId: string, groupId: string) => void;
}

export function FilterGroupComponent({
  group,
  properties,
  depth,
  onUpdateOperator,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  onAddGroup,
  onRemoveGroup,
}: FilterGroupComponentProps) {
  const handleAddFilter = () => {
    const filterableProperties = properties.filter(
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

    onAddFilter(group.id, newFilter);
  };

  const handleAddGroup = () => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      operator: 'AND',
      filters: [],
      groups: [],
    };

    onAddGroup(group.id, newGroup);
  };

  const maxDepth = 5; // Limit nesting to prevent infinite recursion
  const canNest = depth < maxDepth;

  return (
    <div className={`filter-group depth-${depth}`} data-group-id={group.id}>
      {/* Group Header */}
      <div className="filter-group-header">
        <div className="filter-group-operator">
          <label htmlFor={`operator-${group.id}`} className="operator-label">
            Match:
          </label>
          <select
            id={`operator-${group.id}`}
            className="operator-select"
            value={group.operator}
            onChange={(e) =>
              onUpdateOperator(group.id, e.target.value as FilterGroupOperator)
            }
            aria-label="Logical operator for filter group"
          >
            <option value="AND">ALL (AND)</option>
            <option value="OR">ANY (OR)</option>
            <option value="NOT">NONE (NOT)</option>
          </select>
          <span className="operator-hint">
            of the following conditions:
          </span>
        </div>

        {depth > 0 && (
          <button
            className="filter-group-remove"
            onClick={() => onRemoveGroup(group.id, group.id)}
            aria-label="Remove this filter group"
            title="Remove group"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters in this group */}
      <div className="filter-group-content">
        {group.filters.map((filter) => (
          <div key={filter.id} className="filter-group-item">
            <FilterRule
              filter={filter}
              properties={properties}
              onChange={(updates) => onUpdateFilter(group.id, filter.id, updates)}
              onRemove={() => onRemoveFilter(group.id, filter.id)}
            />
          </div>
        ))}

        {/* Nested subgroups */}
        {group.groups.map((subGroup) => (
          <div key={subGroup.id} className="filter-group-item nested">
            <FilterGroupComponent
              group={subGroup}
              properties={properties}
              depth={depth + 1}
              onUpdateOperator={onUpdateOperator}
              onAddFilter={onAddFilter}
              onRemoveFilter={onRemoveFilter}
              onUpdateFilter={onUpdateFilter}
              onAddGroup={onAddGroup}
              onRemoveGroup={(parentId, groupId) => onRemoveGroup(group.id, groupId)}
            />
          </div>
        ))}

        {/* Empty state */}
        {group.filters.length === 0 && group.groups.length === 0 && (
          <div className="filter-group-empty">
            No conditions in this group. Add a filter or subgroup to get started.
          </div>
        )}
      </div>

      {/* Group Actions */}
      <div className="filter-group-actions">
        <button
          className="filter-group-action-button"
          onClick={handleAddFilter}
          aria-label="Add filter to this group"
        >
          + Add Filter
        </button>
        {canNest && (
          <button
            className="filter-group-action-button secondary"
            onClick={handleAddGroup}
            aria-label="Add nested group"
          >
            + Add Group
          </button>
        )}
      </div>
    </div>
  );
}
