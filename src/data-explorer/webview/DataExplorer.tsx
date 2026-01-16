import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type {
  DataExplorerState,
  DataExplorerAction,
  ExtensionMessage,
  WebviewMessage,
  Filter,
} from '../types';
import { DataTable } from './components/DataBrowser/DataTable';
import { ObjectDetailPanel } from './components/ObjectDetail/ObjectDetailPanel';
import { FilterBuilder } from './components/Filters/FilterBuilder';

// Import shared theme for design consistency
import '../webview/theme.css';
import './styles.css';

/**
 * VS Code API type
 */
declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// Create VS Code API instance
const vscode = acquireVsCodeApi();

/**
 * Initial state
 */
const initialState: DataExplorerState = {
  collectionName: '',
  schema: null,
  objects: [],
  totalCount: 0,
  loading: true,
  error: null,
  currentPage: 0,
  pageSize: 20,
  filters: [],
  activeFilters: [],
  visibleColumns: [],
  pinnedColumns: [],
  sortBy: null,
  selectedObjectId: null,
  showDetailPanel: false,
};

/**
 * Reducer for state management
 */
function dataExplorerReducer(
  state: DataExplorerState,
  action: DataExplorerAction
): DataExplorerState {
  switch (action.type) {
    case 'SET_COLLECTION':
      return { ...state, collectionName: action.payload };

    case 'SET_SCHEMA':
      // Initialize visible columns from schema
      const allColumns = action.payload.properties.map((p) => p.name);
      return {
        ...state,
        schema: action.payload,
        visibleColumns: state.visibleColumns.length > 0 ? state.visibleColumns : allColumns,
      };

    case 'SET_DATA':
      return {
        ...state,
        objects: action.payload.objects,
        totalCount: action.payload.totalCount,
        loading: false,
        error: null,
      };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };

    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, currentPage: 0 };

    case 'SET_VISIBLE_COLUMNS':
      return { ...state, visibleColumns: action.payload };

    case 'TOGGLE_COLUMN': {
      const isVisible = state.visibleColumns.includes(action.payload);
      const newColumns = isVisible
        ? state.visibleColumns.filter((col) => col !== action.payload)
        : [...state.visibleColumns, action.payload];
      return { ...state, visibleColumns: newColumns };
    }

    case 'PIN_COLUMN': {
      if (!state.pinnedColumns.includes(action.payload)) {
        return { ...state, pinnedColumns: [...state.pinnedColumns, action.payload] };
      }
      return state;
    }

    case 'UNPIN_COLUMN':
      return {
        ...state,
        pinnedColumns: state.pinnedColumns.filter((col) => col !== action.payload),
      };

    case 'SET_SORT':
      return { ...state, sortBy: action.payload };

    case 'SELECT_OBJECT':
      return {
        ...state,
        selectedObjectId: action.payload,
        showDetailPanel: action.payload !== null,
      };

    case 'TOGGLE_DETAIL_PANEL':
      return { ...state, showDetailPanel: action.payload };

    case 'ADD_FILTER':
      return { ...state, filters: [...state.filters, action.payload] };

    case 'UPDATE_FILTER': {
      const updatedFilters = state.filters.map((filter) =>
        filter.id === action.payload.id
          ? { ...filter, ...action.payload.filter }
          : filter
      );
      return { ...state, filters: updatedFilters };
    }

    case 'REMOVE_FILTER':
      return {
        ...state,
        filters: state.filters.filter((filter) => filter.id !== action.payload),
      };

    case 'CLEAR_FILTERS':
      return { ...state, filters: [], activeFilters: [], currentPage: 0 };

    case 'APPLY_FILTERS':
      return {
        ...state,
        activeFilters: [...state.filters],
        currentPage: 0, // Reset to first page when applying filters
      };

    default:
      return state;
  }
}

/**
 * Context for Data Explorer state
 */
interface DataExplorerContextType {
  state: DataExplorerState;
  dispatch: React.Dispatch<DataExplorerAction>;
  fetchObjects: (page?: number) => void;
  selectObject: (uuid: string | null) => void;
}

const DataExplorerContext = createContext<DataExplorerContextType | null>(null);

/**
 * Hook to use Data Explorer context
 */
export function useDataExplorer() {
  const context = useContext(DataExplorerContext);
  if (!context) {
    throw new Error('useDataExplorer must be used within DataExplorerProvider');
  }
  return context;
}

/**
 * Main Data Explorer component
 */
export function DataExplorer() {
  const [state, dispatch] = useReducer(dataExplorerReducer, initialState);

  /**
   * Fetch objects from the collection
   */
  const fetchObjects = useCallback(
    (page?: number) => {
      const targetPage = page !== undefined ? page : state.currentPage;

      dispatch({ type: 'SET_LOADING', payload: true });

      vscode.postMessage({
        command: 'fetchObjects',
        data: {
          collectionName: state.collectionName,
          limit: state.pageSize,
          offset: targetPage * state.pageSize,
          sortBy: state.sortBy,
          filters: state.activeFilters,
        },
      });
    },
    [state.collectionName, state.currentPage, state.pageSize, state.sortBy, state.activeFilters]
  );

  /**
   * Select an object to view details
   */
  const selectObject = useCallback(
    (uuid: string | null) => {
      if (uuid) {
        vscode.postMessage({
          command: 'selectObject',
          data: {
            collectionName: state.collectionName,
            uuid,
          },
        });
      }
      dispatch({ type: 'SELECT_OBJECT', payload: uuid });
    },
    [state.collectionName]
  );

  /**
   * Handle messages from extension
   */
  useEffect(() => {
    const messageHandler = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.command) {
        case 'initialized':
          dispatch({ type: 'SET_COLLECTION', payload: message.data.collectionName });
          // Apply saved preferences if any
          if (message.data.preferences) {
            if (message.data.preferences.visibleColumns) {
              dispatch({
                type: 'SET_VISIBLE_COLUMNS',
                payload: message.data.preferences.visibleColumns,
              });
            }
            if (message.data.preferences.pinnedColumns) {
              message.data.preferences.pinnedColumns.forEach((col: string) => {
                dispatch({ type: 'PIN_COLUMN', payload: col });
              });
            }
            if (message.data.preferences.pageSize) {
              dispatch({ type: 'SET_PAGE_SIZE', payload: message.data.preferences.pageSize });
            }
            if (message.data.preferences.sortBy) {
              dispatch({ type: 'SET_SORT', payload: message.data.preferences.sortBy });
            }
            if (message.data.preferences.filters) {
              message.data.preferences.filters.forEach((filter: Filter) => {
                dispatch({ type: 'ADD_FILTER', payload: filter });
              });
              // Auto-apply saved filters
              dispatch({ type: 'APPLY_FILTERS' });
            }
          }
          break;

        case 'schemaLoaded':
          dispatch({ type: 'SET_SCHEMA', payload: message.data });
          break;

        case 'objectsLoaded':
          dispatch({ type: 'SET_DATA', payload: message.data });
          break;

        case 'objectSelected':
          // Object details loaded - handled by ObjectDetailPanel
          break;

        case 'error':
          dispatch({ type: 'SET_ERROR', payload: message.data.message });
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  /**
   * Fetch objects when page, sort, or filters change
   */
  useEffect(() => {
    if (state.collectionName && state.schema) {
      fetchObjects();
    }
  }, [state.currentPage, state.pageSize, state.sortBy, state.activeFilters]);

  /**
   * Save preferences when they change
   */
  useEffect(() => {
    if (state.collectionName && state.schema) {
      vscode.postMessage({
        command: 'savePreferences',
        data: {
          collectionName: state.collectionName,
          preferences: {
            visibleColumns: state.visibleColumns,
            pinnedColumns: state.pinnedColumns,
            pageSize: state.pageSize,
            sortBy: state.sortBy,
            filters: state.activeFilters,
          },
        },
      });
    }
  }, [state.visibleColumns, state.pinnedColumns, state.pageSize, state.sortBy, state.activeFilters, state.collectionName, state.schema]);

  /**
   * Context value (memoized to prevent unnecessary re-renders)
   */
  const contextValue = useMemo<DataExplorerContextType>(
    () => ({
      state,
      dispatch,
      fetchObjects,
      selectObject,
    }),
    [state, fetchObjects, selectObject]
  );

  return (
    <DataExplorerContext.Provider value={contextValue}>
      <div className="data-explorer">
        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {state.loading && 'Loading data...'}
          {!state.loading && state.objects.length > 0 && `Loaded ${state.totalCount} objects`}
          {!state.loading && state.objects.length === 0 && 'No objects found'}
        </div>

        {state.error && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{state.error}</span>
            <button
              className="error-dismiss"
              onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <div className="explorer-header">
          <h2 className="collection-name">
            {state.collectionName}
            <span className="object-count">
              {state.loading ? '...' : `${state.totalCount} objects`}
            </span>
          </h2>
        </div>

        {/* Filter panel */}
        <FilterBuilder />

        <div className="explorer-content">
          {state.loading && !state.objects.length ? (
            <div className="loading-skeleton">
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
            </div>
          ) : (
            <>
              <DataTable />
              {state.showDetailPanel && state.selectedObjectId && <ObjectDetailPanel />}
            </>
          )}
        </div>
      </div>
    </DataExplorerContext.Provider>
  );
}
