/**
 * DataExplorerContext - React Context for Data Explorer state management
 * Uses useReducer for complex state updates
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type {
  DataExplorerState,
  DataExplorerAction,
  WeaviateObject,
  CollectionConfig,
  SortState,
} from '../../types';

// Initial state
const initialState: DataExplorerState = {
  collectionName: '',
  schema: null,
  objects: [],
  totalCount: 0,
  loading: true,
  error: null,
  currentPage: 1,
  pageSize: 20,
  visibleColumns: [],
  pinnedColumns: ['uuid'],
  columnWidths: {},
  columnOrder: [],
  sortBy: null,
  selectedRows: new Set(),
  selectedObjectId: null,
  showDetailPanel: false,
  showColumnManager: false,
};

// Reducer function
function dataExplorerReducer(
  state: DataExplorerState,
  action: DataExplorerAction
): DataExplorerState {
  switch (action.type) {
    case 'SET_COLLECTION': {
      const properties = action.payload.schema.properties || [];
      const columnNames = ['uuid', ...properties.map((p) => p.name)];
      return {
        ...state,
        collectionName: action.payload.name,
        schema: action.payload.schema,
        visibleColumns: columnNames.slice(0, 6), // Show first 6 columns by default
        columnOrder: columnNames,
        pinnedColumns: ['uuid'],
        currentPage: 1,
        selectedRows: new Set(),
        selectedObjectId: null,
        showDetailPanel: false,
      };
    }

    case 'SET_DATA':
      return {
        ...state,
        objects: action.payload.objects,
        totalCount: action.payload.total,
        loading: false,
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: action.payload ? null : state.error,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.payload,
      };

    case 'SET_PAGE_SIZE':
      return {
        ...state,
        pageSize: action.payload,
        currentPage: 1, // Reset to first page when changing page size
      };

    case 'SET_VISIBLE_COLUMNS':
      return {
        ...state,
        visibleColumns: action.payload,
      };

    case 'TOGGLE_COLUMN': {
      const column = action.payload;
      const isVisible = state.visibleColumns.includes(column);
      return {
        ...state,
        visibleColumns: isVisible
          ? state.visibleColumns.filter((c) => c !== column)
          : [...state.visibleColumns, column],
      };
    }

    case 'SET_PINNED_COLUMNS':
      return {
        ...state,
        pinnedColumns: action.payload,
      };

    case 'TOGGLE_PIN_COLUMN': {
      const column = action.payload;
      const isPinned = state.pinnedColumns.includes(column);
      return {
        ...state,
        pinnedColumns: isPinned
          ? state.pinnedColumns.filter((c) => c !== column)
          : [...state.pinnedColumns, column],
      };
    }

    case 'SET_COLUMN_WIDTH':
      return {
        ...state,
        columnWidths: {
          ...state.columnWidths,
          [action.payload.column]: action.payload.width,
        },
      };

    case 'SET_COLUMN_ORDER':
      return {
        ...state,
        columnOrder: action.payload,
      };

    case 'TOGGLE_ROW_SELECTION': {
      const uuid = action.payload;
      const newSelectedRows = new Set(state.selectedRows);
      if (newSelectedRows.has(uuid)) {
        newSelectedRows.delete(uuid);
      } else {
        newSelectedRows.add(uuid);
      }
      return {
        ...state,
        selectedRows: newSelectedRows,
      };
    }

    case 'SELECT_ALL_ROWS': {
      if (action.payload) {
        const allUuids = new Set(state.objects.map((obj) => obj.uuid));
        return {
          ...state,
          selectedRows: allUuids,
        };
      } else {
        return {
          ...state,
          selectedRows: new Set(),
        };
      }
    }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedRows: new Set(),
      };

    case 'SET_SORT':
      return {
        ...state,
        sortBy: action.payload,
      };

    case 'SELECT_OBJECT':
      return {
        ...state,
        selectedObjectId: action.payload,
        showDetailPanel: action.payload !== null,
      };

    case 'TOGGLE_DETAIL_PANEL':
      return {
        ...state,
        showDetailPanel: action.payload ?? !state.showDetailPanel,
        selectedObjectId: action.payload === false ? null : state.selectedObjectId,
      };

    case 'TOGGLE_COLUMN_MANAGER':
      return {
        ...state,
        showColumnManager: action.payload ?? !state.showColumnManager,
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// Context type
interface DataExplorerContextType {
  state: DataExplorerState;
  dispatch: React.Dispatch<DataExplorerAction>;
  actions: {
    setCollection: (name: string, schema: CollectionConfig) => void;
    setData: (objects: WeaviateObject[], total: number) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    toggleColumn: (column: string) => void;
    togglePinColumn: (column: string) => void;
    setColumnWidth: (column: string, width: number) => void;
    setColumnOrder: (order: string[]) => void;
    toggleRowSelection: (uuid: string) => void;
    selectAllRows: (select: boolean) => void;
    clearSelection: () => void;
    setSort: (sort: SortState | null) => void;
    selectObject: (uuid: string | null) => void;
    toggleDetailPanel: (show?: boolean) => void;
    toggleColumnManager: (show?: boolean) => void;
    resetState: () => void;
  };
  // Computed values
  totalPages: number;
  displayedColumns: string[];
  sortedObjects: WeaviateObject[];
  isAllSelected: boolean;
  selectedObject: WeaviateObject | null;
}

// Create context
const DataExplorerContext = createContext<DataExplorerContextType | undefined>(undefined);

// Provider props
interface DataExplorerProviderProps {
  children: ReactNode;
  initialCollectionName?: string;
}

// Provider component
export function DataExplorerProvider({
  children,
  initialCollectionName,
}: DataExplorerProviderProps) {
  const [state, dispatch] = useReducer(dataExplorerReducer, {
    ...initialState,
    collectionName: initialCollectionName || '',
  });

  // Action creators
  const actions = useMemo(
    () => ({
      setCollection: (name: string, schema: CollectionConfig) =>
        dispatch({ type: 'SET_COLLECTION', payload: { name, schema } }),

      setData: (objects: WeaviateObject[], total: number) =>
        dispatch({ type: 'SET_DATA', payload: { objects, total } }),

      setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),

      setError: (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),

      setPage: (page: number) => dispatch({ type: 'SET_PAGE', payload: page }),

      setPageSize: (size: number) => dispatch({ type: 'SET_PAGE_SIZE', payload: size }),

      toggleColumn: (column: string) => dispatch({ type: 'TOGGLE_COLUMN', payload: column }),

      togglePinColumn: (column: string) => dispatch({ type: 'TOGGLE_PIN_COLUMN', payload: column }),

      setColumnWidth: (column: string, width: number) =>
        dispatch({ type: 'SET_COLUMN_WIDTH', payload: { column, width } }),

      setColumnOrder: (order: string[]) => dispatch({ type: 'SET_COLUMN_ORDER', payload: order }),

      toggleRowSelection: (uuid: string) =>
        dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: uuid }),

      selectAllRows: (select: boolean) => dispatch({ type: 'SELECT_ALL_ROWS', payload: select }),

      clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),

      setSort: (sort: SortState | null) => dispatch({ type: 'SET_SORT', payload: sort }),

      selectObject: (uuid: string | null) => dispatch({ type: 'SELECT_OBJECT', payload: uuid }),

      toggleDetailPanel: (show?: boolean) =>
        dispatch({ type: 'TOGGLE_DETAIL_PANEL', payload: show }),

      toggleColumnManager: (show?: boolean) =>
        dispatch({ type: 'TOGGLE_COLUMN_MANAGER', payload: show }),

      resetState: () => dispatch({ type: 'RESET_STATE' }),
    }),
    []
  );

  // Computed: total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(state.totalCount / state.pageSize));
  }, [state.totalCount, state.pageSize]);

  // Computed: displayed columns (pinned first, then visible, maintaining order)
  const displayedColumns = useMemo(() => {
    const pinnedVisible = state.pinnedColumns.filter((c) => state.visibleColumns.includes(c));
    const unpinnedVisible = state.visibleColumns.filter((c) => !state.pinnedColumns.includes(c));

    // Maintain order from columnOrder
    return [...pinnedVisible, ...unpinnedVisible].sort((a, b) => {
      const orderA = state.columnOrder.indexOf(a);
      const orderB = state.columnOrder.indexOf(b);
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      return orderA - orderB;
    });
  }, [state.visibleColumns, state.pinnedColumns, state.columnOrder]);

  // Computed: sorted objects (now handled server-side, just return as-is)
  const sortedObjects = useMemo(() => {
    // Server-side sorting is now handled in the API
    // Objects come pre-sorted from the backend
    return state.objects;
  }, [state.objects]);

  // Computed: is all selected
  const isAllSelected = useMemo(() => {
    return state.objects.length > 0 && state.selectedRows.size === state.objects.length;
  }, [state.objects, state.selectedRows]);

  // Computed: selected object
  const selectedObject = useMemo(() => {
    if (!state.selectedObjectId) return null;
    return state.objects.find((obj) => obj.uuid === state.selectedObjectId) || null;
  }, [state.objects, state.selectedObjectId]);

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      actions,
      totalPages,
      displayedColumns,
      sortedObjects,
      isAllSelected,
      selectedObject,
    }),
    [state, actions, totalPages, displayedColumns, sortedObjects, isAllSelected, selectedObject]
  );

  return (
    <DataExplorerContext.Provider value={contextValue}>{children}</DataExplorerContext.Provider>
  );
}

// Custom hook for using context
export function useDataExplorer(): DataExplorerContextType {
  const context = useContext(DataExplorerContext);
  if (!context) {
    throw new Error('useDataExplorer must be used within a DataExplorerProvider');
  }
  return context;
}
