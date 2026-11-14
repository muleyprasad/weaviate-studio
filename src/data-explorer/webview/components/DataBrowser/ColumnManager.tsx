/**
 * ColumnManager - Show/hide columns dialog
 * Allows users to toggle column visibility and manage pinned columns
 */

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { useDataState, useUIState, useUIActions } from '../../context';

interface ColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ColumnManager({ isOpen, onClose }: ColumnManagerProps) {
  const dataState = useDataState();
  const uiState = useUIState();
  const uiActions = useUIActions();
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get all available columns
  const allColumns = useMemo(() => {
    return ['uuid', ...(dataState.schema?.properties?.map((p) => p.name) || [])];
  }, [dataState.schema]);

  // Empty `visibleColumns` means "show every column", so resolve that default here.
  // Otherwise no checkbox appears checked, and toggling one column would hide all the others.
  const effectiveVisibleColumns = useMemo(
    () => (uiState.visibleColumns.length === 0 ? allColumns : uiState.visibleColumns),
    [allColumns, uiState.visibleColumns]
  );

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    return allColumns.filter((col) => col.toLowerCase().includes(search.toLowerCase()));
  }, [allColumns, search]);

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
      const isVisible = effectiveVisibleColumns.includes(column);
      const nextColumns = isVisible
        ? effectiveVisibleColumns.filter((col) => col !== column)
        : [...effectiveVisibleColumns, column];
      // Persist the list in schema order so the table keeps its column order.
      uiActions.setVisibleColumns(allColumns.filter((col) => nextColumns.includes(col)));
    },
    [allColumns, effectiveVisibleColumns, uiActions]
  );

  const handleTogglePin = useCallback(
    (column: string) => {
      if (uiState.pinnedColumns.includes(column)) {
        uiActions.unpinColumn(column);
      } else {
        uiActions.pinColumn(column);
      }
    },
    [uiState.pinnedColumns, uiActions]
  );

  const handleShowAll = useCallback(() => {
    uiActions.setVisibleColumns(allColumns);
  }, [allColumns, uiActions]);

  const handleHideAll = useCallback(() => {
    // Keep at least uuid visible
    uiActions.setVisibleColumns(allColumns.filter((col) => col === 'uuid'));
  }, [allColumns, uiActions]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="column-manager-overlay" role="dialog" aria-label="Manage columns">
      <div className="column-manager-panel" ref={panelRef}>
        <div className="column-manager-header">
          <h3>Manage Columns</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close column manager">
            <span className="codicon codicon-close" aria-hidden="true"></span>
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
            const isVisible = effectiveVisibleColumns.includes(column);
            const isPinned = uiState.pinnedColumns.includes(column);
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
                  <span className="codicon codicon-pin" aria-hidden="true"></span>
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
            {effectiveVisibleColumns.length} of {allColumns.length} columns visible
          </span>
        </div>
      </div>
    </div>
  );
}
