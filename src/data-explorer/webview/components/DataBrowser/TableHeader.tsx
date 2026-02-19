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
          <div className="actions-header" aria-label="Actions">
            <span className="codicon codicon-gear" aria-hidden="true"></span>
          </div>
        </th>
      </tr>
    </thead>
  );
}
