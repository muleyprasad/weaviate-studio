import { jest } from '@jest/globals';
import type { WeaviateClient } from 'weaviate-client';
import { DataExplorerAPI } from '../DataExplorerAPI';
import type { ImportParams, UpdateObjectParams, DeleteObjectParams } from '../../types';

/**
 * Test suite for DataExplorerAPI write operations (Phase 6)
 *
 * Tests cover:
 * - Import from JSON and CSV payloads (end-to-end through the mocked client)
 * - Chunked batch inserts with per-object salvage on chunk failure
 * - Import validation errors (empty payload, bad JSON, missing collection)
 * - Object update mapping, UUID validation, and error paths
 * - Object delete mapping, UUID validation, and error paths
 * - Tenant-aware collection routing via collections.use().withTenant()
 */

describe('DataExplorerAPI - Write Operations', () => {
  let mockClient: jest.Mocked<WeaviateClient>;
  // Test double: intentionally untyped (mirrors mock style used across this repo)
  let mockData: {
    insertMany: any;
    update: any;
    deleteById: any;
  };
  let mockCollection: { data: typeof mockData };
  let api: DataExplorerAPI;

  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    mockData = {
      insertMany: jest.fn(async () => ({})),
      update: jest.fn(async () => undefined),
      deleteById: jest.fn(async () => true),
    };
    mockCollection = { data: mockData } as any;
    mockClient = {
      collections: {
        get: jest.fn(() => mockCollection),
        use: jest.fn(() => ({ withTenant: jest.fn(() => mockCollection) })),
      },
    } as any;

    api = new DataExplorerAPI(mockClient);
  });

  describe('importObjects', () => {
    test('imports a JSON array via a single batch', async () => {
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ title: 'A' }, { title: 'B' }]),
      };

      const result = await api.importObjects(params);

      expect(result.importedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockClient.collections.get).toHaveBeenCalledWith('Article');
      expect(mockData.insertMany).toHaveBeenCalledTimes(1);
      expect(mockData.insertMany).toHaveBeenCalledWith([
        { properties: { title: 'A' } },
        { properties: { title: 'B' } },
      ]);
    });

    test('imports CSV with header row and coerced values', async () => {
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'file',
        format: 'csv',
        payload: 'title,count\nHello,3',
      };

      const result = await api.importObjects(params);

      expect(result.importedCount).toBe(1);
      expect(mockData.insertMany).toHaveBeenCalledWith([
        { properties: { title: 'Hello', count: 3 } },
      ]);
    });

    test('maps imported vectors to the SDK vectors field', async () => {
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ title: 'Vectorized', vector: [0.1, 0.2] }]),
      };

      await api.importObjects(params);

      expect(mockData.insertMany).toHaveBeenCalledWith([
        { properties: { title: 'Vectorized' }, vectors: [0.1, 0.2] },
      ]);
    });

    test('counts per-object batch errors returned by the SDK', async () => {
      mockData.insertMany.mockResolvedValueOnce({
        hasErrors: true,
        errors: {
          1: { message: 'invalid vector dimension' },
        },
      });

      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ title: 'Good' }, { title: 'Bad' }]),
      };

      const result = await api.importObjects(params);

      expect(result.importedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toContain('Item 2: invalid vector dimension');
    });

    test('routes through withTenant for multi-tenant collections', async () => {
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ title: 'T' }]),
        tenant: 'tenant-a',
      };

      await api.importObjects(params);

      expect(mockClient.collections.use).toHaveBeenCalledWith('Article');
      expect(mockData.insertMany).toHaveBeenCalledTimes(1);
    });

    test('splits large imports into 100-object chunks', async () => {
      const items = Array.from({ length: 250 }, (_, i) => ({ n: i }));
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify(items),
      };

      const result = await api.importObjects(params);

      expect(result.importedCount).toBe(250);
      expect(mockData.insertMany).toHaveBeenCalledTimes(3);
      expect(mockData.insertMany.mock.calls[0][0] as unknown[]).toHaveLength(100);
      expect(mockData.insertMany.mock.calls[2][0] as unknown[]).toHaveLength(50);
    });

    test('salvages per-object inserts when a chunk fails', async () => {
      mockData.insertMany
        .mockRejectedValueOnce(new Error('chunk boom'))
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('bad object'));

      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ a: 1 }, { b: 2 }]),
      };

      const result = await api.importObjects(params);

      expect(result.importedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors.join(' ')).toContain('bad object');
    });

    test('throws on invalid JSON payload', async () => {
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: '{oops',
      };

      await expect(api.importObjects(params)).rejects.toThrow('Invalid JSON');
      expect(mockData.insertMany).not.toHaveBeenCalled();
    });

    test('throws on empty payload', async () => {
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: '   ',
      };

      await expect(api.importObjects(params)).rejects.toThrow('empty');
    });

    test('throws when collection name is missing', async () => {
      const params: ImportParams = {
        collectionName: '',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ a: 1 }]),
      };

      await expect(api.importObjects(params)).rejects.toThrow('collection name');
    });

    test('aborts between chunks when signal fires', async () => {
      const controller = new AbortController();
      controller.abort();
      const params: ImportParams = {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: JSON.stringify([{ a: 1 }]),
      };

      await expect(api.importObjects(params, controller.signal)).rejects.toThrow('cancelled');
    });
  });

  describe('updateObject', () => {
    test('updates properties by UUID', async () => {
      const params: UpdateObjectParams = {
        collectionName: 'Article',
        uuid: VALID_UUID,
        properties: { title: 'New' },
      };

      const result = await api.updateObject(params);

      expect(result).toEqual({ uuid: VALID_UUID });
      expect(mockData.update).toHaveBeenCalledWith({
        id: VALID_UUID,
        properties: { title: 'New' },
      });
    });

    test('rejects invalid UUIDs', async () => {
      const params: UpdateObjectParams = {
        collectionName: 'Article',
        uuid: 'not-a-uuid',
        properties: { title: 'New' },
      };

      await expect(api.updateObject(params)).rejects.toThrow('invalid UUID');
      expect(mockData.update).not.toHaveBeenCalled();
    });

    test('rejects non-object properties', async () => {
      const params = {
        collectionName: 'Article',
        uuid: VALID_UUID,
        properties: 'nope',
      } as unknown as UpdateObjectParams;

      await expect(api.updateObject(params)).rejects.toThrow('properties must be an object');
    });

    test('propagates client errors with context', async () => {
      mockData.update.mockRejectedValueOnce(new Error('server says no'));
      const params: UpdateObjectParams = {
        collectionName: 'Article',
        uuid: VALID_UUID,
        properties: { title: 'New' },
      };

      await expect(api.updateObject(params)).rejects.toThrow('server says no');
    });
  });

  describe('deleteObject', () => {
    test('deletes by UUID', async () => {
      const params: DeleteObjectParams = {
        collectionName: 'Article',
        uuid: VALID_UUID,
      };

      const result = await api.deleteObject(params);

      expect(result).toEqual({ uuid: VALID_UUID });
      expect(mockData.deleteById).toHaveBeenCalledWith(VALID_UUID);
    });

    test('rejects invalid UUIDs', async () => {
      const params: DeleteObjectParams = {
        collectionName: 'Article',
        uuid: 'bad',
      };

      await expect(api.deleteObject(params)).rejects.toThrow('invalid UUID');
      expect(mockData.deleteById).not.toHaveBeenCalled();
    });

    test('propagates client errors', async () => {
      mockData.deleteById.mockRejectedValueOnce(new Error('gone wrong'));
      const params: DeleteObjectParams = {
        collectionName: 'Article',
        uuid: VALID_UUID,
      };

      await expect(api.deleteObject(params)).rejects.toThrow('gone wrong');
    });
  });
});
