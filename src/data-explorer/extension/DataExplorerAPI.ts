/**
 * API service for Data Explorer to interact with Weaviate client
 */

import type { WeaviateClient } from 'weaviate-client';
import type {
  FetchParams,
  FetchResult,
  CollectionSchema,
  PropertySchema,
  PropertyDataType,
  VectorizerConfig,
} from '../types';

export class DataExplorerAPI {
  constructor(private client: WeaviateClient) {}

  /**
   * Fetch objects from a collection with pagination and sorting
   */
  async fetchObjects(params: FetchParams): Promise<FetchResult> {
    try {
      const collection = this.client.collections.get(params.collectionName);

      // Build query options
      const queryOptions: any = {
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

      // Execute query
      const result = await collection.query.fetchObjects(queryOptions);

      // Get total count
      const totalCount = await this.getTotalCount(params.collectionName);

      return {
        objects: result.objects || [],
        totalCount,
      };
    } catch (error) {
      console.error('Error fetching objects:', error);
      throw new Error(`Failed to fetch objects: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get total count of objects in a collection
   */
  async getTotalCount(collectionName: string): Promise<number> {
    try {
      const collection = this.client.collections.get(collectionName);
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

      // Check for vectorizer config
      if (config.vectorizer) {
        vectorizers.push({
          name: 'default',
          vectorizer: typeof config.vectorizer === 'string' ? config.vectorizer : config.vectorizer.toString(),
          dimensions: this.extractVectorDimensions(config),
        });
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
  async getObjectByUuid(collectionName: string, uuid: string): Promise<any> {
    try {
      const collection = this.client.collections.get(collectionName);
      const result = await collection.query.fetchObjectById(uuid, {
        returnMetadata: ['uuid', 'creationTimeUnix', 'lastUpdateTimeUnix', 'vector'],
      });
      return result;
    } catch (error) {
      console.error('Error fetching object by UUID:', error);
      throw new Error(`Failed to fetch object: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert Weaviate property to our PropertySchema format
   */
  private convertProperty(prop: any): PropertySchema {
    const property: PropertySchema = {
      name: prop.name,
      dataType: this.normalizeDataType(prop.dataType),
      description: prop.description,
      indexFilterable: prop.indexFilterable,
      indexSearchable: prop.indexSearchable,
      tokenization: prop.tokenization,
    };

    // Handle nested properties for object types
    if (prop.nestedProperties && Array.isArray(prop.nestedProperties)) {
      property.nestedProperties = prop.nestedProperties.map((nested: any) =>
        this.convertProperty(nested)
      );
    }

    return property;
  }

  /**
   * Normalize data type to our standard format
   */
  private normalizeDataType(dataType: any): PropertyDataType {
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
