/**
 * TableRow - Individual row component
 * Renders a single object row with type-specific cells
 */

import React, { useCallback } from 'react';
import { CellRenderer } from './CellRenderer';
import { useDataState, useUIState } from '../../context';
import type { WeaviateObject } from '../../../types';

interface TableRowProps {
  object: WeaviateObject;
  isSelected: boolean;
  displayedColumns: string[];
  onSelect: (uuid: string) => void;
  onRowClick: (uuid: string) => void;
  onFindSimilar?: (uuid: string) => void;
}

function TableRowComponent({
  object,
  isSelected,
  displayedColumns,
  onSelect,
  onRowClick,
  onFindSimilar,
}: TableRowProps) {
  const dataState = useDataState();
  const uiState = useUIState();

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect(object.uuid);
    },
    [onSelect, object.uuid]
  );

  const handleRowClick = useCallback(() => {
    onRowClick(object.uuid);
  }, [onRowClick, object.uuid]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRowClick(object.uuid);
      }
    },
    [onRowClick, object.uuid]
  );

  const handleViewClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRowClick(object.uuid);
    },
    [onRowClick, object.uuid]
  );

  const handleFindSimilarClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFindSimilar?.(object.uuid);
    },
    [onFindSimilar, object.uuid]
  );

  const getCellValue = (column: string): unknown => {
    if (column === 'uuid') {
      return object.uuid;
    }
    return object.properties[column];
  };

  const getDataTypeHint = (column: string): string | undefined => {
    if (column === 'uuid') {
      return 'uuid';
    }
    const property = dataState.schema?.properties?.find((p) => p.name === column);
    return property?.dataType?.[0];
  };

  const isPinned = (column: string) => uiState.pinnedColumns.includes(column);

  return (
    <tr
      className={`data-row ${isSelected ? 'selected' : ''}`}
      role="row"
      aria-selected={isSelected}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Data cells */}
      {displayedColumns.map((column) => (
        <td
          key={column}
          className={`data-cell ${isPinned(column) ? 'pinned' : ''}`}
          role="gridcell"
          style={{
            width: uiState.columnWidths[column] ? `${uiState.columnWidths[column]}px` : undefined,
          }}
        >
          <CellRenderer
            value={getCellValue(column)}
            dataTypeHint={getDataTypeHint(column)}
            columnName={column}
          />
        </td>
      ))}

      {/* Actions cell */}
      <td className="data-cell actions-cell" role="gridcell">
        <div className="row-actions">
          {onFindSimilar && (
            <button
              className="row-action-btn find-similar-btn"
              onClick={handleFindSimilarClick}
              title="Find similar objects"
              aria-label="Find similar objects"
            >
              <span className="codicon codicon-search" aria-hidden="true"></span>
            </button>
          )}
          <button
            className="row-action-btn more-btn"
            onClick={handleViewClick}
            title="View details"
            aria-label="View details"
          >
            <span className="codicon codicon-eye" aria-hidden="true"></span>
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render if essential props change
 */
function arePropsEqual(prevProps: TableRowProps, nextProps: TableRowProps): boolean {
  // Always re-render if selection state changes
  if (prevProps.isSelected !== nextProps.isSelected) {
    return false;
  }

  // Re-render if object UUID changes (different object)
  if (prevProps.object.uuid !== nextProps.object.uuid) {
    return false;
  }

  // Re-render if displayed columns change
  if (prevProps.displayedColumns.length !== nextProps.displayedColumns.length) {
    return false;
  }

  // Check if column list is the same (order matters)
  for (let i = 0; i < prevProps.displayedColumns.length; i++) {
    if (prevProps.displayedColumns[i] !== nextProps.displayedColumns[i]) {
      return false;
    }
  }

  // Props are equal, don't re-render
  return true;
}

export const TableRow = React.memo(TableRowComponent, arePropsEqual);
