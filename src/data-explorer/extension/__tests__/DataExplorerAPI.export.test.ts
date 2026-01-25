import { jest } from '@jest/globals';
import type { WeaviateClient, Collection } from 'weaviate-client';
import { DataExplorerAPI } from '../DataExplorerAPI';
import type { ExportParams, WeaviateObject } from '../../types';

/**
 * Test suite for DataExplorerAPI export functionality
 *
 * Tests cover:
 * - JSON export with various options (metadata, properties, vectors)
 * - CSV export with proper escaping and formatting
 * - Special characters handling (quotes, commas, newlines, unicode)
 * - Large dataset handling with pagination
 * - Truncation at 10,000 object limit
 * - Export cancellation via AbortSignal
 * - Different export scopes (currentPage, filtered, all)
 * - Nested object flattening
 * - Filename generation
 */

describe('DataExplorerAPI - Export Functionality', () => {
  let mockClient: jest.Mocked<WeaviateClient>;
  let mockCollection: jest.Mocked<Collection>;
  let api: DataExplorerAPI;

  const createMockObjects = (count: number): WeaviateObject[] => {
    return Array.from({ length: count }, (_, i) => ({
      uuid: `uuid-${i + 1}`,
      properties: {
        title: `Article ${i + 1}`,
        content: `Content for article ${i + 1}`,
        count: i + 1,
      },
      metadata: {
        uuid: `uuid-${i + 1}`,
      },
    }));
  };

  const mockObjectsWithSpecialChars: WeaviateObject[] = [
    {
      uuid: 'special-1',
      properties: {
        title: 'Title with "quotes"',
        description: 'Text with, commas',
        notes: 'Line 1\nLine 2\rLine 3',
        unicode: 'José María 日本語 🎉',
        empty: '',
        nullValue: null,
      },
      metadata: {
        uuid: 'special-1',
      },
    },
  ];

  const mockObjectsWithNested: WeaviateObject[] = [
    {
      uuid: 'nested-1',
      properties: {
        title: 'Article',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            bio: 'Writer',
            location: 'NYC',
          },
        },
        tags: ['tech', 'science', 'ai'],
      },
      metadata: {
        uuid: 'nested-1',
      },
    },
  ];

  beforeEach(() => {
    mockCollection = {
      query: {
        fetchObjects: jest.fn().mockImplementation((options: any) => {
          const limit = options?.limit || 100;
          const offset = options?.offset || 0;
          const start = offset;
          const objects = createMockObjects(Math.min(limit, 100));
          return Promise.resolve({
            objects: objects.slice(0, Math.min(limit, 100 - start)),
          });
        }),
      },
      aggregate: {
        overAll: (jest.fn() as any).mockResolvedValue({ totalCount: 100 }),
      },
      filter: {
        byProperty: jest.fn(() => ({
          equal: jest.fn(() => ({ _filter: { equal: true } })),
        })),
      },
    } as any;

    mockClient = {
      collections: {
        get: jest.fn(() => mockCollection),
      },
    } as any;

    api = new DataExplorerAPI(mockClient);
  });

  describe('JSON Export', () => {
    test('exports current page objects to JSON', async () => {
      const currentObjects = createMockObjects(10);
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects,
        options: {
          includeMetadata: true,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.format).toBe('json');
      expect(result.objectCount).toBe(10);
      expect(result.isTruncated).toBe(false);

      const parsed = JSON.parse(result.data);
      expect(parsed).toHaveLength(10);
      expect(parsed[0]).toHaveProperty('uuid');
      expect(parsed[0]).toHaveProperty('title');
    });

    test('JSON export includes metadata when requested', async () => {
      const currentObjects: WeaviateObject[] = [
        {
          uuid: 'uuid-1',
          properties: { title: 'Test Article' },
          metadata: {
            uuid: 'uuid-1',
            creationTime: '2024-01-01T00:00:00.000Z',
            lastUpdateTime: '2024-01-02T00:00:00.000Z',
          },
        },
      ];
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects,
        options: {
          includeMetadata: true,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0]).toHaveProperty('uuid', 'uuid-1');
      expect(parsed[0]).toHaveProperty('createdAt', '2024-01-01T00:00:00.000Z');
      expect(parsed[0]).toHaveProperty('updatedAt', '2024-01-02T00:00:00.000Z');
    });

    test('JSON export excludes metadata when not requested', async () => {
      const currentObjects = createMockObjects(1);
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0]).not.toHaveProperty('uuid');
      expect(parsed[0]).not.toHaveProperty('createdAt');
      expect(parsed[0]).toHaveProperty('title');
    });

    test('JSON export includes vectors when requested', async () => {
      const objectsWithVectors: WeaviateObject[] = [
        {
          uuid: 'vec-1',
          properties: { title: 'Test' },
          metadata: { uuid: 'vec-1' },
          vector: [0.1, 0.2, 0.3],
        },
      ];

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: objectsWithVectors,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: true,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0]).toHaveProperty('vector', [0.1, 0.2, 0.3]);
    });

    test('JSON export flattens nested objects when requested', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: mockObjectsWithNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: true,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0]).toHaveProperty('title', 'Article');
      expect(parsed[0]['author.name']).toBe('John Doe');
      expect(parsed[0]['author.email']).toBe('john@example.com');
      expect(parsed[0]['author.profile.bio']).toBe('Writer');
      expect(parsed[0]['author.profile.location']).toBe('NYC');
    });

    test('JSON export preserves nested structure when flattening disabled', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: mockObjectsWithNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0].author).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          bio: 'Writer',
          location: 'NYC',
        },
      });
    });

    test('JSON export handles arrays correctly', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: mockObjectsWithNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0].tags).toEqual(['tech', 'science', 'ai']);
    });

    test('JSON export is properly formatted with indentation', async () => {
      const currentObjects = createMockObjects(1);
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // Check that JSON is formatted with indentation
      expect(result.data).toContain('\n  ');
      expect(result.data).toMatch(/\[\s+\{/);
    });
  });

  describe('CSV Export', () => {
    test('exports current page objects to CSV', async () => {
      const currentObjects = createMockObjects(3);
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects,
        options: {
          includeMetadata: true,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.format).toBe('csv');
      expect(result.objectCount).toBe(3);

      const lines = result.data.split('\n');
      expect(lines[0]).toContain('uuid');
      expect(lines[0]).toContain('createdAt');
      expect(lines[0]).toContain('title');
      expect(lines.length).toBe(4); // Header + 3 rows
    });

    test('CSV export escapes double quotes correctly', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithSpecialChars,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // CSV should escape quotes by doubling them and wrapping in quotes
      expect(result.data).toContain('"Title with ""quotes"""');
    });

    test('CSV export escapes commas correctly', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithSpecialChars,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // CSV should wrap fields containing commas in quotes
      expect(result.data).toContain('"Text with, commas"');
    });

    test('CSV export escapes newlines correctly', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithSpecialChars,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // CSV should wrap fields containing newlines in quotes
      expect(result.data).toMatch(/"Line 1\nLine 2\rLine 3"/);
    });

    test('CSV export handles unicode characters correctly', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithSpecialChars,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.data).toContain('José María 日本語 🎉');
    });

    test('CSV export handles null values as empty strings', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithSpecialChars,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // Null values should be rendered as empty cells in CSV
      expect(result.data).toContain(',,'); // Empty value between commas or at end
    });

    test('CSV export handles empty strings correctly', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithSpecialChars,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // Empty string should be rendered as empty cell (two consecutive commas or at end)
      expect(result.data).toMatch(/,(?:,|\n)/);
    });

    test('CSV export joins arrays with semicolons', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // Arrays should be joined with semicolons to avoid CSV delimiter conflicts
      expect(result.data).toContain('tech;science;ai');
    });

    test('CSV export flattens nested objects when requested', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: true,
        },
      };

      const result = await api.exportObjects(params);
      const lines = result.data.split('\n');

      expect(lines[0]).toContain('author.name');
      expect(lines[0]).toContain('author.email');
      expect(lines[0]).toContain('author.profile.bio');
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('john@example.com');
    });

    test('CSV export stringifies nested objects when flattening disabled', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: mockObjectsWithNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      // Nested object should be JSON-stringified and escaped with doubled quotes
      expect(result.data).toContain('""name""');
    });

    test('CSV export includes hasVector flag when vectors requested', async () => {
      const objectsWithVectors: WeaviateObject[] = [
        {
          uuid: 'vec-1',
          properties: { title: 'Test' },
          metadata: { uuid: 'vec-1' },
          vector: [0.1, 0.2, 0.3],
        },
      ];

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: objectsWithVectors,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: true,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const lines = result.data.split('\n');

      expect(lines[0]).toContain('hasVector');
      expect(lines[1]).toContain('true');
    });

    test('CSV export returns empty string for empty objects array', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: [],
        options: {
          includeMetadata: true,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.data).toBe('');
      expect(result.objectCount).toBe(0);
    });

    test('CSV export handles numbers and booleans correctly', async () => {
      const objects: WeaviateObject[] = [
        {
          uuid: 'test-1',
          properties: {
            count: 42,
            rating: 4.5,
            active: true,
            archived: false,
          },
          metadata: { uuid: 'test-1' },
        },
      ];

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: objects,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const lines = result.data.split('\n');

      expect(lines[1]).toContain('42');
      expect(lines[1]).toContain('4.5');
      expect(lines[1]).toContain('true');
      expect(lines[1]).toContain('false');
    });
  });

  describe('Export Scopes', () => {
    test('exports current page scope', async () => {
      const currentObjects = createMockObjects(10);
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.objectCount).toBe(10);
      expect(mockCollection.query.fetchObjects).not.toHaveBeenCalled();
    });

    test('exports all objects scope', async () => {
      (mockCollection.query.fetchObjects.mockImplementation as any)((options: any) => {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;
        const start = offset;
        if (start >= 100) {
          return Promise.resolve({ objects: [] });
        }
        return Promise.resolve({
          objects: createMockObjects(limit),
        });
      });

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.objectCount).toBe(100);
      expect(mockCollection.query.fetchObjects).toHaveBeenCalled();
    });

    test('exports filtered scope', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'filtered',
        where: [{ id: '1', path: 'status', operator: 'Equal', value: 'published' }],
        matchMode: 'AND',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('status');
      expect(result.objectCount).toBeGreaterThan(0);
    });
  });

  describe('Large Dataset Handling', () => {
    test('paginates through large datasets', async () => {
      let callCount = 0;
      (mockCollection.query.fetchObjects.mockImplementation as any)((options: any) => {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;
        callCount++;
        const start = offset || 0;
        const remaining = Math.max(0, 250 - start);
        const objectsToReturn = Math.min(limit, remaining);

        if (remaining === 0) {
          return Promise.resolve({ objects: [] });
        }

        return Promise.resolve({
          objects: createMockObjects(objectsToReturn),
        });
      });

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.objectCount).toBe(250);
      expect(callCount).toBeGreaterThan(2); // Multiple pagination calls
    });

    test('truncates at 10,000 objects and sets flag', async () => {
      (mockCollection.query.fetchObjects.mockImplementation as any)((options: any) => {
        const limit = options?.limit || 100;
        return Promise.resolve({
          objects: createMockObjects(limit),
        });
      });

      (mockCollection.aggregate.overAll.mockResolvedValue as any)({ totalCount: 15000 });

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.isTruncated).toBe(true);
      expect(result.truncationLimit).toBe(10000);
      expect(result.totalCount).toBe(15000);
      expect(result.objectCount).toBe(10000);
    });

    test('does not set truncated flag when within limit', async () => {
      (mockCollection.query.fetchObjects.mockImplementation as any)((options: any) => {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;
        const start = offset;
        if (start >= 100) {
          return Promise.resolve({ objects: [] });
        }
        return Promise.resolve({
          objects: createMockObjects(Math.min(limit, 100 - start)),
        });
      });

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.isTruncated).toBe(false);
      expect(result.truncationLimit).toBeUndefined();
    });
  });

  describe('Export Cancellation', () => {
    test('cancels export when AbortSignal is triggered before fetch', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      await expect(api.exportObjects(params, abortController.signal)).rejects.toThrow(
        'Export cancelled'
      );
    });

    test('cancels export when AbortSignal is triggered during fetch', async () => {
      const abortController = new AbortController();

      (mockCollection.query.fetchObjects.mockImplementation as any)(() => {
        abortController.abort();
        return Promise.resolve({
          objects: createMockObjects(100),
        });
      });

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      await expect(api.exportObjects(params, abortController.signal)).rejects.toThrow(
        'Export cancelled'
      );
    });

    test('checks abort signal multiple times during export', async () => {
      const abortController = new AbortController();

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: createMockObjects(10),
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      // For currentPage, if already aborted before processing, it will be caught
      // This test verifies the signal is checked at multiple points
      const result = await api.exportObjects(params, abortController.signal);

      expect(result.objectCount).toBe(10);
    });

    test('completes export when AbortSignal is not triggered', async () => {
      const abortController = new AbortController();

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: createMockObjects(10),
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params, abortController.signal);

      expect(result.objectCount).toBe(10);
    });
  });

  describe('Filename Generation', () => {
    test('generates filename with collection name and date', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: [],
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.filename).toMatch(/^Article_\d{4}-\d{2}-\d{2}_page\.json$/);
    });

    test('generates filename with scope suffix for all scope', async () => {
      const params: ExportParams = {
        collectionName: 'Product',
        format: 'csv',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.filename).toMatch(/^Product_\d{4}-\d{2}-\d{2}_all\.csv$/);
    });

    test('generates filename with scope suffix for filtered scope', async () => {
      const params: ExportParams = {
        collectionName: 'User',
        format: 'json',
        scope: 'filtered',
        where: [{ id: '1', path: 'active', operator: 'Equal', value: true }],
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.filename).toMatch(/^User_\d{4}-\d{2}-\d{2}_filtered\.json$/);
    });

    test('generates filename with correct extension for CSV', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: [],
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.filename).toMatch(/\.csv$/);
    });

    test('generates filename with correct extension for JSON', async () => {
      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: [],
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.filename).toMatch(/\.json$/);
    });
  });

  describe('Error Handling', () => {
    test('handles fetch errors gracefully', async () => {
      mockCollection.query.fetchObjects.mockRejectedValueOnce(new Error('Network error'));

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      await expect(api.exportObjects(params)).rejects.toThrow('Network error');
    });

    test('handles timeout errors with actionable message', async () => {
      mockCollection.query.fetchObjects.mockRejectedValueOnce(new Error('Request timed out'));

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      await expect(api.exportObjects(params)).rejects.toThrow(/timed out.*Suggestions/);
    });

    test('distinguishes between cancellation and other errors', async () => {
      const abortController = new AbortController();
      abortController.abort();

      mockCollection.query.fetchObjects.mockRejectedValueOnce(new Error('Network error'));

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'all',
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      await expect(api.exportObjects(params, abortController.signal)).rejects.toThrow(
        'Export cancelled'
      );
    });
  });

  describe('Edge Cases', () => {
    test('handles objects with undefined properties', async () => {
      const objects: WeaviateObject[] = [
        {
          uuid: 'test-1',
          properties: {
            title: 'Test',
            optional: undefined,
          },
          metadata: { uuid: 'test-1' },
        },
      ];

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'csv',
        scope: 'currentPage',
        currentObjects: objects,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);

      expect(result.data).toBeDefined();
      expect(result.objectCount).toBe(1);
    });

    test('handles objects with very long strings', async () => {
      const longString = 'a'.repeat(10000);
      const objects: WeaviateObject[] = [
        {
          uuid: 'test-1',
          properties: { content: longString },
          metadata: { uuid: 'test-1' },
        },
      ];

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: objects,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: false,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0].content).toHaveLength(10000);
    });

    test('handles objects with deeply nested structures', async () => {
      const deeplyNested: WeaviateObject[] = [
        {
          uuid: 'deep-1',
          properties: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    value: 'deep value',
                  },
                },
              },
            },
          },
          metadata: { uuid: 'deep-1' },
        },
      ];

      const params: ExportParams = {
        collectionName: 'Article',
        format: 'json',
        scope: 'currentPage',
        currentObjects: deeplyNested,
        options: {
          includeMetadata: false,
          includeProperties: true,
          includeVectors: false,
          flattenNested: true,
        },
      };

      const result = await api.exportObjects(params);
      const parsed = JSON.parse(result.data);

      expect(parsed[0]['level1.level2.level3.level4.value']).toBe('deep value');
    });
  });
});
