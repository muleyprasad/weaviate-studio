/**
 * Utility functions for filter group operations
 */

import type {
  Filter,
  FilterGroup,
  FilterGroupOperator,
  WhereFilter,
  WeaviateOperator,
} from '../types';

/**
 * Creates a new empty filter group
 */
export function createFilterGroup(operator: FilterGroupOperator = 'AND'): FilterGroup {
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    operator,
    filters: [],
    groups: [],
  };
}

/**
 * Recursively finds a group by ID
 */
export function findGroupById(
  group: FilterGroup,
  targetId: string
): FilterGroup | null {
  if (group.id === targetId) {
    return group;
  }

  for (const childGroup of group.groups) {
    const found = findGroupById(childGroup, targetId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Recursively updates a group by ID
 */
export function updateGroupById(
  group: FilterGroup,
  targetId: string,
  updates: Partial<FilterGroup>
): FilterGroup {
  if (group.id === targetId) {
    return { ...group, ...updates };
  }

  return {
    ...group,
    groups: group.groups.map((g) => updateGroupById(g, targetId, updates)),
  };
}

/**
 * Adds a filter to a specific group by ID
 */
export function addFilterToGroup(
  group: FilterGroup,
  groupId: string,
  filter: Filter
): FilterGroup {
  if (group.id === groupId) {
    return {
      ...group,
      filters: [...group.filters, filter],
    };
  }

  return {
    ...group,
    groups: group.groups.map((g) => addFilterToGroup(g, groupId, filter)),
  };
}

/**
 * Removes a filter from a specific group by ID
 */
export function removeFilterFromGroup(
  group: FilterGroup,
  groupId: string,
  filterId: string
): FilterGroup {
  if (group.id === groupId) {
    return {
      ...group,
      filters: group.filters.filter((f) => f.id !== filterId),
    };
  }

  return {
    ...group,
    groups: group.groups.map((g) =>
      removeFilterFromGroup(g, groupId, filterId)
    ),
  };
}

/**
 * Adds a subgroup to a parent group by ID
 */
export function addGroupToGroup(
  group: FilterGroup,
  parentId: string,
  newGroup: FilterGroup
): FilterGroup {
  if (group.id === parentId) {
    return {
      ...group,
      groups: [...group.groups, newGroup],
    };
  }

  return {
    ...group,
    groups: group.groups.map((g) => addGroupToGroup(g, parentId, newGroup)),
  };
}

/**
 * Removes a subgroup from a parent group by ID
 */
export function removeGroupFromGroup(
  group: FilterGroup,
  parentId: string,
  groupId: string
): FilterGroup {
  if (group.id === parentId) {
    return {
      ...group,
      groups: group.groups.filter((g) => g.id !== groupId),
    };
  }

  return {
    ...group,
    groups: group.groups.map((g) =>
      removeGroupFromGroup(g, parentId, groupId)
    ),
  };
}

/**
 * Updates the operator of a specific group by ID
 */
export function updateGroupOperator(
  group: FilterGroup,
  groupId: string,
  operator: FilterGroupOperator
): FilterGroup {
  if (group.id === groupId) {
    return { ...group, operator };
  }

  return {
    ...group,
    groups: group.groups.map((g) => updateGroupOperator(g, groupId, operator)),
  };
}

/**
 * Counts total filters in a group recursively
 */
export function countFiltersInGroup(group: FilterGroup): number {
  let count = group.filters.length;
  for (const subGroup of group.groups) {
    count += countFiltersInGroup(subGroup);
  }
  return count;
}

/**
 * Checks if a group is empty (no filters and no subgroups)
 */
export function isGroupEmpty(group: FilterGroup): boolean {
  return group.filters.length === 0 && group.groups.length === 0;
}

/**
 * Converts a filter group to a Weaviate WHERE filter
 *
 * @param group - The filter group to convert
 * @param buildFilterOperand - Function to build a single filter operand
 * @returns WhereFilter or null if group is empty
 */
export function filterGroupToWhereFilter(
  group: FilterGroup,
  buildFilterOperand: (filter: Filter) => WhereFilter
): WhereFilter | null {
  // Recursively build WHERE filters for all subgroups
  const groupOperands = group.groups
    .map((subGroup) => filterGroupToWhereFilter(subGroup, buildFilterOperand))
    .filter((where): where is WhereFilter => where !== null);

  // Build WHERE filters for all direct filters
  const filterOperands = group.filters.map(buildFilterOperand);

  // Combine all operands
  const allOperands = [...groupOperands, ...filterOperands];

  if (allOperands.length === 0) {
    return null;
  }

  if (allOperands.length === 1) {
    // Single operand - wrap in NOT if needed
    if (group.operator === 'NOT') {
      return {
        operator: 'Not' as WeaviateOperator,
        operands: allOperands,
      };
    }
    return allOperands[0];
  }

  // Multiple operands - combine with operator
  const weaviateOperator: WeaviateOperator =
    group.operator === 'AND'
      ? 'And'
      : group.operator === 'OR'
      ? 'Or'
      : 'Not';

  return {
    operator: weaviateOperator,
    operands: allOperands,
  };
}

/**
 * Clones a filter group deeply
 */
export function cloneFilterGroup(group: FilterGroup): FilterGroup {
  return {
    ...group,
    id: `group-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    filters: group.filters.map((f) => ({
      ...f,
      id: `filter-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    })),
    groups: group.groups.map(cloneFilterGroup),
  };
}
