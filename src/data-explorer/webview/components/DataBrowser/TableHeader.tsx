/**
 * TableHeader - Column headers with sort functionality
 * Displays column names with sort indicators and handles sort toggling
 */

import React, { useCallback } from 'react';
import { useDataExplorer } from '../../context/DataExplorerContext';

interface TableHeaderProps {
  onSelectAll: (selected: boolean) => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
}

export function TableHeader({ onSelectAll, isAllSelected, isSomeSelected }: TableHeaderProps) {
  const { state, actions, displayedColumns } = useDataExplorer();

  const handleSort = useCallback(
    (column: string) => {
      const currentSort = state.sortBy;

      if (currentSort?.field === column) {
        // Toggle direction or clear sort
        if (currentSort.direction === 'asc') {
          actions.setSort({ field: column, direction: 'desc' });
        } else {
          actions.setSort(null);
        }
      } else {
        // New sort column
        actions.setSort({ field: column, direction: 'asc' });
      }
    },
    [state.sortBy, actions]
  );

  const getSortIndicator = (column: string) => {
    if (state.sortBy?.field !== column) {
      return <span className="sort-indicator inactive">↕</span>;
    }
    return (
      <span className="sort-indicator active">{state.sortBy.direction === 'asc' ? '↑' : '↓'}</span>
    );
  };

  const isPinned = (column: string) => state.pinnedColumns.includes(column);

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
              state.sortBy?.field === column
                ? state.sortBy.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            style={{
              width: state.columnWidths[column] ? `${state.columnWidths[column]}px` : undefined,
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
