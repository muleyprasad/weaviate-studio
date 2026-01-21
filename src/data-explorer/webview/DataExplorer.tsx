/**
 * DataExplorer - Root component for the Data Explorer webview
 * Manages the overall layout and coordinates child components
 */

import React, { useCallback } from 'react';
import {
  DataProvider,
  UIProvider,
  FilterProvider,
  useDataState,
  useUIState,
  useUIActions,
  useFilterState,
  useFilterActions,
} from './context';
import { DataTable } from './components/DataBrowser/DataTable';
import { DetailPanel } from './components/ObjectDetail/DetailPanel';
import { FilterPanel, FilterChips } from './components/FilterBuilder';
import { useDataFetch } from './hooks/useDataFetch';

// Get initial data from the window object (injected by the extension)
declare global {
  interface Window {
    initialData?: {
      collectionName: string;
      connectionId: string;
    };
  }
}

function DataExplorerContent() {
  const dataState = useDataState();
  const uiState = useUIState();
  const uiActions = useUIActions();
  const filterState = useFilterState();
  const filterActions = useFilterActions();
  const { isLoading } = useDataFetch();

  // Handle opening detail panel
  const handleOpenDetail = useCallback(
    (uuid: string) => {
      uiActions.openDetailPanel(uuid);
    },
    [uiActions]
  );

  // Handle closing detail panel
  const handleCloseDetail = useCallback(() => {
    uiActions.closeDetailPanel();
  }, [uiActions]);

  // Get selected object
  const selectedObject = uiState.selectedObjectId
    ? dataState.objects.find((obj) => obj.uuid === uiState.selectedObjectId) || null
    : null;

  // Get schema properties for filter builder
  const schemaProperties = dataState.schema?.properties || [];

  return (
    <div className="data-explorer">
      {/* Header */}
      <header className="data-explorer-header">
        <div className="header-left">
          <div className="breadcrumb">
            <span className="breadcrumb-parent">Collections</span>
            <span className="breadcrumb-separator">/</span>
            <h1 className="breadcrumb-current">{dataState.collectionName}</h1>
          </div>
        </div>
        <div className="header-right">
          {/* Filter button */}
          <button
            type="button"
            className={`filter-toolbar-btn ${filterState.activeFilters.length > 0 ? 'active' : ''}`}
            onClick={filterActions.toggleFilterPanel}
            title="Open filter builder"
            aria-label="Open filter builder"
            aria-expanded={filterState.showFilterPanel}
          >
            <span className="codicon codicon-filter" aria-hidden="true"></span>
            Filters
            {filterState.activeFilters.length > 0 && (
              <span className="filter-count-badge">{filterState.activeFilters.length}</span>
            )}
          </button>
          {!isLoading && (
            <span className="object-count-badge">
              {dataState.totalCount.toLocaleString()} objects
            </span>
          )}
        </div>
      </header>

      {/* Active filter chips */}
      <FilterChips
        filters={filterState.activeFilters}
        onRemove={filterActions.removeFilter}
        onClearAll={filterActions.clearAllFilters}
        onChipClick={() => filterActions.openFilterPanel()}
      />

      {/* Main content */}
      <main className="data-explorer-main">
        {/* Loading indicator */}
        {isLoading && dataState.objects.length === 0 && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <span>Loading objects...</span>
          </div>
        )}

        {/* Data table */}
        <DataTable onOpenDetail={handleOpenDetail} />
      </main>

      {/* Detail panel */}
      {uiState.showDetailPanel && (
        <DetailPanel object={selectedObject} onClose={handleCloseDetail} />
      )}

      {/* Filter panel */}
      <FilterPanel isOpen={filterState.showFilterPanel} properties={schemaProperties} />
    </div>
  );
}

export function DataExplorer() {
  const initialCollectionName = window.initialData?.collectionName || '';

  return (
    <DataProvider initialCollectionName={initialCollectionName}>
      <UIProvider>
        <FilterProvider>
          <DataExplorerContent />
        </FilterProvider>
      </UIProvider>
    </DataProvider>
  );
}

export default DataExplorer;
