/**
 * ColumnManager - Show/hide columns dialog
 * Allows users to toggle column visibility and manage pinned columns
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDataExplorer } from '../../context/DataExplorerContext';

interface ColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ColumnManager({ isOpen, onClose }: ColumnManagerProps) {
  const { state, actions } = useDataExplorer();
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get all available columns
  const allColumns = ['uuid', ...(state.schema?.properties?.map((p) => p.name) || [])];

  // Filter columns based on search
  const filteredColumns = allColumns.filter((col) =>
    col.toLowerCase().includes(search.toLowerCase())
  );

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchInputRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleToggleColumn = useCallback(
    (column: string) => {
      actions.toggleColumn(column);
    },
    [actions]
  );

  const handleTogglePin = useCallback(
    (column: string) => {
      actions.togglePinColumn(column);
    },
    [actions]
  );

  const handleShowAll = useCallback(() => {
    allColumns.forEach((col) => {
      if (!state.visibleColumns.includes(col)) {
        actions.toggleColumn(col);
      }
    });
  }, [allColumns, state.visibleColumns, actions]);

  const handleHideAll = useCallback(() => {
    // Keep at least uuid visible
    state.visibleColumns.forEach((col) => {
      if (col !== 'uuid') {
        actions.toggleColumn(col);
      }
    });
  }, [state.visibleColumns, actions]);

  if (!isOpen) return null;

  return (
    <div className="column-manager-overlay" role="dialog" aria-label="Manage columns">
      <div className="column-manager-panel" ref={panelRef}>
        <div className="column-manager-header">
          <h3>Manage Columns</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close column manager">
            ✕
          </button>
        </div>

        <div className="column-manager-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search columns"
          />
        </div>

        <div className="column-manager-actions">
          <button className="action-btn" onClick={handleShowAll}>
            Show All
          </button>
          <button className="action-btn" onClick={handleHideAll}>
            Hide All
          </button>
        </div>

        <div className="column-manager-list">
          {filteredColumns.map((column) => {
            const isVisible = state.visibleColumns.includes(column);
            const isPinned = state.pinnedColumns.includes(column);
            const isUuid = column === 'uuid';

            return (
              <div
                key={column}
                className={`column-item ${isVisible ? 'visible' : 'hidden'} ${isPinned ? 'pinned' : ''}`}
              >
                <label className="column-checkbox">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => handleToggleColumn(column)}
                    disabled={isUuid && isVisible} // Can't hide uuid
                    aria-label={`Toggle ${column} visibility`}
                  />
                  <span className="column-name">{isUuid ? '_id (uuid)' : column}</span>
                </label>

                <button
                  className={`pin-btn ${isPinned ? 'pinned' : ''}`}
                  onClick={() => handleTogglePin(column)}
                  disabled={!isVisible}
                  title={isPinned ? 'Unpin column' : 'Pin column'}
                  aria-label={isPinned ? `Unpin ${column}` : `Pin ${column}`}
                >
                  📌
                </button>
              </div>
            );
          })}

          {filteredColumns.length === 0 && (
            <div className="no-columns">No columns match your search</div>
          )}
        </div>

        <div className="column-manager-footer">
          <span className="column-count">
            {state.visibleColumns.length} of {allColumns.length} columns visible
          </span>
        </div>
      </div>
    </div>
  );
}
