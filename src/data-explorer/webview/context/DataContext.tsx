/**
 * DataContext - Manages data fetching and object state
 *
 * This context handles:
 * - Collection data (objects, schema)
 * - Loading and error states
 * - Data refresh operations
 *
 * Components that need data should subscribe to this context.
 * Changes to UI state (columns, filters) won't trigger re-renders here.
 */

import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import type { WeaviateObject, CollectionConfig } from '../../types';

// ============================================================================
// State Interface
// ============================================================================

export interface DataContextState {
  collectionName: string;
  schema: CollectionConfig | null;
  objects: WeaviateObject[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Action Types
// ============================================================================

type DataAction =
  | { type: 'SET_COLLECTION'; collectionName: string }
  | { type: 'SET_SCHEMA'; schema: CollectionConfig }
  | { type: 'SET_DATA'; objects: WeaviateObject[]; total: number }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'REFRESH' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: DataContextState = {
  collectionName: '',
  schema: null,
  objects: [],
  totalCount: 0,
  loading: false,
  error: null,
};

function dataReducer(state: DataContextState, action: DataAction): DataContextState {
  switch (action.type) {
    case 'SET_COLLECTION':
      return {
        ...state,
        collectionName: action.collectionName,
        objects: [],
        totalCount: 0,
        schema: null,
        error: null,
      };

    case 'SET_SCHEMA':
      return {
        ...state,
        schema: action.schema,
      };

    case 'SET_DATA':
      return {
        ...state,
        objects: action.objects,
        totalCount: action.total,
        loading: false,
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.loading,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        loading: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'REFRESH':
      return {
        ...state,
        loading: true,
        error: null,
      };

    default:
      return state;
  }
}

// ============================================================================
// Context Actions Interface
// ============================================================================

export interface DataContextActions {
  setCollection: (collectionName: string) => void;
  setSchema: (schema: CollectionConfig) => void;
  setData: (objects: WeaviateObject[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  refresh: () => void;
}

// ============================================================================
// Context Definition
// ============================================================================

interface DataContextValue {
  state: DataContextState;
  actions: DataContextActions;
}

const DataContext = createContext<DataContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface DataProviderProps {
  children: React.ReactNode;
  initialCollectionName?: string;
}

export function DataProvider({ children, initialCollectionName = '' }: DataProviderProps) {
  const [state, dispatch] = useReducer(dataReducer, {
    ...initialState,
    collectionName: initialCollectionName,
  });

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo<DataContextActions>(
    () => ({
      setCollection: (collectionName: string) => {
        dispatch({ type: 'SET_COLLECTION', collectionName });
      },

      setSchema: (schema: CollectionConfig) => {
        dispatch({ type: 'SET_SCHEMA', schema });
      },

      setData: (objects: WeaviateObject[], total: number) => {
        dispatch({ type: 'SET_DATA', objects, total });
      },

      setLoading: (loading: boolean) => {
        dispatch({ type: 'SET_LOADING', loading });
      },

      setError: (error: string | null) => {
        dispatch({ type: 'SET_ERROR', error });
      },

      clearError: () => {
        dispatch({ type: 'CLEAR_ERROR' });
      },

      refresh: () => {
        dispatch({ type: 'REFRESH' });
      },
    }),
    []
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<DataContextValue>(() => ({ state, actions }), [state, actions]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useDataContext(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
}

// Convenience hooks for accessing specific parts of state
export function useDataState(): DataContextState {
  return useDataContext().state;
}

export function useDataActions(): DataContextActions {
  return useDataContext().actions;
}
