/**
 * DataExplorerAPI - Weaviate API wrapper for Data Explorer
 * Handles all Weaviate client interactions for fetching objects and schema
 */

import type { WeaviateClient } from 'weaviate-client';
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
} from '../types';

/**
 * API class for interacting with Weaviate collections in the Data Explorer
 */
export class DataExplorerAPI {
  private countCache = new Map<string, { count: number; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(private client: WeaviateClient) {}

  /**
   * Fetches objects from a collection with pagination, sorting, filtering, and vector search support
   * Supports three query modes:
   * 1. Boolean-only (default): Uses fetchObjects for standard pagination/filtering
   * 2. nearText: Semantic search using text query
   * 3. nearVector: Similarity search using vector embedding
   */
  async fetchObjects(params: FetchObjectsParams): Promise<FetchObjectsResponse> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      // Build common query options - using interface for type safety
      interface BaseQueryOptions {
        limit: number;
        offset?: number;
        returnMetadata: string[];
        returnProperties?: string[];
        sort?: Array<{ path: string[]; order: string }>;
        filters?: unknown; // Weaviate filter type is complex, kept as unknown
      }

      const baseOptions: BaseQueryOptions = {
        limit: params.limit,
        returnMetadata: ['creationTime', 'updateTime', 'distance', 'certainty'],
      };

      // Add offset for non-vector search queries (vector search uses limit only)
      if (!params.vectorSearch || params.vectorSearch.type === 'none') {
        baseOptions.offset = params.offset;
      }

      // Add properties if specified
      if (params.properties && params.properties.length > 0) {
        baseOptions.returnProperties = params.properties;
      }

      // Add sorting if specified (only for boolean queries, not vector search)
      if (params.sortBy && (!params.vectorSearch || params.vectorSearch.type === 'none')) {
        baseOptions.sort = [{ path: [params.sortBy.field], order: params.sortBy.direction }];
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
        })
      );

      // Get total count using cached aggregate (with filter consideration)
      let total = 0;
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
              filters: baseOptions.filters as any,
            });
            total = aggregateResult.totalCount ?? objects.length;
          } else {
            const aggregateResult = await collection.aggregate.overAll();
            total = aggregateResult.totalCount ?? objects.length;
          }
          this.countCache.set(cacheKey, { count: total, timestamp: now });
        } catch (aggregateError) {
          console.warn('Failed to get aggregate count:', aggregateError);
          // Fallback to cached value or objects length
          total = cached?.count ?? objects.length;
        }
      }

      return { objects, total };
    } catch (error) {
      console.error('Error fetching objects:', error);

      // Provide better error messages for common issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('stopwords')) {
        throw new Error(
          'Filter contains only stopwords (common words like "the", "a", "is"). ' +
            'Please use more specific terms or try the "Equal" operator instead of "Like".'
        );
      }

      throw error;
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
    collection: any,
    options: {
      limit: number;
      offset?: number;
      returnMetadata: string[];
      returnProperties?: string[];
      sort?: Array<{ path: string[]; order: string }>;
      filters?: unknown;
    },
    vectorSearch?: VectorSearchParams
  ): Promise<{ objects: any[] }> {
    // Determine query mode
    if (!vectorSearch || vectorSearch.type === 'none') {
      // Boolean-only query mode (default)
      return collection.query.fetchObjects(options);
    }

    // Build vector search options

    const vectorOptions: any = {
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

    // Add target vector for named vectors
    if (vectorSearch.targetVector) {
      vectorOptions.targetVector = vectorSearch.targetVector;
    }

    // Execute appropriate vector search
    if (vectorSearch.type === 'nearText') {
      if (!vectorSearch.text) {
        throw new Error('nearText search requires a text query');
      }
      return collection.query.nearText(vectorSearch.text, vectorOptions);
    }

    if (vectorSearch.type === 'nearVector') {
      if (!vectorSearch.vector || vectorSearch.vector.length === 0) {
        throw new Error('nearVector search requires a vector');
      }
      return collection.query.nearVector(vectorSearch.vector, vectorOptions);
    }

    // Fallback to standard fetch
    return collection.query.fetchObjects(options);
  }

  /**
   * Builds a Weaviate filter from FilterCondition array
   * Combines multiple conditions with AND or OR logic based on matchMode
   */

  private buildWhereFilter(
    collection: any,
    conditions: FilterCondition[],
    matchMode: FilterMatchMode = 'AND'
  ): unknown {
    if (!conditions || conditions.length === 0) {
      return null;
    }

    // Build individual filters

    const filters: any[] = conditions
      .map((condition) => this.buildSingleFilter(collection, condition))
      .filter(Boolean);

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

  private buildSingleFilter(collection: any, condition: FilterCondition): unknown {
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
          // Like uses wildcard patterns
          return filterBuilder.like(String(value));

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
          console.warn(`Unknown filter operator: ${operator}`);
          return null;
      }
    } catch (error) {
      console.error(`Error building filter for condition:`, condition, error);
      return null;
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
  async getObjectByUuid(collectionName: string, uuid: string): Promise<WeaviateObject> {
    try {
      const collection = this.client.collections.get(collectionName);

      const obj = await collection.query.fetchObjectById(uuid, {
        includeVector: true,
      });

      if (!obj) {
        throw new Error(`Object with UUID ${uuid} not found`);
      }

      // Handle vector types - could be number[] or number[][]
      let vector: number[] | undefined;
      if (obj.vectors?.default) {
        const defaultVector = obj.vectors.default;
        if (Array.isArray(defaultVector) && typeof defaultVector[0] === 'number') {
          vector = defaultVector as number[];
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
        vector,
        vectors: undefined, // Skip named vectors for now
      };
    } catch (error) {
      console.error('Error fetching object by UUID:', error);
      throw error;
    }
  }

  /**
   * Gets the total count of objects in a collection
   */
  async getCollectionCount(collectionName: string): Promise<number> {
    try {
      const collection = this.client.collections.get(collectionName);
      const result = await collection.aggregate.overAll();
      return result.totalCount ?? 0;
    } catch (error) {
      console.error('Error getting collection count:', error);
      return 0;
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
}
