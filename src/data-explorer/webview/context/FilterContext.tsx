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

import React, { createContext, useContext, useReducer, useMemo, useRef, useEffect } from 'react';

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

export type FilterMatchMode = 'AND' | 'OR';

export interface FilterContextState {
  activeFilters: FilterCondition[];
  pendingFilters: FilterCondition[]; // Filters being edited in panel before applying
  filterPresets: FilterPreset[];
  isApplying: boolean;
  showFilterPanel: boolean;
  matchMode: FilterMatchMode;
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
  | { type: 'LOAD_PRESET'; presetId: string }
  | { type: 'TOGGLE_FILTER_PANEL' }
  | { type: 'OPEN_FILTER_PANEL' }
  | { type: 'CLOSE_FILTER_PANEL' }
  | { type: 'SET_MATCH_MODE'; mode: FilterMatchMode }
  | { type: 'ADD_PENDING_FILTER'; filter: FilterCondition }
  | { type: 'REMOVE_PENDING_FILTER'; filterId: string }
  | { type: 'UPDATE_PENDING_FILTER'; filterId: string; updates: Partial<FilterCondition> }
  | { type: 'APPLY_PENDING_FILTERS' }
  | { type: 'RESET_PENDING_FILTERS' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: FilterContextState = {
  activeFilters: [],
  pendingFilters: [],
  filterPresets: [],
  isApplying: false,
  showFilterPanel: false,
  matchMode: 'AND',
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
      if (!preset) {
        return state;
      }
      return {
        ...state,
        activeFilters: preset.filters,
      };
    }

    case 'TOGGLE_FILTER_PANEL':
      return {
        ...state,
        showFilterPanel: !state.showFilterPanel,
        // When opening, copy active filters to pending
        pendingFilters: !state.showFilterPanel ? [...state.activeFilters] : state.pendingFilters,
      };

    case 'OPEN_FILTER_PANEL':
      return {
        ...state,
        showFilterPanel: true,
        pendingFilters: [...state.activeFilters],
      };

    case 'CLOSE_FILTER_PANEL':
      return {
        ...state,
        showFilterPanel: false,
      };

    case 'SET_MATCH_MODE':
      return {
        ...state,
        matchMode: action.mode,
      };

    case 'ADD_PENDING_FILTER':
      return {
        ...state,
        pendingFilters: [...state.pendingFilters, action.filter],
      };

    case 'REMOVE_PENDING_FILTER':
      return {
        ...state,
        pendingFilters: state.pendingFilters.filter((f) => f.id !== action.filterId),
      };

    case 'UPDATE_PENDING_FILTER':
      return {
        ...state,
        pendingFilters: state.pendingFilters.map((f) =>
          f.id === action.filterId ? { ...f, ...action.updates } : f
        ),
      };

    case 'APPLY_PENDING_FILTERS':
      return {
        ...state,
        activeFilters: [...state.pendingFilters],
        showFilterPanel: false,
      };

    case 'RESET_PENDING_FILTERS':
      return {
        ...state,
        pendingFilters: [...state.activeFilters],
      };

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
  // Filter panel actions
  toggleFilterPanel: () => void;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  setMatchMode: (mode: FilterMatchMode) => void;
  // Pending filter actions (for panel editing)
  addPendingFilter: (filter: FilterCondition) => void;
  removePendingFilter: (filterId: string) => void;
  updatePendingFilter: (filterId: string, updates: Partial<FilterCondition>) => void;
  applyPendingFilters: () => void;
  resetPendingFilters: () => void;
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

  // Use ref to access latest state without causing re-renders
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Memoize actions to prevent unnecessary re-renders
  // Actions no longer depend on state, they access it via ref
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
          filters: stateRef.current.activeFilters,
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

      // Filter panel actions
      toggleFilterPanel: () => {
        dispatch({ type: 'TOGGLE_FILTER_PANEL' });
      },

      openFilterPanel: () => {
        dispatch({ type: 'OPEN_FILTER_PANEL' });
      },

      closeFilterPanel: () => {
        dispatch({ type: 'CLOSE_FILTER_PANEL' });
      },

      setMatchMode: (mode: FilterMatchMode) => {
        dispatch({ type: 'SET_MATCH_MODE', mode });
      },

      // Pending filter actions
      addPendingFilter: (filter: FilterCondition) => {
        dispatch({ type: 'ADD_PENDING_FILTER', filter });
      },

      removePendingFilter: (filterId: string) => {
        dispatch({ type: 'REMOVE_PENDING_FILTER', filterId });
      },

      updatePendingFilter: (filterId: string, updates: Partial<FilterCondition>) => {
        dispatch({ type: 'UPDATE_PENDING_FILTER', filterId, updates });
      },

      applyPendingFilters: () => {
        dispatch({ type: 'APPLY_PENDING_FILTERS' });
      },

      resetPendingFilters: () => {
        dispatch({ type: 'RESET_PENDING_FILTERS' });
      },
    }),
    [] // No dependencies - actions are stable
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
