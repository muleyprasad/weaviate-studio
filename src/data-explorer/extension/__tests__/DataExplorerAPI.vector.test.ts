import { jest } from '@jest/globals';
import type { WeaviateClient, Collection } from 'weaviate-client';
import { DataExplorerAPI } from '../DataExplorerAPI';
import type { VectorSearchParams } from '../../types';

/**
 * Test suite for DataExplorerAPI vector search functionality
 *
 * Tests cover:
 * - nearText search (semantic search using text query)
 * - nearVector search (similarity search using vector embedding)
 * - nearObject search (find similar objects by UUID)
 * - hybrid search (combined BM25 + vector search)
 * - Score breakdown and distance/certainty metrics
 * - Error handling for invalid inputs
 * - Target vector for named vectors
 */

describe('DataExplorerAPI - Vector Search', () => {
  let mockClient: jest.Mocked<WeaviateClient>;
  let mockCollection: jest.Mocked<Collection>;
  let api: DataExplorerAPI;

  // Track query method calls
  let queryMethodCalls: Array<{ method: string; args: any[] }> = [];

  const mockObjects = [
    {
      uuid: 'vec-uuid-1',
      properties: { title: 'Similar Article 1', content: 'Machine learning content' },
      metadata: {
        creationTime: new Date('2024-01-01'),
        updateTime: new Date('2024-01-02'),
        distance: 0.15,
        certainty: 0.85,
      },
    },
    {
      uuid: 'vec-uuid-2',
      properties: { title: 'Similar Article 2', content: 'Deep learning content' },
      metadata: {
        creationTime: new Date('2024-01-03'),
        updateTime: new Date('2024-01-04'),
        distance: 0.25,
        certainty: 0.75,
      },
    },
  ];

  beforeEach(() => {
    queryMethodCalls = [];

    // Create mock query builder with chainable methods
    const createMockQueryResult = () =>
      Promise.resolve({
        objects: mockObjects,
        metadata: { totalCount: 2 },
      });

    mockCollection = {
      filter: {
        byProperty: jest.fn(() => ({
          equal: jest.fn(() => ({ _filter: { equal: true } })),
        })),
      },
      query: {
        fetchObjects: jest.fn().mockImplementation((options) => {
          queryMethodCalls.push({ method: 'fetchObjects', args: [options] });
          return createMockQueryResult();
        }),
        nearText: jest.fn().mockImplementation((text, options) => {
          queryMethodCalls.push({ method: 'nearText', args: [text, options] });
          return createMockQueryResult();
        }),
        nearVector: jest.fn().mockImplementation((vector, options) => {
          queryMethodCalls.push({ method: 'nearVector', args: [vector, options] });
          return createMockQueryResult();
        }),
        nearObject: jest.fn().mockImplementation((objectId, options) => {
          queryMethodCalls.push({ method: 'nearObject', args: [objectId, options] });
          return createMockQueryResult();
        }),
        hybrid: jest.fn().mockImplementation((text, options) => {
          queryMethodCalls.push({ method: 'hybrid', args: [text, options] });
          return createMockQueryResult();
        }),
      },
      aggregate: {
        overAll: jest.fn().mockResolvedValue({ totalCount: 100 }),
      },
      sort: {
        byProperty: jest.fn(() => ({})),
      },
    } as any;

    mockClient = {
      collections: {
        get: jest.fn(() => mockCollection),
      },
    } as any;

    api = new DataExplorerAPI(mockClient);
  });

  describe('nearText Search', () => {
    test('executes nearText search with text query', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'machine learning algorithms',
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(mockCollection.query.nearText).toHaveBeenCalledWith(
        'machine learning algorithms',
        expect.objectContaining({
          limit: 10,
          returnMetadata: expect.arrayContaining(['distance', 'certainty']),
        })
      );
      expect(result.objects).toHaveLength(2);
    });

    test('nearText search includes distance and certainty in results', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test query',
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(result.objects[0].metadata?.distance).toBe(0.15);
      expect(result.objects[0].metadata?.certainty).toBe(0.85);
      expect(result.objects[1].metadata?.distance).toBe(0.25);
      expect(result.objects[1].metadata?.certainty).toBe(0.75);
    });

    test('nearText search with certainty threshold', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'specific topic',
        certainty: 0.8,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call).toBeDefined();
      expect(call!.args[1]).toMatchObject({ certainty: 0.8 });
    });

    test('nearText search with distance threshold', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'query text',
        distance: 0.3,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call).toBeDefined();
      expect(call!.args[1]).toMatchObject({ distance: 0.3 });
    });

    test('nearText search with target vector for named vectors', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'semantic search',
        targetVector: 'title_vector',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call).toBeDefined();
      expect(call!.args[1]).toMatchObject({ targetVector: 'title_vector' });
    });

    test('nearText throws error when text is missing', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: '', // Empty text
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearText search requires a text query');
    });

    test('nearText throws error when text is undefined', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: undefined as any,
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearText search requires a text query');
    });
  });

  describe('nearVector Search', () => {
    test('executes nearVector search with valid vector', async () => {
      const testVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: testVector,
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(mockCollection.query.nearVector).toHaveBeenCalledWith(
        testVector,
        expect.objectContaining({
          limit: 10,
        })
      );
      expect(result.objects).toHaveLength(2);
    });

    test('nearVector search with high-dimensional vector', async () => {
      const highDimVector = Array.from({ length: 384 }, (_, i) => i * 0.001);
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: highDimVector,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearVector');
      expect(call).toBeDefined();
      expect(call!.args[0]).toHaveLength(384);
    });

    test('nearVector search with distance threshold', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, 0.2, 0.3],
        distance: 0.5,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearVector');
      expect(call!.args[1]).toMatchObject({ distance: 0.5 });
    });

    test('nearVector search with certainty threshold', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, 0.2, 0.3],
        certainty: 0.7,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearVector');
      expect(call!.args[1]).toMatchObject({ certainty: 0.7 });
    });

    test('nearVector search with target vector', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, 0.2, 0.3],
        targetVector: 'content_embedding',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearVector');
      expect(call!.args[1]).toMatchObject({ targetVector: 'content_embedding' });
    });

    test('nearVector throws error when vector is empty', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [],
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearVector search requires a vector');
    });

    test('nearVector throws error when vector is undefined', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: undefined as any,
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearVector search requires a vector');
    });

    test('nearVector throws error when vector contains NaN', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, NaN, 0.3],
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearVector search requires a vector of valid numbers');
    });

    test('nearVector throws error when vector contains Infinity', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, Infinity, 0.3],
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearVector search requires a vector of valid numbers');
    });

    test('nearVector throws error when vector contains negative Infinity', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, -Infinity, 0.3],
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearVector search requires a vector of valid numbers');
    });
  });

  describe('nearObject Search', () => {
    test('executes nearObject search with valid UUID', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(mockCollection.query.nearObject).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          limit: 10,
        })
      );
      expect(result.objects).toHaveLength(2);
    });

    test('nearObject search with distance threshold', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: 'test-uuid-123',
        distance: 0.4,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearObject');
      expect(call!.args[1]).toMatchObject({ distance: 0.4 });
    });

    test('nearObject search with certainty threshold', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: 'test-uuid-456',
        certainty: 0.9,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearObject');
      expect(call!.args[1]).toMatchObject({ certainty: 0.9 });
    });

    test('nearObject search with target vector', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: 'test-uuid-789',
        targetVector: 'summary_vector',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearObject');
      expect(call!.args[1]).toMatchObject({ targetVector: 'summary_vector' });
    });

    test('nearObject throws error when objectId is missing', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: '',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearObject search requires an object UUID');
    });

    test('nearObject throws error when objectId is undefined', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: undefined as any,
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('nearObject search requires an object UUID');
    });
  });

  describe('Hybrid Search', () => {
    test('executes hybrid search with text query', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'machine learning',
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(mockCollection.query.hybrid).toHaveBeenCalledWith(
        'machine learning',
        expect.objectContaining({
          limit: 10,
          alpha: 0.5, // Default alpha
        })
      );
      expect(result.objects).toHaveLength(2);
    });

    test('hybrid search with custom alpha (pure BM25)', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'keyword search',
        alpha: 0, // Pure BM25
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1]).toMatchObject({ alpha: 0 });
    });

    test('hybrid search with custom alpha (pure vector)', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'semantic search',
        alpha: 1, // Pure vector
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1]).toMatchObject({ alpha: 1 });
    });

    test('hybrid search with balanced alpha', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'balanced search',
        alpha: 0.7,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1]).toMatchObject({ alpha: 0.7 });
    });

    test('hybrid search with fusion type', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'fusion test',
        fusionType: 'relativeScoreFusion',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1]).toMatchObject({ fusionType: 'relativeScoreFusion' });
    });

    test('hybrid search with query properties', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'property search',
        properties: ['title', 'content'],
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1]).toMatchObject({ queryProperties: ['title', 'content'] });
    });

    test('hybrid search returns score metadata', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'score test',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1].returnMetadata).toContain('score');
      expect(call!.args[1].returnMetadata).toContain('explainScore');
    });

    test('hybrid throws error when text is missing', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: '',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('hybrid search requires a text query');
    });

    test('hybrid throws error when text is undefined', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: undefined as any,
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow('hybrid search requires a text query');
    });
  });

  describe('Vector Search with Filters', () => {
    test('nearText search combined with filters', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'artificial intelligence',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
        where: [{ id: '1', path: 'category', operator: 'Equal', value: 'tech' }],
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('category');
      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call!.args[1].filters).toBeDefined();
    });

    test('nearVector search combined with filters', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, 0.2, 0.3],
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
        where: [
          { id: '1', path: 'published', operator: 'Equal', value: true, valueType: 'boolean' },
        ],
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('published');
      const call = queryMethodCalls.find((c) => c.method === 'nearVector');
      expect(call!.args[1].filters).toBeDefined();
    });

    test('hybrid search combined with filters', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'search with filter',
        alpha: 0.5,
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
        where: [{ id: '1', path: 'author', operator: 'Equal', value: 'John Doe' }],
      });

      expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('author');
      const call = queryMethodCalls.find((c) => c.method === 'hybrid');
      expect(call!.args[1].filters).toBeDefined();
    });
  });

  describe('No Vector Search (Boolean Only)', () => {
    test('uses fetchObjects when vectorSearch is none', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'none',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(mockCollection.query.fetchObjects).toHaveBeenCalled();
      expect(mockCollection.query.nearText).not.toHaveBeenCalled();
      expect(mockCollection.query.nearVector).not.toHaveBeenCalled();
      expect(mockCollection.query.nearObject).not.toHaveBeenCalled();
      expect(mockCollection.query.hybrid).not.toHaveBeenCalled();
    });

    test('uses fetchObjects when vectorSearch is undefined', async () => {
      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
      });

      expect(mockCollection.query.fetchObjects).toHaveBeenCalled();
    });

    test('includes offset for boolean queries', async () => {
      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 50,
      });

      const call = queryMethodCalls.find((c) => c.method === 'fetchObjects');
      expect(call!.args[0]).toMatchObject({ offset: 50 });
    });

    test('excludes offset for vector search queries', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 50,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call!.args[1].offset).toBeUndefined();
    });
  });

  describe('Distance Metric Configuration', () => {
    test('passes distance metric to nearText', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'cosine test',
        distanceMetric: 'cosine',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call!.args[1]).toMatchObject({ distanceMetric: 'cosine' });
    });

    test('passes distance metric to nearVector', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, 0.2, 0.3],
        distanceMetric: 'dot',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearVector');
      expect(call!.args[1]).toMatchObject({ distanceMetric: 'dot' });
    });
  });

  describe('Return Properties Configuration', () => {
    test('passes return properties to vector search', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'property test',
      };

      await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
        properties: ['title', 'content', 'author'],
      });

      const call = queryMethodCalls.find((c) => c.method === 'nearText');
      expect(call!.args[1]).toMatchObject({
        returnProperties: ['title', 'content', 'author'],
      });
    });
  });

  describe('Error Handling', () => {
    test('propagates API errors from nearText', async () => {
      mockCollection.query.nearText.mockRejectedValueOnce(new Error('Vectorizer not configured'));

      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow(/Vectorizer not configured/);
    });

    test('propagates API errors from nearVector', async () => {
      mockCollection.query.nearVector.mockRejectedValueOnce(new Error('Vector dimension mismatch'));

      const vectorSearch: VectorSearchParams = {
        type: 'nearVector',
        vector: [0.1, 0.2],
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow(/Vector dimension mismatch/);
    });

    test('propagates API errors from nearObject', async () => {
      mockCollection.query.nearObject.mockRejectedValueOnce(new Error('Invalid object reference'));

      const vectorSearch: VectorSearchParams = {
        type: 'nearObject',
        objectId: 'non-existent-uuid',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow(/Invalid object reference/);
    });

    test('propagates API errors from hybrid', async () => {
      mockCollection.query.hybrid.mockRejectedValueOnce(new Error('BM25 index not available'));

      const vectorSearch: VectorSearchParams = {
        type: 'hybrid',
        text: 'test',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow(/BM25 index not available/);
    });

    test('handles timeout errors with actionable message', async () => {
      mockCollection.query.nearText.mockRejectedValueOnce(new Error('Request timed out'));

      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'Article',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow(/timed out.*Suggestions/);
    });

    test('handles collection not found error', async () => {
      mockCollection.query.nearText.mockRejectedValueOnce(new Error('Collection does not exist'));

      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test',
      };

      await expect(
        api.fetchObjects({
          collectionName: 'NonExistent',
          limit: 10,
          offset: 0,
          vectorSearch,
        })
      ).rejects.toThrow(/not found/);
    });
  });

  describe('Result Transformation', () => {
    test('transforms vector search results correctly', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test',
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(result.objects[0]).toMatchObject({
        uuid: 'vec-uuid-1',
        properties: { title: 'Similar Article 1', content: 'Machine learning content' },
        metadata: {
          uuid: 'vec-uuid-1',
          distance: 0.15,
          certainty: 0.85,
        },
      });
    });

    test('includes creation and update times in metadata', async () => {
      const vectorSearch: VectorSearchParams = {
        type: 'nearText',
        text: 'test',
      };

      const result = await api.fetchObjects({
        collectionName: 'Article',
        limit: 10,
        offset: 0,
        vectorSearch,
      });

      expect(result.objects[0].metadata?.creationTime).toBe('2024-01-01T00:00:00.000Z');
      expect(result.objects[0].metadata?.lastUpdateTime).toBe('2024-01-02T00:00:00.000Z');
    });
  });
});
