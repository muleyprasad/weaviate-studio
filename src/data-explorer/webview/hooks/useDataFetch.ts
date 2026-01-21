/**
 * useDataFetch - Custom hook for fetching data from the extension
 * Manages data loading lifecycle and message passing with request cancellation
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDataState, useDataActions, useUIState, useFilterState } from '../context';
import type { VSCodeAPI, ExtensionMessage, WebviewMessage, SortState } from '../../types';

// Get VS Code API (singleton)
let vscodeApi: VSCodeAPI | null = null;

function getVSCodeAPI(): VSCodeAPI {
  if (!vscodeApi) {
    vscodeApi = window.acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useDataFetch() {
  const dataState = useDataState();
  const dataActions = useDataActions();
  const uiState = useUIState();
  const filterState = useFilterState();

  const abortControllerRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const currentRequestIdRef = useRef<string | null>(null); // Track current request ID

  // Post message to extension
  const postMessage = useCallback((message: WebviewMessage) => {
    const vscode = getVSCodeAPI();
    vscode.postMessage(message);
  }, []);

  // Handle messages from extension
  const handleMessage = useCallback(
    (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      // Ignore responses from cancelled requests
      if (message.requestId && message.requestId !== currentRequestIdRef.current) {
        console.log(`Ignoring stale response for request ${message.requestId}`);
        return;
      }

      switch (message.command) {
        case 'init':
        case 'schemaLoaded':
          if (message.schema && message.collectionName) {
            dataActions.setCollection(message.collectionName);
            dataActions.setSchema(message.schema);
          }
          break;

        case 'objectsLoaded':
          if (message.objects && message.total !== undefined) {
            dataActions.setData(message.objects, message.total);
          }
          break;

        case 'objectDetailLoaded':
          // Object detail is handled separately
          break;

        case 'error':
          dataActions.setError(message.error || 'An error occurred');
          break;

        case 'updateData':
        case 'refresh':
          // Trigger a refresh
          fetchObjects(uiState.currentPage, uiState.pageSize);
          break;
      }
    },
    [dataActions, uiState.currentPage, uiState.pageSize] // Include UI state for refresh
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
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      currentRequestIdRef.current = requestId;

      dataActions.setLoading(true);

      const offset = (page - 1) * pageSize;
      postMessage({
        command: 'fetchObjects',
        collectionName: dataState.collectionName,
        limit: pageSize,
        offset,
        sortBy,
        where: filterState.activeFilters.length > 0 ? filterState.activeFilters : undefined, // Include filters
        requestId, // Include request ID
      });
    },
    [postMessage, dataState.collectionName, dataActions, filterState.activeFilters]
  );

  // Initialize - fetch schema and first page of objects
  const initialize = useCallback(() => {
    if (!dataState.collectionName) {
      return;
    }

    dataActions.setLoading(true);
    postMessage({
      command: 'initialize',
      collectionName: dataState.collectionName,
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
    if (initializedRef.current && dataState.collectionName && !dataState.loading) {
      // Debounce page changes
      const timeoutId = setTimeout(() => {
        fetchObjects(uiState.currentPage, uiState.pageSize, uiState.sortBy || undefined);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [uiState.currentPage, uiState.pageSize, uiState.sortBy, filterState.activeFilters]);

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
