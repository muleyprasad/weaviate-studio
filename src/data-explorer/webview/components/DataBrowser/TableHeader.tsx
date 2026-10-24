/**
 * TableHeader - Column headers with sort functionality
 * Displays column names with sort indicators and handles sort toggling
 */

import React, { useCallback } from 'react';
import { useUIState, useUIActions, useDataState } from '../../context';
import { isSortableColumn, getSortabilityMessage } from '../../utils/sortingUtils';

interface TableHeaderProps {
  onSelectAll: (selected: boolean) => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  displayedColumns: string[];
}

export function TableHeader({
  onSelectAll,
  isAllSelected,
  isSomeSelected,
  displayedColumns,
}: TableHeaderProps) {
  const uiState = useUIState();
  const uiActions = useUIActions();
  const dataState = useDataState();

  // Check if a column is sortable based on its data type
  const isSortable = useCallback(
    (column: string) => {
      return isSortableColumn(column, dataState.schema);
    },
    [dataState.schema]
  );

  const handleSort = useCallback(
    (column: string) => {
      // Validate sortability before allowing sort
      if (!isSortable(column)) {
        return;
      }

      const currentSort = uiState.sortBy;

      if (currentSort?.field === column) {
        // Toggle direction or clear sort
        if (currentSort.direction === 'asc') {
          uiActions.setSortBy({ field: column, direction: 'desc' });
        } else {
          uiActions.setSortBy(null);
        }
      } else {
        // New sort column
        uiActions.setSortBy({ field: column, direction: 'asc' });
      }
    },
    [uiState.sortBy, uiActions, isSortable]
  );

  const getSortIndicator = (column: string) => {
    const isActive = uiState.sortBy?.field === column;
    const canSort = isSortable(column);

    // Don't show indicator for non-sortable columns
    if (!canSort) {
      return null;
    }

    if (!isActive) {
      // Show only on hover (controlled by CSS)
      return (
        <span className="sort-indicator inactive" aria-hidden="true">
          ↕
        </span>
      );
    }

    if (!uiState.sortBy) {
      return null;
    }

    return (
      <span
        className="sort-indicator active"
        role="img"
        aria-label={`Sorted ${uiState.sortBy.direction}ending`}
      >
        {uiState.sortBy.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const isPinned = (column: string) => uiState.pinnedColumns.includes(column);

  return (
    <thead className="data-table-header">
      <tr role="row">
        {/* Data columns */}
        {displayedColumns.map((column) => {
          const canSort = isSortable(column);
          const sortabilityMsg = getSortabilityMessage(column, dataState.schema);

          const isSorted = uiState.sortBy?.field === column;

          return (
            <th
              key={column}
              className={`header-cell ${isPinned(column) ? 'pinned' : ''}`}
              role="columnheader"
              aria-sort={
                isSorted && uiState.sortBy
                  ? uiState.sortBy.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
              style={{
                width: uiState.columnWidths[column]
                  ? `${uiState.columnWidths[column]}px`
                  : undefined,
                backgroundColor: 'transparent',
                borderBottom: isSorted
                  ? '3px solid var(--vscode-textLink-foreground, #3794ff)'
                  : '2px solid var(--vscode-panel-border, #333)',
              }}
            >
              <button
                className={`header-button ${!canSort ? 'non-sortable' : ''}`}
                onClick={() => handleSort(column)}
                disabled={!canSort}
                title={canSort ? `Sort by ${column}` : sortabilityMsg || 'Cannot sort this column'}
                aria-label={canSort ? `Sort by ${column}` : `${column} - ${sortabilityMsg}`}
              >
                <span className="header-label">
                  {isPinned(column) && (
                    <span className="pin-icon" title="Pinned column">
                      📌
                    </span>
                  )}
                  {column === 'uuid' ? 'ID' : column}
                </span>
                {getSortIndicator(column)}
              </button>
            </th>
          );
        })}

        {/* Actions column */}
        <th className="header-cell actions-cell" role="columnheader">
          <div className="actions-header" aria-label="Actions" title="Row actions">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              style={{ verticalAlign: 'middle' }}
            >
              <path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.5.5v1.2l2.5.5.3.8-1.4 1.9.8.8 2-1.3.8.3.4 2.5h1.2l.5-2.5.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V7.4l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3-.7-.3zM8 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
            </svg>
            <span className="actions-header-label">Actions</span>
          </div>
        </th>
      </tr>
    </thead>
  );
}
