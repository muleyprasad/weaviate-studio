/**
 * Filter utilities - helpers for filter operations and operator definitions
 */

import type { FilterOperator, FilterCondition } from '../../context';

// Operator definitions by property type
export interface OperatorDefinition {
  value: FilterOperator;
  label: string;
  requiresValue: boolean;
}

// Get available operators for a property data type
export function getOperatorsForType(dataType: string): OperatorDefinition[] {
  const normalizedType = dataType.toLowerCase();

  // Text operators
  if (['text', 'string', 'uuid'].includes(normalizedType)) {
    return [
      { value: 'Equal', label: 'equals', requiresValue: true },
      { value: 'NotEqual', label: 'not equals', requiresValue: true },
      { value: 'Like', label: 'contains', requiresValue: true },
      { value: 'IsNull', label: 'is empty', requiresValue: false },
      { value: 'IsNotNull', label: 'is not empty', requiresValue: false },
    ];
  }

  // Number operators
  if (['int', 'number', 'float', 'double'].includes(normalizedType)) {
    return [
      { value: 'Equal', label: 'equals', requiresValue: true },
      { value: 'NotEqual', label: 'not equals', requiresValue: true },
      { value: 'GreaterThan', label: 'greater than', requiresValue: true },
      { value: 'GreaterThanEqual', label: 'greater than or equal', requiresValue: true },
      { value: 'LessThan', label: 'less than', requiresValue: true },
      { value: 'LessThanEqual', label: 'less than or equal', requiresValue: true },
      { value: 'IsNull', label: 'is empty', requiresValue: false },
      { value: 'IsNotNull', label: 'is not empty', requiresValue: false },
    ];
  }

  // Boolean operators
  if (normalizedType === 'boolean') {
    return [
      { value: 'Equal', label: 'is', requiresValue: true },
      { value: 'IsNull', label: 'is empty', requiresValue: false },
      { value: 'IsNotNull', label: 'is not empty', requiresValue: false },
    ];
  }

  // Date operators
  if (normalizedType === 'date') {
    return [
      { value: 'Equal', label: 'equals', requiresValue: true },
      { value: 'NotEqual', label: 'not equals', requiresValue: true },
      { value: 'GreaterThan', label: 'after', requiresValue: true },
      { value: 'GreaterThanEqual', label: 'on or after', requiresValue: true },
      { value: 'LessThan', label: 'before', requiresValue: true },
      { value: 'LessThanEqual', label: 'on or before', requiresValue: true },
      { value: 'IsNull', label: 'is empty', requiresValue: false },
      { value: 'IsNotNull', label: 'is not empty', requiresValue: false },
    ];
  }

  // Array operators
  if (normalizedType.endsWith('[]')) {
    return [
      { value: 'ContainsAny', label: 'contains any', requiresValue: true },
      { value: 'ContainsAll', label: 'contains all', requiresValue: true },
      { value: 'IsNull', label: 'is empty', requiresValue: false },
      { value: 'IsNotNull', label: 'is not empty', requiresValue: false },
    ];
  }

  // Default operators for unknown types
  return [
    { value: 'Equal', label: 'equals', requiresValue: true },
    { value: 'NotEqual', label: 'not equals', requiresValue: true },
    { value: 'IsNull', label: 'is empty', requiresValue: false },
    { value: 'IsNotNull', label: 'is not empty', requiresValue: false },
  ];
}

// Map data type to value type hint
export function getValueType(dataType: string): 'text' | 'number' | 'boolean' | 'date' {
  const normalizedType = dataType.toLowerCase();

  if (['int', 'number', 'float', 'double'].includes(normalizedType)) {
    return 'number';
  }

  if (normalizedType === 'boolean') {
    return 'boolean';
  }

  if (normalizedType === 'date') {
    return 'date';
  }

  return 'text';
}

// Create a new empty filter condition
export function createEmptyFilter(property?: string, dataType?: string): FilterCondition {
  const valueType = dataType ? getValueType(dataType) : 'text';
  return {
    id: crypto.randomUUID(),
    path: property || '',
    operator: 'Equal',
    value: '',
    valueType,
  };
}

// Format filter value for display
export function formatFilterValue(filter: FilterCondition): string {
  if (filter.operator === 'IsNull' || filter.operator === 'IsNotNull') {
    return '';
  }

  if (filter.value === null || filter.value === undefined || filter.value === '') {
    return '(not set)';
  }

  if (filter.valueType === 'boolean') {
    return filter.value ? 'true' : 'false';
  }

  if (filter.valueType === 'date' && filter.value) {
    try {
      const date = new Date(String(filter.value));
      return date.toLocaleDateString();
    } catch {
      return String(filter.value);
    }
  }

  return String(filter.value);
}

// Get operator label for display
export function getOperatorLabel(operator: FilterOperator, dataType: string = 'text'): string {
  const operators = getOperatorsForType(dataType);
  const operatorDef = operators.find((op) => op.value === operator);
  return operatorDef?.label || operator;
}

// Validate a filter condition
export function isFilterValid(filter: FilterCondition): boolean {
  // Must have a property selected
  if (!filter.path) {
    return false;
  }

  // IsNull/IsNotNull don't need a value
  if (filter.operator === 'IsNull' || filter.operator === 'IsNotNull') {
    return true;
  }

  // Other operators need a value
  if (filter.value === null || filter.value === undefined || filter.value === '') {
    return false;
  }

  return true;
}

// Check if any filters are valid
export function hasValidFilters(filters: FilterCondition[]): boolean {
  return filters.some(isFilterValid);
}
