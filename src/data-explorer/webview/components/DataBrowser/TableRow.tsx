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
              <span className="codicon codicon-symbol-array" aria-hidden="true"></span>
            </button>
          )}
          <button
            type="button"
            className="row-action-btn view-btn"
            onClick={handleViewClick}
            title="View object details"
            aria-label="View object details"
          >
            <span className="codicon codicon-eye" aria-hidden="true"></span>
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
                <span className="codicon codicon-check" aria-hidden="true"></span>
              </button>
              <button
                type="button"
                className="row-action-btn"
                onClick={handleCancelDeleteClick}
                title="Cancel delete"
                aria-label="Cancel delete"
              >
                <span className="codicon codicon-close" aria-hidden="true"></span>
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
                  <span className="codicon codicon-edit" aria-hidden="true"></span>
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
                  <span className="codicon codicon-trash" aria-hidden="true"></span>
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
