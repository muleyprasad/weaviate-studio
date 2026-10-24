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
import { ImportDialog, ImportButton } from './components/Import';
import { EditObjectDialog } from './components/DataBrowser/EditObjectDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardShortcutsHelp } from './components/common';
import { TenantSelector, TenantSelectionModal } from './components/TenantSelector';
import { useDataFetch } from './hooks/useDataFetch';
import { useVectorSearch } from './hooks/useVectorSearch';
import { useDataExplorerShortcuts } from './hooks/useKeyboardShortcuts';
import type { WeaviateObject, PropertyConfig } from '../types';
import { postMessageToExtension } from './utils/vscodeApi';

// Get initial data from the window object (injected by the extension)
declare global {
  interface Window {
    initialData?: {
      collectionName: string;
      connectionId: string;
      targetUuid?: string;
      queryProfileEnabled?: boolean;
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
  const { isLoading, refresh } = useDataFetch();
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

  // Phase 6: Import dialog state
  const [showImportDialog, setShowImportDialog] = React.useState(false);

  const handleOpenImportDialog = useCallback(() => {
    setShowImportDialog(true);
  }, []);

  const handleCloseImportDialog = useCallback(() => {
    setShowImportDialog(false);
  }, []);

  const handleImported = useCallback(() => {
    refresh();
  }, [refresh]);

  // Phase 6: Row edit/delete state
  const [editingUuid, setEditingUuid] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleEditObject = useCallback((uuid: string) => {
    setDeleteError(null);
    setEditingUuid(uuid);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditingUuid(null);
  }, []);

  const handleEditSaved = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleDeleteObject = useCallback(
    (uuid: string) => {
      setDeleteError(null);
      postMessageToExtension({
        command: 'deleteObject',
        deleteObjectParams: {
          collectionName: dataState.collectionName,
          uuid,
        },
        requestId: `del-${Date.now()}`,
      });
    },
    [dataState.collectionName]
  );

  // Refresh the list after a row delete; surface delete failures inline
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command === 'objectDeleted') {
        refresh();
      } else if (message.command === 'error' && message.requestId?.startsWith('del-')) {
        setDeleteError(message.error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refresh]);

  // Handle opening detail panel
  const handleOpenDetail = useCallback(
    (uuid: string) => {
      uiActions.openDetailPanel(uuid);
    },
    [uiActions]
  );

  const handleCloseDetail = useCallback(() => {
    uiActions.closeDetailPanel();
  }, [uiActions]);

  // Get selected object (check both table data and search results)
  const selectedObject = useMemo(() => {
    if (!uiState.selectedObjectId) {
      return null;
    }
    // Check explicitly fetched object first (e.g., from deep link)
    if (dataState.fetchedObjectDetail?.uuid === uiState.selectedObjectId) {
      return dataState.fetchedObjectDetail;
    }
    // Then check table data
    const fromTable = dataState.objects.find((obj) => obj.uuid === uiState.selectedObjectId);
    if (fromTable) {
      return fromTable;
    }
    // Then check vector search results
    const fromSearch = vectorSearchState.searchResults.find(
      (result) => result.object.uuid === uiState.selectedObjectId
    );
    return fromSearch?.object || null;
  }, [
    uiState.selectedObjectId,
    dataState.objects,
    vectorSearchState.searchResults,
    dataState.fetchedObjectDetail,
  ]);

  const editingObject = React.useMemo(() => {
    if (!editingUuid) {
      return null;
    }
    const fromTable = dataState.objects.find((obj) => obj.uuid === editingUuid);
    if (fromTable) {
      return fromTable;
    }
    if (selectedObject?.uuid === editingUuid) {
      return selectedObject;
    }
    return null;
  }, [dataState.objects, editingUuid, selectedObject]);

  // Get schema properties for filter builder
  // Note: 'id' (UUID) is NOT included as a filterable property because Weaviate doesn't
  // support filtering by UUID through the standard filter API. Deep-linking to specific
  // objects is handled specially via fetchObjectById in the backend.
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
    if (showImportDialog) {
      setShowImportDialog(false);
    }
    if (editingUuid) {
      setEditingUuid(null);
    }
    if (uiState.showDetailPanel) {
      uiActions.closeDetailPanel();
    }
  }, [
    filterState.showFilterPanel,
    vectorSearchState.showVectorSearchPanel,
    showExportDialog,
    showImportDialog,
    editingUuid,
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

          {/* Generative Search button - opens Generative Search for this collection */}
          <button
            type="button"
            className="toolbar-btn rag-chat-btn"
            onClick={() =>
              postMessageToExtension({
                command: 'openRagChat',
                // Pass active filters so Generative Search can narrow retrieval context
                activeFilters:
                  filterState.activeFilters.length > 0 ? filterState.activeFilters : undefined,
                filterMatchMode:
                  filterState.activeFilters.length > 0 ? filterState.matchMode : undefined,
              })
            }
            title={
              filterState.activeFilters.length > 0
                ? `Generative Search with ${filterState.activeFilters.length} active filter${filterState.activeFilters.length > 1 ? 's' : ''}`
                : 'Open Generative Search for this collection'
            }
            aria-label="Open Generative Search for this collection"
            id="rag-chat-btn"
          >
            <span className="codicon codicon-comment-discussion" aria-hidden="true" />
            Generative Search
            {filterState.activeFilters.length > 0 && (
              <span className="rag-chat-filter-badge">{filterState.activeFilters.length}</span>
            )}
          </button>

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

          {/* Phase 6: Import button (writes are blocked on read-only connections) */}
          <ImportButton onClick={handleOpenImportDialog} disabled={dataState.readOnly} />

          {/* Refresh button */}
          <button
            type="button"
            className="toolbar-btn refresh-btn"
            onClick={refresh}
            disabled={isLoading}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <span
              className={`codicon codicon-refresh ${isLoading ? 'codicon-modifier-spin' : ''}`}
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              >
                <path d="M13.65 2.35A7.95 7.95 0 0 0 8 0a8 8 0 1 0 8 8h-1.5a6.5 6.5 0 1 1-1.9-4.6l-2.1 2.1h5.5V0l-2.35 2.35z" />
              </svg>
            </span>
            Refresh
          </button>

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
        {isLoading && (
          <div
            className={`loading-overlay${dataState.objects.length > 0 ? ' loading-overlay-transparent' : ''}`}
            role="status"
            aria-live="polite"
          >
            <div className="loading-spinner" />
            <span className="loading-message">Loading objects...</span>
          </div>
        )}

        {/* Phase 6: inline delete failure notice */}
        {deleteError && (
          <div className="export-error" role="alert">
            <span className="codicon codicon-error" aria-hidden="true"></span>
            <span>{deleteError}</span>
            <button
              type="button"
              className="dialog-close-btn"
              onClick={() => setDeleteError(null)}
              aria-label="Dismiss error"
            >
              <span className="codicon codicon-close" aria-hidden="true"></span>
            </button>
          </div>
        )}

        {/* Data table with error boundary */}
        <ErrorBoundary fallbackMessage="Failed to load data table">
          <DataTable
            onOpenDetail={handleOpenDetail}
            onFindSimilar={handleFindSimilar}
            onEditObject={handleEditObject}
            onDeleteObject={handleDeleteObject}
            refresh={refresh}
            isLoading={isLoading}
          />
        </ErrorBoundary>
      </main>

      {/* Detail panel with error boundary */}
      {uiState.showDetailPanel && (
        <ErrorBoundary fallbackMessage="Failed to load object details">
          <DetailPanel
            object={selectedObject}
            onClose={handleCloseDetail}
            onFindSimilar={handleFindSimilar}
            onEdit={handleEditObject}
            onDelete={handleDeleteObject}
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

      {/* Phase 6: Import dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={handleCloseImportDialog}
        collectionName={dataState.collectionName}
        onImported={handleImported}
      />

      {/* Phase 6: Edit object dialog */}
      <EditObjectDialog
        isOpen={editingUuid !== null}
        onClose={handleCloseEditDialog}
        collectionName={dataState.collectionName}
        object={editingObject}
        onSaved={handleEditSaved}
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
