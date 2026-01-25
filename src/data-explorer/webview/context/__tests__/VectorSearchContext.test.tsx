import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  VectorSearchProvider,
  useVectorSearchContext,
  useVectorSearchState,
  useVectorSearchActions,
  VectorSearchMode,
  VectorSearchResult,
  DistanceMetric,
  FusionType,
} from '../VectorSearchContext';

/**
 * Test suite for VectorSearchContext
 *
 * Tests cover:
 * - Mode switching (text, object, vector, hybrid)
 * - Search parameters configuration
 * - Search results management
 * - Score breakdown for hybrid search
 * - Error states and handling
 * - Panel state (open/close/toggle)
 * - Find similar workflow
 * - Collection change reset
 * - State transitions
 */

describe('VectorSearchContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <VectorSearchProvider>{children}</VectorSearchProvider>
  );

  describe('Hook Usage', () => {
    test('useVectorSearchContext returns state and actions', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state).toBeDefined();
      expect(result.current.actions).toBeDefined();
    });

    test('useVectorSearchState returns state directly', () => {
      const { result } = renderHook(() => useVectorSearchState(), { wrapper });

      expect(result.current.showVectorSearchPanel).toBe(false);
      expect(result.current.searchMode).toBe('text');
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.searchError).toBe(null);
      expect(result.current.hasSearched).toBe(false);
    });

    test('useVectorSearchActions returns actions directly', () => {
      const { result } = renderHook(() => useVectorSearchActions(), { wrapper });

      expect(result.current.toggleVectorSearchPanel).toBeInstanceOf(Function);
      expect(result.current.setSearchMode).toBeInstanceOf(Function);
      expect(result.current.setSearchParams).toBeInstanceOf(Function);
      expect(result.current.setSearchResults).toBeInstanceOf(Function);
    });

    test('throws error when used outside VectorSearchProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useVectorSearchContext());
      }).toThrow('useVectorSearchContext must be used within a VectorSearchProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Panel State', () => {
    test('panel is initially closed', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.showVectorSearchPanel).toBe(false);
    });

    test('opens vector search panel', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel();
      });

      expect(result.current.state.showVectorSearchPanel).toBe(true);
    });

    test('closes vector search panel', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel();
        result.current.actions.closeVectorSearchPanel();
      });

      expect(result.current.state.showVectorSearchPanel).toBe(false);
    });

    test('toggles panel open', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.toggleVectorSearchPanel();
      });

      expect(result.current.state.showVectorSearchPanel).toBe(true);
    });

    test('toggles panel closed', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel();
        result.current.actions.toggleVectorSearchPanel();
      });

      expect(result.current.state.showVectorSearchPanel).toBe(false);
    });

    test('opening panel with object ID sets pre-selected object', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel('test-uuid-123');
      });

      expect(result.current.state.preSelectedObjectId).toBe('test-uuid-123');
      expect(result.current.state.searchMode).toBe('object');
      expect(result.current.state.searchParams.objectId).toBe('test-uuid-123');
    });

    test('opening panel without object ID keeps current mode', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('hybrid');
        result.current.actions.openVectorSearchPanel();
      });

      expect(result.current.state.searchMode).toBe('hybrid');
      expect(result.current.state.preSelectedObjectId).toBe(null);
    });

    test('closing panel clears pre-selected object', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel('test-uuid-123');
        result.current.actions.closeVectorSearchPanel();
      });

      expect(result.current.state.preSelectedObjectId).toBe(null);
    });

    test('toggling panel closed clears pre-selected object', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel('test-uuid-456');
        result.current.actions.toggleVectorSearchPanel();
      });

      expect(result.current.state.preSelectedObjectId).toBe(null);
      expect(result.current.state.showVectorSearchPanel).toBe(false);
    });
  });

  describe('Search Mode', () => {
    test('default search mode is text', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.searchMode).toBe('text');
    });

    test('sets search mode to text', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('text');
      });

      expect(result.current.state.searchMode).toBe('text');
      expect(result.current.state.searchParams.mode).toBe('text');
    });

    test('sets search mode to object', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('object');
      });

      expect(result.current.state.searchMode).toBe('object');
      expect(result.current.state.searchParams.mode).toBe('object');
    });

    test('sets search mode to vector', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('vector');
      });

      expect(result.current.state.searchMode).toBe('vector');
      expect(result.current.state.searchParams.mode).toBe('vector');
    });

    test('sets search mode to hybrid', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('hybrid');
      });

      expect(result.current.state.searchMode).toBe('hybrid');
      expect(result.current.state.searchParams.mode).toBe('hybrid');
    });

    test('switching mode clears search error', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Previous error');
        result.current.actions.setSearchMode('hybrid');
      });

      expect(result.current.state.searchError).toBe(null);
    });

    test('switching mode preserves search results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchMode('hybrid');
      });

      expect(result.current.state.searchResults).toEqual(mockResults);
    });
  });

  describe('Search Parameters', () => {
    test('sets query parameter', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ query: 'machine learning' });
      });

      expect(result.current.state.searchParams.query).toBe('machine learning');
    });

    test('sets object ID parameter', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ objectId: 'uuid-123' });
      });

      expect(result.current.state.searchParams.objectId).toBe('uuid-123');
    });

    test('sets vector parameter', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const vectorJson = '[0.1, 0.2, 0.3]';

      act(() => {
        result.current.actions.setSearchParams({ vector: vectorJson });
      });

      expect(result.current.state.searchParams.vector).toBe(vectorJson);
    });

    test('sets distance metric', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ distanceMetric: 'euclidean' });
      });

      expect(result.current.state.searchParams.distanceMetric).toBe('euclidean');
    });

    test('sets max distance threshold', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ maxDistance: 0.7 });
      });

      expect(result.current.state.searchParams.maxDistance).toBe(0.7);
    });

    test('sets result limit', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ limit: 50 });
      });

      expect(result.current.state.searchParams.limit).toBe(50);
    });

    test('sets target vector for named vectors', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ targetVector: 'title_vector' });
      });

      expect(result.current.state.searchParams.targetVector).toBe('title_vector');
    });

    test('sets hybrid alpha parameter', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ hybridAlpha: 0.7 });
      });

      expect(result.current.state.searchParams.hybridAlpha).toBe(0.7);
    });

    test('sets fusion type', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ fusionType: 'relativeScoreFusion' });
      });

      expect(result.current.state.searchParams.fusionType).toBe('relativeScoreFusion');
    });

    test('sets search properties', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({
          searchProperties: ['title', 'content'],
        });
      });

      expect(result.current.state.searchParams.searchProperties).toEqual(['title', 'content']);
    });

    test('sets query rewriting flag', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({ enableQueryRewriting: true });
      });

      expect(result.current.state.searchParams.enableQueryRewriting).toBe(true);
    });

    test('sets multiple parameters at once', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchParams({
          query: 'test query',
          limit: 10,
          hybridAlpha: 0.3,
        });
      });

      expect(result.current.state.searchParams.query).toBe('test query');
      expect(result.current.state.searchParams.limit).toBe(10);
      expect(result.current.state.searchParams.hybridAlpha).toBe(0.3);
    });

    test('changing query parameter clears results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchParams({ query: 'new query' });
      });

      expect(result.current.state.searchResults).toEqual([]);
    });

    test('changing object ID clears results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchParams({ objectId: 'new-uuid' });
      });

      expect(result.current.state.searchResults).toEqual([]);
    });

    test('changing vector clears results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchParams({ vector: '[0.5, 0.6]' });
      });

      expect(result.current.state.searchResults).toEqual([]);
    });

    test('changing non-query parameters preserves results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchParams({ limit: 50, hybridAlpha: 0.8 });
      });

      expect(result.current.state.searchResults).toEqual(mockResults);
    });
  });

  describe('Search Results', () => {
    test('sets search results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'uuid-1',
            properties: { title: 'Article 1' },
            metadata: { uuid: 'uuid-1' },
          },
          distance: 0.15,
          certainty: 0.85,
        },
        {
          object: {
            uuid: 'uuid-2',
            properties: { title: 'Article 2' },
            metadata: { uuid: 'uuid-2' },
          },
          distance: 0.25,
          certainty: 0.75,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
      });

      expect(result.current.state.searchResults).toEqual(mockResults);
      expect(result.current.state.isSearching).toBe(false);
      expect(result.current.state.searchError).toBe(null);
      expect(result.current.state.hasSearched).toBe(true);
    });

    test('sets empty search results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchResults([]);
      });

      expect(result.current.state.searchResults).toEqual([]);
      expect(result.current.state.hasSearched).toBe(true);
    });

    test('search results include hybrid explain score', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'uuid-1',
            properties: { title: 'Article 1' },
            metadata: { uuid: 'uuid-1' },
          },
          distance: 0.15,
          certainty: 0.85,
          explainScore: {
            keyword: 0.6,
            vector: 0.8,
            combined: 0.7,
            matchedTerms: ['machine', 'learning'],
          },
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
      });

      expect(result.current.state.searchResults[0].explainScore).toEqual({
        keyword: 0.6,
        vector: 0.8,
        combined: 0.7,
        matchedTerms: ['machine', 'learning'],
      });
    });
  });

  describe('Search State', () => {
    test('isSearching is initially false', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.isSearching).toBe(false);
    });

    test('sets isSearching to true', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearching(true);
      });

      expect(result.current.state.isSearching).toBe(true);
    });

    test('sets isSearching to false', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearching(true);
        result.current.actions.setSearching(false);
      });

      expect(result.current.state.isSearching).toBe(false);
    });

    test('setting isSearching true clears error', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Previous error');
        result.current.actions.setSearching(true);
      });

      expect(result.current.state.searchError).toBe(null);
    });

    test('hasSearched is initially false', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.hasSearched).toBe(false);
    });

    test('hasSearched becomes true after setting results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchResults([]);
      });

      expect(result.current.state.hasSearched).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('searchError is initially null', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.searchError).toBe(null);
    });

    test('sets search error', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Vectorizer not configured');
      });

      expect(result.current.state.searchError).toBe('Vectorizer not configured');
      expect(result.current.state.isSearching).toBe(false);
    });

    test('clears search error by setting null', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Error message');
        result.current.actions.setSearchError(null);
      });

      expect(result.current.state.searchError).toBe(null);
    });

    test('setting search params clears error', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Previous error');
        result.current.actions.setSearchParams({ query: 'new query' });
      });

      expect(result.current.state.searchError).toBe(null);
    });

    test('setting results clears error', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Previous error');
        result.current.actions.setSearchResults([]);
      });

      expect(result.current.state.searchError).toBe(null);
    });
  });

  describe('Clear Search', () => {
    test('clears all search state', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchParams({ query: 'test', limit: 50 });
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchError('Error');
        result.current.actions.setSearching(true);
      });

      act(() => {
        result.current.actions.clearSearch();
      });

      expect(result.current.state.searchResults).toEqual([]);
      expect(result.current.state.searchError).toBe(null);
      expect(result.current.state.isSearching).toBe(false);
      expect(result.current.state.hasSearched).toBe(false);
      expect(result.current.state.searchParams.query).toBe('');
      expect(result.current.state.searchParams.limit).toBe(25); // Reset to default
    });
  });

  describe('Find Similar Workflow', () => {
    test('findSimilar opens panel and sets object mode', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.findSimilar('similar-uuid-123');
      });

      expect(result.current.state.showVectorSearchPanel).toBe(true);
      expect(result.current.state.searchMode).toBe('object');
      expect(result.current.state.preSelectedObjectId).toBe('similar-uuid-123');
      expect(result.current.state.searchParams.objectId).toBe('similar-uuid-123');
      expect(result.current.state.searchParams.mode).toBe('object');
    });

    test('findSimilar clears previous results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'old-1',
            properties: { title: 'Old Result' },
            metadata: { uuid: 'old-1' },
          },
          distance: 0.1,
          certainty: 0.9,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.findSimilar('new-uuid');
      });

      expect(result.current.state.searchResults).toEqual([]);
    });

    test('findSimilar clears errors', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Previous error');
        result.current.actions.findSimilar('uuid-123');
      });

      expect(result.current.state.searchError).toBe(null);
    });
  });

  describe('Collection Change Reset', () => {
    test('resets all state except panel visibility', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'test-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'test-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.openVectorSearchPanel('uuid-123');
        result.current.actions.setSearchMode('hybrid');
        result.current.actions.setSearchParams({ query: 'test', hybridAlpha: 0.7 });
        result.current.actions.setSearchResults(mockResults);
        result.current.actions.setSearchError('Error');
      });

      act(() => {
        result.current.actions.resetForCollectionChange();
      });

      expect(result.current.state.showVectorSearchPanel).toBe(true); // Preserved
      expect(result.current.state.searchMode).toBe('text'); // Reset
      expect(result.current.state.searchResults).toEqual([]); // Reset
      expect(result.current.state.searchError).toBe(null); // Reset
      expect(result.current.state.preSelectedObjectId).toBe(null); // Reset
      expect(result.current.state.hasSearched).toBe(false); // Reset
      expect(result.current.state.searchParams.query).toBe(''); // Reset
    });

    test('resets with panel closed', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('vector');
        result.current.actions.setSearchParams({ query: 'test' });
        result.current.actions.resetForCollectionChange();
      });

      expect(result.current.state.showVectorSearchPanel).toBe(false);
      expect(result.current.state.searchMode).toBe('text');
    });
  });

  describe('Default Parameters', () => {
    test('has correct default parameters', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.searchParams).toEqual({
        mode: 'text',
        query: '',
        objectId: '',
        vector: '',
        distanceMetric: 'cosine',
        maxDistance: 0.5,
        limit: 25,
        hybridAlpha: 0.5,
        fusionType: 'rankedFusion',
        searchProperties: [],
        enableQueryRewriting: false,
        targetVector: undefined,
      });
    });
  });

  describe('Complex Workflows', () => {
    test('complete search workflow', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      // Open panel
      act(() => {
        result.current.actions.openVectorSearchPanel();
      });

      // Set search mode
      act(() => {
        result.current.actions.setSearchMode('text');
      });

      // Configure parameters
      act(() => {
        result.current.actions.setSearchParams({
          query: 'machine learning',
          limit: 10,
        });
      });

      // Start searching
      act(() => {
        result.current.actions.setSearching(true);
      });

      expect(result.current.state.isSearching).toBe(true);

      // Set results
      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'result-1',
            properties: { title: 'ML Article' },
            metadata: { uuid: 'result-1' },
          },
          distance: 0.1,
          certainty: 0.9,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
      });

      expect(result.current.state.searchResults).toEqual(mockResults);
      expect(result.current.state.isSearching).toBe(false);
      expect(result.current.state.hasSearched).toBe(true);
    });

    test('error workflow', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.openVectorSearchPanel();
        result.current.actions.setSearchParams({ query: 'test' });
        result.current.actions.setSearching(true);
      });

      act(() => {
        result.current.actions.setSearchError('Vectorizer not configured');
      });

      expect(result.current.state.searchError).toBe('Vectorizer not configured');
      expect(result.current.state.isSearching).toBe(false);
    });

    test('retry after error workflow', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchError('Network error');
      });

      act(() => {
        result.current.actions.setSearchParams({ query: 'retry query' });
      });

      expect(result.current.state.searchError).toBe(null);

      act(() => {
        result.current.actions.setSearching(true);
      });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'result-1',
            properties: { title: 'Success' },
            metadata: { uuid: 'result-1' },
          },
          distance: 0.1,
          certainty: 0.9,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
      });

      expect(result.current.state.searchResults).toEqual(mockResults);
      expect(result.current.state.searchError).toBe(null);
    });

    test('switch between search modes preserving results', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'result-1',
            properties: { title: 'Test' },
            metadata: { uuid: 'result-1' },
          },
          distance: 0.2,
          certainty: 0.8,
        },
      ];

      act(() => {
        result.current.actions.setSearchMode('text');
        result.current.actions.setSearchResults(mockResults);
      });

      act(() => {
        result.current.actions.setSearchMode('hybrid');
      });

      expect(result.current.state.searchResults).toEqual(mockResults);

      act(() => {
        result.current.actions.setSearchMode('object');
      });

      expect(result.current.state.searchResults).toEqual(mockResults);
    });
  });

  describe('State Transitions', () => {
    test('transition from initial to text search', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      expect(result.current.state.searchMode).toBe('text');
      expect(result.current.state.hasSearched).toBe(false);

      act(() => {
        result.current.actions.setSearchParams({ query: 'AI' });
        result.current.actions.setSearchResults([]);
      });

      expect(result.current.state.hasSearched).toBe(true);
    });

    test('transition from text to find similar', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      act(() => {
        result.current.actions.setSearchMode('text');
        result.current.actions.setSearchParams({ query: 'test' });
      });

      act(() => {
        result.current.actions.findSimilar('uuid-123');
      });

      expect(result.current.state.searchMode).toBe('object');
      expect(result.current.state.searchParams.objectId).toBe('uuid-123');
      expect(result.current.state.searchResults).toEqual([]);
    });

    test('transition from results to clear to new search', () => {
      const { result } = renderHook(() => useVectorSearchContext(), { wrapper });

      const mockResults: VectorSearchResult[] = [
        {
          object: {
            uuid: 'old-1',
            properties: { title: 'Old' },
            metadata: { uuid: 'old-1' },
          },
          distance: 0.1,
          certainty: 0.9,
        },
      ];

      act(() => {
        result.current.actions.setSearchResults(mockResults);
      });

      expect(result.current.state.hasSearched).toBe(true);

      act(() => {
        result.current.actions.clearSearch();
      });

      expect(result.current.state.hasSearched).toBe(false);
      expect(result.current.state.searchResults).toEqual([]);

      act(() => {
        result.current.actions.setSearchParams({ query: 'new search' });
        result.current.actions.setSearchResults([]);
      });

      expect(result.current.state.hasSearched).toBe(true);
    });
  });
});
