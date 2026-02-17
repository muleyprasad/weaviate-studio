/**
 * Tests for filter utility functions
 */

import {
  getOperatorsForType,
  getValueType,
  createEmptyFilter,
  formatFilterValue,
  getOperatorLabel,
  isFilterValid,
  hasValidFilters,
  type OperatorDefinition,
} from '../filterUtils';
import type { FilterCondition } from '../../../context';

describe('filterUtils', () => {
  describe('getOperatorsForType', () => {
    describe('text types', () => {
      it('returns text operators for "text" type', () => {
        const operators = getOperatorsForType('text');
        expect(operators).toHaveLength(5);
        expect(operators.map((op) => op.value)).toEqual([
          'Equal',
          'NotEqual',
          'Like',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('returns text operators for "string" type', () => {
        const operators = getOperatorsForType('string');
        expect(operators).toHaveLength(5);
        expect(operators.map((op) => op.value)).toEqual([
          'Equal',
          'NotEqual',
          'Like',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('returns text operators for "uuid" type', () => {
        const operators = getOperatorsForType('uuid');
        expect(operators).toHaveLength(5);
        expect(operators.map((op) => op.value)).toEqual([
          'Equal',
          'NotEqual',
          'Like',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('handles case-insensitive text types', () => {
        const operators = getOperatorsForType('TEXT');
        expect(operators).toHaveLength(5);
        expect(operators[0].value).toBe('Equal');
      });

      it('sets correct requiresValue for text operators', () => {
        const operators = getOperatorsForType('text');
        expect(operators.find((op) => op.value === 'Equal')?.requiresValue).toBe(true);
        expect(operators.find((op) => op.value === 'Like')?.requiresValue).toBe(true);
        expect(operators.find((op) => op.value === 'IsNull')?.requiresValue).toBe(false);
        expect(operators.find((op) => op.value === 'IsNotNull')?.requiresValue).toBe(false);
      });
    });

    describe('number types', () => {
      it('returns number operators for "int" type', () => {
        const operators = getOperatorsForType('int');
        expect(operators).toHaveLength(8);
        expect(operators.map((op) => op.value)).toEqual([
          'Equal',
          'NotEqual',
          'GreaterThan',
          'GreaterThanEqual',
          'LessThan',
          'LessThanEqual',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('returns number operators for "number" type', () => {
        const operators = getOperatorsForType('number');
        expect(operators).toHaveLength(8);
      });

      it('returns number operators for "float" type', () => {
        const operators = getOperatorsForType('float');
        expect(operators).toHaveLength(8);
      });

      it('returns number operators for "double" type', () => {
        const operators = getOperatorsForType('double');
        expect(operators).toHaveLength(8);
      });

      it('handles case-insensitive number types', () => {
        const operators = getOperatorsForType('INT');
        expect(operators).toHaveLength(8);
      });

      it('sets correct labels for number operators', () => {
        const operators = getOperatorsForType('int');
        expect(operators.find((op) => op.value === 'GreaterThan')?.label).toBe('greater than');
        expect(operators.find((op) => op.value === 'LessThanEqual')?.label).toBe(
          'less than or equal'
        );
      });
    });

    describe('boolean type', () => {
      it('returns boolean operators for "boolean" type', () => {
        const operators = getOperatorsForType('boolean');
        expect(operators).toHaveLength(3);
        expect(operators.map((op) => op.value)).toEqual(['Equal', 'IsNull', 'IsNotNull']);
      });

      it('handles case-insensitive boolean type', () => {
        const operators = getOperatorsForType('BOOLEAN');
        expect(operators).toHaveLength(3);
      });

      it('uses "is" label for boolean Equal operator', () => {
        const operators = getOperatorsForType('boolean');
        expect(operators.find((op) => op.value === 'Equal')?.label).toBe('is');
      });
    });

    describe('date type', () => {
      it('returns date operators for "date" type', () => {
        const operators = getOperatorsForType('date');
        expect(operators).toHaveLength(8);
        expect(operators.map((op) => op.value)).toEqual([
          'Equal',
          'NotEqual',
          'GreaterThan',
          'GreaterThanEqual',
          'LessThan',
          'LessThanEqual',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('uses date-specific labels', () => {
        const operators = getOperatorsForType('date');
        expect(operators.find((op) => op.value === 'GreaterThan')?.label).toBe('after');
        expect(operators.find((op) => op.value === 'GreaterThanEqual')?.label).toBe('on or after');
        expect(operators.find((op) => op.value === 'LessThan')?.label).toBe('before');
        expect(operators.find((op) => op.value === 'LessThanEqual')?.label).toBe('on or before');
      });
    });

    describe('array types', () => {
      it('returns array operators for "text[]" type', () => {
        const operators = getOperatorsForType('text[]');
        expect(operators).toHaveLength(4);
        expect(operators.map((op) => op.value)).toEqual([
          'ContainsAny',
          'ContainsAll',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('returns array operators for "int[]" type', () => {
        const operators = getOperatorsForType('int[]');
        expect(operators).toHaveLength(4);
      });

      it('returns array operators for "number[]" type', () => {
        const operators = getOperatorsForType('number[]');
        expect(operators).toHaveLength(4);
      });

      it('handles case-insensitive array types', () => {
        const operators = getOperatorsForType('TEXT[]');
        expect(operators).toHaveLength(4);
      });
    });

    describe('unknown types', () => {
      it('returns default operators for unknown type', () => {
        const operators = getOperatorsForType('unknown');
        expect(operators).toHaveLength(4);
        expect(operators.map((op) => op.value)).toEqual([
          'Equal',
          'NotEqual',
          'IsNull',
          'IsNotNull',
        ]);
      });

      it('returns default operators for empty string', () => {
        const operators = getOperatorsForType('');
        expect(operators).toHaveLength(4);
      });

      it('returns default operators for custom type', () => {
        const operators = getOperatorsForType('customType');
        expect(operators).toHaveLength(4);
      });
    });
  });

  describe('getValueType', () => {
    describe('number types', () => {
      it('returns "number" for "int" type', () => {
        expect(getValueType('int')).toBe('number');
      });

      it('returns "number" for "number" type', () => {
        expect(getValueType('number')).toBe('number');
      });

      it('returns "number" for "float" type', () => {
        expect(getValueType('float')).toBe('number');
      });

      it('returns "number" for "double" type', () => {
        expect(getValueType('double')).toBe('number');
      });

      it('handles case-insensitive number types', () => {
        expect(getValueType('INT')).toBe('number');
        expect(getValueType('FLOAT')).toBe('number');
      });
    });

    describe('boolean type', () => {
      it('returns "boolean" for "boolean" type', () => {
        expect(getValueType('boolean')).toBe('boolean');
      });

      it('handles case-insensitive boolean type', () => {
        expect(getValueType('BOOLEAN')).toBe('boolean');
      });
    });

    describe('date type', () => {
      it('returns "date" for "date" type', () => {
        expect(getValueType('date')).toBe('date');
      });

      it('handles case-insensitive date type', () => {
        expect(getValueType('DATE')).toBe('date');
      });
    });

    describe('text types', () => {
      it('returns "text" for "text" type', () => {
        expect(getValueType('text')).toBe('text');
      });

      it('returns "text" for "string" type', () => {
        expect(getValueType('string')).toBe('text');
      });

      it('returns "text" for "uuid" type', () => {
        expect(getValueType('uuid')).toBe('text');
      });

      it('returns "text" for unknown types', () => {
        expect(getValueType('unknown')).toBe('text');
      });

      it('returns "text" for array types', () => {
        expect(getValueType('text[]')).toBe('text');
      });

      it('returns "text" for empty string', () => {
        expect(getValueType('')).toBe('text');
      });
    });
  });

  describe('createEmptyFilter', () => {
    it('creates filter with default values when no parameters', () => {
      const filter = createEmptyFilter();
      expect(filter).toMatchObject({
        path: '',
        operator: 'Equal',
        value: '',
        valueType: 'text',
      });
      expect(filter.id).toBeDefined();
      expect(typeof filter.id).toBe('string');
    });

    it('creates filter with specified property', () => {
      const filter = createEmptyFilter('name');
      expect(filter.path).toBe('name');
    });

    it('creates filter with correct valueType for number dataType', () => {
      const filter = createEmptyFilter('age', 'int');
      expect(filter.valueType).toBe('number');
    });

    it('creates filter with correct valueType for boolean dataType', () => {
      const filter = createEmptyFilter('active', 'boolean');
      expect(filter.valueType).toBe('boolean');
    });

    it('creates filter with correct valueType for date dataType', () => {
      const filter = createEmptyFilter('createdAt', 'date');
      expect(filter.valueType).toBe('date');
    });

    it('creates filter with correct valueType for text dataType', () => {
      const filter = createEmptyFilter('title', 'text');
      expect(filter.valueType).toBe('text');
    });

    it('generates unique IDs for each filter', () => {
      const filter1 = createEmptyFilter();
      const filter2 = createEmptyFilter();
      expect(filter1.id).not.toBe(filter2.id);
    });
  });

  describe('formatFilterValue', () => {
    describe('null operators', () => {
      it('returns empty string for IsNull operator', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'IsNull',
          value: '',
          valueType: 'text',
        };
        expect(formatFilterValue(filter)).toBe('');
      });

      it('returns empty string for IsNotNull operator', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'IsNotNull',
          value: '',
          valueType: 'text',
        };
        expect(formatFilterValue(filter)).toBe('');
      });
    });

    describe('empty values', () => {
      it('returns "(not set)" for null value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: null,
          valueType: 'text',
        };
        expect(formatFilterValue(filter)).toBe('(not set)');
      });

      it('returns "(not set)" for undefined value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: undefined,
          valueType: 'text',
        };
        expect(formatFilterValue(filter)).toBe('(not set)');
      });

      it('returns "(not set)" for empty string value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: '',
          valueType: 'text',
        };
        expect(formatFilterValue(filter)).toBe('(not set)');
      });
    });

    describe('boolean values', () => {
      it('returns "true" for true boolean value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'active',
          operator: 'Equal',
          value: true,
          valueType: 'boolean',
        };
        expect(formatFilterValue(filter)).toBe('true');
      });

      it('returns "false" for false boolean value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'active',
          operator: 'Equal',
          value: false,
          valueType: 'boolean',
        };
        expect(formatFilterValue(filter)).toBe('false');
      });
    });

    describe('date values', () => {
      it('formats valid date string', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'createdAt',
          operator: 'Equal',
          value: '2024-01-15T10:30:00Z',
          valueType: 'date',
        };
        const result = formatFilterValue(filter);
        expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Locale-dependent format
      });

      it('returns "Invalid Date" for invalid date string', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'createdAt',
          operator: 'Equal',
          value: 'invalid-date',
          valueType: 'date',
        };
        // Invalid dates are converted to Date objects which toString to "Invalid Date"
        expect(formatFilterValue(filter)).toBe('Invalid Date');
      });

      it('handles Date object', () => {
        const date = new Date('2024-01-15');
        const filter: FilterCondition = {
          id: '1',
          path: 'createdAt',
          operator: 'Equal',
          value: date,
          valueType: 'date',
        };
        const result = formatFilterValue(filter);
        expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      });
    });

    describe('text and number values', () => {
      it('returns string representation of text value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John Doe',
          valueType: 'text',
        };
        expect(formatFilterValue(filter)).toBe('John Doe');
      });

      it('returns string representation of number value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'age',
          operator: 'Equal',
          value: 42,
          valueType: 'number',
        };
        expect(formatFilterValue(filter)).toBe('42');
      });

      it('handles zero as valid number', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'count',
          operator: 'Equal',
          value: 0,
          valueType: 'number',
        };
        expect(formatFilterValue(filter)).toBe('0');
      });
    });
  });

  describe('getOperatorLabel', () => {
    it('returns correct label for text Equal operator', () => {
      expect(getOperatorLabel('Equal', 'text')).toBe('equals');
    });

    it('returns correct label for text Like operator', () => {
      expect(getOperatorLabel('Like', 'text')).toBe('contains');
    });

    it('returns correct label for number GreaterThan operator', () => {
      expect(getOperatorLabel('GreaterThan', 'int')).toBe('greater than');
    });

    it('returns correct label for date GreaterThan operator', () => {
      expect(getOperatorLabel('GreaterThan', 'date')).toBe('after');
    });

    it('returns correct label for boolean Equal operator', () => {
      expect(getOperatorLabel('Equal', 'boolean')).toBe('is');
    });

    it('returns correct label for array ContainsAny operator', () => {
      expect(getOperatorLabel('ContainsAny', 'text[]')).toBe('contains any');
    });

    it('returns operator value when no matching label found', () => {
      expect(getOperatorLabel('Equal', 'unknown')).toBe('equals');
    });

    it('uses text type as default when dataType not provided', () => {
      expect(getOperatorLabel('Equal')).toBe('equals');
    });
  });

  describe('isFilterValid', () => {
    describe('invalid filters', () => {
      it('returns false when path is empty', () => {
        const filter: FilterCondition = {
          id: '1',
          path: '',
          operator: 'Equal',
          value: 'test',
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(false);
      });

      it('returns false when value is null for Equal operator', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: null,
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(false);
      });

      it('returns false when value is undefined for Equal operator', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: undefined,
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(false);
      });

      it('returns false when value is empty string for Equal operator', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: '',
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(false);
      });

      it('returns false when value is missing for GreaterThan operator', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'age',
          operator: 'GreaterThan',
          value: '',
          valueType: 'number',
        };
        expect(isFilterValid(filter)).toBe(false);
      });
    });

    describe('valid filters', () => {
      it('returns true for IsNull operator without value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'IsNull',
          value: '',
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(true);
      });

      it('returns true for IsNotNull operator without value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'IsNotNull',
          value: '',
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(true);
      });

      it('returns true for Equal operator with text value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(true);
      });

      it('returns true for Equal operator with number value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'age',
          operator: 'Equal',
          value: 42,
          valueType: 'number',
        };
        expect(isFilterValid(filter)).toBe(true);
      });

      it('returns true for Equal operator with zero value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'count',
          operator: 'Equal',
          value: 0,
          valueType: 'number',
        };
        expect(isFilterValid(filter)).toBe(true);
      });

      it('returns true for Equal operator with false boolean', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'active',
          operator: 'Equal',
          value: false,
          valueType: 'boolean',
        };
        expect(isFilterValid(filter)).toBe(true);
      });

      it('returns true for Like operator with value', () => {
        const filter: FilterCondition = {
          id: '1',
          path: 'name',
          operator: 'Like',
          value: 'John',
          valueType: 'text',
        };
        expect(isFilterValid(filter)).toBe(true);
      });
    });
  });

  describe('hasValidFilters', () => {
    it('returns false for empty array', () => {
      expect(hasValidFilters([])).toBe(false);
    });

    it('returns false when all filters are invalid', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          path: '',
          operator: 'Equal',
          value: 'test',
          valueType: 'text',
        },
        {
          id: '2',
          path: 'name',
          operator: 'Equal',
          value: '',
          valueType: 'text',
        },
      ];
      expect(hasValidFilters(filters)).toBe(false);
    });

    it('returns true when at least one filter is valid', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          path: '',
          operator: 'Equal',
          value: 'test',
          valueType: 'text',
        },
        {
          id: '2',
          path: 'name',
          operator: 'Equal',
          value: 'John',
          valueType: 'text',
        },
      ];
      expect(hasValidFilters(filters)).toBe(true);
    });

    it('returns true when all filters are valid', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
          valueType: 'text',
        },
        {
          id: '2',
          path: 'age',
          operator: 'GreaterThan',
          value: 18,
          valueType: 'number',
        },
      ];
      expect(hasValidFilters(filters)).toBe(true);
    });

    it('returns true for single valid filter', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          path: 'name',
          operator: 'IsNotNull',
          value: '',
          valueType: 'text',
        },
      ];
      expect(hasValidFilters(filters)).toBe(true);
    });
  });
});
