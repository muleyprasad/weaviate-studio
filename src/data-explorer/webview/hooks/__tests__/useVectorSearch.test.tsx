import { renderHook, act } from '@testing-library/react';
import { useVectorSearch } from '../useVectorSearch';
import { DataProvider, UIProvider, FilterProvider, VectorSearchProvider } from '../../context';
import React from 'react';
import type { WeaviateObject, ExtensionMessage } from '../../../types';

/**
 * Test suite for useVectorSearch hook
 *
 * Tests cover:
 * - Search execution for all search types (text, vector, object, hybrid)
 * - Input validation and error handling
 * - Result parsing and transformation
 * - Score breakdown for hybrid search
 * - Request ID tracking and stale response handling
 * - Loading states
 * - Integration with VectorSearchContext
 * - explainScore parsing for hybrid search
 */

// Mock VSCode API
const mockPostMessage = jest.fn();
const mockGetVSCodeAPI = jest.fn(() => ({
  postMessage: mockPostMessage,
}));

jest.mock('../../utils/vscodeApi', () => ({
  getVSCodeAPI: () => mockGetVSCodeAPI(),
}));

describe('useVectorSearch', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <DataProvider initialCollectionName="TestCollection">
        <UIProvider>
          <FilterProvider>
            <VectorSearchProvider>{children}</VectorSearchProvider>
          </FilterProvider>
        </UIProvider>
      </DataProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns expected API methods', () => {
      const { result } = renderHook(() => useVectorSearch(), { wrapper });

      expect(result.current.executeSearch).toBeInstanceOf(Function);
      expect(result.current.clearSearch).toBeInstanceOf(Function);
      expect(result.current.isSearching).toBeDefined();
      expect(result.current.searchResults).toBeDefined();
      expect(result.current.searchError).toBeDefined();
    });

    test('initial state values', () => {
      const { result } = renderHook(() => useVectorSearch(), { wrapper });

      expect(result.current.isSearching).toBe(false);
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchError).toBe(null);
    });
  });

  describe('Text Search Execution', () => {
    test('executes text search with valid query', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'machine learning' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'fetchObjects',
          collectionName: 'TestCollection',
          vectorSearch: expect.objectContaining({
            type: 'nearText',
            text: 'machine learning',
          }),
        })
      );
    });

    test('includes distance and limit parameters in text search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({
          query: 'test query',
          maxDistance: 0.7,
          limit: 50,
        });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'nearText',
            text: 'test query',
            distance: 0.7,
            limit: 50,
          }),
        })
      );
    });

    test('includes distance metric and target vector in text search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({
          query: 'AI concepts',
          distanceMetric: 'euclidean',
          targetVector: 'title_vector',
        });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'nearText',
            distanceMetric: 'euclidean',
            targetVector: 'title_vector',
          }),
        })
      );
    });

    test('does not execute text search with empty query', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: '   ' });
      });

      mockPostMessage.mockClear();

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(contextResult.current.search.searchError).toBe('Invalid search parameters');
    });

    test('trims whitespace from text query', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: '  test query  ' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            text: 'test query',
          }),
        })
      );
    });
  });

  describe('Vector Search Execution', () => {
    test('executes vector search with valid array', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('vector');
        contextResult.current.context.setSearchParams({ vector: '[0.1, 0.2, 0.3, 0.4]' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'nearVector',
            vector: [0.1, 0.2, 0.3, 0.4],
          }),
        })
      );
    });

    test('includes distance and limit in vector search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('vector');
        contextResult.current.context.setSearchParams({
          vector: '[0.5, 0.6]',
          maxDistance: 0.8,
          limit: 20,
        });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'nearVector',
            distance: 0.8,
            limit: 20,
          }),
        })
      );
    });

    test('rejects invalid vector JSON format', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('vector');
        contextResult.current.context.setSearchParams({ vector: 'not valid json' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(contextResult.current.search.searchError).toBe('Invalid search parameters');
    });

    test('rejects vector with non-numeric values', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('vector');
        contextResult.current.context.setSearchParams({ vector: '["a", "b", "c"]' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(contextResult.current.search.searchError).toBe('Invalid search parameters');
    });

    test('rejects non-array vector format', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('vector');
        contextResult.current.context.setSearchParams({ vector: '{"x": 0.1, "y": 0.2}' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(contextResult.current.search.searchError).toBe('Invalid search parameters');
    });
  });

  describe('Object Search Execution', () => {
    test('executes object search with valid UUID', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('object');
        contextResult.current.context.setSearchParams({ objectId: 'test-uuid-123' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'nearObject',
            objectId: 'test-uuid-123',
          }),
        })
      );
    });

    test('includes distance and limit in object search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('object');
        contextResult.current.context.setSearchParams({
          objectId: 'uuid-456',
          maxDistance: 0.6,
          limit: 15,
        });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'nearObject',
            distance: 0.6,
            limit: 15,
          }),
        })
      );
    });

    test('does not execute object search with empty UUID', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('object');
        contextResult.current.context.setSearchParams({ objectId: '   ' });
      });

      mockPostMessage.mockClear();

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(contextResult.current.search.searchError).toBe('Invalid search parameters');
    });

    test('trims whitespace from object ID', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('object');
        contextResult.current.context.setSearchParams({ objectId: '  uuid-789  ' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            objectId: 'uuid-789',
          }),
        })
      );
    });
  });

  describe('Hybrid Search Execution', () => {
    test('executes hybrid search with valid query', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: 'hybrid search test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'hybrid',
            text: 'hybrid search test',
          }),
        })
      );
    });

    test('includes hybrid-specific parameters', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({
          query: 'test',
          hybridAlpha: 0.7,
          fusionType: 'relativeScoreFusion',
          searchProperties: ['title', 'content'],
        });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorSearch: expect.objectContaining({
            type: 'hybrid',
            alpha: 0.7,
            fusionType: 'relativeScoreFusion',
            properties: ['title', 'content'],
          }),
        })
      );
    });

    test('omits properties when searchProperties is empty', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({
          query: 'test',
          searchProperties: [],
        });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.vectorSearch.properties).toBeUndefined();
    });

    test('does not execute hybrid search with empty query', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: '' });
      });

      mockPostMessage.mockClear();

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(contextResult.current.search.searchError).toBe('Invalid search parameters');
    });
  });

  describe('Request ID Generation and Tracking', () => {
    test('generates unique request ID with vs- prefix', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.requestId).toMatch(/^vs-\d+-[a-z0-9]+$/);
    });

    test('generates different request IDs for each search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'first' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const firstRequestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        contextResult.current.context.setSearchParams({ query: 'second' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const secondRequestId = mockPostMessage.mock.calls[1][0].requestId;

      expect(firstRequestId).not.toBe(secondRequestId);
    });

    test('ignores stale vector search responses', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'first' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const firstRequestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        contextResult.current.context.setSearchParams({ query: 'second' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const secondRequestId = mockPostMessage.mock.calls[1][0].requestId;

      // Simulate stale response from first request
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: firstRequestId,
              objects: [{ uuid: 'stale-1', properties: {}, metadata: { uuid: 'stale-1' } }],
            },
          })
        );
      });

      // Should still be searching (stale response ignored)
      expect(contextResult.current.search.isSearching).toBe(true);

      // Simulate current response
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: secondRequestId,
              objects: [{ uuid: 'current-1', properties: {}, metadata: { uuid: 'current-1' } }],
            },
          })
        );
      });

      expect(contextResult.current.search.isSearching).toBe(false);
      expect(contextResult.current.search.searchResults).toHaveLength(1);
      expect(contextResult.current.search.searchResults[0].object.uuid).toBe('current-1');
    });

    test('ignores responses without vs- prefix', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      // Simulate response from regular data fetch (no vs- prefix)
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: 'regular-request-123',
              objects: [{ uuid: 'obj-1', properties: {}, metadata: { uuid: 'obj-1' } }],
            },
          })
        );
      });

      // Should not process this response
      expect(contextResult.current.search.searchResults).toEqual([]);
    });
  });

  describe('Result Parsing and Transformation', () => {
    test('transforms objects to VectorSearchResult format', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test Article' },
        metadata: {
          uuid: 'result-1',
          distance: 0.25,
          certainty: 0.75,
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults).toHaveLength(1);
      expect(contextResult.current.search.searchResults[0]).toMatchObject({
        object: mockObject,
        distance: 0.25,
        certainty: 0.75,
      });
    });

    test('handles empty results', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'nonexistent' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults).toEqual([]);
      expect(contextResult.current.search.isSearching).toBe(false);
    });

    test('handles undefined objects in response', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: undefined,
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults).toEqual([]);
    });

    test('calculates certainty from distance when not provided', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test' },
        metadata: {
          uuid: 'result-1',
          distance: 0.4,
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults[0].certainty).toBe(0.8); // 1 - 0.4/2
    });
  });

  describe('Hybrid Search Score Breakdown', () => {
    test('parses explainScore from JSON string', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test' },
        metadata: {
          uuid: 'result-1',
          score: 0.82,
          explainScore: '{"bm25": 0.6, "vector": 0.9, "score": 0.82, "matchedTerms": ["test"]}',
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults[0].explainScore).toEqual({
        keyword: 0.6,
        vector: 0.9,
        combined: 0.82,
        matchedTerms: ['test'],
      });
    });

    test('parses explainScore from object format', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test' },
        metadata: {
          uuid: 'result-1',
          score: 0.75,
          explainScore: {
            bm25: 0.5,
            vector: 0.8,
            score: 0.75,
            keywords: ['machine', 'learning'],
          },
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults[0].explainScore).toEqual({
        keyword: 0.5,
        vector: 0.8,
        combined: 0.75,
        matchedTerms: ['machine', 'learning'],
      });
    });

    test('uses alternative field names for explainScore', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test' },
        metadata: {
          uuid: 'result-1',
          score: 0.88,
          explainScore: {
            keyword: 0.7,
            nearText: 0.95,
            score: 0.88,
          },
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults[0].explainScore).toEqual({
        keyword: 0.7,
        vector: 0.95,
        combined: 0.88,
        matchedTerms: undefined,
      });
    });

    test('falls back to metadata score when parsing fails', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test' },
        metadata: {
          uuid: 'result-1',
          score: 0.65,
          explainScore: 'invalid json string',
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults[0].explainScore).toEqual({
        keyword: 0,
        vector: 0,
        combined: 0.65,
        matchedTerms: undefined,
      });

      consoleSpy.mockRestore();
    });

    test('uses combined score as certainty for hybrid search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('hybrid');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      const mockObject: WeaviateObject = {
        uuid: 'result-1',
        properties: { title: 'Test' },
        metadata: {
          uuid: 'result-1',
          score: 0.92,
          distance: 0.1,
          explainScore: {
            bm25: 0.8,
            vector: 0.95,
            score: 0.92,
          },
        },
      };

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [mockObject],
            },
          })
        );
      });

      // For hybrid search, certainty should be the combined score
      expect(contextResult.current.search.searchResults[0].certainty).toBe(0.92);
    });
  });

  describe('Loading States', () => {
    test('sets searching state to true when executing search', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      expect(contextResult.current.search.isSearching).toBe(true);
    });

    test('sets searching to false after receiving results', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [],
            },
          })
        );
      });

      expect(contextResult.current.search.isSearching).toBe(false);
    });

    test('sets searching to false after error', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'error',
              requestId,
              error: 'Search failed',
            },
          })
        );
      });

      expect(contextResult.current.search.isSearching).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('handles error message from extension', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'error',
              requestId,
              error: 'Vectorizer not configured for this collection',
            },
          })
        );
      });

      expect(contextResult.current.search.searchError).toBe(
        'Vectorizer not configured for this collection'
      );
      expect(contextResult.current.search.isSearching).toBe(false);
    });

    test('handles error without message', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'error',
              requestId,
              error: undefined,
            },
          })
        );
      });

      expect(contextResult.current.search.searchError).toBe('Vector search failed');
    });
  });

  describe('Clear Search', () => {
    test('clears search results and state', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [
                {
                  uuid: 'result-1',
                  properties: { title: 'Test' },
                  metadata: { uuid: 'result-1' },
                },
              ],
            },
          })
        );
      });

      expect(contextResult.current.search.searchResults).toHaveLength(1);

      act(() => {
        contextResult.current.search.clearSearch();
      });

      expect(contextResult.current.search.searchResults).toEqual([]);
      expect(contextResult.current.search.searchError).toBe(null);
      expect(contextResult.current.search.isSearching).toBe(false);
    });

    test('prevents stale responses after clear', () => {
      const { result: contextResult } = renderHook(
        () => ({
          search: useVectorSearch(),
          context: require('../../context').useVectorSearchActions(),
        }),
        { wrapper }
      );

      act(() => {
        contextResult.current.context.setSearchMode('text');
        contextResult.current.context.setSearchParams({ query: 'test' });
      });

      act(() => {
        contextResult.current.search.executeSearch();
      });

      const requestId = mockPostMessage.mock.calls[0][0].requestId;

      act(() => {
        contextResult.current.search.clearSearch();
      });

      // Response arrives after clear
      act(() => {
        window.dispatchEvent(
          new MessageEvent<ExtensionMessage>('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [
                {
                  uuid: 'stale-result',
                  properties: { title: 'Stale' },
                  metadata: { uuid: 'stale-result' },
                },
              ],
            },
          })
        );
      });

      // Should not process stale response
      expect(contextResult.current.search.searchResults).toEqual([]);
    });
  });
});
