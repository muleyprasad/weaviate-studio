/**
 * FilterContext - Manages filter state and operations
 *
 * This context handles:
 * - Active filters
 * - Filter presets
 * - Filter application state
 *
 * This is prepared for Phase 2 (Visual Filter Builder).
 * Components that need filter state should subscribe to this context.
 * Changes to data or UI won't trigger re-renders here.
 */

import React, { createContext, useContext, useReducer, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type FilterOperator =
  | 'Equal'
  | 'NotEqual'
  | 'GreaterThan'
  | 'GreaterThanEqual'
  | 'LessThan'
  | 'LessThanEqual'
  | 'Like'
  | 'ContainsAny'
  | 'ContainsAll'
  | 'IsNull'
  | 'IsNotNull';

export interface FilterCondition {
  id: string;
  path: string;
  operator: FilterOperator;
  value: unknown;
  valueType?: 'text' | 'number' | 'boolean' | 'date';
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterCondition[];
  createdAt: Date;
}

// ============================================================================
// State Interface
// ============================================================================

export interface FilterContextState {
  activeFilters: FilterCondition[];
  filterPresets: FilterPreset[];
  isApplying: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

type FilterAction =
  | { type: 'ADD_FILTER'; filter: FilterCondition }
  | { type: 'REMOVE_FILTER'; filterId: string }
  | { type: 'UPDATE_FILTER'; filterId: string; updates: Partial<FilterCondition> }
  | { type: 'CLEAR_ALL_FILTERS' }
  | { type: 'SET_FILTERS'; filters: FilterCondition[] }
  | { type: 'SET_APPLYING'; isApplying: boolean }
  | { type: 'SAVE_PRESET'; preset: FilterPreset }
  | { type: 'DELETE_PRESET'; presetId: string }
  | { type: 'LOAD_PRESET'; presetId: string };

// ============================================================================
// Reducer
// ============================================================================

const initialState: FilterContextState = {
  activeFilters: [],
  filterPresets: [],
  isApplying: false,
};

function filterReducer(state: FilterContextState, action: FilterAction): FilterContextState {
  switch (action.type) {
    case 'ADD_FILTER':
      return {
        ...state,
        activeFilters: [...state.activeFilters, action.filter],
      };

    case 'REMOVE_FILTER':
      return {
        ...state,
        activeFilters: state.activeFilters.filter((f) => f.id !== action.filterId),
      };

    case 'UPDATE_FILTER':
      return {
        ...state,
        activeFilters: state.activeFilters.map((f) =>
          f.id === action.filterId ? { ...f, ...action.updates } : f
        ),
      };

    case 'CLEAR_ALL_FILTERS':
      return {
        ...state,
        activeFilters: [],
      };

    case 'SET_FILTERS':
      return {
        ...state,
        activeFilters: action.filters,
      };

    case 'SET_APPLYING':
      return {
        ...state,
        isApplying: action.isApplying,
      };

    case 'SAVE_PRESET':
      return {
        ...state,
        filterPresets: [...state.filterPresets, action.preset],
      };

    case 'DELETE_PRESET':
      return {
        ...state,
        filterPresets: state.filterPresets.filter((p) => p.id !== action.presetId),
      };

    case 'LOAD_PRESET': {
      const preset = state.filterPresets.find((p) => p.id === action.presetId);
      if (!preset) return state;
      return {
        ...state,
        activeFilters: preset.filters,
      };
    }

    default:
      return state;
  }
}

// ============================================================================
// Context Actions Interface
// ============================================================================

export interface FilterContextActions {
  addFilter: (filter: FilterCondition) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<FilterCondition>) => void;
  clearAllFilters: () => void;
  setFilters: (filters: FilterCondition[]) => void;
  setApplying: (isApplying: boolean) => void;
  savePreset: (name: string) => void;
  deletePreset: (presetId: string) => void;
  loadPreset: (presetId: string) => void;
}

// ============================================================================
// Context Definition
// ============================================================================

interface FilterContextValue {
  state: FilterContextState;
  actions: FilterContextActions;
}

const FilterContext = createContext<FilterContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface FilterProviderProps {
  children: React.ReactNode;
}

export function FilterProvider({ children }: FilterProviderProps) {
  const [state, dispatch] = useReducer(filterReducer, initialState);

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo<FilterContextActions>(
    () => ({
      addFilter: (filter: FilterCondition) => {
        dispatch({ type: 'ADD_FILTER', filter });
      },

      removeFilter: (filterId: string) => {
        dispatch({ type: 'REMOVE_FILTER', filterId });
      },

      updateFilter: (filterId: string, updates: Partial<FilterCondition>) => {
        dispatch({ type: 'UPDATE_FILTER', filterId, updates });
      },

      clearAllFilters: () => {
        dispatch({ type: 'CLEAR_ALL_FILTERS' });
      },

      setFilters: (filters: FilterCondition[]) => {
        dispatch({ type: 'SET_FILTERS', filters });
      },

      setApplying: (isApplying: boolean) => {
        dispatch({ type: 'SET_APPLYING', isApplying });
      },

      savePreset: (name: string) => {
        const preset: FilterPreset = {
          id: crypto.randomUUID(),
          name,
          filters: state.activeFilters,
          createdAt: new Date(),
        };
        dispatch({ type: 'SAVE_PRESET', preset });
      },

      deletePreset: (presetId: string) => {
        dispatch({ type: 'DELETE_PRESET', presetId });
      },

      loadPreset: (presetId: string) => {
        dispatch({ type: 'LOAD_PRESET', presetId });
      },
    }),
    [state.activeFilters]
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<FilterContextValue>(() => ({ state, actions }), [state, actions]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useFilterContext(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
}

// Convenience hooks for accessing specific parts of state
export function useFilterState(): FilterContextState {
  return useFilterContext().state;
}

export function useFilterActions(): FilterContextActions {
  return useFilterContext().actions;
}
