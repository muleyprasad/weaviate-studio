/**
 * Utility functions for filter operations
 */

import type {
  Filter,
  FilterOperator,
  FilterValue,
  PropertyDataType,
  WhereFilter,
  WeaviateOperator,
} from '../types';

/**
 * Get available operators for a property data type
 */
export function getOperatorsForType(dataType: PropertyDataType): FilterOperator[] {
  const baseType = dataType.replace('[]', '') as PropertyDataType;

  switch (baseType) {
    case 'text':
      return ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'isNull', 'isNotNull'];

    case 'int':
    case 'number':
      return ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanEqual', 'lessThanEqual', 'between', 'isNull', 'isNotNull'];

    case 'boolean':
      return ['equals', 'isNull', 'isNotNull'];

    case 'date':
      return ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanEqual', 'lessThanEqual', 'between', 'isNull', 'isNotNull'];

    case 'uuid':
      return ['equals', 'notEquals', 'in', 'notIn', 'isNull', 'isNotNull'];

    case 'geoCoordinates':
      return ['withinDistance', 'isNull', 'isNotNull'];

    case 'phoneNumber':
    case 'blob':
      return ['equals', 'notEquals', 'isNull', 'isNotNull'];

    case 'object':
      return ['isNull', 'isNotNull'];

    default:
      return ['equals', 'notEquals', 'isNull', 'isNotNull'];
  }
}

/**
 * Get default value for a property data type
 */
export function getDefaultValue(dataType: PropertyDataType): FilterValue {
  const baseType = dataType.replace('[]', '') as PropertyDataType;

  switch (baseType) {
    case 'text':
    case 'uuid':
    case 'phoneNumber':
      return '';

    case 'int':
    case 'number':
      return 0;

    case 'boolean':
      return true;

    case 'date':
      return new Date();

    case 'geoCoordinates':
      return { lat: 0, lon: 0, distance: 1000 };

    default:
      return null;
  }
}

/**
 * Map our operator names to Weaviate operator names
 */
function mapOperatorToWeaviate(operator: FilterOperator): string {
  const operatorMap: Record<FilterOperator, string> = {
    equals: 'Equal',
    notEquals: 'NotEqual',
    greaterThan: 'GreaterThan',
    lessThan: 'LessThan',
    greaterThanEqual: 'GreaterThanEqual',
    lessThanEqual: 'LessThanEqual',
    contains: 'Like',
    startsWith: 'Like',
    endsWith: 'Like',
    in: 'ContainsAny',
    notIn: 'ContainsAny', // Will be wrapped in NOT
    isNull: 'IsNull',
    isNotNull: 'IsNull', // Will be wrapped in NOT
    between: 'And',
    withinDistance: 'WithinGeoRange',
    withinPolygon: 'WithinGeoRange',
  };

  return operatorMap[operator] || 'Equal';
}

/**
 * Format value for WHERE filter based on operator and data type
 */
function formatFilterValue(
  value: FilterValue,
  operator: FilterOperator,
  dataType: PropertyDataType
): FilterValue {
  if (operator === 'isNull' || operator === 'isNotNull') {
    return true;
  }

  const baseType = dataType.replace('[]', '') as PropertyDataType;

  // Handle text operators that need wildcards
  if (typeof value === 'string') {
    if (operator === 'contains') {
      return `*${value}*`;
    } else if (operator === 'startsWith') {
      return `${value}*`;
    } else if (operator === 'endsWith') {
      return `*${value}`;
    }
  }

  // Handle date conversion
  if (baseType === 'date' && value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

/**
 * Build a single WHERE filter operand
 *
 * @param filter - Filter to convert to WHERE operand
 * @returns WhereFilter operand
 *
 * @remarks
 * Exported for use in filterGroupToWhereFilter. Handles all filter operators
 * including special cases like isNull, notNull, in, notIn, between, etc.
 */
export function buildFilterOperand(filter: Filter): WhereFilter {
  const weaviateOperator = mapOperatorToWeaviate(filter.operator);
  const formattedValue = formatFilterValue(filter.value, filter.operator, filter.dataType);

  const baseFilter: WhereFilter = {
    operator: weaviateOperator as WeaviateOperator,
    path: [filter.property],
  };

  // Handle special cases
  if (filter.operator === 'isNull' || filter.operator === 'isNotNull') {
    const nullFilter: WhereFilter = {
      ...baseFilter,
      valueBoolean: true,
    };
    return filter.operator === 'isNotNull'
      ? { operator: 'Not', operands: [nullFilter] }
      : nullFilter;
  }

  // Handle 'in' operator - create OR combination of Equal conditions
  if (filter.operator === 'in' && Array.isArray(formattedValue) && formattedValue.length > 0) {
    if (formattedValue.length === 1) {
      // Single value - just use Equal
      const singleFilter: WhereFilter = {
        operator: 'Equal' as WeaviateOperator,
        path: [filter.property],
      };
      addValueToFilter(singleFilter, formattedValue[0], filter.dataType);
      return singleFilter;
    }
    // Multiple values - create OR combination
    return {
      operator: 'Or',
      operands: (formattedValue as (string | number)[]).map((val) => {
        const equalFilter: WhereFilter = {
          operator: 'Equal' as WeaviateOperator,
          path: [filter.property],
        };
        addValueToFilter(equalFilter, val, filter.dataType);
        return equalFilter;
      }),
    };
  }

  // Handle 'notIn' operator - wrap 'in' logic in NOT
  if (filter.operator === 'notIn' && Array.isArray(formattedValue) && formattedValue.length > 0) {
    if (formattedValue.length === 1) {
      // Single value - just use NotEqual
      const singleFilter: WhereFilter = {
        operator: 'NotEqual' as WeaviateOperator,
        path: [filter.property],
      };
      addValueToFilter(singleFilter, formattedValue[0], filter.dataType);
      return singleFilter;
    }
    // Multiple values - NOT(OR(Equal, Equal, ...))
    const orFilter: WhereFilter = {
      operator: 'Or',
      operands: (formattedValue as (string | number)[]).map((val) => {
        const equalFilter: WhereFilter = {
          operator: 'Equal' as WeaviateOperator,
          path: [filter.property],
        };
        addValueToFilter(equalFilter, val, filter.dataType);
        return equalFilter;
      }),
    };
    return { operator: 'Not', operands: [orFilter] };
  }

  // Handle 'notEquals' operator
  if (filter.operator === 'notEquals') {
    const positiveFilter = { ...baseFilter };
    addValueToFilter(positiveFilter, formattedValue, filter.dataType);
    return { operator: 'Not', operands: [positiveFilter] };
  }

  if (filter.operator === 'between' && typeof formattedValue === 'object' && formattedValue !== null && 'min' in formattedValue) {
    const { min, max } = formattedValue as { min: number; max: number };
    return {
      operator: 'And',
      operands: [
        {
          operator: 'GreaterThanEqual' as WeaviateOperator,
          path: [filter.property],
          ...(filter.dataType.includes('int') ? { valueInt: min } : { valueNumber: min }),
        },
        {
          operator: 'LessThanEqual' as WeaviateOperator,
          path: [filter.property],
          ...(filter.dataType.includes('int') ? { valueInt: max } : { valueNumber: max }),
        },
      ],
    };
  }

  if (filter.operator === 'withinDistance' && typeof formattedValue === 'object' && formattedValue !== null && 'lat' in formattedValue) {
    const { lat, lon, distance } = formattedValue as { lat: number; lon: number; distance: number };
    return {
      operator: 'WithinGeoRange' as WeaviateOperator,
      path: [filter.property],
      valueGeoRange: {
        geoCoordinates: {
          latitude: lat,
          longitude: lon,
        },
        distance: {
          max: distance,
        },
      },
    };
  }

  // Add appropriate value type
  addValueToFilter(baseFilter, formattedValue, filter.dataType);
  return baseFilter;
}

/**
 * Add value to filter based on data type
 */
function addValueToFilter(filter: WhereFilter, value: FilterValue, dataType: PropertyDataType): void {
  const baseType = dataType.replace('[]', '') as PropertyDataType;

  if (value === null) {
    return;
  }

  switch (baseType) {
    case 'text':
    case 'uuid':
    case 'phoneNumber':
    case 'blob':
      if (typeof value === 'string') {
        filter.valueText = value;
      } else if (Array.isArray(value)) {
        filter.valueText = value[0] as string;
      }
      break;

    case 'int':
      if (typeof value === 'number') {
        filter.valueInt = Math.floor(value);
      } else if (Array.isArray(value)) {
        filter.valueInt = Math.floor(value[0] as number);
      }
      break;

    case 'number':
      if (typeof value === 'number') {
        filter.valueNumber = value;
      } else if (Array.isArray(value)) {
        filter.valueNumber = value[0] as number;
      }
      break;

    case 'boolean':
      if (typeof value === 'boolean') {
        filter.valueBoolean = value;
      }
      break;

    case 'date':
      if (typeof value === 'string') {
        filter.valueDate = value;
      } else if (value instanceof Date) {
        filter.valueDate = value.toISOString();
      }
      break;
  }
}

/**
 * Build WHERE filter from array of filters
 * Combines all filters with AND operator
 */
export function buildWhereFilter(filters: Filter[]): WhereFilter | null {
  if (filters.length === 0) {
    return null;
  }

  if (filters.length === 1) {
    return buildFilterOperand(filters[0]);
  }

  return {
    operator: 'And',
    operands: filters.map(buildFilterOperand),
  };
}

/**
 * Get human-readable label for an operator
 */
export function getOperatorLabel(operator: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: 'equals',
    notEquals: 'not equals',
    greaterThan: 'greater than',
    lessThan: 'less than',
    greaterThanEqual: 'greater than or equal',
    lessThanEqual: 'less than or equal',
    contains: 'contains',
    startsWith: 'starts with',
    endsWith: 'ends with',
    in: 'in list',
    notIn: 'not in list',
    isNull: 'is null',
    isNotNull: 'is not null',
    between: 'between',
    withinDistance: 'within distance',
    withinPolygon: 'within polygon',
  };

  return labels[operator] || operator;
}

/**
 * Validate filter value based on operator and data type
 */
export function isValidFilterValue(value: FilterValue, operator: FilterOperator, dataType: PropertyDataType): boolean {
  // Null checks don't need values
  if (operator === 'isNull' || operator === 'isNotNull') {
    return true;
  }

  // Value is required for other operators
  if (value === null || value === undefined) {
    return false;
  }

  const baseType = dataType.replace('[]', '') as PropertyDataType;

  switch (baseType) {
    case 'text':
    case 'uuid':
    case 'phoneNumber':
      if (operator === 'in' || operator === 'notIn') {
        return Array.isArray(value) && value.length > 0;
      }
      return typeof value === 'string' && value.length > 0;

    case 'int':
    case 'number':
      if (operator === 'between') {
        return typeof value === 'object' && value !== null && 'min' in value && 'max' in value;
      }
      return typeof value === 'number' && !isNaN(value);

    case 'boolean':
      return typeof value === 'boolean';

    case 'date':
      return value instanceof Date || typeof value === 'string';

    case 'geoCoordinates':
      return (
        typeof value === 'object' &&
        value !== null &&
        'lat' in value &&
        'lon' in value &&
        'distance' in value
      );

    default:
      return true;
  }
}
