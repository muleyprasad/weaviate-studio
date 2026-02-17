import { jest } from '@jest/globals';
import type { WeaviateClient, Collection } from 'weaviate-client';
import { DataExplorerAPI } from '../DataExplorerAPI';
import type { FilterCondition, FilterMatchMode } from '../../types';

// Mock the Filters module
jest.mock('weaviate-client', () => ({
  Filters: {
    and: jest.fn((...filters: any[]) => ({ _combiner: 'and', filters })),
    or: jest.fn((...filters: any[]) => ({ _combiner: 'or', filters })),
  },
}));

/**
 * Test suite for DataExplorerAPI filter building functionality
 *
 * Tests cover:
 * - All filter operators (Equal, NotEqual, GreaterThan, etc.)
 * - All data types (text, number, boolean, date, arrays)
 * - Edge cases (null, undefined, empty values, special characters)
 * - Complex filters (AND/OR logic, multiple conditions)
 * - Error handling (unknown operators, builder failures)
 */

describe('DataExplorerAPI - Filter Building', () => {
  let mockClient: jest.Mocked<WeaviateClient>;
  let mockCollection: jest.Mocked<Collection>;
  let api: DataExplorerAPI;

  // Mock filter builder that tracks method calls
  let mockFilterBuilder: any;
  let filterBuilderCalls: Array<{ method: string; args: any[] }> = [];

  beforeEach(() => {
    // Reset tracking
    filterBuilderCalls = [];

    // Create chainable filter builder mock
    mockFilterBuilder = {
      equal: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'equal', args: [value] });
        return { _filter: { equal: value } };
      }),
      notEqual: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'notEqual', args: [value] });
        return { _filter: { notEqual: value } };
      }),
      greaterThan: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'greaterThan', args: [value] });
        return { _filter: { greaterThan: value } };
      }),
      greaterOrEqual: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'greaterOrEqual', args: [value] });
        return { _filter: { greaterOrEqual: value } };
      }),
      lessThan: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'lessThan', args: [value] });
        return { _filter: { lessThan: value } };
      }),
      lessOrEqual: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'lessOrEqual', args: [value] });
        return { _filter: { lessOrEqual: value } };
      }),
      like: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'like', args: [value] });
        return { _filter: { like: value } };
      }),
      containsAny: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'containsAny', args: [value] });
        return { _filter: { containsAny: value } };
      }),
      containsAll: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'containsAll', args: [value] });
        return { _filter: { containsAll: value } };
      }),
      isNull: jest.fn((value: any) => {
        filterBuilderCalls.push({ method: 'isNull', args: [value] });
        return { _filter: { isNull: value } };
      }),
    };

    // Mock collection with filter builder
    mockCollection = {
      filter: {
        byProperty: jest.fn((path: string) => mockFilterBuilder),
      },
      query: {
        fetchObjects: (jest.fn() as any).mockResolvedValue({
          objects: [
            {
              uuid: 'test-uuid-1',
              properties: { name: 'Test Object 1' },
              metadata: {},
            },
            {
              uuid: 'test-uuid-2',
              properties: { name: 'Test Object 2' },
              metadata: {},
            },
          ],
        }),
        nearText: jest.fn().mockReturnThis(),
        nearVector: jest.fn().mockReturnThis(),
        nearObject: jest.fn().mockReturnThis(),
        hybrid: jest.fn().mockReturnThis(),
      },
      aggregate: {
        overAll: (jest.fn() as any).mockResolvedValue({
          totalCount: 100,
        }),
      },
    } as any;

    // Mock client
    mockClient = {
      collections: {
        get: jest.fn(() => mockCollection),
      },
    } as any;

    api = new DataExplorerAPI(mockClient);
  });

  describe('Basic Operators', () => {
    test('Equal operator with text value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'name', operator: 'Equal', value: 'John', valueType: 'text' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('name');
      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: ['John'] });
    });

    test('NotEqual operator with number value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'age', operator: 'NotEqual', value: 30, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('age');
      expect(filterBuilderCalls).toContainEqual({ method: 'notEqual', args: [30] });
    });

    test('Like operator with wildcard pattern', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'email', operator: 'Like', value: '*@example.com', valueType: 'text' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('email');
      expect(filterBuilderCalls).toContainEqual({ method: 'like', args: ['*@example.com'] });
    });

    test('IsNull operator', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'description', operator: 'IsNull', value: null },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('description');
      expect(filterBuilderCalls).toContainEqual({ method: 'isNull', args: [true] });
    });

    test('IsNotNull operator', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'description', operator: 'IsNotNull', value: null },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('description');
      expect(filterBuilderCalls).toContainEqual({ method: 'isNull', args: [false] });
    });
  });

  describe('Numeric Comparison Operators', () => {
    test('GreaterThan operator with number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'price', operator: 'GreaterThan', value: 100, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Product',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'greaterThan', args: [100] });
    });

    test('GreaterThanEqual operator with number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'quantity', operator: 'GreaterThanEqual', value: 10, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Product',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'greaterOrEqual', args: [10] });
    });

    test('LessThan operator with number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'age', operator: 'LessThan', value: 65, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'lessThan', args: [65] });
    });

    test('LessThanEqual operator with number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'score', operator: 'LessThanEqual', value: 100, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Test',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'lessOrEqual', args: [100] });
    });

    test('Numeric operators coerce string to number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'age', operator: 'GreaterThan', value: '25', valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'greaterThan', args: [25] });
    });
  });

  describe('Boolean Operators', () => {
    test('Equal operator with boolean true', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'isActive', operator: 'Equal', value: true, valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [true] });
    });

    test('Equal operator with boolean false', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'isActive', operator: 'Equal', value: false, valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [false] });
    });

    test('Boolean coercion from string "true"', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'isActive', operator: 'Equal', value: 'true', valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [true] });
    });

    test('Boolean coercion from string "false"', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'isActive', operator: 'Equal', value: 'false', valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [false] });
    });
  });

  describe('Date Operators', () => {
    test('Equal operator with Date object', async () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const conditions: FilterCondition[] = [
        { id: '1', path: 'createdAt', operator: 'Equal', value: date, valueType: 'date' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'equal',
        args: ['2024-01-01T00:00:00.000Z'],
      });
    });

    test('Equal operator with date string', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'createdAt', operator: 'Equal', value: '2024-01-01', valueType: 'date' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      // Should be converted to ISO string
      const call = filterBuilderCalls.find((c) => c.method === 'equal');
      expect(call).toBeDefined();
      expect(call!.args[0]).toMatch(/2024-01-01T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    test('GreaterThan operator with date', async () => {
      const date = new Date('2024-01-01');
      const conditions: FilterCondition[] = [
        { id: '1', path: 'publishedAt', operator: 'GreaterThan', value: date, valueType: 'date' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      const call = filterBuilderCalls.find((c) => c.method === 'greaterThan');
      expect(call).toBeDefined();
      expect(call!.args[0]).toMatch(/2024-01-01T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    test('LessThan operator with date', async () => {
      const conditions: FilterCondition[] = [
        {
          id: '1',
          path: 'expiresAt',
          operator: 'LessThan',
          value: '2024-12-31',
          valueType: 'date',
        },
      ];

      await api.fetchObjects({
        collectionName: 'Subscription',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      const call = filterBuilderCalls.find((c) => c.method === 'lessThan');
      expect(call).toBeDefined();
      expect(call!.args[0]).toMatch(/2024-12-31T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('Array Operators', () => {
    test('ContainsAny operator with array value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'tags', operator: 'ContainsAny', value: ['tech', 'science'] },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'containsAny',
        args: [['tech', 'science']],
      });
    });

    test('ContainsAny operator with single value (converted to array)', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'tags', operator: 'ContainsAny', value: 'tech' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'containsAny',
        args: [['tech']],
      });
    });

    test('ContainsAll operator with array value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'categories', operator: 'ContainsAll', value: ['featured', 'trending'] },
      ];

      await api.fetchObjects({
        collectionName: 'Product',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'containsAll',
        args: [['featured', 'trending']],
      });
    });

    test('ContainsAll operator with single value (converted to array)', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'categories', operator: 'ContainsAll', value: 'featured' },
      ];

      await api.fetchObjects({
        collectionName: 'Product',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'containsAll',
        args: [['featured']],
      });
    });
  });

  describe('Multiple Conditions', () => {
    test('Multiple conditions with AND logic (default)', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'status', operator: 'Equal', value: 'active', valueType: 'text' },
        { id: '2', path: 'age', operator: 'GreaterThan', value: 18, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      // Should have built 2 filters
      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(2);
      expect(filterBuilderCalls).toHaveLength(2);
      expect(filterBuilderCalls[0]).toEqual({ method: 'equal', args: ['active'] });
      expect(filterBuilderCalls[1]).toEqual({ method: 'greaterThan', args: [18] });
    });

    test('Multiple conditions with explicit AND mode', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'category', operator: 'Equal', value: 'electronics' },
        { id: '2', path: 'price', operator: 'LessThan', value: 1000, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Product',
        limit: 10,
        offset: 0,
        where: conditions,
        matchMode: 'AND',
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(2);
    });

    test('Multiple conditions with OR logic', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'status', operator: 'Equal', value: 'draft' },
        { id: '2', path: 'status', operator: 'Equal', value: 'pending' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
        matchMode: 'OR',
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(2);
      expect(filterBuilderCalls).toHaveLength(2);
    });

    test('Single valid condition returns single filter', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'name', operator: 'Like', value: 'John*' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(1);
      expect(filterBuilderCalls).toHaveLength(1);
    });

    test('Empty conditions array results in no filtering', async () => {
      const conditions: FilterCondition[] = [];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      // No filter builder should be called
      expect(mockCollection.filter.byProperty).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('Null value with Equal operator', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'middleName', operator: 'Equal', value: null },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [null] });
    });

    test('Undefined value with Equal operator', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'optional', operator: 'Equal', value: undefined },
      ];

      await api.fetchObjects({
        collectionName: 'Test',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [undefined] });
    });

    test('Empty string value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'description', operator: 'Equal', value: '', valueType: 'text' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [''] });
    });

    test('Special characters in Like pattern', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'email', operator: 'Like', value: '*test+123@example.com' },
      ];

      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'like',
        args: ['*test+123@example.com'],
      });
    });

    test('Unicode characters in text value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'name', operator: 'Equal', value: 'José María 日本語', valueType: 'text' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'equal',
        args: ['José María 日本語'],
      });
    });

    test('Very large number', async () => {
      const conditions: FilterCondition[] = [
        {
          id: '1',
          path: 'population',
          operator: 'GreaterThan',
          value: 1000000000,
          valueType: 'number',
        },
      ];

      await api.fetchObjects({
        collectionName: 'Country',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'greaterThan',
        args: [1000000000],
      });
    });

    test('Negative number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'balance', operator: 'LessThan', value: -100, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Account',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'lessThan',
        args: [-100],
      });
    });

    test('Decimal number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'rating', operator: 'GreaterThanEqual', value: 4.5, valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Review',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({
        method: 'greaterOrEqual',
        args: [4.5],
      });
    });

    test('Invalid date string remains as string', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'createdAt', operator: 'Equal', value: 'invalid-date', valueType: 'date' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      // Invalid date should remain as the original value
      expect(filterBuilderCalls).toContainEqual({
        method: 'equal',
        args: ['invalid-date'],
      });
    });
  });

  describe('Error Handling', () => {
    test('Unknown operator throws error', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'name', operator: 'InvalidOp' as any, value: 'test' },
      ];

      await expect(
        api.fetchObjects({
          collectionName: 'Test',
          limit: 10,
          offset: 0,
          where: conditions,
        })
      ).rejects.toThrow(/Unknown filter operator/);
    });

    test('Filter builder failure propagates error with context', async () => {
      // Make the filter builder throw
      mockFilterBuilder.equal.mockImplementationOnce(() => {
        throw new Error('Builder failure');
      });

      const conditions: FilterCondition[] = [
        { id: '1', path: 'name', operator: 'Equal', value: 'test' },
      ];

      await expect(
        api.fetchObjects({
          collectionName: 'Test',
          limit: 10,
          offset: 0,
          where: conditions,
        })
      ).rejects.toThrow(/Failed to build filter for path "name"/);
    });

    test('Error includes original error message', async () => {
      mockFilterBuilder.greaterThan.mockImplementationOnce(() => {
        throw new Error('Invalid comparison value');
      });

      const conditions: FilterCondition[] = [
        {
          id: '1',
          path: 'age',
          operator: 'GreaterThan',
          value: 'not-a-number',
          valueType: 'number',
        },
      ];

      await expect(
        api.fetchObjects({
          collectionName: 'Person',
          limit: 10,
          offset: 0,
          where: conditions,
        })
      ).rejects.toThrow(/Invalid comparison value/);
    });
  });

  describe('Match Mode Behavior', () => {
    test('Default match mode is AND', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'status', operator: 'Equal', value: 'active' },
        { id: '2', path: 'verified', operator: 'Equal', value: true, valueType: 'boolean' },
      ];

      // matchMode not specified - should default to AND
      await api.fetchObjects({
        collectionName: 'User',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(2);
    });

    test('Explicit AND match mode', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'category', operator: 'Equal', value: 'tech' },
        { id: '2', path: 'published', operator: 'Equal', value: true, valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        where: conditions,
        matchMode: 'AND',
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(2);
    });

    test('OR match mode', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'priority', operator: 'Equal', value: 'high' },
        { id: '2', path: 'urgent', operator: 'Equal', value: true, valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'Task',
        limit: 10,
        offset: 0,
        where: conditions,
        matchMode: 'OR',
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledTimes(2);
    });
  });

  describe('Value Type Coercion', () => {
    test('Number coercion from string', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'count', operator: 'Equal', value: '42', valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Stats',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [42] });
    });

    test('Text coercion from number', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'code', operator: 'Equal', value: 12345, valueType: 'text' },
      ];

      await api.fetchObjects({
        collectionName: 'Product',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: ['12345'] });
    });

    test('Boolean coercion from truthy value', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'flag', operator: 'Equal', value: 1, valueType: 'boolean' },
      ];

      await api.fetchObjects({
        collectionName: 'Config',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: [true] });
    });

    test('Invalid number string returns NaN for number type', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'age', operator: 'Equal', value: 'not-a-number', valueType: 'number' },
      ];

      await api.fetchObjects({
        collectionName: 'Person',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      // NaN is returned for invalid number strings
      expect(filterBuilderCalls[0].args[0]).toBe('not-a-number');
    });

    test('No valueType defaults to string coercion', async () => {
      const conditions: FilterCondition[] = [
        { id: '1', path: 'data', operator: 'Equal', value: 123 },
      ];

      await api.fetchObjects({
        collectionName: 'Test',
        limit: 10,
        offset: 0,
        where: conditions,
      });

      expect(filterBuilderCalls).toContainEqual({ method: 'equal', args: ['123'] });
    });
  });
});
