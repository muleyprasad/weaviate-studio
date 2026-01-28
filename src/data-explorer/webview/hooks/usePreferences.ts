/**
 * usePreferences - Hook for persisting user preferences
 * Stores column visibility, sort order, filter presets, and panel states per collection
 */

import { useCallback, useEffect, useState } from 'react';

export interface FilterPreset {
  id: string;
  name: string;
  filters: Array<{
    path: string;
    operator: string;
    value: string;
    dataType: string;
  }>;
  matchMode: 'AND' | 'OR';
  createdAt: number;
}

export interface UserPreferences {
  // Column settings
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  pinnedColumns: string[];

  // Table settings
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  pageSize: number;

  // Filter settings
  filterPresets: FilterPreset[];
  lastMatchMode: 'AND' | 'OR';

  // Panel states
  panelStates: {
    showFilters: boolean;
    showVectorSearch: boolean;
  };

  // Search settings
  lastSearchMode: 'text' | 'object' | 'vector' | 'hybrid';
  defaultResultLimit: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  columnVisibility: {},
  columnOrder: [],
  pinnedColumns: [],
  sortColumn: null,
  sortDirection: 'asc',
  pageSize: 20,
  filterPresets: [],
  lastMatchMode: 'AND',
  panelStates: {
    showFilters: false,
    showVectorSearch: false,
  },
  lastSearchMode: 'text',
  defaultResultLimit: 25,
};

const STORAGE_KEY_PREFIX = 'weaviate.dataExplorer.preferences';

/**
 * Get the storage key for a specific collection
 */
function getStorageKey(collectionName: string): string {
  return `${STORAGE_KEY_PREFIX}.${collectionName}`;
}

/**
 * Safely parse JSON from localStorage
 */
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) {
    return fallback;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Hook for managing user preferences per collection
 */
export function usePreferences(collectionName: string) {
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => {
    if (!collectionName) {
      return DEFAULT_PREFERENCES;
    }
    const stored = localStorage.getItem(getStorageKey(collectionName));
    return safeJsonParse(stored, DEFAULT_PREFERENCES);
  });

  // Update preferences when collection changes
  useEffect(() => {
    if (!collectionName) {
      setPreferencesState(DEFAULT_PREFERENCES);
      return;
    }
    const stored = localStorage.getItem(getStorageKey(collectionName));
    setPreferencesState(safeJsonParse(stored, DEFAULT_PREFERENCES));
  }, [collectionName]);

  /**
   * Save preferences to localStorage
   */
  const savePreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      if (!collectionName) {
        return;
      }

      setPreferencesState((current) => {
        const updated = { ...current, ...updates };
        try {
          localStorage.setItem(getStorageKey(collectionName), JSON.stringify(updated));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.error('localStorage quota exceeded. Unable to save preferences.');
            // Attempt to recover by clearing old preferences
            try {
              localStorage.removeItem(getStorageKey(collectionName));
              // Try again with just the current update
              localStorage.setItem(getStorageKey(collectionName), JSON.stringify(updated));
            } catch (retryError) {
              console.error('Failed to save preferences even after clearing:', retryError);
              // Notify user - in a real app, you'd show a toast/notification
              alert(
                'Unable to save preferences: Storage quota exceeded. Some preferences may not be saved.'
              );
            }
          } else {
            console.error('Failed to save preferences:', error);
          }
        }
        return updated;
      });
    },
    [collectionName]
  );

  /**
   * Update column visibility
   */
  const setColumnVisibility = useCallback(
    (columnName: string, visible: boolean) => {
      savePreferences({
        columnVisibility: {
          ...preferences.columnVisibility,
          [columnName]: visible,
        },
      });
    },
    [preferences.columnVisibility, savePreferences]
  );

  /**
   * Update column order
   */
  const setColumnOrder = useCallback(
    (order: string[]) => {
      savePreferences({ columnOrder: order });
    },
    [savePreferences]
  );

  /**
   * Update pinned columns
   */
  const setPinnedColumns = useCallback(
    (columns: string[]) => {
      savePreferences({ pinnedColumns: columns });
    },
    [savePreferences]
  );

  /**
   * Update sort settings
   */
  const setSortSettings = useCallback(
    (column: string | null, direction: 'asc' | 'desc') => {
      savePreferences({
        sortColumn: column,
        sortDirection: direction,
      });
    },
    [savePreferences]
  );

  /**
   * Update page size
   */
  const setPageSize = useCallback(
    (size: number) => {
      savePreferences({ pageSize: size });
    },
    [savePreferences]
  );

  /**
   * Save a filter preset
   */
  const saveFilterPreset = useCallback(
    (name: string, filters: FilterPreset['filters'], matchMode: 'AND' | 'OR') => {
      const newPreset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name,
        filters,
        matchMode,
        createdAt: Date.now(),
      };
      savePreferences({
        filterPresets: [...preferences.filterPresets, newPreset],
      });
      return newPreset;
    },
    [preferences.filterPresets, savePreferences]
  );

  /**
   * Delete a filter preset
   */
  const deleteFilterPreset = useCallback(
    (presetId: string) => {
      savePreferences({
        filterPresets: preferences.filterPresets.filter((p) => p.id !== presetId),
      });
    },
    [preferences.filterPresets, savePreferences]
  );

  /**
   * Update panel states
   */
  const setPanelState = useCallback(
    (panel: keyof UserPreferences['panelStates'], open: boolean) => {
      savePreferences({
        panelStates: {
          ...preferences.panelStates,
          [panel]: open,
        },
      });
    },
    [preferences.panelStates, savePreferences]
  );

  /**
   * Update search settings
   */
  const setSearchSettings = useCallback(
    (settings: {
      lastSearchMode?: UserPreferences['lastSearchMode'];
      defaultResultLimit?: number;
    }) => {
      savePreferences(settings);
    },
    [savePreferences]
  );

  /**
   * Reset all preferences for this collection
   */
  const resetPreferences = useCallback(() => {
    if (!collectionName) {
      return;
    }
    try {
      localStorage.removeItem(getStorageKey(collectionName));
      setPreferencesState(DEFAULT_PREFERENCES);
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    }
  }, [collectionName]);

  /**
   * Get all stored collection names
   */
  const getStoredCollections = useCallback((): string[] => {
    const collections: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        collections.push(key.replace(`${STORAGE_KEY_PREFIX}.`, ''));
      }
    }
    return collections;
  }, []);

  return {
    preferences,
    savePreferences,
    setColumnVisibility,
    setColumnOrder,
    setPinnedColumns,
    setSortSettings,
    setPageSize,
    saveFilterPreset,
    deleteFilterPreset,
    setPanelState,
    setSearchSettings,
    resetPreferences,
    getStoredCollections,
  };
}

export default usePreferences;
