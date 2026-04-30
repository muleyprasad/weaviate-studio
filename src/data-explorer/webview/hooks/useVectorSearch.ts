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
import type {
  WebviewMessage,
  WeaviateObject,
  ExtensionMessage,
  WeaviateExplainScoreRaw,
} from '../../types';

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

  /**
   * Parse raw explainScore from Weaviate API into normalized format
   * Handles both JSON string and object formats with various field naming conventions
   * Returns partial data with fallback values if parsing fails
   */
  const parseExplainScore = (
    rawScore: string | WeaviateExplainScoreRaw | unknown,
    metadataScore?: number
  ): VectorSearchResult['explainScore'] | undefined => {
    if (!rawScore) {
      return undefined;
    }

    try {
      let parsed: WeaviateExplainScoreRaw;

      if (typeof rawScore === 'string') {
        parsed = JSON.parse(rawScore) as WeaviateExplainScoreRaw;
      } else if (typeof rawScore === 'object' && rawScore !== null) {
        parsed = rawScore as WeaviateExplainScoreRaw;
      } else {
        return undefined;
      }

      const keywordScore = parsed.bm25 ?? parsed.keyword ?? 0;
      const vectorScore = parsed.vector ?? parsed.nearText ?? 0;
      const combinedScore = metadataScore ?? parsed.score ?? (keywordScore + vectorScore) / 2;

      return {
        keyword: keywordScore,
        vector: vectorScore,
        combined: combinedScore,
        matchedTerms: parsed.matchedTerms ?? parsed.keywords,
      };
    } catch (parseError) {
      // Log parse failures but return fallback with combined score only
      console.warn(
        '[VectorSearch] Failed to parse explainScore breakdown, using metadata score as fallback',
        {
          rawScore,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        }
      );
      debugLog('Failed to parse explainScore', { rawScore, error: parseError });

      // Return minimal result with just the combined/metadata score if available
      // This ensures users still see scoring even when breakdown parsing fails
      if (metadataScore !== undefined) {
        return {
          keyword: 0,
          vector: 0,
          combined: metadataScore,
          matchedTerms: undefined,
        };
      }

      return undefined;
    }
  };

  // Handle vector search response
  const handleSearchResponse = useCallback(
    (objects: WeaviateObject[]) => {
      debugLog('Response received', { count: objects.length });
      // Transform objects to VectorSearchResult format
      const results: VectorSearchResult[] = objects.map((obj) => {
        // Parse explainScore for hybrid search results
        const explainScore = parseExplainScore(obj.metadata?.explainScore, obj.metadata?.score);

        // For hybrid search, use combined score for certainty calculation
        // since distance may not be meaningful
        const hasHybridScore = explainScore?.combined !== undefined;
        const effectiveDistance = obj.metadata?.distance ?? 0;
        const effectiveCertainty = hasHybridScore
          ? explainScore.combined // Use combined score directly as certainty proxy
          : (obj.metadata?.certainty ?? 1 - effectiveDistance / 2);

        return {
          object: obj,
          distance: effectiveDistance,
          certainty: effectiveCertainty,
          explainScore,
        };
      });

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
    const { searchMode, searchParams, selectedTargetVectors, joinStrategy, vectorWeights } =
      searchState;

    // Build the targetVector field:
    // - 0 selected  → undefined (let the server pick or error gracefully)
    // - 1 selected  → plain string (single-target)
    // - 2+ selected → multi-target object { combination, targetVectors, weights? }
    let resolvedTargetVector:
      | string
      | { combination: string; targetVectors: string[]; weights?: Record<string, number> }
      | undefined;

    if (selectedTargetVectors.length === 1) {
      resolvedTargetVector = selectedTargetVectors[0];
    } else if (selectedTargetVectors.length > 1) {
      // Filter weights to only the currently selected vectors.
      // Stale weights from previously-deselected vectors must not reach the API —
      // in manual-weights / relative-score strategies, Weaviate derives participating
      // target vectors from weight keys, so stale keys silently include deselected vectors.
      const selectedWeights: Record<string, number> = {};
      selectedTargetVectors.forEach((vec) => {
        if (vectorWeights[vec] !== undefined) {
          selectedWeights[vec] = vectorWeights[vec];
        }
      });

      resolvedTargetVector = {
        combination: joinStrategy,
        targetVectors: selectedTargetVectors,
        weights: Object.keys(selectedWeights).length > 0 ? selectedWeights : undefined,
      };
    } else {
      // No vectors selected — fall back to legacy single searchParams.targetVector
      resolvedTargetVector = searchParams.targetVector || undefined;
    }

    // Only apply a distance filter when the user has explicitly tightened the
    // slider below the default (1.0). At the default we omit the field entirely
    // so Weaviate returns pure top-N results with no distance ceiling.
    const DEFAULT_MAX_DISTANCE = 1.0;
    const effectiveDistance =
      searchParams.maxDistance < DEFAULT_MAX_DISTANCE ? searchParams.maxDistance : undefined;

    // Validate input based on mode
    let isValid = false;
    let vectorSearchPayload: {
      type: 'nearText' | 'nearVector' | 'nearObject' | 'hybrid';
      text?: string;
      vector?: number[];
      objectId?: string;
      distance?: number;
      limit?: number;
      distanceMetric?: string;
      targetVector?: typeof resolvedTargetVector;
      // Hybrid-specific params
      alpha?: number;
      fusionType?: string;
      properties?: string[];
    } | null = null;

    switch (searchMode) {
      case 'text':
        if (searchParams.query.trim()) {
          isValid = true;
          vectorSearchPayload = {
            type: 'nearText',
            text: searchParams.query.trim(),
            distance: effectiveDistance,
            limit: searchParams.limit,
            distanceMetric: searchParams.distanceMetric,
            targetVector: resolvedTargetVector,
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
            distance: effectiveDistance,
            limit: searchParams.limit,
            distanceMetric: searchParams.distanceMetric,
            targetVector: resolvedTargetVector,
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
              distance: effectiveDistance,
              limit: searchParams.limit,
              distanceMetric: searchParams.distanceMetric,
              targetVector: resolvedTargetVector,
            };
          } else {
            searchActions.setSearchError(
              'Invalid vector format: Expected an array of numbers. Example: [0.1, 0.2, 0.3]'
            );
          }
        } catch (e) {
          const error = e as Error;
          const errorMessage = error.message || 'Unknown error';
          searchActions.setSearchError(
            `Invalid vector JSON: ${errorMessage}. Please check your JSON syntax.`
          );
          isValid = false;
        }
        break;

      case 'hybrid':
        if (searchParams.query.trim()) {
          isValid = true;
          vectorSearchPayload = {
            type: 'hybrid',
            text: searchParams.query.trim(),
            alpha: searchParams.hybridAlpha,
            fusionType: searchParams.fusionType,
            properties:
              searchParams.searchProperties.length > 0 ? searchParams.searchProperties : undefined, // undefined means all text properties
            limit: searchParams.limit,
            targetVector: resolvedTargetVector,
          };
        }
        break;
    }

    if (!isValid || !vectorSearchPayload) {
      searchActions.setSearchError('Invalid search parameters');
      return;
    }

    // Generate unique request ID with vs- prefix for vector search
    const requestId = `vs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
