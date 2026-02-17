/**
 * useDataFetch - Custom hook for fetching data from the extension
 * Manages data loading lifecycle and message passing with request cancellation
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  useDataState,
  useDataActions,
  useUIState,
  useFilterState,
  useFilterActions,
  useVectorSearchActions,
} from '../context';
import { getVSCodeAPI } from '../utils/vscodeApi';
import type { ExtensionMessage, WebviewMessage, SortState } from '../../types';

export function useDataFetch() {
  const dataState = useDataState();
  const dataActions = useDataActions();
  const uiState = useUIState();
  const filterState = useFilterState();
  const filterActions = useFilterActions();
  const vectorSearchActions = useVectorSearchActions();

  const abortControllerRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const initialFetchDoneRef = useRef(false); // Track if initial fetch completed
  const currentRequestIdRef = useRef<string | null>(null); // Track current request ID
  const previousCollectionRef = useRef<string | null>(null); // Track collection changes

  // Post message to extension
  const postMessage = useCallback((message: WebviewMessage) => {
    const vscode = getVSCodeAPI();
    vscode.postMessage(message);
  }, []);

  // Store fetchObjects in a ref to avoid dependency issues
  const fetchObjectsRef = useRef<
    ((page: number, pageSize: number, sortBy?: SortState) => void) | null
  >(null);

  // Handle messages from extension
  const handleMessage = useCallback(
    (event: MessageEvent<ExtensionMessage>) => {
      try {
        const message = event.data;

        // Validate message structure
        if (!message || typeof message !== 'object' || !message.command) {
          console.error('[DataFetch] Invalid message structure received:', message);
          dataActions.setError('Received malformed message from extension');
          return;
        }

        // Only check for stale responses on commands that this hook handles
        // Commands like 'aggregationsLoaded', 'exportComplete' are handled by other components
        const commandsToCheckForStale = ['objectsLoaded', 'init', 'schemaLoaded'];
        if (
          message.requestId &&
          commandsToCheckForStale.includes(message.command) &&
          message.requestId !== currentRequestIdRef.current
        ) {
          console.log(`Ignoring stale response for request ${message.requestId}`);
          return;
        }

        switch (message.command) {
          case 'init':
          case 'schemaLoaded':
            if (message.schema && message.collectionName) {
              // Clear filters and vector search when switching to a different collection
              if (
                previousCollectionRef.current &&
                previousCollectionRef.current !== message.collectionName
              ) {
                filterActions.clearAllFilters();
                vectorSearchActions.resetForCollectionChange();
              }
              previousCollectionRef.current = message.collectionName;
              dataActions.setCollection(message.collectionName);
              dataActions.setSchema(message.schema);

              // Check if multi-tenant
              const isMultiTenant =
                message.isMultiTenant || !!(message.schema.multiTenancy as any)?.enabled;

              if (isMultiTenant) {
                // If tenants were sent with schema, use them immediately
                if (message.tenants) {
                  dataActions.setTenants(message.tenants, true);
                  dataActions.setLoading(false);
                  // Modal will show immediately
                } else {
                  // Otherwise request tenants
                  postMessage({ command: 'getTenants' });
                }
              } else {
                dataActions.setTenants([], false);
              }
            }
            break;

          case 'tenantsLoaded':
            if (message.tenants !== undefined && message.isMultiTenant !== undefined) {
              dataActions.setTenants(message.tenants, message.isMultiTenant);

              // If multi-tenant, stop loading and wait for user to select a tenant
              // Modal will be shown by the UI component
              if (message.isMultiTenant && message.tenants.length > 0) {
                dataActions.setLoading(false);
                return;
              }
            }
            break;

          case 'tenantChanged':
            if (message.tenant !== undefined) {
              dataActions.setSelectedTenant(message.tenant);
              if (message.objects && message.total !== undefined) {
                dataActions.setData(message.objects, message.total, message.unfilteredTotal);
              }
            }
            break;

          case 'objectsLoaded':
            // Validate required fields
            if (!message.objects || message.total === undefined) {
              console.error('[DataFetch] Invalid objectsLoaded message: missing required fields', {
                hasObjects: !!message.objects,
                hasTotal: message.total !== undefined,
                messageKeys: Object.keys(message),
              });
              dataActions.setError(
                'Failed to load data due to invalid server response. Please try refreshing.'
              );
              dataActions.setLoading(false);
              break;
            }

            // Process valid message
            dataActions.setData(message.objects, message.total, message.unfilteredTotal);
            // Mark initial fetch as done to allow pagination/filter effects to proceed
            if (!initialFetchDoneRef.current) {
              initialFetchDoneRef.current = true;
            }
            break;

          case 'objectDetailLoaded':
            // Object detail is handled separately
            break;

          case 'error':
            // Only handle errors for this hook's requests
            if (!message.requestId || message.requestId === currentRequestIdRef.current) {
              dataActions.setError(message.error || 'An error occurred');
            }
            break;

          case 'updateData':
          case 'refresh':
            // Trigger a refresh - use ref to get latest fetchObjects
            if (fetchObjectsRef.current) {
              fetchObjectsRef.current(uiState.currentPage, uiState.pageSize);
            }
            break;
        }
      } catch (error) {
        const err = error as Error;
        console.error('[DataFetch] Error processing message:', {
          error: err.message,
          stack: err.stack,
          message: event.data,
        });
        dataActions.setError(
          `Failed to process extension message: ${err.message || 'Unknown error'}`
        );
      }
    },
    [dataActions, filterActions, vectorSearchActions, uiState.currentPage, uiState.pageSize]
  );

  // Fetch objects with current pagination
  const fetchObjects = useCallback(
    (page: number, pageSize: number, sortBy?: SortState) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Generate unique request ID
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      currentRequestIdRef.current = requestId;

      dataActions.setLoading(true);

      const offset = (page - 1) * pageSize;
      postMessage({
        command: 'fetchObjects',
        collectionName: dataState.collectionName,
        tenant: dataState.selectedTenant || undefined,
        limit: pageSize,
        offset,
        sortBy,
        where: filterState.activeFilters.length > 0 ? filterState.activeFilters : undefined,
        matchMode: filterState.matchMode, // Include AND/OR logic
        requestId,
      });
    },
    [
      postMessage,
      dataState.collectionName,
      dataState.selectedTenant,
      dataActions,
      filterState.activeFilters,
      filterState.matchMode,
    ]
  );

  // Keep fetchObjectsRef updated
  useEffect(() => {
    fetchObjectsRef.current = fetchObjects;
  }, [fetchObjects]);

  // Initialize - fetch schema and first page of objects
  const initialize = useCallback(() => {
    if (!dataState.collectionName) {
      return;
    }

    // Generate unique request ID for tracking
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    currentRequestIdRef.current = requestId;

    dataActions.setLoading(true);
    postMessage({
      command: 'initialize',
      collectionName: dataState.collectionName,
      requestId,
    });
  }, [postMessage, dataState.collectionName, dataActions]);

  // Refresh data
  const refresh = useCallback(() => {
    postMessage({
      command: 'refresh',
      collectionName: dataState.collectionName,
    });
  }, [postMessage, dataState.collectionName]);

  // Get object detail
  const getObjectDetail = useCallback(
    (uuid: string) => {
      postMessage({
        command: 'getObjectDetail',
        collectionName: dataState.collectionName,
        uuid,
      });
    },
    [postMessage, dataState.collectionName]
  );

  // Set up message listener
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  // Initial data fetch
  useEffect(() => {
    if (!initializedRef.current && dataState.collectionName) {
      initializedRef.current = true;
      initialize();
    }
  }, [dataState.collectionName, initialize]);

  // Fetch when page, pageSize, sortBy, or filters change
  useEffect(() => {
    // Skip if not initialized yet or if initial fetch hasn't completed
    if (!initializedRef.current || !initialFetchDoneRef.current || !dataState.collectionName) {
      return undefined;
    }

    // Debounce page changes
    const timeoutId = setTimeout(() => {
      if (fetchObjectsRef.current) {
        fetchObjectsRef.current(uiState.currentPage, uiState.pageSize, uiState.sortBy || undefined);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    uiState.currentPage,
    uiState.pageSize,
    uiState.sortBy,
    filterState.activeFilters,
    dataState.collectionName,
    // Do NOT include dataState.loading or fetchObjects to avoid infinite loop
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    fetchObjects,
    initialize,
    refresh,
    getObjectDetail,
    postMessage,
    isLoading: dataState.loading,
    error: dataState.error,
  };
}
