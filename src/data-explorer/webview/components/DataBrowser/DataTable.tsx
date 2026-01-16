import React from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { CellRenderer } from './CellRenderer';
import { Pagination } from './Pagination';
import { ColumnManager } from './ColumnManager';
import type { PropertyDataType } from '../../../types';

/**
 * Main data table component
 */
export function DataTable() {
  const { state, selectObject } = useDataExplorer();

  if (!state.schema) {
    return <div className="no-schema">Loading schema...</div>;
  }

  // Get ordered columns: pinned first, then visible
  const pinnedColumns = state.pinnedColumns.filter((col) =>
    state.visibleColumns.includes(col)
  );
  const unpinnedColumns = state.visibleColumns.filter(
    (col) => !state.pinnedColumns.includes(col)
  );
  const orderedColumns = [...pinnedColumns, ...unpinnedColumns];

  // Get property info for columns
  const getPropertyInfo = (columnName: string) => {
    return state.schema!.properties.find((p) => p.name === columnName);
  };

  const handleRowClick = (objectId: string) => {
    selectObject(objectId);
  };

  const getObjectId = (obj: any): string => {
    // Try different possible UUID locations
    return obj.uuid || obj.id || obj._additional?.id || '';
  };

  const getPropertyValue = (obj: any, propertyName: string): any => {
    // First try direct property access
    if (obj.properties && propertyName in obj.properties) {
      return obj.properties[propertyName];
    }
    // Then try root level
    if (propertyName in obj) {
      return obj[propertyName];
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
        <table className="data-table">
          <thead>
            <tr>
              <th className="row-number-header">#</th>
              <th className="uuid-header">UUID</th>
              {orderedColumns.map((columnName) => {
                const isPinned = state.pinnedColumns.includes(columnName);
                const property = getPropertyInfo(columnName);
                return (
                  <th
                    key={columnName}
                    className={`column-header ${isPinned ? 'pinned' : ''}`}
                    title={property?.description || columnName}
                  >
                    <span className="column-name">{columnName}</span>
                    {property && (
                      <span className="column-type-badge">{property.dataType}</span>
                    )}
                    {isPinned && <span className="pin-indicator">📌</span>}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {state.objects.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length + 2} className="no-data">
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
                    className={`data-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleRowClick(objectId)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleRowClick(objectId);
                      }
                    }}
                  >
                    <td className="row-number">{rowNumber}</td>
                    <td className="uuid-cell">
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
                        <td key={columnName} className="data-cell">
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
