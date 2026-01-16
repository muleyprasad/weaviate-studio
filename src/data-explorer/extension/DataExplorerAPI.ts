/**
 * API service for Data Explorer to interact with Weaviate client
 */

import type { WeaviateClient, WeaviateObject } from 'weaviate-client';
import type {
  FetchParams,
  FetchResult,
  CollectionSchema,
  PropertySchema,
  PropertyDataType,
  VectorizerConfig,
  WhereFilter,
  Filter,
} from '../types';
import { buildWhereFilter } from '../utils/filterUtils';

export class DataExplorerAPI {
  constructor(private client: WeaviateClient) {}

  /**
   * Fetch objects from a collection with pagination and sorting
   */
  async fetchObjects(params: FetchParams): Promise<FetchResult> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      // Build query options with proper types
      interface QueryOptions {
        limit: number;
        offset: number;
        returnMetadata: string[];
        returnProperties?: string[];
        sort?: {
          path: string;
          order: 'asc' | 'desc';
        };
        where?: WhereFilter;
      }

      const queryOptions: QueryOptions = {
        limit: params.limit,
        offset: params.offset,
        returnMetadata: ['uuid', 'creationTimeUnix', 'lastUpdateTimeUnix', 'vector'],
      };

      // Add properties if specified
      if (params.properties && params.properties.length > 0) {
        queryOptions.returnProperties = params.properties;
      }

      // Add sorting if specified
      if (params.sortBy) {
        queryOptions.sort = {
          path: params.sortBy.field,
          order: params.sortBy.direction,
        };
      }

      // Add filters if specified
      if (params.filters && params.filters.length > 0) {
        const whereFilter = buildWhereFilter(params.filters);
        if (whereFilter) {
          queryOptions.where = whereFilter;
        }
      }

      // Execute query
      const result = await collection.query.fetchObjects(queryOptions as any); // Weaviate client types are complex

      // Get total count (with filters if specified)
      const totalCount = await this.getTotalCount(params.collectionName, params.filters);

      return {
        objects: (result.objects || []) as unknown as WeaviateObject<Record<string, unknown>, string>[],
        totalCount,
      };
    } catch (error) {
      console.error('Error fetching objects:', error);
      throw new Error(`Failed to fetch objects: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get total count of objects in a collection (optionally filtered)
   */
  async getTotalCount(collectionName: string, filters?: Filter[]): Promise<number> {
    try {
      const collection = this.client.collections.get(collectionName);

      // If we have filters, use aggregate with where clause
      if (filters && filters.length > 0) {
        const whereFilter = buildWhereFilter(filters);
        if (whereFilter) {
          const result = await collection.aggregate.overAll({
            where: whereFilter,
          } as any);
          return result.totalCount || 0;
        }
      }

      // No filters - get total count
      const result = await collection.aggregate.overAll({});
      return result.totalCount || 0;
    } catch (error) {
      console.error('Error getting total count:', error);
      // Fallback: try to get count from a fetch with limit 0
      try {
        const collection = this.client.collections.get(collectionName);
        const result = await collection.query.fetchObjects({ limit: 0 });
        return 0; // Can't determine count without aggregate
      } catch {
        return 0;
      }
    }
  }

  /**
   * Get collection schema
   */
  async getSchema(collectionName: string): Promise<CollectionSchema> {
    try {
      const collection = this.client.collections.get(collectionName);
      const config = await collection.config.get();

      // Extract properties
      const properties: PropertySchema[] = [];

      if (config.properties) {
        for (const prop of config.properties) {
          properties.push(this.convertProperty(prop));
        }
      }

      // Extract vectorizer information
      const vectorizers: VectorizerConfig[] = [];

      // Check for vectorizers config (v4+ API)
      if (config.vectorizers && typeof config.vectorizers === 'object') {
        for (const [name, vectorizerConfig] of Object.entries(config.vectorizers)) {
          if (vectorizerConfig && typeof vectorizerConfig === 'object') {
            vectorizers.push({
              name,
              vectorizer: (vectorizerConfig as any).vectorizer?.name || 'unknown',
              dimensions: (vectorizerConfig as any).vectorIndexConfig?.dimensions,
            });
          }
        }
      }

      // Check for named vectors
      if ((config as any).vectorConfig) {
        const vectorConfig = (config as any).vectorConfig;
        for (const [name, vectorCfg] of Object.entries(vectorConfig)) {
          if (typeof vectorCfg === 'object' && vectorCfg !== null) {
            vectorizers.push({
              name,
              vectorizer: (vectorCfg as any).vectorizer?.vectorizer || 'unknown',
              dimensions: (vectorCfg as any).vectorIndexConfig?.dimensions,
            });
          }
        }
      }

      return {
        name: config.name,
        properties,
        vectorizers,
        description: config.description,
      };
    } catch (error) {
      console.error('Error getting schema:', error);
      throw new Error(`Failed to get schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a single object by UUID
   */
  async getObjectByUuid(collectionName: string, uuid: string): Promise<unknown> {
    try {
      const collection = this.client.collections.get(collectionName);
      const result = await collection.query.fetchObjectById(uuid, {
        returnMetadata: ['uuid', 'creationTimeUnix', 'lastUpdateTimeUnix', 'vector'],
      } as any); // Weaviate client fetchObjectById types are complex
      return result;
    } catch (error) {
      console.error('Error fetching object by UUID:', error);
      throw new Error(`Failed to fetch object: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert Weaviate property config to our PropertySchema format
   */
  private convertProperty(prop: Record<string, unknown>): PropertySchema {
    const property: PropertySchema = {
      name: prop.name as string,
      dataType: this.normalizeDataType(prop.dataType),
      description: prop.description as string | undefined,
      indexFilterable: prop.indexFilterable as boolean | undefined,
      indexSearchable: prop.indexSearchable as boolean | undefined,
      tokenization: prop.tokenization as string | undefined,
    };

    // Handle nested properties for object types
    if (prop.nestedProperties && Array.isArray(prop.nestedProperties)) {
      property.nestedProperties = prop.nestedProperties.map((nested: Record<string, unknown>) =>
        this.convertProperty(nested)
      );
    }

    return property;
  }

  /**
   * Normalize data type to our standard format
   */
  private normalizeDataType(dataType: unknown): PropertyDataType {
    // Handle array notation
    if (Array.isArray(dataType)) {
      const baseType = dataType[0];
      return `${this.normalizeDataType(baseType)}[]` as PropertyDataType;
    }

    // Convert string to lowercase and handle common variations
    const typeStr = String(dataType).toLowerCase();

    // Map Weaviate types to our types
    const typeMap: Record<string, PropertyDataType> = {
      'text': 'text',
      'string': 'text',
      'int': 'int',
      'integer': 'int',
      'number': 'number',
      'float': 'number',
      'double': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'date': 'date',
      'uuid': 'uuid',
      'geocoordinates': 'geoCoordinates',
      'phonenumber': 'phoneNumber',
      'blob': 'blob',
      'object': 'object',
    };

    return typeMap[typeStr] || 'text';
  }

  /**
   * Extract vector dimensions from config
   */
  private extractVectorDimensions(config: any): number | undefined {
    // Try to get from vectorIndexConfig
    if (config.vectorIndexConfig?.dimensions) {
      return config.vectorIndexConfig.dimensions;
    }

    // Try to infer from vectorIndexType
    if (config.vectorIndexType === 'hnsw' && config.vectorIndexConfig) {
      return config.vectorIndexConfig.dimensions;
    }

    return undefined;
  }

  /**
   * Perform vector search using nearText
   */
  async vectorSearchText(params: {
    collectionName: string;
    searchText: string;
    limit?: number;
    distance?: number;
    certainty?: number;
  }): Promise<WeaviateObject<Record<string, unknown>, string>[]> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      const queryOptions: any = {
        limit: params.limit || 10,
      };

      // Add distance or certainty
      if (params.distance !== undefined) {
        queryOptions.distance = params.distance;
      } else if (params.certainty !== undefined) {
        queryOptions.certainty = params.certainty;
      }

      // Execute nearText query
      const result = await collection.query.nearText(params.searchText, queryOptions);

      return (result.objects || []) as unknown as WeaviateObject<Record<string, unknown>, string>[];
    } catch (error) {
      console.error('Error in vector search (text):', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform vector search using nearObject
   */
  async vectorSearchObject(params: {
    collectionName: string;
    referenceObjectId: string;
    limit?: number;
    distance?: number;
    certainty?: number;
  }): Promise<WeaviateObject<Record<string, unknown>, string>[]> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      const queryOptions: any = {
        limit: params.limit || 10,
      };

      // Add distance or certainty
      if (params.distance !== undefined) {
        queryOptions.distance = params.distance;
      } else if (params.certainty !== undefined) {
        queryOptions.certainty = params.certainty;
      }

      // Execute nearObject query
      const result = await collection.query.nearObject(params.referenceObjectId, queryOptions);

      return (result.objects || []) as unknown as WeaviateObject<Record<string, unknown>, string>[];
    } catch (error) {
      console.error('Error in vector search (object):', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform vector search using nearVector
   */
  async vectorSearchVector(params: {
    collectionName: string;
    vector: number[];
    limit?: number;
    distance?: number;
    certainty?: number;
  }): Promise<WeaviateObject<Record<string, unknown>, string>[]> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      const queryOptions: any = {
        limit: params.limit || 10,
      };

      // Add distance or certainty
      if (params.distance !== undefined) {
        queryOptions.distance = params.distance;
      } else if (params.certainty !== undefined) {
        queryOptions.certainty = params.certainty;
      }

      // Execute nearVector query
      const result = await collection.query.nearVector(params.vector, queryOptions);

      return (result.objects || []) as unknown as WeaviateObject<Record<string, unknown>, string>[];
    } catch (error) {
      console.error('Error in vector search (vector):', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if client is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.client.collections.listAll();
      return true;
    } catch {
      return false;
    }
  }
}
