/**
 * DataTable - Main table component
 * Displays collection objects in a sortable, selectable table
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { Pagination } from './Pagination';
import { ColumnManager } from './ColumnManager';
import { NoObjectsEmptyState } from '../common';
import {
  useDataState,
  useUIState,
  useUIActions,
  useFilterState,
  useFilterActions,
} from '../../context';

interface DataTableProps {
  onOpenDetail: (uuid: string) => void;
  onFindSimilar?: (uuid: string) => void;
  refresh: () => void;
  isLoading: boolean;
}

export function DataTable({ onOpenDetail, onFindSimilar, refresh, isLoading }: DataTableProps) {
  const dataState = useDataState();
  const uiState = useUIState();
  const uiActions = useUIActions();
  const filterState = useFilterState();
  const filterActions = useFilterActions();

  // Ref for virtual scrolling container
  const tableBodyRef = useRef<HTMLDivElement>(null);

  // Get displayed columns from schema
  const displayedColumns = useMemo(() => {
    if (!dataState.schema) {
      return [];
    }

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
      if (!dataState.objects.length) {
        return;
      }

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

  // Virtual scrolling configuration
  const rowVirtualizer = useVirtualizer({
    count: dataState.objects.length,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => 40, // Estimated row height in pixels
    overscan: 10, // Number of items to render outside of the visible area
  });

  // Check if there are active filters
  const hasFilters = filterState.activeFilters.length > 0;

  // Clear all filters handler
  const handleClearFilters = useCallback(() => {
    filterActions.clearAllFilters();
  }, [filterActions]);

  // Render loading skeleton with improved shimmer animation
  const renderSkeleton = () => (
    <tbody className="data-table-body skeleton" role="status" aria-label="Loading data">
      {Array.from({ length: uiState.pageSize || 10 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-row">
          {/* Data cells */}
          {displayedColumns.slice(0, 5).map((_, colIndex) => (
            <td key={colIndex} className="data-cell">
              <div
                className="skeleton-shimmer"
                style={{
                  height: 16,
                  width: `${70 + Math.random() * 25}%`,
                  borderRadius: 4,
                }}
              />
            </td>
          ))}
          {/* Actions cell */}
          <td className="data-cell actions-cell">
            <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: 4 }} />
          </td>
        </tr>
      ))}
    </tbody>
  );

  // Render empty state using the new component
  const renderEmptyState = () => (
    <tbody className="data-table-body empty">
      <tr>
        <td colSpan={displayedColumns.length + 1} className="empty-cell">
          <NoObjectsEmptyState
            onRefresh={refresh}
            hasFilters={hasFilters}
            onClearFilters={handleClearFilters}
          />
        </td>
      </tr>
    </tbody>
  );

  // Render error state with improved styling
  const renderErrorState = () => (
    <tbody className="data-table-body error">
      <tr>
        <td colSpan={displayedColumns.length + 1} className="error-cell">
          <div className="error-boundary" role="alert">
            <span className="codicon codicon-error" aria-hidden="true"></span>
            <h3>Error loading data</h3>
            <p className="error-message">{dataState.error}</p>
            <button
              type="button"
              className="error-retry-btn"
              onClick={refresh}
              aria-label="Retry loading data"
            >
              <span className="codicon codicon-refresh" aria-hidden="true"></span>
              Retry
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  );

  return (
    <div className="data-table-container">
      {/* Table */}
      <div
        ref={tableBodyRef}
        className="data-table-wrapper"
        role="grid"
        aria-label="Data table"
        aria-rowcount={dataState.objects.length}
        aria-busy={isLoading}
        onKeyDown={handleKeyDown}
        style={{
          height: '600px',
          overflow: 'auto',
        }}
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
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const object = dataState.objects[virtualRow.index];
                return (
                  <TableRow
                    key={object.uuid}
                    object={object}
                    isSelected={uiState.selectedRows.has(object.uuid)}
                    displayedColumns={displayedColumns}
                    schema={dataState.schema}
                    pinnedColumns={uiState.pinnedColumns}
                    columnWidths={uiState.columnWidths}
                    onSelect={handleSelectRow}
                    onRowClick={handleRowClick}
                    onFindSimilar={onFindSimilar}
                  />
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination */}
      {!dataState.error && <Pagination />}

      {/* Column Manager Dialog */}
      <ColumnManager
        isOpen={uiState.showColumnManager}
        onClose={() => uiActions.toggleColumnManager()}
      />
    </div>
  );
}
