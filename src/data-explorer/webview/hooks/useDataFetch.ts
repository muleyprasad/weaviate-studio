/**
 * useDataFetch - Custom hook for fetching data from the extension
 * Handles message passing between webview and VS Code extension
 */

import { useEffect, useCallback, useRef } from 'react';
import { useDataExplorer } from '../context/DataExplorerContext';
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
  const { state, actions } = useDataExplorer();
  const abortControllerRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  // Post message to extension
  const postMessage = useCallback((message: WebviewMessage) => {
    const vscode = getVSCodeAPI();
    vscode.postMessage(message);
  }, []);

  // Handle messages from extension
  const handleMessage = useCallback(
    (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.command) {
        case 'init':
        case 'schemaLoaded':
          if (message.schema && message.collectionName) {
            actions.setCollection(message.collectionName, message.schema);
          }
          break;

        case 'objectsLoaded':
          if (message.objects && message.total !== undefined) {
            actions.setData(message.objects, message.total);
          }
          break;

        case 'objectDetailLoaded':
          // Object detail is handled separately
          break;

        case 'error':
          actions.setError(message.error || 'An error occurred');
          break;

        case 'updateData':
        case 'refresh':
          // Trigger a refresh
          fetchObjects(state.currentPage, state.pageSize);
          break;
      }
    },
    [actions, state.currentPage, state.pageSize]
  );

  // Fetch objects with current pagination
  const fetchObjects = useCallback(
    (page: number, pageSize: number, sortBy?: SortState) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      actions.setLoading(true);

      const offset = (page - 1) * pageSize;
      postMessage({
        command: 'fetchObjects',
        collectionName: state.collectionName,
        limit: pageSize,
        offset,
        sortBy,
      });
    },
    [postMessage, state.collectionName, actions]
  );

  // Initialize - fetch schema and first page of objects
  const initialize = useCallback(() => {
    if (!state.collectionName) {
      return;
    }

    actions.setLoading(true);
    postMessage({
      command: 'initialize',
      collectionName: state.collectionName,
    });
  }, [postMessage, state.collectionName, actions]);

  // Refresh data
  const refresh = useCallback(() => {
    postMessage({
      command: 'refresh',
      collectionName: state.collectionName,
    });
  }, [postMessage, state.collectionName]);

  // Get object detail
  const getObjectDetail = useCallback(
    (uuid: string) => {
      postMessage({
        command: 'getObjectDetail',
        collectionName: state.collectionName,
        uuid,
      });
    },
    [postMessage, state.collectionName]
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
    if (!initializedRef.current && state.collectionName) {
      initializedRef.current = true;
      initialize();
    }
  }, [state.collectionName, initialize]);

  // Fetch when page or pageSize changes
  useEffect(() => {
    if (initializedRef.current && state.collectionName && !state.loading) {
      // Debounce page changes
      const timeoutId = setTimeout(() => {
        fetchObjects(state.currentPage, state.pageSize, state.sortBy || undefined);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [state.currentPage, state.pageSize]);

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
    isLoading: state.loading,
    error: state.error,
  };
}
