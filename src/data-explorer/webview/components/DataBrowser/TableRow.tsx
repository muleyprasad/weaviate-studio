/**
 * TableRow - Individual row component
 * Renders a single object row with type-specific cells
 */

import React, { useCallback } from 'react';
import { CellRenderer } from './CellRenderer';
import { useDataExplorer } from '../../context/DataExplorerContext';
import type { WeaviateObject } from '../../../types';

interface TableRowProps {
  object: WeaviateObject;
  isSelected: boolean;
  onSelect: (uuid: string) => void;
  onRowClick: (uuid: string) => void;
}

export function TableRow({ object, isSelected, onSelect, onRowClick }: TableRowProps) {
  const { state, displayedColumns } = useDataExplorer();

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
    const property = state.schema?.properties?.find((p) => p.name === column);
    return property?.dataType?.[0];
  };

  const isPinned = (column: string) => state.pinnedColumns.includes(column);

  return (
    <tr
      className={`data-row ${isSelected ? 'selected' : ''}`}
      role="row"
      aria-selected={isSelected}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Checkbox cell */}
      <td className="data-cell checkbox-cell" role="gridcell">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select row ${object.uuid}`}
        />
      </td>

      {/* Data cells */}
      {displayedColumns.map((column) => (
        <td
          key={column}
          className={`data-cell ${isPinned(column) ? 'pinned' : ''}`}
          role="gridcell"
          style={{
            width: state.columnWidths[column] ? `${state.columnWidths[column]}px` : undefined,
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
        <button
          className="row-action-btn view-btn"
          onClick={handleViewClick}
          title="View object details"
          aria-label="View object details"
        >
          👁️
        </button>
      </td>
    </tr>
  );
}
