/**
 * DataExplorerAPI - Weaviate API wrapper for Data Explorer
 * Handles all Weaviate client interactions for fetching objects and schema
 *
 * ERROR HANDLING STANDARD:
 * ========================
 * This module follows a consistent error handling pattern:
 *
 * 1. PUBLIC METHODS (fetchObjects, getCollectionSchema, etc.):
 *    - Always throw errors for exceptional conditions
 *    - Never return null/undefined for errors
 *    - Errors include context (collection name, operation type)
 *    - Timeout errors are detected and given actionable messages
 *
 * 2. PRIVATE HELPER METHODS (buildWeaviateFilter, aggregation helpers):
 *    - Return null for "no data" or "not applicable" cases (e.g., empty filters)
 *    - Throw errors for actual failures
 *    - Log warnings for non-critical failures that can be handled gracefully
 *
 * 3. AGGREGATION METHODS:
 *    - Return null when data doesn't match expected format (graceful degradation)
 *    - Collect failures in aggregationFailures array instead of throwing
 *    - This allows partial results when some properties fail
 *
 * RATIONALE:
 * - Public API throws: Callers can use try-catch for error handling
 * - Helpers return null: Allows optional/conditional logic without try-catch
 * - Aggregations return null: Enables partial results for mixed property types
 */

import type { WeaviateClient, Collection, Vectors } from 'weaviate-client';
import { Filters } from 'weaviate-client';
import type {
  WeaviateObject,
  CollectionConfig,
  FetchObjectsParams,
  FetchObjectsResponse,
  PropertyConfig,
  FilterCondition,
  FilterOperator,
  FilterMatchMode,
  VectorSearchParams,
  AggregationResult,
  AggregationParams,
  ExportParams,
  ExportResult,
  ExportOptions,
  PropertyTopValues,
  PropertyNumericStats,
  PropertyDateRange,
  PropertyBooleanCounts,
} from '../types';
import type {
  WeaviateFilter,
  WeaviateSortBuilder,
  WeaviateQueryMetadata,
  WeaviateQueryOptions,
  WeaviateVectorQueryOptions,
  WeaviateHybridQueryOptions,
  WeaviateQueryResult,
  WeaviateAggregateOptions,
  WeaviateAggregateResult,
  WeaviateGroupByOptions,
  WeaviateGroupByResult,
  WeaviateGroupByGroup,
  WeaviateNumericMetrics,
  WeaviateDateMetrics,
} from '../types/weaviate';
import { isNumericMetrics, isDateMetrics } from '../types/weaviate';

// Debug flag - set to false for production
const DEBUG = false;

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
      'Suggestions: Try again, reduce page size, add filters to narrow results, or check server connectivity.'
  );
}

/**
 * API class for interacting with Weaviate collections in the Data Explorer
 */
export class DataExplorerAPI {
  private countCache = new Map<string, { count: number; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly REQUEST_TIMEOUT = DEFAULT_TIMEOUT_MS;

  constructor(private client: WeaviateClient) {}

  /**
   * Helper method to check if a collection schema has multi-tenancy enabled
   */
  private isMultiTenantCollection(schema: CollectionConfig): boolean {
    return !!(schema.multiTenancy as any)?.enabled;
  }

  /**
   * Fetches objects from a collection with pagination, sorting, filtering, and vector search support
   * Supports three query modes:
   * 1. Boolean-only (default): Uses fetchObjects for standard pagination/filtering
   * 2. nearText: Semantic search using text query
   * 3. nearVector: Similarity search using vector embedding
   */
  async fetchObjects(params: FetchObjectsParams): Promise<FetchObjectsResponse> {
    try {
      // Get collection - use tenant-aware method if tenant is specified
      const collection = params.tenant
        ? this.client.collections.use(params.collectionName).withTenant(params.tenant)
        : this.client.collections.get(params.collectionName);

      // Build common query options using Weaviate types
      const baseOptions: WeaviateQueryOptions = {
        limit: params.limit ?? 20,
        returnMetadata: ['creationTime', 'updateTime', 'distance', 'certainty'],
        includeVector: true,
      };

      // Add offset for non-vector search queries (vector search uses limit only)
      if (!params.vectorSearch || params.vectorSearch.type === 'none') {
        baseOptions.offset = params.offset ?? 0;
      }

      // Add properties if specified
      if (params.properties && params.properties.length > 0) {
        baseOptions.returnProperties = params.properties;
      }

      // Add sorting if specified (only for boolean queries, not vector search)
      if (params.sortBy && (!params.vectorSearch || params.vectorSearch.type === 'none')) {
        // Use the collection's sort builder - cast to unknown first for type safety
        const sortOrder = params.sortBy.direction.toLowerCase() === 'asc' ? 'asc' : 'desc';
        baseOptions.sort = (
          collection.sort as unknown as {
            byProperty: (field: string, order: 'asc' | 'desc') => WeaviateSortBuilder;
          }
        ).byProperty(params.sortBy.field, sortOrder as 'asc' | 'desc');
      }

      // Add filters if specified (works with all query types)
      if (params.where && params.where.length > 0) {
        const filter = this.buildWhereFilter(collection, params.where, params.matchMode || 'AND');
        if (filter) {
          baseOptions.filters = filter;
        }
      }

      // Execute appropriate query based on vector search type
      const result = await this.executeQuery(collection, baseOptions, params.vectorSearch);

      // Transform result to our format
      const objects: WeaviateObject[] = result.objects.map(
        (obj: {
          uuid: string;
          properties: unknown;
          metadata?: {
            creationTime?: Date;
            updateTime?: Date;
            distance?: number;
            certainty?: number;
          };
          vector?: number[];
          vectors?: Record<string, number[]>;
        }) => ({
          uuid: obj.uuid,
          properties: this._validateProperties(obj.properties),
          metadata: {
            uuid: obj.uuid,
            creationTime: obj.metadata?.creationTime?.toISOString(),
            lastUpdateTime: obj.metadata?.updateTime?.toISOString(),
            distance: obj.metadata?.distance,
            certainty: obj.metadata?.certainty,
          },
          vector: obj.vector,
          vectors: obj.vectors,
        })
      );

      // Get total count using cached aggregate (with filter consideration)
      let total = 0;
      let unfilteredTotal: number | undefined = undefined;
      const hasFilters = params.where && params.where.length > 0;
      const cacheKey = hasFilters
        ? `${params.collectionName}:filtered:${JSON.stringify(params.where)}:${params.matchMode || 'AND'}`
        : params.collectionName;
      const cached = this.countCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        // Use cached count
        total = cached.count;
      } else {
        // Fetch fresh count using aggregation (more efficient than fetching objects)
        try {
          if (hasFilters && baseOptions.filters) {
            // Use aggregate with filters for efficient counting
            const aggregateResult = await collection.aggregate.overAll({
              filters: baseOptions.filters,
            } as WeaviateAggregateOptions);
            total = aggregateResult.totalCount ?? objects.length;
          } else {
            const aggregateResult = await collection.aggregate.overAll();
            total = aggregateResult.totalCount ?? objects.length;
          }
          this.countCache.set(cacheKey, { count: total, timestamp: now });
        } catch (aggregateError) {
          console.warn('Failed to get aggregate count:', aggregateError);
          // Distinguish between cache available vs no cache scenarios
          if (cached) {
            // Log that we're using stale cache
            const staleness = now - cached.timestamp;
            console.warn(
              `Using stale count cache (${staleness}ms old). ` +
                `Aggregate count failed: ${aggregateError instanceof Error ? aggregateError.message : String(aggregateError)}`
            );
            total = cached.count;
          } else {
            // No cache available - log error and fall back to objects length
            console.error(
              'Failed to get aggregate count and no cache available. Using object count as fallback.',
              aggregateError
            );
            total = objects.length;
          }
        }
      }

      // Get unfiltered total count when filters are active
      if (hasFilters) {
        const unfilteredCacheKey = params.collectionName;
        const unfilteredCached = this.countCache.get(unfilteredCacheKey);

        if (unfilteredCached && now - unfilteredCached.timestamp < this.CACHE_TTL) {
          // Use cached unfiltered count
          unfilteredTotal = unfilteredCached.count;
        } else {
          // Fetch fresh unfiltered count
          try {
            const aggregateResult = await collection.aggregate.overAll();
            unfilteredTotal = aggregateResult.totalCount ?? total;
            this.countCache.set(unfilteredCacheKey, { count: unfilteredTotal, timestamp: now });
          } catch (aggregateError) {
            console.warn('Failed to get unfiltered aggregate count:', aggregateError);
            // Use cached value if available
            if (unfilteredCached) {
              unfilteredTotal = unfilteredCached.count;
            }
            // If no cache, don't set unfilteredTotal (will be undefined)
          }
        }
      }

      return { objects, total, unfilteredTotal };
    } catch (error) {
      console.error('Error fetching objects from collection:', {
        collection: params.collectionName,
        limit: params.limit,
        offset: params.offset,
        hasFilters: params.where && params.where.length > 0,
        hasVectorSearch: params.vectorSearch?.type !== 'none',
        error,
      });

      // Provide specific, actionable error messages for common issues
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('stopwords')) {
        throw new Error(
          `[Collection: ${params.collectionName}] Filter contains only stopwords (common words like "the", "a", "is"). ` +
            'Please use more specific terms or try the "Equal" operator instead of "Like".'
        );
      }

      if (
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('does not exist')
      ) {
        throw new Error(
          `Collection "${params.collectionName}" not found. Please verify the collection name and that you\'re connected to the correct Weaviate instance.`
        );
      }

      if (isTimeoutError(error)) {
        throw createTimeoutError(
          'Data fetch',
          `collection "${params.collectionName}"`,
          this.REQUEST_TIMEOUT
        );
      }

      if (
        errorMessage.toLowerCase().includes('authentication') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('forbidden')
      ) {
        throw new Error(
          'Authentication failed. Please verify your connection credentials and try again.'
        );
      }

      if (errorMessage.toLowerCase().includes('invalid filter')) {
        throw new Error(
          `[Collection: ${params.collectionName}] Invalid filter syntax. Please check your filter conditions and try again.`
        );
      }

      // Generic error with context
      throw new Error(
        `[Collection: ${params.collectionName}] Failed to fetch objects: ${errorMessage}`
      );
    }
  }

  /**
   * Executes the appropriate query based on vector search type
   * @param collection - The Weaviate collection to query
   * @param options - Base query options (limit, filters, etc.)
   * @param vectorSearch - Optional vector search parameters
   * @returns Query result with objects array
   */
  private async executeQuery(
    collection: Collection,
    options: WeaviateQueryOptions,
    vectorSearch?: VectorSearchParams
  ): Promise<WeaviateQueryResult> {
    // Determine query mode
    if (!vectorSearch || vectorSearch.type === 'none') {
      // Boolean-only query mode (default)
      return collection.query.fetchObjects(options);
    }

    // Build vector search options using Weaviate vector query types
    const vectorOptions: WeaviateVectorQueryOptions = {
      limit: options.limit,
      returnMetadata: options.returnMetadata,
    };

    if (options.returnProperties) {
      vectorOptions.returnProperties = options.returnProperties;
    }

    if (options.filters) {
      vectorOptions.filters = options.filters;
    }

    // Add distance/certainty constraints
    if (vectorSearch.certainty !== undefined) {
      vectorOptions.certainty = vectorSearch.certainty;
    }
    if (vectorSearch.distance !== undefined) {
      vectorOptions.distance = vectorSearch.distance;
    }

    // Add distance metric if specified
    // Note: Weaviate typically uses the distance metric configured at collection level,
    // but we pass it through for potential client library support
    if (vectorSearch.distanceMetric) {
      vectorOptions.distanceMetric = vectorSearch.distanceMetric;
    }

    // Add target vector for named vectors
    if (vectorSearch.targetVector) {
      vectorOptions.targetVector = vectorSearch.targetVector;
    }

    // Execute appropriate vector search
    // Cast to Record<string, unknown> for Weaviate client compatibility
    const queryOptions = vectorOptions as Record<string, unknown>;

    if (vectorSearch.type === 'nearText') {
      if (!vectorSearch.text) {
        throw new Error('nearText search requires a text query');
      }
      return collection.query.nearText(vectorSearch.text, queryOptions);
    }

    if (vectorSearch.type === 'nearVector') {
      if (!vectorSearch.vector || vectorSearch.vector.length === 0) {
        throw new Error('nearVector search requires a vector');
      }
      // Validate that all vector elements are valid numbers
      if (!vectorSearch.vector.every((n) => typeof n === 'number' && isFinite(n))) {
        throw new Error(
          'nearVector search requires a vector of valid numbers (no NaN, Infinity, null, or undefined)'
        );
      }
      return collection.query.nearVector(vectorSearch.vector, queryOptions);
    }

    if (vectorSearch.type === 'nearObject') {
      if (!vectorSearch.objectId) {
        throw new Error('nearObject search requires an object UUID');
      }
      return collection.query.nearObject(vectorSearch.objectId, queryOptions);
    }

    // Hybrid search - combines BM25 keyword search with vector similarity
    if (vectorSearch.type === 'hybrid') {
      if (!vectorSearch.text) {
        throw new Error('hybrid search requires a text query');
      }

      // Build hybrid-specific options
      const hybridOptions: WeaviateHybridQueryOptions = {
        ...vectorOptions,
        alpha: vectorSearch.alpha ?? 0.5, // 0 = pure BM25, 1 = pure vector
        returnMetadata: ['score', 'distance', 'certainty', 'explainScore'],
      };

      // Add fusion type if specified (default: rankedFusion)
      if (vectorSearch.fusionType) {
        hybridOptions.fusionType = vectorSearch.fusionType;
      }

      // Add target properties for keyword search (empty array = search all text properties)
      if (vectorSearch.properties && vectorSearch.properties.length > 0) {
        hybridOptions.queryProperties = vectorSearch.properties;
      }

      return collection.query.hybrid(vectorSearch.text, hybridOptions as Record<string, unknown>);
    }

    // Fallback to standard fetch
    return collection.query.fetchObjects(options);
  }

  /**
   * Builds a Weaviate filter from FilterCondition array
   * Combines multiple conditions with AND or OR logic based on matchMode
   *
   * @returns WeaviateFilter or null if no valid conditions (null = no filtering)
   */
  private buildWhereFilter(
    collection: Collection,
    conditions: FilterCondition[],
    matchMode: FilterMatchMode = 'AND'
  ): WeaviateFilter | null {
    // Return null for empty conditions - this is not an error, just means "no filter"
    if (!conditions || conditions.length === 0) {
      return null;
    }

    // Build individual filters
    const filters: WeaviateFilter[] = conditions
      .map((condition) => this.buildSingleFilter(collection, condition))
      .filter((f): f is WeaviateFilter => f !== null && f !== undefined);

    // Return null if all conditions were invalid - this is not an error
    if (filters.length === 0) {
      return null;
    }

    if (filters.length === 1) {
      return filters[0];
    }

    // Combine multiple filters using Filters.and() or Filters.or()
    if (matchMode === 'OR') {
      return Filters.or(...filters);
    } else {
      return Filters.and(...filters);
    }
  }

  /**
   * Builds a single filter condition for Weaviate
   */
  private buildSingleFilter(
    collection: Collection,
    condition: FilterCondition
  ): WeaviateFilter | null {
    try {
      const { path, operator, value, valueType } = condition;

      // Get the filter builder for this property
      const filterBuilder = collection.filter.byProperty(path);

      // Apply the appropriate operator
      switch (operator) {
        case 'Equal':
          return filterBuilder.equal(this.coerceValue(value, valueType));

        case 'NotEqual':
          return filterBuilder.notEqual(this.coerceValue(value, valueType));

        case 'GreaterThan':
          return filterBuilder.greaterThan(this.coerceValue(value, valueType) as number | Date);

        case 'GreaterThanEqual':
          return filterBuilder.greaterOrEqual(this.coerceValue(value, valueType) as number | Date);

        case 'LessThan':
          return filterBuilder.lessThan(this.coerceValue(value, valueType) as number | Date);

        case 'LessThanEqual':
          return filterBuilder.lessOrEqual(this.coerceValue(value, valueType) as number | Date);

        case 'Like':
          // Like uses wildcard patterns - if user provides wildcards, use as-is; otherwise wrap for "contains" behavior
          const likeValue = String(value);
          const hasWildcard = likeValue.includes('*') || likeValue.includes('?');
          const pattern = hasWildcard ? likeValue : `*${likeValue}*`;
          return filterBuilder.like(pattern);

        case 'ContainsAny':
          // ContainsAny expects an array
          const anyValues = Array.isArray(value) ? value : [value];
          return filterBuilder.containsAny(anyValues);

        case 'ContainsAll':
          // ContainsAll expects an array
          const allValues = Array.isArray(value) ? value : [value];
          return filterBuilder.containsAll(allValues);

        case 'IsNull':
          return filterBuilder.isNull(true);

        case 'IsNotNull':
          return filterBuilder.isNull(false);

        default:
          throw new Error(`Unknown filter operator: ${operator}`);
      }
    } catch (error) {
      console.error(`Error building filter for condition:`, condition, error);
      throw new Error(
        `Failed to build filter for path "${condition.path}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Coerces a value to the appropriate type based on valueType hint
   */
  private coerceValue(value: unknown, valueType?: 'text' | 'number' | 'boolean' | 'date'): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (valueType) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;

      case 'boolean':
        if (typeof value === 'boolean') {
          return value;
        }
        if (value === 'true') {
          return true;
        }
        if (value === 'false') {
          return false;
        }
        return Boolean(value);

      case 'date':
        // Return ISO string for dates
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Try to parse string as date
        const date = new Date(String(value));
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
        return value;

      case 'text':
      default:
        return String(value);
    }
  }

  /**
   * Gets the schema configuration for a collection
   */
  async getCollectionSchema(collectionName: string): Promise<CollectionConfig> {
    try {
      const collection = this.client.collections.get(collectionName);
      const config = await collection.config.get();

      // Transform to our CollectionConfig format
      const schema: CollectionConfig = {
        name: config.name,
        description: config.description || undefined,
        properties: this.transformProperties(config.properties),
        vectorizerConfig: config.vectorizers,
        generativeConfig: config.generative,
        replicationConfig: config.replication,
        invertedIndex: config.invertedIndex,
        multiTenancy: config.multiTenancy,
        shardingConfig: config.sharding,
      };

      return schema;
    } catch (error) {
      console.error('Error getting collection schema:', error);
      throw error;
    }
  }

  /**
   * Fetches a single object by UUID
   */
  async getObjectByUuid(
    collectionName: string,
    uuid: string,
    tenant?: string
  ): Promise<WeaviateObject> {
    try {
      const collection = tenant
        ? this.client.collections.use(collectionName).withTenant(tenant)
        : this.client.collections.get(collectionName);

      const obj = await collection.query.fetchObjectById(uuid, {
        includeVector: true,
      });

      if (!obj) {
        throw new Error(`Object with UUID ${uuid} not found`);
      }

      // Extract default vector from vectors if available
      let defaultVector: number[] | undefined;
      if (obj.vectors?.default) {
        const vecData = obj.vectors.default;
        if (Array.isArray(vecData) && vecData.length > 0 && typeof vecData[0] === 'number') {
          defaultVector = vecData as number[];
        }
      }

      return {
        uuid: obj.uuid,
        properties: this._validateProperties(obj.properties),
        metadata: {
          uuid: obj.uuid,
          creationTime: obj.metadata?.creationTime?.toISOString(),
          lastUpdateTime: obj.metadata?.updateTime?.toISOString(),
        },
        vector: defaultVector,
        vectors: obj.vectors,
      };
    } catch (error) {
      console.error('Error fetching object by UUID:', error);
      throw error;
    }
  }

  /**
   * Gets the total count of objects in a collection
   */
  async getCollectionCount(collectionName: string, tenant?: string): Promise<number> {
    try {
      const collection = tenant
        ? this.client.collections.use(collectionName).withTenant(tenant)
        : this.client.collections.get(collectionName);
      const result = await withTimeout(collection.aggregate.overAll(), this.REQUEST_TIMEOUT);
      return result.totalCount ?? 0;
    } catch (error) {
      console.error('Error getting collection count:', error);
      if (isTimeoutError(error)) {
        throw createTimeoutError(
          'Count aggregation',
          `collection "${collectionName}"`,
          this.REQUEST_TIMEOUT
        );
      }
      throw new Error(
        `Failed to get count for collection "${collectionName}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets the list of tenants for a multi-tenant collection
   */
  async getTenants(
    collectionName: string
  ): Promise<Array<{ name: string; activityStatus?: string }>> {
    try {
      const collection = this.client.collections.use(collectionName);
      const tenants = await collection.tenants.get();

      // Transform tenants object to array
      return Object.entries(tenants).map(([name, info]: [string, any]) => ({
        name,
        activityStatus: info.activityStatus,
      }));
    } catch (error) {
      console.error('Error getting tenants:', error);
      throw new Error(
        `Failed to get tenants for collection "${collectionName}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clears the count cache for a collection (useful after filter changes)
   */
  clearCountCache(collectionName?: string): void {
    if (collectionName) {
      // Clear specific collection cache
      for (const key of this.countCache.keys()) {
        if (key.startsWith(collectionName)) {
          this.countCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.countCache.clear();
    }
  }

  /**
   * Transforms Weaviate property config to our format
   */
  private transformProperties(
    properties: Array<{
      name: string;
      dataType: string;
      description?: string;
      indexFilterable?: boolean;
      indexSearchable?: boolean;
      skipVectorization?: boolean;
      tokenization?: string;
      nestedProperties?: Array<{
        name: string;
        dataType: string;
        description?: string;
        indexFilterable?: boolean;
        indexSearchable?: boolean;
        skipVectorization?: boolean;
        tokenization?: string;
      }>;
    }>
  ): PropertyConfig[] {
    return properties.map((prop) => ({
      name: prop.name,
      dataType: [prop.dataType],
      description: prop.description,
      indexFilterable: prop.indexFilterable,
      indexSearchable: prop.indexSearchable,
      skipVectorisation: prop.skipVectorization,
      tokenization: prop.tokenization,
      nestedProperties: prop.nestedProperties
        ? this.transformProperties(
            prop.nestedProperties as Array<{
              name: string;
              dataType: string;
              description?: string;
              indexFilterable?: boolean;
              indexSearchable?: boolean;
              skipVectorization?: boolean;
              tokenization?: string;
              nestedProperties?: Array<{
                name: string;
                dataType: string;
              }>;
            }>
          )
        : undefined,
    }));
  }

  /**
   * Validates and safely casts properties object
   */
  private _validateProperties(props: unknown): Record<string, unknown> {
    if (typeof props === 'object' && props !== null && !Array.isArray(props)) {
      return props as Record<string, unknown>;
    }
    return {};
  }

  // =====================================================
  // Phase 5: Aggregation Methods
  // =====================================================

  /**
   * Gets aggregation statistics for a collection
   * Returns total count, top values for categorical properties,
   * min/max/avg for numeric properties, date ranges, and boolean counts
   */
  async getAggregations(params: AggregationParams): Promise<AggregationResult> {
    try {
      if (DEBUG) {
        console.log('[DataExplorerAPI] Getting aggregations for:', params.collectionName);
      }

      // Get collection - use tenant-aware method if tenant is specified
      const collection = params.tenant
        ? this.client.collections.use(params.collectionName).withTenant(params.tenant)
        : this.client.collections.get(params.collectionName);

      // Get collection schema to understand property types
      const schema = await this.getCollectionSchema(params.collectionName);
      const properties = schema.properties || [];

      if (DEBUG) {
        console.log(
          '[DataExplorerAPI] Schema properties:',
          properties.map((p) => p.name)
        );
      }

      // Build filter if specified
      let filters: WeaviateFilter | null = null;
      if (params.where && params.where.length > 0) {
        filters = this.buildWhereFilter(collection, params.where, params.matchMode || 'AND');
      }

      // Get total count
      const countResult = filters
        ? await collection.aggregate.overAll({ filters } as WeaviateAggregateOptions)
        : await collection.aggregate.overAll();
      const totalCount = countResult.totalCount ?? 0;

      if (DEBUG) {
        console.log('[DataExplorerAPI] Total count:', totalCount);
      }

      // Initialize result
      const result: AggregationResult = {
        totalCount,
        topValues: [],
        numericStats: [],
        dateRange: [],
        booleanCounts: [],
        aggregationFailures: [],
      };

      // Process each property based on its type
      const propertiesToProcess =
        params.properties && params.properties.length > 0
          ? properties.filter((p) => params.properties!.includes(p.name))
          : properties;

      if (DEBUG) {
        console.log(
          '[DataExplorerAPI] Processing properties:',
          propertiesToProcess.map((p) => `${p.name} (${p.dataType[0]})`)
        );
      }

      for (const prop of propertiesToProcess) {
        const dataType = prop.dataType[0]?.toLowerCase() || '';
        const propName = prop.name;

        try {
          if (DEBUG) {
            console.log(`[DataExplorerAPI] Aggregating property: ${propName} (${dataType})`);
          }

          if (dataType === 'text' || dataType === 'string') {
            // Get top values for text properties
            const topValues = await this.getPropertyTopValues(
              collection,
              propName,
              totalCount,
              filters
            );
            if (topValues && topValues.values.length > 0) {
              result.topValues!.push(topValues);
              if (DEBUG) {
                console.log(`[DataExplorerAPI] Added top values for ${propName}`);
              }
            }
          } else if (dataType === 'int' || dataType === 'number') {
            // Get numeric stats
            const numericStats = await this.getPropertyNumericStats(collection, propName, filters);
            if (numericStats) {
              result.numericStats!.push(numericStats);
              if (DEBUG) {
                console.log(`[DataExplorerAPI] Added numeric stats for ${propName}`);
              }
            }
          } else if (dataType === 'date') {
            // Get date range
            const dateRange = await this.getPropertyDateRange(collection, propName, filters);
            if (dateRange) {
              result.dateRange!.push(dateRange);
              if (DEBUG) {
                console.log(`[DataExplorerAPI] Added date range for ${propName}`);
              }
            }
          } else if (dataType === 'boolean') {
            // Get boolean counts
            const booleanCounts = await this.getPropertyBooleanCounts(
              collection,
              propName,
              totalCount,
              filters
            );
            if (booleanCounts) {
              result.booleanCounts!.push(booleanCounts);
              if (DEBUG) {
                console.log(`[DataExplorerAPI] Added boolean counts for ${propName}`);
              }
            }
          }
        } catch (propError) {
          // Collect failure details with property info
          const errorMessage = propError instanceof Error ? propError.message : String(propError);
          console.warn(`[DataExplorerAPI] Failed to aggregate property ${propName}:`, propError);
          result.aggregationFailures!.push({
            property: propName,
            error: errorMessage,
            type: dataType,
          });
        }
      }

      if (DEBUG) {
        console.log('[DataExplorerAPI] Aggregation result:', {
          totalCount: result.totalCount,
          topValues: result.topValues?.length || 0,
          numericStats: result.numericStats?.length || 0,
          dateRange: result.dateRange?.length || 0,
          booleanCounts: result.booleanCounts?.length || 0,
          aggregationFailures: result.aggregationFailures?.length || 0,
        });
      }

      return result;
    } catch (error) {
      console.error('[DataExplorerAPI] Error getting aggregations:', error);
      throw error;
    }
  }

  /**
   * Gets top values for a text property using aggregation
   *
   * @returns PropertyTopValues or null if no data available (graceful degradation)
   * @throws Error only for actual API failures (logged as warnings, not thrown)
   */
  private async getPropertyTopValues(
    collection: Collection,
    propertyName: string,
    totalCount: number,
    filters?: WeaviateFilter | null
  ): Promise<PropertyTopValues | null> {
    try {
      // Use groupBy aggregation to get value counts
      const groupByOptions: WeaviateGroupByOptions = {
        groupBy: { property: propertyName },
      };
      if (filters) {
        groupByOptions.filters = filters;
      }
      const result = await collection.aggregate.groupBy.overAll(groupByOptions);

      // Result is an array, not an object with groups property
      const groupByResult = result as WeaviateGroupByResult;
      // Return null if no data - this is not an error, just means no values to aggregate
      if (!groupByResult || !Array.isArray(groupByResult) || groupByResult.length === 0) {
        return null;
      }

      // Sort by count and take top 5
      const sortedGroups = groupByResult
        .filter((g) => g.groupedBy?.value !== null && g.groupedBy?.value !== undefined)
        .sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0))
        .slice(0, 5);

      const values = sortedGroups.map((group) => ({
        value: String(group.groupedBy?.value || 'N/A'),
        count: group.totalCount || 0,
        percentage: totalCount > 0 ? Math.round(((group.totalCount || 0) / totalCount) * 100) : 0,
      }));

      return {
        property: propertyName,
        values,
      };
    } catch (error) {
      // Log warning but return null - allows partial aggregation results
      console.warn(`Failed to get top values for ${propertyName}:`, error);
      return null;
    }
  }

  /**
   * Gets numeric statistics for a number/int property
   *
   * @returns PropertyNumericStats or null if no data/wrong type (graceful degradation)
   * @throws Error only for actual API failures (logged as warnings, not thrown)
   */
  private async getPropertyNumericStats(
    collection: Collection,
    propertyName: string,
    filters?: WeaviateFilter | null
  ): Promise<PropertyNumericStats | null> {
    try {
      const numericOptions: WeaviateAggregateOptions = {
        returnMetrics: collection.metrics
          .aggregate(propertyName)
          .integer(['count', 'maximum', 'mean', 'median', 'minimum', 'sum']),
      };
      if (filters) {
        numericOptions.filters = filters;
      }
      const result = await collection.aggregate.overAll(numericOptions);

      const metrics = result.properties?.[propertyName] as WeaviateNumericMetrics | undefined;
      if (!metrics || !isNumericMetrics(metrics)) {
        // Try number type instead of integer
        const numberOptions: WeaviateAggregateOptions = {
          returnMetrics: collection.metrics
            .aggregate(propertyName)
            .number(['count', 'maximum', 'mean', 'median', 'minimum', 'sum']),
        };
        if (filters) {
          numberOptions.filters = filters;
        }
        const numberResult = await collection.aggregate.overAll(numberOptions);
        const numberMetrics = numberResult.properties?.[propertyName] as
          | WeaviateNumericMetrics
          | undefined;
        if (!numberMetrics || !isNumericMetrics(numberMetrics)) {
          return null;
        }

        return {
          property: propertyName,
          count: numberMetrics.count ?? 0,
          min: numberMetrics.minimum ?? 0,
          max: numberMetrics.maximum ?? 0,
          mean: numberMetrics.mean ?? 0,
          median: numberMetrics.median,
          sum: numberMetrics.sum,
        };
      }

      return {
        property: propertyName,
        count: metrics.count ?? 0,
        min: metrics.minimum ?? 0,
        max: metrics.maximum ?? 0,
        mean: metrics.mean ?? 0,
        median: metrics.median,
        sum: metrics.sum,
      };
    } catch (error) {
      // Log warning but return null - allows partial aggregation results
      console.warn(`Failed to get numeric stats for ${propertyName}:`, error);
      return null;
    }
  }

  /**
   * Gets date range for a date property
   *
   * @returns PropertyDateRange or null if no data/wrong type (graceful degradation)
   * @throws Error only for actual API failures (logged as warnings, not thrown)
   */
  private async getPropertyDateRange(
    collection: Collection,
    propertyName: string,
    filters?: WeaviateFilter | null
  ): Promise<PropertyDateRange | null> {
    try {
      const dateOptions: WeaviateAggregateOptions = {
        returnMetrics: collection.metrics.aggregate(propertyName).date(['minimum', 'maximum']),
      };
      if (filters) {
        dateOptions.filters = filters;
      }
      const result = await collection.aggregate.overAll(dateOptions);

      const metrics = result.properties?.[propertyName] as WeaviateDateMetrics | undefined;
      if (!metrics || !isDateMetrics(metrics)) {
        return null;
      }

      return {
        property: propertyName,
        earliest: metrics.minimum ? new Date(metrics.minimum).toISOString() : 'N/A',
        latest: metrics.maximum ? new Date(metrics.maximum).toISOString() : 'N/A',
      };
    } catch (error) {
      // Log warning but return null - allows partial aggregation results
      console.warn(`Failed to get date range for ${propertyName}:`, error);
      return null;
    }
  }

  /**
   * Gets boolean counts for a boolean property
   *
   * @returns PropertyBooleanCounts or null if no data/wrong type (graceful degradation)
   * @throws Error only for actual API failures (logged as warnings, not thrown)
   */
  private async getPropertyBooleanCounts(
    collection: Collection,
    propertyName: string,
    totalCount: number,
    filters?: WeaviateFilter | null
  ): Promise<PropertyBooleanCounts | null> {
    try {
      const boolOptions: WeaviateGroupByOptions = {
        groupBy: { property: propertyName },
      };
      if (filters) {
        boolOptions.filters = filters;
      }
      const result = await collection.aggregate.groupBy.overAll(boolOptions);

      // Result is an array, not an object with groups property
      const groupByResult = result as WeaviateGroupByResult;
      if (!groupByResult || !Array.isArray(groupByResult) || groupByResult.length === 0) {
        return null;
      }

      let trueCount = 0;
      let falseCount = 0;

      for (const group of groupByResult) {
        if (group.groupedBy?.value === true) {
          trueCount = group.totalCount || 0;
        } else if (group.groupedBy?.value === false) {
          falseCount = group.totalCount || 0;
        }
      }

      const total = trueCount + falseCount;
      return {
        property: propertyName,
        trueCount,
        falseCount,
        truePercentage: total > 0 ? Math.round((trueCount / total) * 100) : 0,
        falsePercentage: total > 0 ? Math.round((falseCount / total) * 100) : 0,
      };
    } catch (error) {
      // Log warning but return null - allows partial aggregation results
      console.warn(`Failed to get boolean counts for ${propertyName}:`, error);
      return null;
    }
  }

  // =====================================================
  // Phase 5: Export Methods
  // =====================================================

  /**
   * Exports objects from a collection in the specified format
   */
  async exportObjects(params: ExportParams, signal?: AbortSignal): Promise<ExportResult> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new Error('Export cancelled');
      }

      let objects: WeaviateObject[];
      let isTruncated = false;
      let totalCount: number | undefined;

      switch (params.scope) {
        case 'currentPage':
          // Use provided current objects
          objects = params.currentObjects || [];
          break;

        case 'filtered':
          // Fetch all objects matching the filter
          const filteredResult = await this.fetchAllObjects(
            params.collectionName,
            params.where,
            params.matchMode,
            signal,
            params.tenant
          );
          objects = filteredResult.objects;
          isTruncated = filteredResult.isTruncated;
          totalCount = filteredResult.totalCount;
          break;

        case 'all':
          // Use collection.iterator() for entire collection - more efficient for large datasets
          const allResult = await this.fetchAllObjectsWithIterator(
            params.collectionName,
            signal,
            params.tenant
          );
          objects = allResult.objects;
          isTruncated = allResult.isTruncated;
          totalCount = allResult.totalCount;
          break;

        default:
          objects = [];
      }

      // Check if aborted after fetching
      if (signal?.aborted) {
        throw new Error('Export cancelled');
      }

      // Format the data
      const data =
        params.format === 'json'
          ? this.toJSON(objects, params.options)
          : this.toCSV(objects, params.options);

      // Check if aborted after formatting
      if (signal?.aborted) {
        throw new Error('Export cancelled');
      }

      // Generate filename
      const filename = this.generateExportFilename(params);

      return {
        filename,
        data,
        objectCount: objects.length,
        format: params.format,
        isTruncated,
        totalCount,
        truncationLimit: isTruncated ? 10000 : undefined,
      };
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === 'Export cancelled')) {
        throw new Error('Export cancelled');
      }
      console.error('Error exporting objects:', error);
      if (isTimeoutError(error)) {
        throw createTimeoutError('Export', `collection "${params.collectionName}"`);
      }
      throw error;
    }
  }

  /**
   * Fetches all objects from a collection (with optional filters)
   * Uses pagination to handle large collections
   * Returns objects and truncation info
   */
  private async fetchAllObjects(
    collectionName: string,
    where?: FilterCondition[],
    matchMode?: FilterMatchMode,
    signal?: AbortSignal,
    tenant?: string
  ): Promise<{ objects: WeaviateObject[]; isTruncated: boolean; totalCount?: number }> {
    const allObjects: WeaviateObject[] = [];
    let offset = 0;
    const limit = 100;
    const maxObjects = 10000; // Safety limit
    let isTruncated = false;
    let totalCount: number | undefined;

    while (allObjects.length < maxObjects) {
      // Check if export was cancelled
      if (signal?.aborted) {
        throw new Error('Export cancelled');
      }

      const result = await this.fetchObjects({
        collectionName,
        limit,
        offset,
        where,
        matchMode,
        tenant,
      });

      allObjects.push(...result.objects);

      // Store total count from first request
      if (offset === 0) {
        totalCount = result.total;
      }

      // Break if we got fewer objects than requested (end of data)
      if (result.objects.length < limit) {
        break;
      }

      offset += limit;
    }

    // Check if we hit the max limit and there's more data
    if (allObjects.length >= maxObjects && totalCount && totalCount > maxObjects) {
      isTruncated = true;
    }

    return { objects: allObjects, isTruncated, totalCount };
  }

  /**
   * Fetches all objects from a collection using iterator (more efficient for entire collections)
   * Uses collection.iterator() which is optimized for scanning entire collections
   * Returns objects and truncation info
   */
  private async fetchAllObjectsWithIterator(
    collectionName: string,
    signal?: AbortSignal,
    tenant?: string
  ): Promise<{ objects: WeaviateObject[]; isTruncated: boolean; totalCount?: number }> {
    const allObjects: WeaviateObject[] = [];
    const maxObjects = 10000; // Safety limit
    let isTruncated = false;
    let totalCount: number | undefined;

    try {
      const collection = tenant
        ? this.client.collections.use(collectionName).withTenant(tenant)
        : this.client.collections.get(collectionName);

      // Get total count first
      try {
        const aggregateResult = await collection.aggregate.overAll();
        totalCount = aggregateResult.totalCount ?? 0;
      } catch (aggregateError) {
        console.warn('Failed to get total count:', aggregateError);
      }

      // Use iterator for efficient scanning
      const iterator = collection.iterator({
        includeVector: true,
        returnMetadata: ['creationTime', 'updateTime'],
      });

      for await (const obj of iterator) {
        // Check if export was cancelled
        if (signal?.aborted) {
          throw new Error('Export cancelled');
        }

        // Check safety limit
        if (allObjects.length >= maxObjects) {
          isTruncated = true;
          break;
        }

        // Extract default vector from vectors if available
        let defaultVector: number[] | undefined;
        if (obj.vectors?.default) {
          const vecData = obj.vectors.default;
          if (Array.isArray(vecData) && vecData.length > 0 && typeof vecData[0] === 'number') {
            defaultVector = vecData as number[];
          }
        }

        allObjects.push({
          uuid: obj.uuid,
          properties: this._validateProperties(obj.properties),
          metadata: {
            uuid: obj.uuid,
            creationTime: obj.metadata?.creationTime?.toISOString(),
            lastUpdateTime: obj.metadata?.updateTime?.toISOString(),
          },
          vector: defaultVector,
          vectors: obj.vectors,
        });
      }

      return { objects: allObjects, isTruncated, totalCount };
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === 'Export cancelled')) {
        throw new Error('Export cancelled');
      }
      console.error('Error fetching objects with iterator:', error);
      throw error;
    }
  }

  /**
   * Converts objects to JSON format
   */
  private toJSON(objects: WeaviateObject[], options: ExportOptions): string {
    const formatted = objects.map((obj) => {
      const result: Record<string, unknown> = {};

      // Add metadata if requested
      if (options.includeMetadata) {
        result.uuid = obj.uuid;
        if (obj.metadata?.creationTime) {
          result.createdAt = obj.metadata.creationTime;
        }
        if (obj.metadata?.lastUpdateTime) {
          result.updatedAt = obj.metadata.lastUpdateTime;
        }
      }

      // Add properties
      if (options.includeProperties) {
        if (options.flattenNested) {
          Object.assign(result, this.flattenObject(obj.properties));
        } else {
          Object.assign(result, obj.properties);
        }
      }

      // Add vectors if requested
      if (options.includeVectors) {
        if (obj.vector) {
          result.vector = obj.vector;
        }
        if (obj.vectors) {
          result.vectors = obj.vectors;
        }
      }

      return result;
    });

    return JSON.stringify(formatted, null, 2);
  }

  /**
   * Converts objects to CSV format
   */
  private toCSV(objects: WeaviateObject[], options: ExportOptions): string {
    if (objects.length === 0) {
      return '';
    }

    // Collect all unique column names
    const columns = new Set<string>();

    if (options.includeMetadata) {
      columns.add('uuid');
      columns.add('createdAt');
      columns.add('updatedAt');
    }

    // Get property columns from first object (assuming consistent schema)
    if (options.includeProperties) {
      const sampleObj = objects[0];
      if (options.flattenNested) {
        const flattened = this.flattenObject(sampleObj.properties);
        Object.keys(flattened).forEach((key) => columns.add(key));
      } else {
        Object.keys(sampleObj.properties).forEach((key) => columns.add(key));
      }
    }

    // Note: Vectors are typically too large for CSV, but include a flag if requested
    if (options.includeVectors) {
      columns.add('hasVector');
    }

    const columnArray = Array.from(columns);

    // Build CSV header
    const header = columnArray.map((col) => this.escapeCSV(col)).join(',');

    // Build CSV rows - flatten once per object for performance
    const rows = objects.map((obj) => {
      const row: string[] = [];
      const flattenedProps = options.flattenNested
        ? this.flattenObject(obj.properties)
        : obj.properties;

      for (const col of columnArray) {
        let value: unknown = '';

        if (col === 'uuid') {
          value = obj.uuid;
        } else if (col === 'createdAt') {
          value = obj.metadata?.creationTime || '';
        } else if (col === 'updatedAt') {
          value = obj.metadata?.lastUpdateTime || '';
        } else if (col === 'hasVector') {
          value = obj.vector ? 'true' : 'false';
        } else {
          value = flattenedProps[col];
        }

        // Format the value for CSV
        row.push(this.formatCSVValue(value));
      }

      return row.join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Flattens nested objects using dot notation
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix: string = ''
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Escapes a string for CSV (handles quotes, commas, newlines)
   */
  private escapeCSV(value: string): string {
    if (
      value.includes('"') ||
      value.includes(',') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Formats a value for CSV output
   */
  private formatCSVValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return this.escapeCSV(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      // Join arrays with semicolon to avoid CSV delimiter conflicts
      return this.escapeCSV(value.map((v) => String(v)).join(';'));
    }

    if (typeof value === 'object') {
      return this.escapeCSV(JSON.stringify(value));
    }

    return String(value);
  }

  /**
   * Generates a filename for the export
   */
  private generateExportFilename(params: ExportParams): string {
    const date = new Date().toISOString().split('T')[0];
    const scopeSuffix =
      params.scope === 'all' ? 'all' : params.scope === 'filtered' ? 'filtered' : 'page';
    const extension = params.format === 'json' ? 'json' : 'csv';
    const tenantSuffix = params.tenant ? `_TENANT_${params.tenant}` : '';
    return `${params.collectionName}${tenantSuffix}_${date}_${scopeSuffix}.${extension}`;
  }
}
