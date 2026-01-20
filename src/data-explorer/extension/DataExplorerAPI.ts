/**
 * DataExplorerAPI - Weaviate API wrapper for Data Explorer
 * Handles all Weaviate client interactions for fetching objects and schema
 */

import type { WeaviateClient } from 'weaviate-client';
import type {
  WeaviateObject,
  CollectionConfig,
  FetchObjectsParams,
  FetchObjectsResponse,
  PropertyConfig,
} from '../types';

/**
 * API class for interacting with Weaviate collections in the Data Explorer
 */
export class DataExplorerAPI {
  constructor(private client: WeaviateClient) {}

  /**
   * Fetches objects from a collection with pagination support
   */
  async fetchObjects(params: FetchObjectsParams): Promise<FetchObjectsResponse> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      // Build query options
      const queryOptions: {
        limit: number;
        offset: number;
        returnMetadata?: ('creationTime' | 'updateTime')[];
        returnProperties?: string[];
      } = {
        limit: params.limit,
        offset: params.offset,
        returnMetadata: ['creationTime', 'updateTime'],
      };

      // Add properties filter if specified
      if (params.properties && params.properties.length > 0) {
        queryOptions.returnProperties = params.properties;
      }

      // Fetch objects
      const result = await collection.query.fetchObjects(queryOptions);

      // Transform result to our format
      const objects: WeaviateObject[] = result.objects.map((obj) => ({
        uuid: obj.uuid,
        properties: obj.properties as Record<string, unknown>,
        metadata: {
          uuid: obj.uuid,
          creationTime: obj.metadata?.creationTime?.toISOString(),
          lastUpdateTime: obj.metadata?.updateTime?.toISOString(),
        },
      }));

      // Get total count using aggregate
      let total = 0;
      try {
        const aggregateResult = await collection.aggregate.overAll();
        total = aggregateResult.totalCount ?? objects.length;
      } catch (aggregateError) {
        console.warn('Failed to get aggregate count, using objects length:', aggregateError);
        total = objects.length;
      }

      return { objects, total };
    } catch (error) {
      console.error('Error fetching objects:', error);
      throw error;
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
        properties: obj.properties as Record<string, unknown>,
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
}
