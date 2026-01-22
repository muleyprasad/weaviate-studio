/**
 * useVectorSearch - Custom hook for executing vector searches
 * Manages vector search API calls and result handling
 */

import { useCallback, useRef, useEffect } from 'react';
import {
  useDataState,
  useVectorSearchState,
  useVectorSearchActions,
  type VectorSearchResult,
} from '../context';
import { getVSCodeAPI } from '../utils/vscodeApi';
import type { WebviewMessage, WeaviateObject, ExtensionMessage } from '../../types';

const isDevelopment = process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.log(`[VectorSearch] ${message}`, data);
    } else {
      console.log(`[VectorSearch] ${message}`);
    }
  }
}

export function useVectorSearch() {
  const dataState = useDataState();
  const searchState = useVectorSearchState();
  const searchActions = useVectorSearchActions();
  const currentRequestIdRef = useRef<string | null>(null);

  // Post message to extension
  const postMessage = useCallback((message: WebviewMessage & { vectorSearch?: unknown }) => {
    const vscode = getVSCodeAPI();
    vscode.postMessage(message);
  }, []);

  // Handle vector search response
  const handleSearchResponse = useCallback(
    (objects: WeaviateObject[]) => {
      debugLog('Response received', { count: objects.length });
      // Transform objects to VectorSearchResult format
      const results: VectorSearchResult[] = objects.map((obj) => ({
        object: obj,
        distance: obj.metadata?.distance ?? 0,
        certainty: obj.metadata?.certainty ?? 1 - (obj.metadata?.distance ?? 0) / 2,
      }));

      searchActions.setSearchResults(results);
    },
    [searchActions]
  );

  // Handle search error
  const handleSearchError = useCallback(
    (error: string) => {
      debugLog('Search error', { error });
      searchActions.setSearchError(error);
    },
    [searchActions]
  );

  // Set up message listener for vector search responses
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      // Only handle messages for vector search requests (vs- prefix)
      if (!message.requestId || !message.requestId.startsWith('vs-')) {
        return;
      }

      // Ignore stale responses
      if (message.requestId !== currentRequestIdRef.current) {
        console.log(`Ignoring stale vector search response for request ${message.requestId}`);
        return;
      }

      switch (message.command) {
        case 'objectsLoaded':
          if (message.objects) {
            handleSearchResponse(message.objects);
          } else {
            // Empty results
            searchActions.setSearchResults([]);
          }
          break;

        case 'error':
          handleSearchError(message.error || 'Vector search failed');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleSearchResponse, handleSearchError, searchActions]);

  // Execute vector search based on current mode and params
  const executeSearch = useCallback(() => {
    const { searchMode, searchParams } = searchState;

    // Validate input based on mode
    let isValid = false;
    let vectorSearchPayload: {
      type: 'nearText' | 'nearVector' | 'nearObject';
      text?: string;
      vector?: number[];
      objectId?: string;
      distance?: number;
      limit?: number;
      distanceMetric?: string;
      targetVector?: string;
    } | null = null;

    switch (searchMode) {
      case 'text':
        if (searchParams.query.trim()) {
          isValid = true;
          vectorSearchPayload = {
            type: 'nearText',
            text: searchParams.query.trim(),
            distance: searchParams.maxDistance,
            limit: searchParams.limit,
            distanceMetric: searchParams.distanceMetric,
            targetVector: searchParams.targetVector,
          };
        }
        break;

      case 'object':
        if (searchParams.objectId.trim()) {
          isValid = true;
          // For object search, we use the object's UUID to find similar
          vectorSearchPayload = {
            type: 'nearObject',
            objectId: searchParams.objectId.trim(),
            distance: searchParams.maxDistance,
            limit: searchParams.limit,
            distanceMetric: searchParams.distanceMetric,
            targetVector: searchParams.targetVector,
          };
        }
        break;

      case 'vector':
        try {
          const parsed = JSON.parse(searchParams.vector);
          if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
            isValid = true;
            vectorSearchPayload = {
              type: 'nearVector',
              vector: parsed,
              distance: searchParams.maxDistance,
              limit: searchParams.limit,
              distanceMetric: searchParams.distanceMetric,
              targetVector: searchParams.targetVector,
            };
          }
        } catch {
          isValid = false;
        }
        break;
    }

    if (!isValid || !vectorSearchPayload) {
      searchActions.setSearchError('Invalid search parameters');
      return;
    }

    // Generate unique request ID with vs- prefix for vector search
    const requestId = `vs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentRequestIdRef.current = requestId;

    debugLog('Executing search', {
      requestId,
      mode: searchMode,
      collection: dataState.collectionName,
      payload: vectorSearchPayload,
    });

    // Set searching state
    searchActions.setSearching(true);

    // Post vector search message to extension
    postMessage({
      command: 'fetchObjects',
      collectionName: dataState.collectionName,
      limit: searchParams.limit,
      offset: 0,
      vectorSearch: vectorSearchPayload,
      requestId,
    } as WebviewMessage & { vectorSearch: unknown });
  }, [searchState, searchActions, dataState.collectionName, postMessage]);

  // Clear search
  const clearSearch = useCallback(() => {
    currentRequestIdRef.current = null;
    searchActions.clearSearch();
  }, [searchActions]);

  return {
    executeSearch,
    clearSearch,
    isSearching: searchState.isSearching,
    searchResults: searchState.searchResults,
    searchError: searchState.searchError,
  };
}
