/**
 * useKeyboardShortcuts - Global keyboard shortcut handler
 *
 * Provides keyboard shortcuts for common operations
 */

import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

/**
 * Check if keyboard shortcut matches the event
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Check key (case insensitive)
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }

  // Check modifiers
  if (shortcut.ctrl !== undefined && event.ctrlKey !== shortcut.ctrl) {
    return false;
  }

  if (shortcut.shift !== undefined && event.shiftKey !== shortcut.shift) {
    return false;
  }

  if (shortcut.alt !== undefined && event.altKey !== shortcut.alt) {
    return false;
  }

  if (shortcut.meta !== undefined && event.metaKey !== shortcut.meta) {
    return false;
  }

  return true;
}

/**
 * Use keyboard shortcuts
 *
 * @param shortcuts - Array of keyboard shortcut definitions
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Some shortcuts should work even in inputs (like Escape)
      const isEscape = event.key === 'Escape';

      if (isInput && !isEscape) {
        return;
      }

      // Find matching shortcut
      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

/**
 * Format keyboard shortcut for display
 *
 * @param shortcut - Keyboard shortcut
 * @returns Formatted string (e.g., "Ctrl+F")
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.meta) parts.push('Cmd');

  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}

/**
 * Default keyboard shortcuts for Data Explorer
 */
export const DEFAULT_SHORTCUTS = {
  // Navigation
  ESCAPE: { key: 'Escape', description: 'Close modals, clear selection' },
  ENTER: { key: 'Enter', description: 'Activate buttons, open details' },
  SPACE: { key: ' ', description: 'Toggle checkboxes, expand/collapse' },

  // Quick actions
  REFRESH: { key: 'r', ctrl: true, description: 'Refresh data' },
  EXPORT: { key: 'e', ctrl: true, description: 'Open export dialog' },
  FIND: { key: 'f', ctrl: true, description: 'Focus quick search' },

  // Vector search
  VECTOR_SEARCH: { key: 'k', ctrl: true, description: 'Toggle vector search' },

  // Filter management
  CLEAR_FILTERS: {
    key: 'Backspace',
    ctrl: true,
    shift: true,
    description: 'Clear all filters',
  },
  APPLY_FILTERS: { key: 'Enter', ctrl: true, description: 'Apply current filters' },

  // Navigation (arrow keys)
  ARROW_UP: { key: 'ArrowUp', description: 'Navigate up' },
  ARROW_DOWN: { key: 'ArrowDown', description: 'Navigate down' },
  ARROW_LEFT: { key: 'ArrowLeft', description: 'Navigate left' },
  ARROW_RIGHT: { key: 'ArrowRight', description: 'Navigate right' },

  // Pagination
  PAGE_NEXT: { key: 'n', ctrl: true, description: 'Next page' },
  PAGE_PREV: { key: 'p', ctrl: true, description: 'Previous page' },
};
