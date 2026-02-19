/**
 * KeyboardShortcutsHelp - Displays available keyboard shortcuts
 * Shows as a tooltip or modal with all shortcuts
 */

import React, { useState, useRef, useEffect } from 'react';
import { KEYBOARD_SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  compact?: boolean;
}

export function KeyboardShortcutsHelp({ compact = false }: KeyboardShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

  const formatKeys = (keys: string[]) => {
    const key = isMac ? keys[1] || keys[0] : keys[0];
    return key.replace('Ctrl', '⌃').replace('⌘', '⌘');
  };

  return (
    <div className="keyboard-shortcuts-help">
      <button
        ref={buttonRef}
        type="button"
        className="keyboard-shortcuts-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Keyboard shortcuts"
        aria-label="Show keyboard shortcuts"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="codicon codicon-keyboard" aria-hidden="true"></span>
        {!compact && <span className="btn-text">Shortcuts</span>}
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="keyboard-shortcuts-tooltip"
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <div className="shortcuts-header">
            <h3>Keyboard Shortcuts</h3>
            <button
              type="button"
              className="shortcuts-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <span className="codicon codicon-close" aria-hidden="true"></span>
            </button>
          </div>
          <div className="shortcuts-list">
            {Object.entries(KEYBOARD_SHORTCUTS).map(([key, shortcut]) => (
              <div key={key} className="shortcut-item">
                <span className="shortcut-description">{shortcut.description}</span>
                <kbd className="shortcut-keys">{formatKeys(shortcut.keys)}</kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default KeyboardShortcutsHelp;
