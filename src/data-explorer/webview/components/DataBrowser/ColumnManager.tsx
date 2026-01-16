import React, { useState } from 'react';
import { useDataExplorer } from '../../DataExplorer';

/**
 * Column Manager component for showing/hiding columns
 */
export function ColumnManager() {
  const { state, dispatch } = useDataExplorer();
  const [isOpen, setIsOpen] = useState(false);

  if (!state.schema) {
    return null;
  }

  const allColumns = state.schema.properties.map((p) => p.name);
  const visibleCount = state.visibleColumns.length;
  const totalCount = allColumns.length;

  const toggleColumn = (columnName: string) => {
    dispatch({ type: 'TOGGLE_COLUMN', payload: columnName });
  };

  const showAll = () => {
    dispatch({ type: 'SET_VISIBLE_COLUMNS', payload: allColumns });
  };

  const hideAll = () => {
    // Keep at least one column visible
    if (allColumns.length > 0) {
      dispatch({ type: 'SET_VISIBLE_COLUMNS', payload: [allColumns[0]] });
    }
  };

  const togglePinColumn = (columnName: string) => {
    if (state.pinnedColumns.includes(columnName)) {
      dispatch({ type: 'UNPIN_COLUMN', payload: columnName });
    } else {
      dispatch({ type: 'PIN_COLUMN', payload: columnName });
    }
  };

  return (
    <div className="column-manager">
      <button
        className="column-manager-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Manage columns"
        aria-expanded={isOpen}
      >
        👁️ Columns ({visibleCount}/{totalCount})
      </button>

      {isOpen && (
        <div className="column-manager-dropdown">
          <div className="column-manager-header">
            <span className="header-title">Manage Columns</span>
            <button className="close-button" onClick={() => setIsOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="column-manager-actions">
            <button className="action-button" onClick={showAll}>
              Show All
            </button>
            <button className="action-button" onClick={hideAll}>
              Hide All
            </button>
          </div>

          <div className="column-list">
            {allColumns.map((columnName) => {
              const isVisible = state.visibleColumns.includes(columnName);
              const isPinned = state.pinnedColumns.includes(columnName);
              const property = state.schema!.properties.find((p) => p.name === columnName);

              return (
                <div key={columnName} className="column-item">
                  <label className="column-checkbox">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleColumn(columnName)}
                    />
                    <span className="column-name">{columnName}</span>
                    {property && (
                      <span className="column-type">{property.dataType}</span>
                    )}
                  </label>

                  <button
                    className={`pin-button ${isPinned ? 'pinned' : ''}`}
                    onClick={() => togglePinColumn(columnName)}
                    aria-label={isPinned ? 'Unpin column' : 'Pin column'}
                    title={isPinned ? 'Unpin' : 'Pin to left'}
                  >
                    📌
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
