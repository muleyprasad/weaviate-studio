/**
 * TableHeader - Column headers with sort functionality
 * Displays column names with sort indicators and handles sort toggling
 */

import React, { useCallback } from 'react';
import { useUIState, useUIActions } from '../../context';

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

  const handleSort = useCallback(
    (column: string) => {
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
    [uiState.sortBy, uiActions]
  );

  const getSortIndicator = (column: string) => {
    if (uiState.sortBy?.field !== column) {
      return <span className="sort-indicator inactive">↕</span>;
    }
    return (
      <span className="sort-indicator active">
        {uiState.sortBy.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const isPinned = (column: string) => uiState.pinnedColumns.includes(column);

  return (
    <thead className="data-table-header">
      <tr role="row">
        {/* Checkbox column */}
        <th className="header-cell checkbox-cell" role="columnheader" aria-label="Select all rows">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) {
                input.indeterminate = isSomeSelected && !isAllSelected;
              }
            }}
            onChange={(e) => onSelectAll(e.target.checked)}
            aria-label="Select all rows"
          />
        </th>

        {/* Data columns */}
        {displayedColumns.map((column) => (
          <th
            key={column}
            className={`header-cell ${isPinned(column) ? 'pinned' : ''}`}
            role="columnheader"
            aria-sort={
              uiState.sortBy?.field === column
                ? uiState.sortBy.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            style={{
              width: uiState.columnWidths[column] ? `${uiState.columnWidths[column]}px` : undefined,
            }}
          >
            <button
              className="header-button"
              onClick={() => handleSort(column)}
              title={`Sort by ${column}`}
              aria-label={`Sort by ${column}`}
            >
              <span className="header-label">
                {isPinned(column) && (
                  <span className="pin-icon" title="Pinned column">
                    📌
                  </span>
                )}
                {column === 'uuid' ? '_id' : column}
              </span>
              {getSortIndicator(column)}
            </button>
          </th>
        ))}

        {/* Actions column */}
        <th className="header-cell actions-cell" role="columnheader" aria-label="Actions">
          Actions
        </th>
      </tr>
    </thead>
  );
}
