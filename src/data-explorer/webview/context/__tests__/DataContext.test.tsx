import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { DataProvider, useDataContext, useDataState, useDataActions } from '../DataContext';
import type { WeaviateObject, CollectionConfig } from '../../../types';

/**
 * Test suite for DataContext
 *
 * Tests cover:
 * - Setting collection and schema
 * - Setting data with totalCount and unfilteredTotalCount
 * - Loading and error states
 * - Refresh functionality
 */

describe('DataContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataProvider>{children}</DataProvider>
  );

  describe('Hook Usage', () => {
    test('useDataContext returns state and actions', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      expect(result.current.state).toBeDefined();
      expect(result.current.actions).toBeDefined();
    });

    test('useDataState returns state directly', () => {
      const { result } = renderHook(() => useDataState(), { wrapper });

      expect(result.current.collectionName).toBe('');
      expect(result.current.schema).toBeNull();
      expect(result.current.objects).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.unfilteredTotalCount).toBe(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('useDataActions returns actions directly', () => {
      const { result } = renderHook(() => useDataActions(), { wrapper });

      expect(result.current.setCollection).toBeDefined();
      expect(result.current.setSchema).toBeDefined();
      expect(result.current.setData).toBeDefined();
      expect(result.current.setLoading).toBeDefined();
      expect(result.current.setError).toBeDefined();
      expect(result.current.clearError).toBeDefined();
      expect(result.current.refresh).toBeDefined();
    });
  });

  describe('Data Management', () => {
    test('setCollection updates collection name and resets data', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      act(() => {
        result.current.actions.setCollection('TestCollection');
      });

      expect(result.current.state.collectionName).toBe('TestCollection');
      expect(result.current.state.objects).toEqual([]);
      expect(result.current.state.totalCount).toBe(0);
      expect(result.current.state.unfilteredTotalCount).toBe(0);
      expect(result.current.state.schema).toBeNull();
      expect(result.current.state.error).toBeNull();
    });

    test('setData updates objects and totalCount without unfilteredTotal', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      const mockObjects: WeaviateObject[] = [
        {
          uuid: '1',
          properties: { name: 'Test' },
          metadata: { uuid: '1' },
        },
      ];

      act(() => {
        result.current.actions.setData(mockObjects, 100);
      });

      expect(result.current.state.objects).toEqual(mockObjects);
      expect(result.current.state.totalCount).toBe(100);
      expect(result.current.state.unfilteredTotalCount).toBe(100); // Should default to totalCount
      expect(result.current.state.loading).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    test('setData updates objects, totalCount and unfilteredTotalCount when provided', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      const mockObjects: WeaviateObject[] = [
        {
          uuid: '1',
          properties: { name: 'Test' },
          metadata: { uuid: '1' },
        },
      ];

      act(() => {
        result.current.actions.setData(mockObjects, 50, 200);
      });

      expect(result.current.state.objects).toEqual(mockObjects);
      expect(result.current.state.totalCount).toBe(50); // Filtered count
      expect(result.current.state.unfilteredTotalCount).toBe(200); // Unfiltered total
      expect(result.current.state.loading).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    test('setSchema updates schema', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      const mockSchema: CollectionConfig = {
        name: 'TestCollection',
        properties: [],
      };

      act(() => {
        result.current.actions.setSchema(mockSchema);
      });

      expect(result.current.state.schema).toEqual(mockSchema);
    });
  });

  describe('Loading and Error States', () => {
    test('setLoading updates loading state', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      act(() => {
        result.current.actions.setLoading(true);
      });

      expect(result.current.state.loading).toBe(true);

      act(() => {
        result.current.actions.setLoading(false);
      });

      expect(result.current.state.loading).toBe(false);
    });

    test('setError updates error state and stops loading', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      act(() => {
        result.current.actions.setLoading(true);
        result.current.actions.setError('Test error');
      });

      expect(result.current.state.error).toBe('Test error');
      expect(result.current.state.loading).toBe(false);
    });

    test('clearError clears error state', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      act(() => {
        result.current.actions.setError('Test error');
      });

      expect(result.current.state.error).toBe('Test error');

      act(() => {
        result.current.actions.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Refresh', () => {
    test('refresh sets loading and clears error', () => {
      const { result } = renderHook(() => useDataContext(), { wrapper });

      act(() => {
        result.current.actions.setError('Test error');
        result.current.actions.refresh();
      });

      expect(result.current.state.loading).toBe(true);
      expect(result.current.state.error).toBeNull();
    });
  });
});
