/**
 * UIContext - Manages UI state (columns, pagination, sorting, selection, panels)
 *
 * This context handles:
 * - Column visibility, widths, order, pinning
 * - Pagination state
 * - Sorting state
 * - Row selection
 * - Panel visibility (detail panel, column manager)
 *
 * Components that need UI state should subscribe to this context.
 * Changes to data (objects loading) won't trigger re-renders here.
 */

import React, { createContext, useContext, useReducer, useMemo } from 'react';
import type { SortState } from '../../types';

// ============================================================================
// State Interface
// ============================================================================

export interface UIContextState {
  // Column management
  visibleColumns: string[];
  pinnedColumns: string[];
  columnWidths: Record<string, number>;
  columnOrder: string[];

  // Pagination
  currentPage: number;
  pageSize: number;

  // Sorting
  sortBy: SortState | null;

  // Selection
  selectedRows: Set<string>;
  selectedObjectId: string | null;

  // Panels
  showDetailPanel: boolean;
  showColumnManager: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

type UIAction =
  // Column actions
  | { type: 'TOGGLE_COLUMN'; columnName: string }
  | { type: 'SET_VISIBLE_COLUMNS'; columns: string[] }
  | { type: 'SET_COLUMN_WIDTH'; columnName: string; width: number }
  | { type: 'SET_COLUMN_ORDER'; order: string[] }
  | { type: 'PIN_COLUMN'; columnName: string }
  | { type: 'UNPIN_COLUMN'; columnName: string }
  | { type: 'RESET_COLUMNS' }

  // Pagination actions
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_PAGE_SIZE'; size: number }

  // Sorting actions
  | { type: 'SET_SORT'; sort: SortState | null }

  // Selection actions
  | { type: 'TOGGLE_ROW_SELECTION'; uuid: string }
  | { type: 'SELECT_ALL'; uuids: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SELECTED_OBJECT'; uuid: string | null }

  // Panel actions
  | { type: 'OPEN_DETAIL_PANEL'; uuid: string }
  | { type: 'CLOSE_DETAIL_PANEL' }
  | { type: 'TOGGLE_COLUMN_MANAGER' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: UIContextState = {
  visibleColumns: [],
  pinnedColumns: [],
  columnWidths: {},
  columnOrder: [],
  currentPage: 1,
  pageSize: 20,
  sortBy: null,
  selectedRows: new Set<string>(),
  selectedObjectId: null,
  showDetailPanel: false,
  showColumnManager: false,
};

function uiReducer(state: UIContextState, action: UIAction): UIContextState {
  switch (action.type) {
    // Column actions
    case 'TOGGLE_COLUMN': {
      const isVisible = state.visibleColumns.includes(action.columnName);
      return {
        ...state,
        visibleColumns: isVisible
          ? state.visibleColumns.filter((col) => col !== action.columnName)
          : [...state.visibleColumns, action.columnName],
      };
    }

    case 'SET_VISIBLE_COLUMNS':
      return {
        ...state,
        visibleColumns: action.columns,
      };

    case 'SET_COLUMN_WIDTH':
      return {
        ...state,
        columnWidths: {
          ...state.columnWidths,
          [action.columnName]: action.width,
        },
      };

    case 'SET_COLUMN_ORDER':
      return {
        ...state,
        columnOrder: action.order,
      };

    case 'PIN_COLUMN':
      return {
        ...state,
        pinnedColumns: state.pinnedColumns.includes(action.columnName)
          ? state.pinnedColumns
          : [...state.pinnedColumns, action.columnName],
      };

    case 'UNPIN_COLUMN':
      return {
        ...state,
        pinnedColumns: state.pinnedColumns.filter((col) => col !== action.columnName),
      };

    case 'RESET_COLUMNS':
      return {
        ...state,
        visibleColumns: [],
        pinnedColumns: [],
        columnWidths: {},
        columnOrder: [],
      };

    // Pagination actions
    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.page,
      };

    case 'SET_PAGE_SIZE':
      return {
        ...state,
        pageSize: action.size,
        currentPage: 1, // Reset to first page when page size changes
      };

    // Sorting actions
    case 'SET_SORT':
      return {
        ...state,
        sortBy: action.sort,
        currentPage: 1, // Reset to first page when sort changes
      };

    // Selection actions
    case 'TOGGLE_ROW_SELECTION': {
      const newSelection = new Set(state.selectedRows);
      if (newSelection.has(action.uuid)) {
        newSelection.delete(action.uuid);
      } else {
        newSelection.add(action.uuid);
      }
      return {
        ...state,
        selectedRows: newSelection,
      };
    }

    case 'SELECT_ALL':
      return {
        ...state,
        selectedRows: new Set(action.uuids),
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedRows: new Set<string>(),
      };

    case 'SET_SELECTED_OBJECT':
      return {
        ...state,
        selectedObjectId: action.uuid,
      };

    // Panel actions
    case 'OPEN_DETAIL_PANEL':
      return {
        ...state,
        selectedObjectId: action.uuid,
        showDetailPanel: true,
      };

    case 'CLOSE_DETAIL_PANEL':
      return {
        ...state,
        showDetailPanel: false,
        selectedObjectId: null,
      };

    case 'TOGGLE_COLUMN_MANAGER':
      return {
        ...state,
        showColumnManager: !state.showColumnManager,
      };

    default:
      return state;
  }
}

// ============================================================================
// Context Actions Interface
// ============================================================================

export interface UIContextActions {
  // Column actions
  toggleColumn: (columnName: string) => void;
  setVisibleColumns: (columns: string[]) => void;
  setColumnWidth: (columnName: string, width: number) => void;
  setColumnOrder: (order: string[]) => void;
  pinColumn: (columnName: string) => void;
  unpinColumn: (columnName: string) => void;
  resetColumns: () => void;

  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Sorting actions
  setSortBy: (sort: SortState | null) => void;

  // Selection actions
  toggleRowSelection: (uuid: string) => void;
  selectAll: (uuids: string[]) => void;
  clearSelection: () => void;

  // Panel actions
  openDetailPanel: (uuid: string) => void;
  closeDetailPanel: () => void;
  toggleColumnManager: () => void;
}

// ============================================================================
// Context Definition
// ============================================================================

interface UIContextValue {
  state: UIContextState;
  actions: UIContextActions;
}

const UIContext = createContext<UIContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface UIProviderProps {
  children: React.ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo<UIContextActions>(
    () => ({
      // Column actions
      toggleColumn: (columnName: string) => {
        dispatch({ type: 'TOGGLE_COLUMN', columnName });
      },

      setVisibleColumns: (columns: string[]) => {
        dispatch({ type: 'SET_VISIBLE_COLUMNS', columns });
      },

      setColumnWidth: (columnName: string, width: number) => {
        dispatch({ type: 'SET_COLUMN_WIDTH', columnName, width });
      },

      setColumnOrder: (order: string[]) => {
        dispatch({ type: 'SET_COLUMN_ORDER', order });
      },

      pinColumn: (columnName: string) => {
        dispatch({ type: 'PIN_COLUMN', columnName });
      },

      unpinColumn: (columnName: string) => {
        dispatch({ type: 'UNPIN_COLUMN', columnName });
      },

      resetColumns: () => {
        dispatch({ type: 'RESET_COLUMNS' });
      },

      // Pagination actions
      setPage: (page: number) => {
        dispatch({ type: 'SET_PAGE', page });
      },

      setPageSize: (size: number) => {
        dispatch({ type: 'SET_PAGE_SIZE', size });
      },

      // Sorting actions
      setSortBy: (sort: SortState | null) => {
        dispatch({ type: 'SET_SORT', sort });
      },

      // Selection actions
      toggleRowSelection: (uuid: string) => {
        dispatch({ type: 'TOGGLE_ROW_SELECTION', uuid });
      },

      selectAll: (uuids: string[]) => {
        dispatch({ type: 'SELECT_ALL', uuids });
      },

      clearSelection: () => {
        dispatch({ type: 'CLEAR_SELECTION' });
      },

      // Panel actions
      openDetailPanel: (uuid: string) => {
        dispatch({ type: 'OPEN_DETAIL_PANEL', uuid });
      },

      closeDetailPanel: () => {
        dispatch({ type: 'CLOSE_DETAIL_PANEL' });
      },

      toggleColumnManager: () => {
        dispatch({ type: 'TOGGLE_COLUMN_MANAGER' });
      },
    }),
    []
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<UIContextValue>(() => ({ state, actions }), [state, actions]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useUIContext(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return context;
}

// Convenience hooks for accessing specific parts of state
export function useUIState(): UIContextState {
  return useUIContext().state;
}

export function useUIActions(): UIContextActions {
  return useUIContext().actions;
}
