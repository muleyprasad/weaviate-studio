/**
 * VectorSearchContext - Manages vector search state and operations
 *
 * This context handles:
 * - Vector search mode (text semantic, similar object, raw vector)
 * - Search parameters and results
 * - Search loading state
 *
 * Phase 3: Vector Search Panel
 */

import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import type { WeaviateObject } from '../../types';

// ============================================================================
// Types
// ============================================================================

export type VectorSearchMode = 'text' | 'object' | 'vector';

export type DistanceMetric = 'cosine' | 'euclidean' | 'manhattan' | 'dot';

export interface VectorSearchResult {
  object: WeaviateObject;
  distance: number;
  certainty: number;
}

export interface VectorSearchParameters {
  mode: VectorSearchMode;
  query: string; // For text mode
  objectId: string; // For similar object mode
  vector: string; // Raw vector JSON string
  distanceMetric: DistanceMetric;
  maxDistance: number;
  limit: number;
  targetVector?: string; // For named vectors
}

// ============================================================================
// State Interface
// ============================================================================

export interface VectorSearchContextState {
  showVectorSearchPanel: boolean;
  searchMode: VectorSearchMode;
  searchParams: VectorSearchParameters;
  searchResults: VectorSearchResult[];
  isSearching: boolean;
  searchError: string | null;
  // Pre-selected object for "Find Similar" action
  preSelectedObjectId: string | null;
}

// ============================================================================
// Action Types
// ============================================================================

type VectorSearchAction =
  | { type: 'TOGGLE_VECTOR_SEARCH_PANEL' }
  | { type: 'OPEN_VECTOR_SEARCH_PANEL'; objectId?: string }
  | { type: 'CLOSE_VECTOR_SEARCH_PANEL' }
  | { type: 'SET_SEARCH_MODE'; mode: VectorSearchMode }
  | { type: 'SET_SEARCH_PARAMS'; params: Partial<VectorSearchParameters> }
  | { type: 'SET_SEARCH_RESULTS'; results: VectorSearchResult[] }
  | { type: 'SET_SEARCHING'; isSearching: boolean }
  | { type: 'SET_SEARCH_ERROR'; error: string | null }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'FIND_SIMILAR'; objectId: string };

// ============================================================================
// Initial State
// ============================================================================

const initialSearchParams: VectorSearchParameters = {
  mode: 'text',
  query: '',
  objectId: '',
  vector: '',
  distanceMetric: 'cosine',
  maxDistance: 0.5,
  limit: 25,
};

const initialState: VectorSearchContextState = {
  showVectorSearchPanel: false,
  searchMode: 'text',
  searchParams: { ...initialSearchParams },
  searchResults: [],
  isSearching: false,
  searchError: null,
  preSelectedObjectId: null,
};

// ============================================================================
// Reducer
// ============================================================================

function vectorSearchReducer(
  state: VectorSearchContextState,
  action: VectorSearchAction
): VectorSearchContextState {
  switch (action.type) {
    case 'TOGGLE_VECTOR_SEARCH_PANEL':
      return {
        ...state,
        showVectorSearchPanel: !state.showVectorSearchPanel,
        // Clear pre-selected object when closing
        preSelectedObjectId: state.showVectorSearchPanel ? null : state.preSelectedObjectId,
      };

    case 'OPEN_VECTOR_SEARCH_PANEL':
      return {
        ...state,
        showVectorSearchPanel: true,
        preSelectedObjectId: action.objectId || null,
        // Switch to object mode if opening with a pre-selected object
        searchMode: action.objectId ? 'object' : state.searchMode,
        searchParams: action.objectId
          ? { ...state.searchParams, mode: 'object', objectId: action.objectId }
          : state.searchParams,
      };

    case 'CLOSE_VECTOR_SEARCH_PANEL':
      return {
        ...state,
        showVectorSearchPanel: false,
        preSelectedObjectId: null,
      };

    case 'SET_SEARCH_MODE':
      return {
        ...state,
        searchMode: action.mode,
        searchParams: { ...state.searchParams, mode: action.mode },
        searchError: null,
        // Results are shared across all modes - don't clear on tab switch
      };

    case 'SET_SEARCH_PARAMS': {
      // Clear results if query-related params change (query, objectId, vector)
      const queryParamsChanged =
        action.params.query !== undefined ||
        action.params.objectId !== undefined ||
        action.params.vector !== undefined;
      return {
        ...state,
        searchParams: { ...state.searchParams, ...action.params },
        searchError: null,
        searchResults: queryParamsChanged ? [] : state.searchResults,
      };
    }

    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.results,
        isSearching: false,
        searchError: null,
      };

    case 'SET_SEARCHING':
      return {
        ...state,
        isSearching: action.isSearching,
        searchError: action.isSearching ? null : state.searchError,
      };

    case 'SET_SEARCH_ERROR':
      return {
        ...state,
        searchError: action.error,
        isSearching: false,
      };

    case 'CLEAR_SEARCH':
      return {
        ...state,
        searchResults: [],
        searchParams: { ...initialSearchParams },
        searchError: null,
        isSearching: false,
      };

    case 'FIND_SIMILAR':
      return {
        ...state,
        showVectorSearchPanel: true,
        searchMode: 'object',
        preSelectedObjectId: action.objectId,
        searchParams: {
          ...state.searchParams,
          mode: 'object',
          objectId: action.objectId,
        },
        searchResults: [], // Clear previous results
        searchError: null,
      };

    default:
      return state;
  }
}

// ============================================================================
// Context Actions Interface
// ============================================================================

export interface VectorSearchContextActions {
  toggleVectorSearchPanel: () => void;
  openVectorSearchPanel: (objectId?: string) => void;
  closeVectorSearchPanel: () => void;
  setSearchMode: (mode: VectorSearchMode) => void;
  setSearchParams: (params: Partial<VectorSearchParameters>) => void;
  setSearchResults: (results: VectorSearchResult[]) => void;
  setSearching: (isSearching: boolean) => void;
  setSearchError: (error: string | null) => void;
  clearSearch: () => void;
  findSimilar: (objectId: string) => void;
}

// ============================================================================
// Context Definition
// ============================================================================

interface VectorSearchContextValue {
  state: VectorSearchContextState;
  actions: VectorSearchContextActions;
}

const VectorSearchContext = createContext<VectorSearchContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface VectorSearchProviderProps {
  children: React.ReactNode;
}

export function VectorSearchProvider({ children }: VectorSearchProviderProps) {
  const [state, dispatch] = useReducer(vectorSearchReducer, initialState);

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo<VectorSearchContextActions>(
    () => ({
      toggleVectorSearchPanel: () => {
        dispatch({ type: 'TOGGLE_VECTOR_SEARCH_PANEL' });
      },

      openVectorSearchPanel: (objectId?: string) => {
        dispatch({ type: 'OPEN_VECTOR_SEARCH_PANEL', objectId });
      },

      closeVectorSearchPanel: () => {
        dispatch({ type: 'CLOSE_VECTOR_SEARCH_PANEL' });
      },

      setSearchMode: (mode: VectorSearchMode) => {
        dispatch({ type: 'SET_SEARCH_MODE', mode });
      },

      setSearchParams: (params: Partial<VectorSearchParameters>) => {
        dispatch({ type: 'SET_SEARCH_PARAMS', params });
      },

      setSearchResults: (results: VectorSearchResult[]) => {
        dispatch({ type: 'SET_SEARCH_RESULTS', results });
      },

      setSearching: (isSearching: boolean) => {
        dispatch({ type: 'SET_SEARCHING', isSearching });
      },

      setSearchError: (error: string | null) => {
        dispatch({ type: 'SET_SEARCH_ERROR', error });
      },

      clearSearch: () => {
        dispatch({ type: 'CLEAR_SEARCH' });
      },

      findSimilar: (objectId: string) => {
        dispatch({ type: 'FIND_SIMILAR', objectId });
      },
    }),
    []
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<VectorSearchContextValue>(() => ({ state, actions }), [state, actions]);

  return <VectorSearchContext.Provider value={value}>{children}</VectorSearchContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

export function useVectorSearchContext(): VectorSearchContextValue {
  const context = useContext(VectorSearchContext);
  if (!context) {
    throw new Error('useVectorSearchContext must be used within a VectorSearchProvider');
  }
  return context;
}

// Convenience hooks for accessing specific parts of state
export function useVectorSearchState(): VectorSearchContextState {
  return useVectorSearchContext().state;
}

export function useVectorSearchActions(): VectorSearchContextActions {
  return useVectorSearchContext().actions;
}
