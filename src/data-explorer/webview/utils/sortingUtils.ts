/**
 * Sorting utilities for Data Explorer table
 * Validates column sortability based on Weaviate data types
 */

import type { CollectionConfig } from '../../types';

// Sortable primitive types per Weaviate specification
const SORTABLE_DATA_TYPES = ['text', 'string', 'int', 'number', 'boolean', 'date'];

// Non-sortable complex types
const NON_SORTABLE_TYPES = [
  'uuid',
  'uuid[]',
  'object',
  'object[]',
  'text[]',
  'string[]',
  'int[]',
  'number[]',
  'boolean[]',
  'date[]',
  'geoCoordinates',
  'phoneNumber',
  'blob',
  'vector',
];

/**
 * Check if a column can be sorted based on its data type
 * @param columnName - Name of the column to check
 * @param schema - Collection schema containing property definitions
 * @returns true if column is sortable, false otherwise
 */
export function isSortableColumn(columnName: string, schema: CollectionConfig | null): boolean {
  // UUID column is never sortable in Weaviate
  if (columnName === 'uuid') {
    return false;
  }

  if (!schema?.properties) {
    return false;
  }

  const property = schema.properties.find((p) => p.name === columnName);
  if (!property) {
    return false;
  }

  // Check if data type is in the sortable list
  const dataType = property.dataType[0];
  return SORTABLE_DATA_TYPES.includes(dataType);
}

/**
 * Get a user-friendly message explaining why a column cannot be sorted
 * @param columnName - Name of the column
 * @param schema - Collection schema containing property definitions
 * @returns Error message or null if column is sortable
 */
export function getSortabilityMessage(
  columnName: string,
  schema: CollectionConfig | null
): string | null {
  if (columnName === 'uuid') {
    return 'UUID columns cannot be sorted';
  }

  const property = schema?.properties?.find((p) => p.name === columnName);
  if (!property) {
    return 'Column not found in schema';
  }

  const dataType = property.dataType[0];

  // Array types cannot be sorted
  if (dataType.includes('[]')) {
    return 'Array columns cannot be sorted';
  }

  // Complex object types cannot be sorted
  if (['object', 'blob', 'geoCoordinates', 'phoneNumber', 'vector'].includes(dataType)) {
    return `${dataType} columns cannot be sorted`;
  }

  // Column is sortable
  return null;
}
