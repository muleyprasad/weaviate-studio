/**
 * useKeyboardShortcuts - Hook for managing keyboard shortcuts
 * Provides global keyboard navigation for the Data Explorer
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: () => void;
}

export interface KeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Available keyboard shortcuts for display in help tooltip
 */
export const KEYBOARD_SHORTCUTS = {
  toggleFilters: { keys: ['Ctrl+F', '⌘F'], description: 'Open/close filters' },
  toggleVectorSearch: { keys: ['Ctrl+K', '⌘K'], description: 'Open/close vector search' },
  openExport: { keys: ['Ctrl+E', '⌘E'], description: 'Open export dialog' },
  closePanel: { keys: ['Escape'], description: 'Close active panel' },
  refresh: { keys: ['Ctrl+R', '⌘R'], description: 'Refresh data' },
  selectAll: { keys: ['Ctrl+A', '⌘A'], description: 'Select all rows' },
  nextPage: { keys: ['Ctrl+→', '⌘→'], description: 'Next page' },
  prevPage: { keys: ['Ctrl+←', '⌘←'], description: 'Previous page' },
};

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: KeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);

  // Keep shortcuts ref updated
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) {
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Allow Escape to work even in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcutsRef.current) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : true;
        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;

        // For shortcuts that require Ctrl/Cmd, also check that the modifier is pressed
        const modifierRequired = shortcut.ctrlKey || shortcut.metaKey;
        const modifierPressed = event.ctrlKey || event.metaKey;
        const modifierCorrect = modifierRequired ? modifierPressed : !modifierPressed;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && modifierCorrect) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Hook specifically for Data Explorer shortcuts
 */
export function useDataExplorerShortcuts(handlers: {
  onToggleFilters: () => void;
  onToggleVectorSearch: () => void;
  onOpenExport: () => void;
  onClosePanel: () => void;
  onRefresh: () => void;
  onSelectAll?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'f',
      ctrlKey: true,
      description: 'Toggle filters',
      action: handlers.onToggleFilters,
    },
    {
      key: 'k',
      ctrlKey: true,
      description: 'Toggle vector search',
      action: handlers.onToggleVectorSearch,
    },
    {
      key: 'e',
      ctrlKey: true,
      description: 'Open export',
      action: handlers.onOpenExport,
    },
    {
      key: 'Escape',
      description: 'Close panel',
      action: handlers.onClosePanel,
    },
    {
      key: 'r',
      ctrlKey: true,
      description: 'Refresh',
      action: handlers.onRefresh,
    },
  ];

  if (handlers.onSelectAll) {
    shortcuts.push({
      key: 'a',
      ctrlKey: true,
      description: 'Select all',
      action: handlers.onSelectAll,
    });
  }

  if (handlers.onNextPage) {
    shortcuts.push({
      key: 'ArrowRight',
      ctrlKey: true,
      description: 'Next page',
      action: handlers.onNextPage,
    });
  }

  if (handlers.onPrevPage) {
    shortcuts.push({
      key: 'ArrowLeft',
      ctrlKey: true,
      description: 'Previous page',
      action: handlers.onPrevPage,
    });
  }

  useKeyboardShortcuts(shortcuts);
}

export default useKeyboardShortcuts;
