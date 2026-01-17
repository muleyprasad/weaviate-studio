import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
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
import { VectorSearchPanel } from './components/VectorSearch/VectorSearchPanel';
import { QuickInsightsPanel } from './components/Insights/QuickInsightsPanel';
import { ExportDialog } from './components/Export/ExportDialog';
import { SchemaVisualizer } from './components/Schema/SchemaVisualizer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmptyState } from './components/EmptyState';
import { ConnectionError } from './components/ConnectionError';
import { TableSkeleton } from './components/LoadingSkeleton';
import { useKeyboardShortcuts, type KeyboardShortcut } from './hooks/useKeyboardShortcuts';

// Import shared theme for design consistency
import '../../webview/theme.css';
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
  filterGroup: null,
  activeFilterGroup: null,
  filterTemplates: [],
  vectorSearch: {
    isActive: false,
    config: {
      mode: 'text',
      limit: 10,
      useDistanceMetric: true,
      distance: 0.5,
      certainty: 0.7,
      alpha: 0.75,
      enableQueryRewriting: true,
    },
    results: [],
    loading: false,
    error: null,
  },
  insights: {
    loading: false,
    error: null,
    totalCount: 0,
    categoricalAggregations: [],
    numericAggregations: [],
    dateAggregations: [],
    config: {
      categoricalProperties: [],
      numericProperties: [],
      dateProperties: [],
      autoRefresh: false,
    },
    lastRefreshed: null,
  },
  showExportDialog: false,
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
        filter.id === action.payload.id ? { ...filter, ...action.payload.filter } : filter
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

    case 'SET_FILTER_GROUP':
      return { ...state, filterGroup: action.payload };

    case 'UPDATE_FILTER_GROUP':
      if (!state.filterGroup) return state;
      return {
        ...state,
        filterGroup: { ...state.filterGroup, ...action.payload },
      };

    case 'ADD_GROUP_TO_GROUP': {
      if (!state.filterGroup) return state;
      const { addGroupToGroup } = require('../utils/filterGroupUtils');
      return {
        ...state,
        filterGroup: addGroupToGroup(
          state.filterGroup,
          action.payload.parentId,
          action.payload.group
        ),
      };
    }

    case 'ADD_FILTER_TO_GROUP': {
      if (!state.filterGroup) return state;
      const { addFilterToGroup } = require('../utils/filterGroupUtils');
      return {
        ...state,
        filterGroup: addFilterToGroup(
          state.filterGroup,
          action.payload.groupId,
          action.payload.filter
        ),
      };
    }

    case 'REMOVE_FILTER_FROM_GROUP': {
      if (!state.filterGroup) return state;
      const { removeFilterFromGroup } = require('../utils/filterGroupUtils');
      return {
        ...state,
        filterGroup: removeFilterFromGroup(
          state.filterGroup,
          action.payload.groupId,
          action.payload.filterId
        ),
      };
    }

    case 'REMOVE_GROUP_FROM_GROUP': {
      if (!state.filterGroup) return state;
      const { removeGroupFromGroup } = require('../utils/filterGroupUtils');
      return {
        ...state,
        filterGroup: removeGroupFromGroup(
          state.filterGroup,
          action.payload.parentId,
          action.payload.groupId
        ),
      };
    }

    case 'UPDATE_GROUP_OPERATOR': {
      if (!state.filterGroup) return state;
      const { updateGroupOperator } = require('../utils/filterGroupUtils');
      return {
        ...state,
        filterGroup: updateGroupOperator(
          state.filterGroup,
          action.payload.groupId,
          action.payload.operator
        ),
      };
    }

    case 'APPLY_FILTER_GROUP':
      return {
        ...state,
        activeFilterGroup: state.filterGroup,
        currentPage: 0,
      };

    case 'CLEAR_FILTER_GROUP':
      return {
        ...state,
        filterGroup: null,
        activeFilterGroup: null,
        currentPage: 0,
      };

    case 'SAVE_FILTER_TEMPLATE':
      return {
        ...state,
        filterTemplates: [...state.filterTemplates, action.payload],
      };

    case 'DELETE_FILTER_TEMPLATE':
      return {
        ...state,
        filterTemplates: state.filterTemplates.filter((t) => t.id !== action.payload),
      };

    case 'LOAD_FILTER_TEMPLATE': {
      const template = state.filterTemplates.find((t) => t.id === action.payload);
      if (!template) return state;
      const { cloneFilterGroup } = require('../utils/filterGroupUtils');
      return {
        ...state,
        filterGroup: cloneFilterGroup(template.group),
      };
    }

    case 'SET_VECTOR_SEARCH_CONFIG':
      return {
        ...state,
        vectorSearch: {
          ...state.vectorSearch,
          config: {
            ...state.vectorSearch.config,
            ...action.payload,
          },
        },
      };

    case 'SET_VECTOR_SEARCH_ACTIVE':
      return {
        ...state,
        vectorSearch: {
          ...state.vectorSearch,
          isActive: action.payload,
        },
      };

    case 'SET_VECTOR_SEARCH_RESULTS':
      return {
        ...state,
        vectorSearch: {
          ...state.vectorSearch,
          results: action.payload,
          loading: false,
          error: null,
        },
      };

    case 'SET_VECTOR_SEARCH_LOADING':
      return {
        ...state,
        vectorSearch: {
          ...state.vectorSearch,
          loading: action.payload,
        },
      };

    case 'SET_VECTOR_SEARCH_ERROR':
      return {
        ...state,
        vectorSearch: {
          ...state.vectorSearch,
          error: action.payload,
          loading: false,
        },
      };

    case 'CLEAR_VECTOR_SEARCH':
      return {
        ...state,
        vectorSearch: {
          ...state.vectorSearch,
          results: [],
          loading: false,
          error: null,
        },
      };

    case 'SET_INSIGHTS_LOADING':
      return {
        ...state,
        insights: {
          ...state.insights,
          loading: action.payload,
        },
      };

    case 'SET_INSIGHTS_ERROR':
      return {
        ...state,
        insights: {
          ...state.insights,
          error: action.payload,
          loading: false,
        },
      };

    case 'SET_INSIGHTS_DATA':
      return {
        ...state,
        insights: {
          ...state.insights,
          totalCount: action.payload.totalCount,
          categoricalAggregations: action.payload.categoricalAggregations,
          numericAggregations: action.payload.numericAggregations,
          dateAggregations: action.payload.dateAggregations,
          loading: false,
          error: null,
          lastRefreshed: new Date(),
        },
      };

    case 'UPDATE_INSIGHTS_CONFIG':
      return {
        ...state,
        insights: {
          ...state.insights,
          config: {
            ...state.insights.config,
            ...action.payload,
          },
        },
      };

    case 'REFRESH_INSIGHTS':
      // Trigger insights refresh (handled by effect)
      return {
        ...state,
        insights: {
          ...state.insights,
          loading: true,
        },
      };

    case 'TOGGLE_EXPORT_DIALOG':
      return {
        ...state,
        showExportDialog: action.payload,
      };

    case 'START_EXPORT':
      // Export started (handled by effect or component)
      return state;

    case 'EXPORT_SUCCESS':
      return state;

    case 'EXPORT_ERROR':
      return state;

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
  postMessage: (message: WebviewMessage) => void;
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
            // Load filter templates
            if (message.data.preferences.filterTemplates) {
              message.data.preferences.filterTemplates.forEach((template: any) => {
                dispatch({ type: 'SAVE_FILTER_TEMPLATE', payload: template });
              });
            }
            // Load insights configuration
            if (message.data.preferences.insightsConfig) {
              dispatch({
                type: 'UPDATE_INSIGHTS_CONFIG',
                payload: message.data.preferences.insightsConfig,
              });
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

        case 'vectorSearchResults':
          dispatch({ type: 'SET_VECTOR_SEARCH_RESULTS', payload: message.data.results });
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
   * Debounce filter changes to avoid excessive API calls
   */
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!state.collectionName || !state.schema) {
      return;
    }

    // Clear existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Immediate fetch for page/pageSize changes (user-initiated navigation)
    // Debounced fetch for filter/sort changes (allow user to finish editing)
    const isFilterOrSortChange = state.activeFilters.length > 0 || state.sortBy !== null;

    if (isFilterOrSortChange) {
      // Debounce filter and sort changes (300ms)
      fetchTimeoutRef.current = setTimeout(() => {
        fetchObjects();
      }, 300);
    } else {
      // Immediate fetch for pagination
      fetchObjects();
    }

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [
    state.currentPage,
    state.pageSize,
    state.sortBy,
    state.activeFilters,
    state.collectionName,
    state.schema,
    fetchObjects,
  ]);

  /**
   * Save preferences when they change
   * Includes UI preferences, filters, and insights configuration
   */
  useEffect(() => {
    if (state.collectionName && state.schema) {
      vscode.postMessage({
        command: 'savePreferences',
        data: {
          collectionName: state.collectionName,
          preferences: {
            // UI preferences
            visibleColumns: state.visibleColumns,
            pinnedColumns: state.pinnedColumns,
            pageSize: state.pageSize,
            sortBy: state.sortBy,

            // Filter preferences
            filters: state.activeFilters,
            filterTemplates: state.filterTemplates,

            // Insights configuration
            insightsConfig: state.insights.config,
          },
        },
      });
    }
  }, [
    state.visibleColumns,
    state.pinnedColumns,
    state.pageSize,
    state.sortBy,
    state.activeFilters,
    state.filterTemplates,
    state.insights.config,
    state.collectionName,
    state.schema,
  ]);

  /**
   * Post message to extension
   */
  const postMessage = useCallback((message: WebviewMessage) => {
    vscode.postMessage(message);
  }, []);

  /**
   * Keyboard shortcuts
   */
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      // Refresh data (Ctrl+R)
      {
        key: 'r',
        ctrl: true,
        action: () => fetchObjects(),
        description: 'Refresh data',
      },
      // Export dialog (Ctrl+E)
      {
        key: 'e',
        ctrl: true,
        action: () => dispatch({ type: 'TOGGLE_EXPORT_DIALOG', payload: true }),
        description: 'Open export dialog',
      },
      // Toggle vector search (Ctrl+K)
      {
        key: 'k',
        ctrl: true,
        action: () =>
          dispatch({
            type: 'SET_VECTOR_SEARCH_ACTIVE',
            payload: !state.vectorSearch.isActive,
          }),
        description: 'Toggle vector search',
      },
      // Clear filters (Ctrl+Shift+Backspace)
      {
        key: 'Backspace',
        ctrl: true,
        shift: true,
        action: () => {
          dispatch({ type: 'CLEAR_FILTERS' });
          dispatch({ type: 'CLEAR_FILTER_GROUP' });
        },
        description: 'Clear all filters',
      },
      // Close modals/panels (Escape)
      {
        key: 'Escape',
        action: () => {
          if (state.showExportDialog) {
            dispatch({ type: 'TOGGLE_EXPORT_DIALOG', payload: false });
          } else if (state.showDetailPanel) {
            dispatch({ type: 'SELECT_OBJECT', payload: null });
          } else if (state.vectorSearch.isActive) {
            dispatch({ type: 'SET_VECTOR_SEARCH_ACTIVE', payload: false });
          }
        },
        description: 'Close modals, clear selection',
        preventDefault: false, // Allow default behavior in inputs
      },
      // Next page (Ctrl+N)
      {
        key: 'n',
        ctrl: true,
        action: () => {
          if (state.currentPage < Math.ceil(state.totalCount / state.pageSize) - 1) {
            dispatch({ type: 'SET_PAGE', payload: state.currentPage + 1 });
          }
        },
        description: 'Next page',
      },
      // Previous page (Ctrl+P)
      {
        key: 'p',
        ctrl: true,
        action: () => {
          if (state.currentPage > 0) {
            dispatch({ type: 'SET_PAGE', payload: state.currentPage - 1 });
          }
        },
        description: 'Previous page',
      },
    ],
    [
      fetchObjects,
      state.vectorSearch.isActive,
      state.showExportDialog,
      state.showDetailPanel,
      state.currentPage,
      state.totalCount,
      state.pageSize,
      dispatch,
    ]
  );

  useKeyboardShortcuts(shortcuts);

  /**
   * Context value (memoized to prevent unnecessary re-renders)
   */
  const contextValue = useMemo<DataExplorerContextType>(
    () => ({
      state,
      dispatch,
      fetchObjects,
      selectObject,
      postMessage,
    }),
    [state, fetchObjects, selectObject, postMessage]
  );

  return (
    <DataExplorerContext.Provider value={contextValue}>
      <div className="data-explorer" role="main" aria-label="Data Explorer">
        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
          {state.loading && 'Loading data...'}
          {!state.loading && state.objects.length > 0 && `Loaded ${state.totalCount} objects`}
          {!state.loading && state.objects.length === 0 && 'No objects found'}
        </div>

        {/* Keyboard shortcuts help (for screen readers) */}
        <div className="sr-only" role="region" aria-label="Keyboard shortcuts">
          <h2>Available keyboard shortcuts:</h2>
          <ul>
            <li>Control+R: Refresh data</li>
            <li>Control+E: Open export dialog</li>
            <li>Control+K: Toggle vector search</li>
            <li>Control+N: Next page</li>
            <li>Control+P: Previous page</li>
            <li>Control+Shift+Backspace: Clear all filters</li>
            <li>Escape: Close modals and panels</li>
          </ul>
        </div>

        {state.error && (
          <div className="error-banner" role="alert" aria-live="assertive">
            <span className="error-icon" aria-hidden="true">
              ⚠️
            </span>
            <span className="error-message">{state.error}</span>
            <button
              className="error-dismiss"
              onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
              aria-label="Dismiss error message"
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        <header className="explorer-header" role="banner">
          <h1 className="collection-name">
            {state.collectionName}
            <span className="object-count" aria-label={`${state.totalCount} objects in collection`}>
              {state.loading ? '...' : `${state.totalCount} objects`}
            </span>
          </h1>

          <nav className="explorer-actions" aria-label="Main actions">
            {/* Export button */}
            <button
              className="action-button"
              onClick={() => dispatch({ type: 'TOGGLE_EXPORT_DIALOG', payload: true })}
              aria-label="Export data (Control+E)"
              title="Export data (Ctrl+E)"
              type="button"
            >
              <span aria-hidden="true">💾</span> Export
            </button>

            {/* Toggle Vector Search button */}
            <button
              className="action-button"
              onClick={() =>
                dispatch({
                  type: 'SET_VECTOR_SEARCH_ACTIVE',
                  payload: !state.vectorSearch.isActive,
                })
              }
              aria-label={
                state.vectorSearch.isActive
                  ? 'Close Vector Search Panel (Control+K)'
                  : 'Open Vector Search Panel (Control+K)'
              }
              aria-expanded={state.vectorSearch.isActive}
              aria-controls="vector-search-panel"
              title={
                state.vectorSearch.isActive
                  ? 'Close Vector Search (Ctrl+K)'
                  : 'Open Vector Search (Ctrl+K)'
              }
              type="button"
            >
              <span aria-hidden="true">{state.vectorSearch.isActive ? '✕' : '🔮'}</span>
              {state.vectorSearch.isActive ? ' Close' : ' Vector Search'}
            </button>
          </nav>
        </header>

        {/* Schema Visualizer - Phase 5: Always visible for immediate schema reference */}
        {state.schema && (
          <ErrorBoundary featureName="Schema Visualizer">
            <SchemaVisualizer schema={state.schema} />
          </ErrorBoundary>
        )}

        {/* Quick Insights Panel - Phase 5: Always visible for collection overview */}
        <ErrorBoundary featureName="Quick Insights">
          <QuickInsightsPanel />
        </ErrorBoundary>

        {/* Filter panel */}
        <ErrorBoundary featureName="Filter Builder">
          <FilterBuilder />
        </ErrorBoundary>

        {/* Vector Search panel */}
        {state.vectorSearch.isActive && (
          <ErrorBoundary featureName="Vector Search">
            <VectorSearchPanel />
          </ErrorBoundary>
        )}

        <div className="explorer-content">
          {state.loading && !state.objects.length ? (
            <TableSkeleton rows={10} columns={state.visibleColumns.length || 5} />
          ) : !state.loading && state.objects.length === 0 ? (
            <EmptyState
              type="no-results"
              actions={[
                {
                  label: 'Clear Filters',
                  onClick: () => {
                    dispatch({ type: 'CLEAR_FILTERS' });
                    dispatch({ type: 'CLEAR_FILTER_GROUP' });
                  },
                  primary: true,
                },
                {
                  label: 'Refresh',
                  onClick: () => fetchObjects(),
                },
              ]}
            />
          ) : (
            <>
              <ErrorBoundary featureName="Data Table">
                <DataTable />
              </ErrorBoundary>
              {state.showDetailPanel && state.selectedObjectId && (
                <ErrorBoundary featureName="Object Detail Panel">
                  <ObjectDetailPanel />
                </ErrorBoundary>
              )}
            </>
          )}
        </div>

        {/* Export Dialog */}
        <ErrorBoundary featureName="Export Dialog">
          <ExportDialog />
        </ErrorBoundary>
      </div>
    </DataExplorerContext.Provider>
  );
}
