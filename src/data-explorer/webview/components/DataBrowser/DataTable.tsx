/**
 * DataTable - Main table component
 * Displays collection objects in a sortable, selectable table
 */

import React, { useCallback, useMemo } from 'react';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { Pagination } from './Pagination';
import { ColumnManager } from './ColumnManager';
import { useDataState, useUIState, useUIActions } from '../../context';
import { useDataFetch } from '../../hooks/useDataFetch';

interface DataTableProps {
  onOpenDetail: (uuid: string) => void;
  onFindSimilar?: (uuid: string) => void;
}

export function DataTable({ onOpenDetail, onFindSimilar }: DataTableProps) {
  const dataState = useDataState();
  const uiState = useUIState();
  const uiActions = useUIActions();
  const { refresh, isLoading } = useDataFetch();

  // Get displayed columns from schema
  const displayedColumns = useMemo(() => {
    if (!dataState.schema) return [];

    const allColumns = ['uuid', ...(dataState.schema.properties || []).map((p) => p.name)];

    // If no custom visible columns set, show all
    if (uiState.visibleColumns.length === 0) {
      return allColumns;
    }

    // Filter to only visible columns
    return allColumns.filter((col) => uiState.visibleColumns.includes(col));
  }, [dataState.schema, uiState.visibleColumns]);

  // Calculate if all rows are selected
  const isAllSelected = useMemo(() => {
    return dataState.objects.length > 0 && uiState.selectedRows.size === dataState.objects.length;
  }, [dataState.objects.length, uiState.selectedRows.size]);

  // Calculate if some but not all are selected
  const isSomeSelected = uiState.selectedRows.size > 0 && !isAllSelected;

  // Handle select all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const allUuids = dataState.objects.map((obj) => obj.uuid);
        uiActions.selectAll(allUuids);
      } else {
        uiActions.clearSelection();
      }
    },
    [dataState.objects, uiActions]
  );

  // Handle row selection
  const handleSelectRow = useCallback(
    (uuid: string) => {
      uiActions.toggleRowSelection(uuid);
    },
    [uiActions]
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
    uiActions.toggleColumnManager();
  }, [uiActions]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!dataState.objects.length) return;

      const currentIndex = uiState.selectedObjectId
        ? dataState.objects.findIndex((obj) => obj.uuid === uiState.selectedObjectId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < dataState.objects.length - 1) {
            const nextUuid = dataState.objects[currentIndex + 1].uuid;
            uiActions.openDetailPanel(nextUuid);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const prevUuid = dataState.objects[currentIndex - 1].uuid;
            uiActions.openDetailPanel(prevUuid);
          }
          break;

        case 'Enter':
          if (uiState.selectedObjectId) {
            onOpenDetail(uiState.selectedObjectId);
          }
          break;

        case 'Escape':
          uiActions.closeDetailPanel();
          break;

        case ' ':
          e.preventDefault();
          if (uiState.selectedObjectId) {
            uiActions.toggleRowSelection(uiState.selectedObjectId);
          }
          break;
      }
    },
    [dataState.objects, uiState.selectedObjectId, uiActions, onOpenDetail]
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
            <p>{dataState.error}</p>
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
            className="toolbar-btn icon-btn refresh-btn"
            onClick={refresh}
            disabled={isLoading}
            title="Refresh"
            aria-label="Refresh data"
          >
            ↻
          </button>
        </div>

        <div className="toolbar-right">
          {uiState.selectedRows.size > 0 && (
            <span className="selection-info">
              {uiState.selectedRows.size} selected
              <button
                className="clear-selection-btn"
                onClick={() => uiActions.clearSelection()}
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
        aria-rowcount={dataState.objects.length}
        aria-busy={isLoading}
        onKeyDown={handleKeyDown}
      >
        <table className="data-table">
          <TableHeader
            onSelectAll={handleSelectAll}
            isAllSelected={isAllSelected}
            isSomeSelected={isSomeSelected}
            displayedColumns={displayedColumns}
          />

          {dataState.error ? (
            renderErrorState()
          ) : isLoading && dataState.objects.length === 0 ? (
            renderSkeleton()
          ) : dataState.objects.length === 0 ? (
            renderEmptyState()
          ) : (
            <tbody className="data-table-body">
              {dataState.objects.map((object) => (
                <TableRow
                  key={object.uuid}
                  object={object}
                  isSelected={uiState.selectedRows.has(object.uuid)}
                  displayedColumns={displayedColumns}
                  onSelect={handleSelectRow}
                  onRowClick={handleRowClick}
                  onFindSimilar={onFindSimilar}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination */}
      {!dataState.error && !isLoading && <Pagination />}

      {/* Column Manager Dialog */}
      <ColumnManager
        isOpen={uiState.showColumnManager}
        onClose={() => uiActions.toggleColumnManager()}
      />
    </div>
  );
}
