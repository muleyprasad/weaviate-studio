import React, { useState, useRef, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';

/**
 * Column Manager component for showing/hiding columns
 */
export function ColumnManager() {
  const { state, dispatch } = useDataExplorer();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const closeDropdown = () => {
    setIsOpen(false);
    // Return focus to trigger button
    buttonRef.current?.focus();
  };

  // Handle escape key to close dropdown
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeDropdown();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="column-manager">
      <button
        ref={buttonRef}
        className="column-manager-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Manage columns"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        👁️ Columns ({visibleCount}/{totalCount})
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="column-manager-dropdown"
          role="dialog"
          aria-labelledby="column-manager-title"
          aria-modal="false"
        >
          <div className="column-manager-header">
            <span id="column-manager-title" className="header-title">Manage Columns</span>
            <button
              className="close-button"
              onClick={closeDropdown}
              aria-label="Close column manager"
            >
              ✕
            </button>
          </div>

          <div className="column-manager-actions">
            <button className="action-button" onClick={showAll} aria-label="Show all columns">
              Show All
            </button>
            <button className="action-button" onClick={hideAll} aria-label="Hide all columns except one">
              Hide All
            </button>
          </div>

          <div className="column-list" role="group" aria-label="Column visibility list">
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
                      aria-label={`${isVisible ? 'Hide' : 'Show'} column ${columnName}`}
                    />
                    <span className="column-name">{columnName}</span>
                    {property && (
                      <span className="column-type" aria-label={`Type: ${property.dataType}`}>
                        {property.dataType}
                      </span>
                    )}
                  </label>

                  <button
                    className={`pin-button ${isPinned ? 'pinned' : ''}`}
                    onClick={() => togglePinColumn(columnName)}
                    aria-label={isPinned ? `Unpin ${columnName} column` : `Pin ${columnName} column to left`}
                    aria-pressed={isPinned}
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
