import * as vscode from 'vscode';
import { CollectionConfig, PropertyConfig, WeaviateClient } from 'weaviate-client';
import { ConnectionManager } from '../../services/ConnectionManager';

export interface WeaviateSchemaProperty {
  name: string;
  dataType: string[];
  description?: string;
}

export interface WeaviateSchemaClass {
  class: string;
  description?: string;
  properties: WeaviateSchemaProperty[];
}

export interface WeaviateSchema {
  classes: WeaviateSchemaClass[];
}

export interface GraphQLSchema {
  uri: string;
  schema?: any;
  fileMatch?: string[];
  introspectionJSON?: any;
}

const SCHEMA_CACHE_KEY = 'weaviate-schema-cache';

export class SchemaProvider {
  private static instance: SchemaProvider;
  private context: vscode.ExtensionContext;
  private connectionManager: ConnectionManager;
  private schemaCache: Map<string, { schema: WeaviateSchema; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.connectionManager = ConnectionManager.getInstance(context);
    this.loadCachedSchemas();
  }

  public static getInstance(context: vscode.ExtensionContext): SchemaProvider {
    if (!SchemaProvider.instance) {
      SchemaProvider.instance = new SchemaProvider(context);
    }
    return SchemaProvider.instance;
  }

  private loadCachedSchemas(): void {
    const cachedData = this.context.workspaceState.get<{
      [key: string]: { schema: WeaviateSchema; timestamp: number };
    }>(SCHEMA_CACHE_KEY);
    if (cachedData) {
      Object.entries(cachedData).forEach(([key, value]) => {
        this.schemaCache.set(key, value);
      });
    }
  }

  private saveCachedSchemas(): void {
    const cacheObject: { [key: string]: { schema: WeaviateSchema; timestamp: number } } = {};
    this.schemaCache.forEach((value, key) => {
      cacheObject[key] = value;
    });
    this.context.workspaceState.update(SCHEMA_CACHE_KEY, cacheObject);
  }

  public async getSchemaForConnection(
    connectionId?: string,
    client?: WeaviateClient
  ): Promise<WeaviateSchema | null> {
    try {
      // Use provided client or get one from connection manager
      let weaviateClient = client;
      let connectionUrl: string;

      if (!weaviateClient) {
        // Get connection by ID or use first available connection
        let connection;
        if (connectionId) {
          connection = this.connectionManager.getConnection(connectionId);
        } else {
          // Get first connection from the list as fallback
          const connections = this.connectionManager.getConnections();
          connection = connections.length > 0 ? connections[0] : undefined;
        }

        if (!connection) {
          throw new Error('No active Weaviate connection found');
        }

        connectionUrl = connection.httpHost || connection.cloudUrl || 'localhost';
        weaviateClient = this.connectionManager.getClient(connection.id);
      } else {
        // Try to extract URL from client if possible
        connectionUrl = 'custom-client';
      }

      // Check cache first
      const cacheKey = connectionUrl;
      const cachedData = this.schemaCache.get(cacheKey);

      if (cachedData && Date.now() - cachedData.timestamp < this.cacheTTL) {
        console.log('Using cached schema for', connectionUrl);
        return cachedData.schema;
      }

      // Fetch fresh schema
      console.log('Fetching fresh schema for', connectionUrl);
      if (!weaviateClient) {
        throw new Error('No Weaviate client available');
      }

      // get the list of collections
      const collections = await weaviateClient.collections.listAll();

      // Cache the result
      const schemaData: WeaviateSchema = {
        classes: (collections || []).map((collection: CollectionConfig) => ({
          class: collection.name || '',
          description: collection.description,
          properties: (collection.properties || []).map((prop: PropertyConfig) => ({
            name: prop.name || '',
            dataType: Array.isArray(prop.dataType) ? prop.dataType : [prop.dataType || 'string'],
            description: prop.description,
          })),
        })),
      };

      this.schemaCache.set(cacheKey, {
        schema: schemaData,
        timestamp: Date.now(),
      });

      this.saveCachedSchemas();
      return schemaData;
    } catch (error: any) {
      console.error('Error fetching schema:', error);
      vscode.window.showErrorMessage(`Error fetching Weaviate schema: ${error.message}`);
      return null;
    }
  }

  public async getGraphQLSchemaConfig(
    connectionId?: string,
    client?: WeaviateClient
  ): Promise<GraphQLSchema | null> {
    try {
      // Use provided client or get one from connection manager
      let weaviateClient = client;
      let connectionUrl: string;

      if (!weaviateClient) {
        // Get connection by ID or use first available connection
        let connection;
        if (connectionId) {
          connection = this.connectionManager.getConnection(connectionId);
        } else {
          // Get first connection from the list as fallback
          const connections = this.connectionManager.getConnections();
          connection = connections.length > 0 ? connections[0] : undefined;
        }

        if (!connection) {
          throw new Error('No active Weaviate connection found');
        }

        connectionUrl = connection.httpHost || connection.cloudUrl || 'localhost';
        weaviateClient = this.connectionManager.getClient(connection.id);
      } else {
        // Try to extract URL from client if possible
        connectionUrl = 'custom-client';
      }

      const schema = await this.getSchemaForConnection(connectionId, weaviateClient);

      if (!schema) {
        return null;
      }

      // Create introspection JSON for GraphQL schema
      const types = [
        { name: 'Get', kind: 'OBJECT' },
        { name: 'Aggregate', kind: 'OBJECT' },
        { name: 'Explore', kind: 'OBJECT' },
      ];

      // Convert Weaviate schema to GraphQL introspection format
      // This is a simplified version - in a real implementation, you'd create a proper
      // GraphQL introspection response with all the necessary fields
      const introspectionJSON = {
        __schema: {
          types: [
            ...types,
            ...schema.classes.map((cls) => ({
              name: cls.class,
              kind: 'OBJECT',
              fields: cls.properties.map((prop) => ({
                name: prop.name,
                type: {
                  name: prop.dataType[0],
                  kind: 'SCALAR',
                },
                description: prop.description || null,
              })),
            })),
          ],
        },
      };

      return {
        uri: connectionUrl,
        schema: schema,
        fileMatch: ['*.graphql', '*.gql'],
        introspectionJSON,
      };
    } catch (error: any) {
      console.error('Error creating GraphQL schema config:', error);
      vscode.window.showErrorMessage(`Error creating GraphQL schema config: ${error.message}`);
      return null;
    }
  }

  public clearCache(connectionId?: string): void {
    if (connectionId) {
      // Clear specific connection cache
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        this.schemaCache.delete(connection.httpHost || connection.cloudUrl || 'localhost');
      }
    } else {
      // Clear all cache
      this.schemaCache.clear();
    }
    this.saveCachedSchemas();
  }
}
