/**
 * RagChatAPI - Weaviate API wrapper for RAG Chat
 * Handles all Weaviate client interactions for generative search (RAG) queries
 *
 * ERROR HANDLING STANDARD:
 * ========================
 * This module follows a consistent error handling pattern:
 *
 * 1. PUBLIC METHODS (executeRagQuery, getCollections):
 *    - Always throw errors for exceptional conditions
 *    - Never return null/undefined for errors
 *    - Errors include context (collection name, operation type)
 *    - Timeout errors are detected and given actionable messages
 *
 * RATIONALE:
 * - Public API throws: Callers can use try-catch for error handling
 */

import type { WeaviateClient } from 'weaviate-client';
import { Filters } from 'weaviate-client';
import {
  DEFAULT_TIMEOUT_MS,
  withTimeout,
  isTimeoutError,
  createTimeoutError,
} from '../../shared/timeout';
import type { FilterCondition, FilterMatchMode } from '../../data-explorer/types';

/**
 * API class for interacting with Weaviate collections in the RAG Chat feature
 */
export class RagChatAPI {
  private readonly REQUEST_TIMEOUT = DEFAULT_TIMEOUT_MS;

  constructor(private client: WeaviateClient) {}

  /**
   * Executes a RAG (Retrieval-Augmented Generation) query against a collection.
   * Uses generative search to retrieve relevant objects and generate an answer.
   *
   * @param params.collectionName - The Weaviate collection to query
   * @param params.question - The natural language question to ask
   * @param params.limit - Maximum number of context objects to retrieve (default: 5)
   * @returns The generated answer and the context objects used to produce it
   */
  async executeRagQuery(params: {
    collectionName: string;
    question: string;
    limit?: number;
    /** Optional where filters inherited from Data Explorer */
    where?: FilterCondition[];
    matchMode?: FilterMatchMode;
  }): Promise<{
    answer: string;
    contextObjects: Array<{
      uuid: string;
      properties: Record<string, unknown>;
      distance?: number;
      certainty?: number;
      score?: number;
    }>;
  }> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      // Build where filter if provided
      let builtFilter: ReturnType<typeof Filters.and> | undefined;
      if (params.where && params.where.length > 0) {
        const filterClauses = params.where
          .map((cond) => {
            try {
              const fb = collection.filter.byProperty(cond.path);
              switch (cond.operator) {
                case 'Equal':
                  return fb.equal(cond.value as any);
                case 'NotEqual':
                  return fb.notEqual(cond.value as any);
                case 'GreaterThan':
                  return fb.greaterThan(cond.value as any);
                case 'GreaterThanEqual':
                  return fb.greaterOrEqual(cond.value as any);
                case 'LessThan':
                  return fb.lessThan(cond.value as any);
                case 'LessThanEqual':
                  return fb.lessOrEqual(cond.value as any);
                case 'Like':
                  return fb.like(String(cond.value));
                case 'IsNull':
                  return fb.isNull(true);
                case 'IsNotNull':
                  return fb.isNull(false);
                default:
                  return null;
              }
            } catch {
              return null;
            }
          })
          .filter(Boolean) as unknown as Parameters<typeof Filters.and>;

        if (filterClauses.length > 0) {
          builtFilter =
            params.matchMode === 'OR'
              ? Filters.or(...(filterClauses as any))
              : Filters.and(...(filterClauses as any));
        }
      }

      const queryOptions: Record<string, unknown> = {
        limit: params.limit ?? 5,
        returnMetadata: ['distance', 'certainty', 'score'],
      };
      if (builtFilter) {
        queryOptions.filters = builtFilter;
      }

      const result = await withTimeout(
        collection.generate.hybrid(params.question, { groupedTask: params.question }, queryOptions),
        this.REQUEST_TIMEOUT
      );

      const contextObjects = result.objects.map(
        (obj: {
          uuid: string;
          properties: Record<string, unknown>;
          metadata?: {
            distance?: number;
            certainty?: number;
            score?: number;
          };
        }) => ({
          uuid: obj.uuid,
          properties: obj.properties,
          distance: obj.metadata?.distance,
          certainty: obj.metadata?.certainty,
          score: obj.metadata?.score,
        })
      );

      return {
        answer: result.generated ?? '',
        contextObjects,
      };
    } catch (error) {
      if (isTimeoutError(error)) {
        throw createTimeoutError(
          'RAG query',
          `collection "${params.collectionName}"`,
          this.REQUEST_TIMEOUT
        );
      }
      throw new Error(
        `Failed to execute RAG query on collection "${params.collectionName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets all collection names that support RAG (generative search) from the Weaviate instance.
   * Only returns collections that have a generative module configured.
   *
   * @returns Sorted array of collection name strings that support RAG
   */
  async getCollections(): Promise<string[]> {
    try {
      const collections = await withTimeout(
        this.client.collections.listAll(),
        this.REQUEST_TIMEOUT
      );

      const names = collections
        .filter((col) => {
          const generative = col.generative;
          return generative?.name && generative.name !== 'none';
        })
        .map((col) => col.name);

      return names.sort();
    } catch (error) {
      if (isTimeoutError(error)) {
        throw createTimeoutError('List collections', 'Weaviate instance', this.REQUEST_TIMEOUT);
      }
      throw new Error(
        `Failed to list collections: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
