/**
 * Context Module Exports
 *
 * This module provides three separate contexts for the Data Explorer:
 *
 * 1. DataContext - Data fetching and object state
 * 2. UIContext - UI state (columns, pagination, sorting, selection, panels)
 * 3. FilterContext - Filter state and operations (Phase 2)
 *
 * By splitting concerns, we prevent unnecessary re-renders:
 * - Filter changes don't re-render table rows
 * - Column width changes don't re-render data
 * - Selection changes don't re-render everything
 */

// Data Context
export {
  DataProvider,
  useDataContext,
  useDataState,
  useDataActions,
  type DataContextState,
  type DataContextActions,
} from './DataContext';

// UI Context
export {
  UIProvider,
  useUIContext,
  useUIState,
  useUIActions,
  type UIContextState,
  type UIContextActions,
} from './UIContext';

// Filter Context
export {
  FilterProvider,
  useFilterContext,
  useFilterState,
  useFilterActions,
  type FilterContextState,
  type FilterContextActions,
  type FilterCondition,
  type FilterOperator,
  type FilterPreset,
} from './FilterContext';

// Legacy export - will be removed after migration
export { DataExplorerProvider, useDataExplorer } from './DataExplorerContext';
