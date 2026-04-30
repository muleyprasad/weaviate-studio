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
import type { WeaviateObject, JoinStrategy } from '../../types';

// ============================================================================
// Types
// ============================================================================

export type VectorSearchMode = 'text' | 'object' | 'vector' | 'hybrid';

export type DistanceMetric = 'cosine' | 'euclidean' | 'manhattan' | 'dot';

export type FusionType = 'rankedFusion' | 'relativeScoreFusion';

export interface HybridExplainScore {
  keyword: number;
  vector: number;
  combined: number;
  matchedTerms?: string[];
}

export interface VectorSearchResult {
  object: WeaviateObject;
  distance: number;
  certainty: number;
  explainScore?: HybridExplainScore;
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
  certainty?: number; // Minimum certainty threshold (0-1)
  distance?: number; // Maximum distance threshold
  // Hybrid search parameters
  hybridAlpha: number; // 0 = pure keyword (BM25), 1 = pure vector
  fusionType: FusionType;
  searchProperties: string[]; // Which properties to search in
  enableQueryRewriting: boolean;
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
  // Track if a search has been performed (for empty state messaging)
  hasSearched: boolean;
  // Multi-target vector search state
  vectorOptionsExpanded: boolean;
  selectedTargetVectors: string[];
  joinStrategy: JoinStrategy;
  vectorWeights: Record<string, number>;
  multiTargetActive: boolean;
  muveraFlagsByVector: Record<string, boolean>;
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
  | { type: 'FIND_SIMILAR'; objectId: string }
  | { type: 'RESET_FOR_COLLECTION_CHANGE' }
  // Multi-target vector search actions
  | { type: 'TOGGLE_VECTOR_OPTIONS' }
  | { type: 'SET_SELECTED_TARGET_VECTORS'; vectors: string[] }
  | { type: 'SET_JOIN_STRATEGY'; strategy: JoinStrategy }
  | { type: 'SET_VECTOR_WEIGHT'; vectorName: string; weight: number }
  | { type: 'NORMALIZE_WEIGHTS' }
  | { type: 'SET_MUVERA_FLAGS'; flags: Record<string, boolean> };

// ============================================================================
// Initial State
// ============================================================================

const initialSearchParams: VectorSearchParameters = {
  mode: 'text',
  query: '',
  objectId: '',
  vector: '',
  distanceMetric: 'cosine',
  maxDistance: 1.0, // Permissive default: allows results up to cosine distance 1.0 (orthogonal).
  // At 0.5 many valid results were silently dropped. Users can tighten the
  // slider; the query omits the distance filter entirely when at default (1.0).
  limit: 25,
  // Hybrid search parameters
  hybridAlpha: 0.5, // Balanced by default
  fusionType: 'rankedFusion',
  searchProperties: [], // Empty = search all text properties
  enableQueryRewriting: false,
};

const initialState: VectorSearchContextState = {
  showVectorSearchPanel: false,
  searchMode: 'text',
  searchParams: { ...initialSearchParams },
  searchResults: [],
  isSearching: false,
  searchError: null,
  preSelectedObjectId: null,
  hasSearched: false,
  // Multi-target vector search state
  vectorOptionsExpanded: false,
  selectedTargetVectors: [],
  joinStrategy: 'minimum',
  vectorWeights: {},
  multiTargetActive: false,
  muveraFlagsByVector: {},
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
        hasSearched: true,
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
        hasSearched: false,
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

    case 'RESET_FOR_COLLECTION_CHANGE':
      // Reset all vector search state when collection changes
      return {
        ...initialState,
        // Keep panel open state if it was open
        showVectorSearchPanel: state.showVectorSearchPanel,
      };

    case 'TOGGLE_VECTOR_OPTIONS':
      return {
        ...state,
        vectorOptionsExpanded: !state.vectorOptionsExpanded,
      };

    case 'SET_SELECTED_TARGET_VECTORS':
      return {
        ...state,
        selectedTargetVectors: action.vectors,
        multiTargetActive: action.vectors.length > 1,
      };

    case 'SET_JOIN_STRATEGY':
      return {
        ...state,
        joinStrategy: action.strategy,
      };

    case 'SET_VECTOR_WEIGHT': {
      const newWeights = { ...state.vectorWeights, [action.vectorName]: action.weight };
      return {
        ...state,
        vectorWeights: newWeights,
      };
    }

    case 'NORMALIZE_WEIGHTS': {
      const totalWeight = Object.values(state.vectorWeights).reduce((a, b) => a + b, 0);
      if (totalWeight <= 0) {
        return state;
      }
      const normalizedWeights: Record<string, number> = {};
      Object.entries(state.vectorWeights).forEach(([vector, weight]) => {
        normalizedWeights[vector] = weight / totalWeight;
      });
      return {
        ...state,
        vectorWeights: normalizedWeights,
      };
    }

    case 'SET_MUVERA_FLAGS':
      return {
        ...state,
        muveraFlagsByVector: action.flags,
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
  resetForCollectionChange: () => void;
  // Multi-target vector search actions
  toggleVectorOptions: () => void;
  setSelectedTargetVectors: (vectors: string[]) => void;
  setJoinStrategy: (strategy: JoinStrategy) => void;
  setVectorWeight: (vectorName: string, weight: number) => void;
  normalizeWeights: () => void;
  setMuveraFlags: (flags: Record<string, boolean>) => void;
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

      resetForCollectionChange: () => {
        dispatch({ type: 'RESET_FOR_COLLECTION_CHANGE' });
      },

      // Multi-target vector search actions
      toggleVectorOptions: () => {
        dispatch({ type: 'TOGGLE_VECTOR_OPTIONS' });
      },

      setSelectedTargetVectors: (vectors: string[]) => {
        dispatch({ type: 'SET_SELECTED_TARGET_VECTORS', vectors });
      },

      setJoinStrategy: (strategy: JoinStrategy) => {
        dispatch({ type: 'SET_JOIN_STRATEGY', strategy });
      },

      setVectorWeight: (vectorName: string, weight: number) => {
        dispatch({ type: 'SET_VECTOR_WEIGHT', vectorName, weight });
      },

      normalizeWeights: () => {
        dispatch({ type: 'NORMALIZE_WEIGHTS' });
      },

      setMuveraFlags: (flags: Record<string, boolean>) => {
        dispatch({ type: 'SET_MUVERA_FLAGS', flags });
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
