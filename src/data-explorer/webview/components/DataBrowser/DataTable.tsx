import React, { useMemo } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { CellRenderer } from './CellRenderer';
import { Pagination } from './Pagination';
import { ColumnManager } from './ColumnManager';
import type { PropertyDataType } from '../../../types';
import type { WeaviateObject } from 'weaviate-client';

/**
 * Main data table component
 */
export function DataTable() {
  const { state, selectObject } = useDataExplorer();

  if (!state.schema) {
    return <div className="no-schema">Loading schema...</div>;
  }

  // Get ordered columns: pinned first, then visible (memoized for performance)
  const orderedColumns = useMemo(() => {
    const pinnedColumns = state.pinnedColumns.filter((col) =>
      state.visibleColumns.includes(col)
    );
    const unpinnedColumns = state.visibleColumns.filter(
      (col) => !state.pinnedColumns.includes(col)
    );
    return [...pinnedColumns, ...unpinnedColumns];
  }, [state.pinnedColumns, state.visibleColumns]);

  // Get property info for columns
  const getPropertyInfo = (columnName: string) => {
    return state.schema!.properties.find((p) => p.name === columnName);
  };

  const handleRowClick = (objectId: string) => {
    selectObject(objectId);
  };

  const handleRowKeyPress = (e: React.KeyboardEvent, objectId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(objectId);
    }
  };

  const getObjectId = (obj: WeaviateObject<Record<string, unknown>, string>): string => {
    // Try different possible UUID locations
    return obj.uuid || (obj as any).id || (obj as any)._additional?.id || '';
  };

  const getPropertyValue = (obj: WeaviateObject<Record<string, unknown>, string>, propertyName: string): unknown => {
    // First try direct property access
    const objAny = obj as any;
    if (objAny.properties && propertyName in objAny.properties) {
      return objAny.properties[propertyName];
    }
    // Then try root level
    if (propertyName in objAny) {
      return objAny[propertyName];
    }
    return null;
  };

  return (
    <div className="data-table-container">
      <div className="data-table-toolbar">
        <ColumnManager />
        <div className="toolbar-spacer"></div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table" role="grid" aria-label="Data objects table">
          <thead>
            <tr role="row">
              <th role="columnheader" className="row-number-header">#</th>
              <th role="columnheader" className="uuid-header">UUID</th>
              {orderedColumns.map((columnName) => {
                const isPinned = state.pinnedColumns.includes(columnName);
                const property = getPropertyInfo(columnName);
                return (
                  <th
                    key={columnName}
                    role="columnheader"
                    className={`column-header ${isPinned ? 'pinned' : ''}`}
                    title={property?.description || columnName}
                    aria-sort="none"
                  >
                    <span className="column-name">{columnName}</span>
                    {property && (
                      <span className="column-type-badge">{property.dataType}</span>
                    )}
                    {isPinned && <span className="pin-indicator" aria-label="Pinned column">📌</span>}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {state.objects.length === 0 ? (
              <tr role="row">
                <td colSpan={orderedColumns.length + 2} className="no-data" role="cell">
                  {state.loading ? 'Loading objects...' : 'No objects found'}
                </td>
              </tr>
            ) : (
              state.objects.map((obj, index) => {
                const objectId = getObjectId(obj);
                const rowNumber = state.currentPage * state.pageSize + index + 1;
                const isSelected = state.selectedObjectId === objectId;

                return (
                  <tr
                    key={objectId || index}
                    role="row"
                    className={`data-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleRowClick(objectId)}
                    tabIndex={0}
                    onKeyPress={(e) => handleRowKeyPress(e, objectId)}
                    aria-selected={isSelected}
                    aria-label={`Object ${rowNumber}, UUID ${objectId.substring(0, 8)}`}
                  >
                    <td role="cell" className="row-number">{rowNumber}</td>
                    <td role="cell" className="uuid-cell">
                      <CellRenderer
                        value={objectId}
                        dataType="uuid"
                        propertyName="uuid"
                        objectId={objectId}
                      />
                    </td>
                    {orderedColumns.map((columnName) => {
                      const property = getPropertyInfo(columnName);
                      const value = getPropertyValue(obj, columnName);
                      const dataType = (property?.dataType || 'text') as PropertyDataType;

                      return (
                        <td key={columnName} role="cell" className="data-cell">
                          <CellRenderer
                            value={value}
                            dataType={dataType}
                            propertyName={columnName}
                            objectId={objectId}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination />
    </div>
  );
}
