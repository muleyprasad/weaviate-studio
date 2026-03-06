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

// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Wraps a promise with a timeout
 * Rejects if the promise doesn't resolve within the specified timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Checks if an error is a timeout error
 */
function isTimeoutError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('timeout') || message.includes('timed out');
}

/**
 * Creates a user-friendly timeout error message with actionable suggestions
 */
function createTimeoutError(
  operation: string,
  context: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Error {
  return new Error(
    `${operation} timed out after ${timeoutMs}ms for ${context}. ` +
      'Suggestions: Try again, reduce the limit, or check server connectivity.'
  );
}

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
  }): Promise<{
    answer: string;
    contextObjects: Array<{
      uuid: string;
      properties: Record<string, unknown>;
      distance?: number;
      certainty?: number;
    }>;
  }> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      const result = await withTimeout(
        collection.generate.nearText(
          [params.question],
          {
            groupedTask: params.question,
          },
          {
            limit: params.limit ?? 5,
            returnMetadata: ['distance', 'certainty'],
          }
        ),
        this.REQUEST_TIMEOUT
      );

      const contextObjects = result.objects.map(
        (obj: {
          uuid: string;
          properties: Record<string, unknown>;
          metadata?: {
            distance?: number;
            certainty?: number;
          };
        }) => ({
          uuid: obj.uuid,
          properties: obj.properties,
          distance: obj.metadata?.distance,
          certainty: obj.metadata?.certainty,
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
   * Gets all available collection names from the Weaviate instance.
   *
   * @returns Sorted array of collection name strings
   */
  async getCollections(): Promise<string[]> {
    try {
      const collections = await withTimeout(
        this.client.collections.listAll(),
        this.REQUEST_TIMEOUT
      );

      const names = collections.map((col: { name: string }) => col.name);

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
