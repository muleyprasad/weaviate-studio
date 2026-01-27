/**
 * DataExplorer - Root component for the Data Explorer webview
 * Manages the overall layout and coordinates child components
 */

import React, { useCallback, useMemo } from 'react';
import {
  DataProvider,
  UIProvider,
  FilterProvider,
  VectorSearchProvider,
  useDataState,
  useUIState,
  useUIActions,
  useFilterState,
  useFilterActions,
  useVectorSearchState,
  useVectorSearchActions,
} from './context';
import { DataTable } from './components/DataBrowser/DataTable';
import { DetailPanel } from './components/ObjectDetail/DetailPanel';
import { FilterPanel, FilterChips } from './components/FilterBuilder';
import { VectorSearchPanel } from './components/VectorSearch';
import { ExportDialog, ExportButton } from './components/Export';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardShortcutsHelp } from './components/common';
import { TenantSelector, TenantSelectionModal } from './components/TenantSelector';
import { useDataFetch } from './hooks/useDataFetch';
import { useVectorSearch } from './hooks/useVectorSearch';
import { useDataExplorerShortcuts } from './hooks/useKeyboardShortcuts';
import type { WeaviateObject } from '../types';

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
  const vectorSearchState = useVectorSearchState();
  const vectorSearchActions = useVectorSearchActions();
  const { isLoading } = useDataFetch();
  const { executeSearch } = useVectorSearch();

  // Phase 5: Export dialog state
  const [showExportDialog, setShowExportDialog] = React.useState(false);

  // Open/close export dialog handlers
  const handleOpenExportDialog = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const handleCloseExportDialog = useCallback(() => {
    setShowExportDialog(false);
  }, []);

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

  // Get selected object (check both table data and search results)
  const selectedObject = useMemo(() => {
    if (!uiState.selectedObjectId) {
      return null;
    }
    // First check table data
    const fromTable = dataState.objects.find((obj) => obj.uuid === uiState.selectedObjectId);
    if (fromTable) {
      return fromTable;
    }
    // Then check vector search results
    const fromSearch = vectorSearchState.searchResults.find(
      (result) => result.object.uuid === uiState.selectedObjectId
    );
    return fromSearch?.object || null;
  }, [uiState.selectedObjectId, dataState.objects, vectorSearchState.searchResults]);

  // Get schema properties for filter builder
  const schemaProperties = dataState.schema?.properties || [];

  // Handle vector search result selection
  const handleVectorResultSelect = useCallback(
    (object: WeaviateObject) => {
      uiActions.openDetailPanel(object.uuid);
    },
    [uiActions]
  );

  // Handle vector search execution
  const handleVectorSearch = useCallback(() => {
    executeSearch();
  }, [executeSearch]);

  // Get pre-selected object for vector search (when "Find Similar" is clicked)
  const preSelectedObject = useMemo(() => {
    if (vectorSearchState.preSelectedObjectId) {
      return (
        dataState.objects.find((obj) => obj.uuid === vectorSearchState.preSelectedObjectId) || null
      );
    }
    return null;
  }, [vectorSearchState.preSelectedObjectId, dataState.objects]);

  // Handle "Find Similar" action from table or detail panel
  const handleFindSimilar = useCallback(
    (objectId: string) => {
      vectorSearchActions.findSimilar(objectId);
    },
    [vectorSearchActions]
  );

  // Get refresh function from useDataFetch
  const { refresh } = useDataFetch();

  // Close all panels handler
  const handleCloseAllPanels = useCallback(() => {
    if (filterState.showFilterPanel) {
      filterActions.closeFilterPanel();
    }
    if (vectorSearchState.showVectorSearchPanel) {
      vectorSearchActions.closeVectorSearchPanel();
    }
    if (showExportDialog) {
      setShowExportDialog(false);
    }
    if (uiState.showDetailPanel) {
      uiActions.closeDetailPanel();
    }
  }, [
    filterState.showFilterPanel,
    vectorSearchState.showVectorSearchPanel,
    showExportDialog,
    uiState.showDetailPanel,
    filterActions,
    vectorSearchActions,
    uiActions,
  ]);

  // Register keyboard shortcuts
  useDataExplorerShortcuts({
    onToggleFilters: filterActions.toggleFilterPanel,
    onToggleVectorSearch: vectorSearchActions.toggleVectorSearchPanel,
    onOpenExport: handleOpenExportDialog,
    onClosePanel: handleCloseAllPanels,
    onRefresh: refresh,
  });

  return (
    <div className="data-explorer">
      {/* Skip link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

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
          {/* Tenant selector for multi-tenant collections */}
          <TenantSelector />

          {/* Vector Search button */}
          <button
            type="button"
            className={`vector-search-toolbar-btn ${vectorSearchState.showVectorSearchPanel ? 'active' : ''}`}
            onClick={vectorSearchActions.toggleVectorSearchPanel}
            title="Open vector search (Ctrl+K)"
            aria-label="Open vector search"
            aria-expanded={vectorSearchState.showVectorSearchPanel}
          >
            <span className="codicon codicon-search" aria-hidden="true"></span>
            Vector Search
          </button>

          {/* Filter button */}
          <button
            type="button"
            className={`filter-toolbar-btn ${filterState.activeFilters.length > 0 ? 'active' : ''}`}
            onClick={filterActions.toggleFilterPanel}
            title="Open filter builder (Ctrl+F)"
            aria-label="Open filter builder"
            aria-expanded={filterState.showFilterPanel}
          >
            <span className="codicon codicon-filter" aria-hidden="true"></span>
            Filters
            {filterState.activeFilters.length > 0 && (
              <span className="filter-count-badge">{filterState.activeFilters.length}</span>
            )}
          </button>

          {/* Export button */}
          <ExportButton
            onClick={handleOpenExportDialog}
            disabled={dataState.objects.length === 0}
          />

          {/* Column manager button */}
          <button
            type="button"
            className="toolbar-btn columns-btn"
            onClick={() => uiActions.toggleColumnManager()}
            title="Manage columns"
            aria-label="Manage columns"
            aria-expanded={uiState.showColumnManager}
          >
            <span className="codicon codicon-list-unordered" aria-hidden="true"></span>
            Columns
          </button>

          {/* Keyboard shortcuts help - with visible icon */}
          <KeyboardShortcutsHelp />

          <span className="object-count-badge">
            {isLoading ? '...' : dataState.totalCount.toLocaleString()} objects
          </span>
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
      <main id="main-content" className="data-explorer-main">
        {/* Loading indicator */}
        {isLoading && dataState.objects.length === 0 && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <span className="loading-message">Loading objects...</span>
          </div>
        )}

        {/* Data table with error boundary */}
        <ErrorBoundary fallbackMessage="Failed to load data table">
          <DataTable onOpenDetail={handleOpenDetail} onFindSimilar={handleFindSimilar} />
        </ErrorBoundary>
      </main>

      {/* Detail panel with error boundary */}
      {uiState.showDetailPanel && (
        <ErrorBoundary fallbackMessage="Failed to load object details">
          <DetailPanel
            object={selectedObject}
            onClose={handleCloseDetail}
            onFindSimilar={handleFindSimilar}
          />
        </ErrorBoundary>
      )}

      {/* Filter panel with error boundary */}
      <ErrorBoundary fallbackMessage="Failed to load filter panel">
        <FilterPanel isOpen={filterState.showFilterPanel} properties={schemaProperties} />
      </ErrorBoundary>

      {/* Vector Search panel with error boundary */}
      <ErrorBoundary fallbackMessage="Failed to load vector search">
        <VectorSearchPanel
          isOpen={vectorSearchState.showVectorSearchPanel}
          schema={dataState.schema}
          onResultSelect={handleVectorResultSelect}
          onSearch={handleVectorSearch}
          preSelectedObject={preSelectedObject}
        />
      </ErrorBoundary>

      {/* Export dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={handleCloseExportDialog}
        collectionName={dataState.collectionName}
        currentPageCount={dataState.objects.length}
        filteredCount={dataState.totalCount}
        totalCount={dataState.totalCount}
        unfilteredTotalCount={dataState.unfilteredTotalCount}
        currentObjects={dataState.objects}
        hasFilters={filterState.activeFilters.length > 0}
        where={filterState.activeFilters}
        matchMode={filterState.matchMode}
      />

      {/* Tenant selection modal for multi-tenant collections */}
      <TenantSelectionModal />
    </div>
  );
}

export function DataExplorer() {
  const initialCollectionName = window.initialData?.collectionName || '';

  return (
    <DataProvider initialCollectionName={initialCollectionName}>
      <UIProvider>
        <FilterProvider>
          <VectorSearchProvider>
            <DataExplorerContent />
          </VectorSearchProvider>
        </FilterProvider>
      </UIProvider>
    </DataProvider>
  );
}

export default DataExplorer;
