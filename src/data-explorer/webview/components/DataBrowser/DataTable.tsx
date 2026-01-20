/**
 * DataTable - Main table component
 * Displays collection objects in a sortable, selectable table
 */

import React, { useCallback, useMemo } from 'react';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { Pagination } from './Pagination';
import { ColumnManager } from './ColumnManager';
import { useDataExplorer } from '../../context/DataExplorerContext';
import { useDataFetch } from '../../hooks/useDataFetch';

interface DataTableProps {
  onOpenDetail: (uuid: string) => void;
}

export function DataTable({ onOpenDetail }: DataTableProps) {
  const { state, actions, sortedObjects, isAllSelected, displayedColumns } = useDataExplorer();
  const { refresh, isLoading } = useDataFetch();

  // Calculate if some but not all are selected
  const isSomeSelected = state.selectedRows.size > 0 && !isAllSelected;

  // Handle select all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      actions.selectAllRows(selected);
    },
    [actions]
  );

  // Handle row selection
  const handleSelectRow = useCallback(
    (uuid: string) => {
      actions.toggleRowSelection(uuid);
    },
    [actions]
  );

  // Handle row click (open detail panel)
  const handleRowClick = useCallback(
    (uuid: string) => {
      onOpenDetail(uuid);
    },
    [onOpenDetail]
  );

  // Toggle column manager
  const toggleColumnManager = useCallback(() => {
    actions.toggleColumnManager();
  }, [actions]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!sortedObjects.length) return;

      const currentIndex = state.selectedObjectId
        ? sortedObjects.findIndex((obj) => obj.uuid === state.selectedObjectId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < sortedObjects.length - 1) {
            const nextUuid = sortedObjects[currentIndex + 1].uuid;
            actions.selectObject(nextUuid);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const prevUuid = sortedObjects[currentIndex - 1].uuid;
            actions.selectObject(prevUuid);
          }
          break;

        case 'Enter':
          if (state.selectedObjectId) {
            onOpenDetail(state.selectedObjectId);
          }
          break;

        case 'Escape':
          actions.selectObject(null);
          actions.toggleDetailPanel(false);
          break;

        case ' ':
          e.preventDefault();
          if (state.selectedObjectId) {
            actions.toggleRowSelection(state.selectedObjectId);
          }
          break;
      }
    },
    [sortedObjects, state.selectedObjectId, actions, onOpenDetail]
  );

  // Render loading skeleton
  const renderSkeleton = () => (
    <tbody className="data-table-body skeleton">
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-row">
          <td className="data-cell checkbox-cell">
            <div className="skeleton-checkbox" />
          </td>
          {displayedColumns.slice(0, 4).map((_, colIndex) => (
            <td key={colIndex} className="data-cell">
              <div className="skeleton-cell" />
            </td>
          ))}
          <td className="data-cell actions-cell">
            <div className="skeleton-action" />
          </td>
        </tr>
      ))}
    </tbody>
  );

  // Render empty state
  const renderEmptyState = () => (
    <tbody className="data-table-body empty">
      <tr>
        <td colSpan={displayedColumns.length + 2} className="empty-cell">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No objects found</h3>
            <p>This collection is empty or no objects match your criteria.</p>
            <button className="refresh-btn" onClick={refresh}>
              🔄 Refresh Data
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  );

  // Render error state
  const renderErrorState = () => (
    <tbody className="data-table-body error">
      <tr>
        <td colSpan={displayedColumns.length + 2} className="error-cell">
          <div className="error-state" role="alert">
            <div className="error-icon">⚠️</div>
            <h3>Error loading data</h3>
            <p>{state.error}</p>
            <button className="retry-btn" onClick={refresh}>
              🔄 Retry
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  );

  return (
    <div className="data-table-container">
      {/* Toolbar */}
      <div className="data-table-toolbar">
        <div className="toolbar-left">
          <button
            className="toolbar-btn columns-btn"
            onClick={toggleColumnManager}
            title="Manage columns"
            aria-label="Manage columns"
          >
            ⚙️ Columns
          </button>
          <button
            className="toolbar-btn refresh-btn"
            onClick={refresh}
            disabled={isLoading}
            title="Refresh data"
            aria-label="Refresh data"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="toolbar-right">
          {state.selectedRows.size > 0 && (
            <span className="selection-info">
              {state.selectedRows.size} selected
              <button
                className="clear-selection-btn"
                onClick={() => actions.clearSelection()}
                title="Clear selection"
                aria-label="Clear selection"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="data-table-wrapper"
        role="grid"
        aria-label="Data table"
        aria-rowcount={sortedObjects.length}
        aria-busy={isLoading}
        onKeyDown={handleKeyDown}
      >
        <table className="data-table">
          <TableHeader
            onSelectAll={handleSelectAll}
            isAllSelected={isAllSelected}
            isSomeSelected={isSomeSelected}
          />

          {state.error ? (
            renderErrorState()
          ) : isLoading && sortedObjects.length === 0 ? (
            renderSkeleton()
          ) : sortedObjects.length === 0 ? (
            renderEmptyState()
          ) : (
            <tbody className="data-table-body">
              {sortedObjects.map((object) => (
                <TableRow
                  key={object.uuid}
                  object={object}
                  isSelected={state.selectedRows.has(object.uuid)}
                  onSelect={handleSelectRow}
                  onRowClick={handleRowClick}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination */}
      {!state.error && !isLoading && <Pagination />}

      {/* Column Manager Dialog */}
      <ColumnManager
        isOpen={state.showColumnManager}
        onClose={() => actions.toggleColumnManager(false)}
      />
    </div>
  );
}
