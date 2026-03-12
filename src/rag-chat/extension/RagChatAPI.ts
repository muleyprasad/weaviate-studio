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
import { Filters, configure } from 'weaviate-client';
import {
  DEFAULT_TIMEOUT_MS,
  withTimeout,
  isTimeoutError,
  createTimeoutError,
} from '../../shared/timeout';
import type { FilterCondition, FilterMatchMode } from '../../data-explorer/types';
import { workspace } from 'vscode';

/**
 * API class for interacting with Weaviate collections in the RAG Chat feature
 */
export class RagChatAPI {
  private readonly REQUEST_TIMEOUT: number;

  constructor(private client: WeaviateClient) {
    // Read timeout from user settings, default to 120 seconds
    const config = workspace.getConfiguration('weaviate');
    this.REQUEST_TIMEOUT = config.get<number>('ragQueryTimeout') ?? 120000;
  }

  /**
   * Validates collection name to prevent injection/XSS when used in UI or error messages
   */
  private _validateCollectionName(name: string): void {
    if (!name || name.trim() === '') {
      throw new Error('Collection name cannot be empty.');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error('Collection name contains invalid characters.');
    }
  }

  /**
   * Executes a RAG (Retrieval-Augmented Generation) query against a collection.
   * Uses generative search to retrieve relevant objects and generate an answer.
   *
   * @param params.collectionName - The Weaviate collection to query
   * @param params.question - The natural language question to ask
   * @param params.limit - Maximum number of context objects to retrieve (default: 5)
   * @param params.timeout - Query timeout in milliseconds (default: 120000)
   * @returns The generated answer and the context objects used to produce it
   */
  async executeRagQuery(params: {
    collectionName: string;
    question: string;
    limit?: number;
    timeout?: number;
    /** Optional where filters inherited from Data Explorer */
    where?: FilterCondition[];
    matchMode?: FilterMatchMode;
    /** Whether the collection has a vectorizer configured */
    hasVectorizer?: boolean;
    /** The selected generative provider configuration */
    provider?: import('../types').GenerativeProviderSelection;
    /** Advanced settings for custom providers */
    advancedSettings?: import('../types').AdvancedRagSettings;
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
    // Use timeout from params, or fall back to instance default
    const requestTimeout = params.timeout ?? this.REQUEST_TIMEOUT;

    this._validateCollectionName(params.collectionName);

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
                  console.warn(
                    `RagChatAPI: Dropped filter for path "${cond.path}" due to unsupported operator "${cond.operator}"`
                  );
                  return null;
              }
            } catch (err) {
              console.warn(
                `RagChatAPI: Dropped filter for path "${cond.path}" due to error: ${err instanceof Error ? err.message : String(err)}`
              );
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

      // Build generative config if provider is specified
      let genConfig: any = undefined;
      const provider = params.provider ?? { kind: 'default' };

      if (provider.kind === 'module') {
        const createMethod =
          (configure.generative as any)[provider.moduleName.replace('generative-', '')] ??
          (configure.generative as any)[
            provider.moduleName.replace('generative-', '').replace('-', '')
          ];

        if (createMethod && typeof createMethod === 'function') {
          genConfig = createMethod();
        } else if (provider.moduleName === 'generative-openai') {
          genConfig = configure.generative.openAI();
        }
      } else if (provider.kind === 'custom' && params.advancedSettings?.baseUrl) {
        genConfig = configure.generative.openAI({
          baseURL: params.advancedSettings.baseUrl,
          model: params.advancedSettings.model || undefined,
        });
      }

      // Execute query based on vectorizer presence
      let result;
      const useBm25 = params.hasVectorizer === false;

      const queryPayload = genConfig
        ? { groupedTask: params.question, config: genConfig }
        : { groupedTask: params.question };

      if (useBm25) {
        result = await withTimeout(
          collection.generate.bm25(params.question, queryPayload, queryOptions),
          requestTimeout
        );
      } else {
        result = await withTimeout(
          collection.generate.hybrid(params.question, queryPayload, queryOptions),
          requestTimeout
        );
      }

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
          requestTimeout
        );
      }
      throw new Error(
        `Failed to execute RAG query on collection "${params.collectionName}": ${error instanceof Error ? error.message : String(error)}.`
      );
    }
  }

  /**
   * Gets all collection infos from the Weaviate instance.
   * Returns metadata about vectorizer and generative configuration.
   *
   * @returns Array of CollectionInfo objects
   */
  async getCollectionInfos(): Promise<import('../types').CollectionInfo[]> {
    try {
      const collections = await withTimeout(
        this.client.collections.listAll(),
        this.REQUEST_TIMEOUT
      );

      const infos: import('../types').CollectionInfo[] = collections.map((col) => {
        // v3 client uses vectorizers, if not present or explicitly 'none', it has no vectorizer
        const hasVec = col.vectorizers !== undefined && Object.keys(col.vectorizers).length > 0;
        return {
          name: col.name,
          hasVectorizer: hasVec,
          generativeModule:
            col.generative?.name && col.generative.name !== 'none' ? col.generative.name : null,
        };
      });

      return infos.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (isTimeoutError(error)) {
        throw createTimeoutError('List collections', 'Weaviate instance', this.REQUEST_TIMEOUT);
      }
      throw new Error(
        `Failed to list collections: ${error instanceof Error ? error.message : String(error)}.`
      );
    }
  }

  /**
   * Scans collections to find all configured generative modules
   */
  async getAvailableGenerativeModules(): Promise<string[]> {
    try {
      const infos = await this.getCollectionInfos();
      const modules = new Set<string>();
      for (const info of infos) {
        if (info.generativeModule) {
          modules.add(info.generativeModule);
        }
      }
      return Array.from(modules).sort();
    } catch (e) {
      console.warn('Failed to get available generative modules', e);
      return [];
    }
  }
}
