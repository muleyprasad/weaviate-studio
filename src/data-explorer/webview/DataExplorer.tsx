/**
 * DataExplorer - Root component for the Data Explorer webview
 * Manages the overall layout and coordinates child components
 */

import React, { useCallback, useEffect } from 'react';
import { DataExplorerProvider, useDataExplorer } from './context/DataExplorerContext';
import { DataTable } from './components/DataBrowser/DataTable';
import { DetailPanel } from './components/ObjectDetail/DetailPanel';
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
  const { state, actions, selectedObject } = useDataExplorer();
  const { refresh, isLoading, error } = useDataFetch();

  // Handle opening detail panel
  const handleOpenDetail = useCallback(
    (uuid: string) => {
      actions.selectObject(uuid);
    },
    [actions]
  );

  // Handle closing detail panel
  const handleCloseDetail = useCallback(() => {
    actions.selectObject(null);
    actions.toggleDetailPanel(false);
  }, [actions]);

  return (
    <div className="data-explorer">
      {/* Header */}
      <header className="data-explorer-header">
        <div className="header-left">
          <h1 className="collection-title">
            Collection: <span className="collection-name">{state.collectionName}</span>
          </h1>
          {!isLoading && (
            <span className="object-count">[{state.totalCount.toLocaleString()} objects]</span>
          )}
        </div>
        <div className="header-right">{/* Future: Add quick search here */}</div>
      </header>

      {/* Main content */}
      <main className="data-explorer-main">
        {/* Loading indicator */}
        {isLoading && state.objects.length === 0 && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <span>Loading objects...</span>
          </div>
        )}

        {/* Data table */}
        <DataTable onOpenDetail={handleOpenDetail} />
      </main>

      {/* Detail panel */}
      {state.showDetailPanel && <DetailPanel object={selectedObject} onClose={handleCloseDetail} />}
    </div>
  );
}

export function DataExplorer() {
  const initialCollectionName = window.initialData?.collectionName || '';

  return (
    <DataExplorerProvider initialCollectionName={initialCollectionName}>
      <DataExplorerContent />
    </DataExplorerProvider>
  );
}

export default DataExplorer;
