/**
 * TableRow - Individual row component
 * Renders a single object row with type-specific cells
 */

import React, { useCallback, useState } from 'react';
import { CellRenderer } from './CellRenderer';
import type { WeaviateObject, CollectionConfig } from '../../../types';

interface TableRowProps {
  object: WeaviateObject;
  isSelected: boolean;
  displayedColumns: string[];
  schema: CollectionConfig | null;
  pinnedColumns: string[];
  columnWidths: Record<string, number>;
  onSelect: (uuid: string) => void;
  onRowClick: (uuid: string) => void;
  onFindSimilar?: (uuid: string) => void;
  onEdit?: (uuid: string) => void;
  onDelete?: (uuid: string) => void;
  readOnly?: boolean;
}

function TableRowComponent({
  object,
  isSelected,
  displayedColumns,
  schema,
  pinnedColumns,
  columnWidths,
  onSelect,
  onRowClick,
  onFindSimilar,
  onEdit,
  onDelete,
  readOnly = false,
}: TableRowProps) {
  // Two-step delete confirmation state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmingDelete(false);
      onEdit?.(object.uuid);
    },
    [onEdit, object.uuid]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmingDelete) {
        setConfirmingDelete(false);
        onDelete?.(object.uuid);
      } else {
        setConfirmingDelete(true);
      }
    },
    [confirmingDelete, onDelete, object.uuid]
  );

  const handleCancelDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDelete(false);
  }, []);

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
    const property = schema?.properties?.find((p) => p.name === column);
    return property?.dataType?.[0];
  };

  const isPinned = (column: string) => pinnedColumns.includes(column);

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
            width: columnWidths[column] ? `${columnWidths[column]}px` : undefined,
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
              type="button"
              className="row-action-btn find-similar-btn"
              onClick={handleFindSimilarClick}
              title="Find similar objects using vector search"
              aria-label="Find similar objects using vector search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M2 3h2v1H3v8h1v1H2V3zm10 0h2v10h-2v-1h1V4h-1V3zm-6 2h1v6H6V5zm3 0h1v6H9V5z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="row-action-btn view-btn"
            onClick={handleViewClick}
            title="View object details"
            aria-label="View object details"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 3C4.5 3 1.6 5.2.4 8c1.2 2.8 4.1 5 7.6 5s6.4-2.2 7.6-5c-1.2-2.8-4.1-5-7.6-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S6.1 4.5 8 4.5 11.5 6.1 11.5 8 9.9 11.5 8 11.5zm0-5.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                className="row-action-btn delete-confirm-btn"
                onClick={handleDeleteClick}
                title="Confirm delete"
                aria-label="Confirm delete"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13.85 3.65l-8 8a.5.5 0 0 1-.7 0l-4-4a.5.5 0 0 1 .7-.7L5.5 10.79l7.65-7.64a.5.5 0 0 1 .7.5z" />
                </svg>
              </button>
              <button
                type="button"
                className="row-action-btn"
                onClick={handleCancelDeleteClick}
                title="Cancel delete"
                aria-label="Cancel delete"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 7.29l3.15-3.14a.5.5 0 0 1 .7.7L8.71 8l3.14 3.15a.5.5 0 0 1-.7.7L8 8.71l-3.15 3.14a.5.5 0 0 1-.7-.7L7.29 8 4.15 4.85a.5.5 0 0 1 .7-.7L8 7.29z" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {onEdit && (
                <button
                  type="button"
                  className="row-action-btn edit-btn"
                  onClick={handleEditClick}
                  disabled={readOnly}
                  title={readOnly ? 'Editing is disabled on read-only connections' : 'Edit object'}
                  aria-label="Edit object"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M13.23 1A2.78 2.78 0 0 0 11.26 1.8L2 11.05V14h2.95l9.26-9.26a2.77 2.77 0 0 0 0-3.93 2.76 2.76 0 0 0-1.98-.81zm0 1c.47 0 .93.18 1.28.53a1.78 1.78 0 0 1 0 2.52L12.7 6.86 10.14 4.3l1.8-1.8a1.78 1.78 0 0 1 1.29-.5zM9.44 5L12 7.56 4.53 15.03H2v-2.53L9.44 5z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="row-action-btn delete-btn"
                  onClick={handleDeleteClick}
                  disabled={readOnly}
                  title={
                    readOnly ? 'Deleting is disabled on read-only connections' : 'Delete object'
                  }
                  aria-label="Delete object"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M11 2H9c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1H5c-.55 0-1 .45-1 1v1h8V3c0-.55-.45-1-1-1zm-6 3v9c0 .55.45 1 1 1h4c.55 0 1-.45 1-1V5H5zm2 8H6V7h1v6zm2 0H8V7h1v6zm2 0h-1V7h1v6z" />
                  </svg>
                </button>
              )}
            </>
          )}
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

  // Re-render if schema changes (affects data type hints)
  if (prevProps.schema !== nextProps.schema) {
    return false;
  }

  // Re-render if pinned columns change
  if (prevProps.pinnedColumns !== nextProps.pinnedColumns) {
    return false;
  }

  // Re-render if column widths reference changes
  if (prevProps.columnWidths !== nextProps.columnWidths) {
    return false;
  }

  // Re-render if read-only state changes (affects action buttons)
  if (prevProps.readOnly !== nextProps.readOnly) {
    return false;
  }

  // Re-render if action handlers change
  if (prevProps.onEdit !== nextProps.onEdit || prevProps.onDelete !== nextProps.onDelete) {
    return false;
  }

  // Props are equal, don't re-render
  return true;
}

export const TableRow = React.memo(TableRowComponent, arePropsEqual);
