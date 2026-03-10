import * as vscode from 'vscode';
import * as fs from 'fs';
import weaviate, {
  AuthUserPasswordCredentials,
  ConnectToCustomOptions,
  WeaviateClient,
} from 'weaviate-client';
import { WEAVIATE_INTEGRATION_HEADER } from '../constants';

export interface ConnectionLink {
  name: string;
  url: string;
}

export interface WeaviateConnection {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  lastUsed?: number;
  links?: ConnectionLink[];
  autoConnect?: boolean; // Auto connect on expand, default: false
  openClusterViewOnConnect?: boolean; // Auto open cluster view on connect, default: true
  readOnly?: boolean; // When true, prevents modifications to the connection

  // Either cloud or custom (discriminated union with "type")
  type: 'custom' | 'cloud';

  // Common (for both types)
  authType?: 'apiKey' | 'clientPassword'; // default: 'apiKey' if apiKey present, else none
  apiKey?: string;

  // Client password auth fields
  username?: string;
  password?: string;

  // Custom connection fields
  httpHost?: string;
  httpPort?: number;
  grpcHost?: string;
  grpcPort?: number;
  grpcSecure?: boolean;
  httpSecure?: boolean;

  // Cloud connection fields
  cloudUrl?: string;

  // Advanced settings
  timeoutInit?: number;
  timeoutQuery?: number;
  timeoutInsert?: number;
  skipInitChecks?: boolean;

  connectionVersion?: string; // future use

  // Secret presence flags (actual values stored in context.secrets, not globalState)
  apiKeyPresent?: boolean;
  passwordPresent?: boolean;

  // backwards compatibility
  url?: string; // old field, to be migrated
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private static readonly currentVersion = '3'; // Current connection configuration version
  private readonly storageKey = 'weaviate-connections';

  // --- Secret storage helpers ---
  private secretKey(id: string, field: 'apiKey' | 'password'): string {
    return `weaviate-connection-${id}-${field}`;
  }

  private async storeSecret(
    id: string,
    field: 'apiKey' | 'password',
    value: string
  ): Promise<void> {
    await this.context.secrets.store(this.secretKey(id, field), value);
  }

  private async getSecret(id: string, field: 'apiKey' | 'password'): Promise<string | undefined> {
    return this.context.secrets.get(this.secretKey(id, field));
  }

  private async deleteSecret(id: string, field: 'apiKey' | 'password'): Promise<void> {
    await this.context.secrets.delete(this.secretKey(id, field));
  }

  private _onConnectionsChanged = new vscode.EventEmitter<void>();
  public readonly onConnectionsChanged = this._onConnectionsChanged.event;
  private connections: WeaviateConnection[] = [];
  private clients: Map<string, WeaviateClient> = new Map();
  private addConnectionMutex: Promise<any> = Promise.resolve(); // Mutex to prevent race conditions

  private constructor(private readonly context: vscode.ExtensionContext) {
    // Chain the mutex onto the initial load so all operations wait for initialization
    this.addConnectionMutex = this.loadConnections().catch((error) => {
      console.error('Failed to load connections during initialization:', error);
    });
  }

  private async checkConnectionsMigration(
    connections: WeaviateConnection[]
  ): Promise<WeaviateConnection[]> {
    // Ensure connections is a valid array
    if (!Array.isArray(connections)) {
      console.warn('Invalid connections data, expected array, got:', typeof connections);
      return [];
    }

    // Filter out null/undefined values and invalid objects
    const validConnections = connections.filter((conn): conn is WeaviateConnection => {
      return conn !== null && conn !== undefined && typeof conn === 'object';
    });

    // if migration detected, save the migrated connections
    let need_to_save = false;

    const migratedConnections = await Promise.all(
      validConnections.map(async (conn) => {
        try {
          // Ensure autoConnect has a default value
          if (conn.autoConnect === undefined) {
            conn.autoConnect = false;
            need_to_save = true;
          }

          if (conn.connectionVersion === ConnectionManager.currentVersion) {
            return conn;
          } else if (conn.connectionVersion === '2') {
            // v2 → v3: move plaintext apiKey/password out of globalState and into context.secrets
            if (conn.apiKey && typeof conn.apiKey === 'string') {
              await this.storeSecret(conn.id, 'apiKey', conn.apiKey);
              conn.apiKeyPresent = true;
            }
            if (conn.password && typeof conn.password === 'string') {
              await this.storeSecret(conn.id, 'password', conn.password);
              conn.passwordPresent = true;
            }
            conn.connectionVersion = ConnectionManager.currentVersion;
            need_to_save = true;
          } else if (!conn.connectionVersion) {
            // may be new connection without version — bump straight to current
            if (conn.httpHost || conn.cloudUrl) {
              // Already in the new shape; just migrate secrets if present
              if (conn.apiKey && typeof conn.apiKey === 'string') {
                await this.storeSecret(conn.id, 'apiKey', conn.apiKey);
                conn.apiKeyPresent = true;
              }
              if (conn.password && typeof conn.password === 'string') {
                await this.storeSecret(conn.id, 'password', conn.password);
                conn.passwordPresent = true;
              }
              need_to_save = true;
              return { ...conn, connectionVersion: ConnectionManager.currentVersion };
            }
            // old connection with legacy url field — migrate structure
            if (
              conn.url &&
              (conn.url.includes('weaviate.cloud') ||
                conn.url.includes('weaviate.io') ||
                conn.url.includes('weaviate.network'))
            ) {
              conn.type = 'cloud';
              conn.cloudUrl = conn.url;
              delete conn.url;
              conn.connectionVersion = ConnectionManager.currentVersion;
              need_to_save = true;
            } else {
              // custom connection
              if (!conn.url) {
                // invalid connection, skip migration
                return conn;
              }
              conn.type = 'custom';
              let rawUrl = conn.url;
              if (!/^https?:\/\//i.test(rawUrl)) {
                rawUrl = `http://${rawUrl}`;
              }
              const url = new URL(rawUrl);
              delete conn.url;
              conn.httpHost = url.hostname;
              const hasExplicitPort = url.port && url.port.trim().length > 0;
              conn.httpPort = hasExplicitPort
                ? parseInt(url.port, 10)
                : url.protocol === 'https:'
                  ? 443
                  : 8080;
              conn.httpSecure = url.protocol === 'https:';
              conn.grpcHost = url.hostname;
              conn.grpcPort = 50051;
              conn.grpcSecure = url.protocol === 'https:';
              conn.connectionVersion = ConnectionManager.currentVersion;
              need_to_save = true;
            }
            // Migrate any plaintext secrets present in the old connection
            if (conn.apiKey && typeof conn.apiKey === 'string') {
              await this.storeSecret(conn.id, 'apiKey', conn.apiKey);
              conn.apiKeyPresent = true;
            }
            if (conn.password && typeof conn.password === 'string') {
              await this.storeSecret(conn.id, 'password', conn.password);
              conn.passwordPresent = true;
            }
          }
          return conn;
        } catch (error) {
          console.warn('Error migrating connection, skipping:', conn, error);
          return null;
        }
      })
    );

    // Filter out any null values from failed migrations
    const finalConnections = migratedConnections.filter(
      (conn): conn is WeaviateConnection => conn !== null && conn !== undefined
    );

    if (need_to_save) {
      try {
        // Strip raw secret values before persisting
        const toSave = finalConnections.map(({ apiKey, password, ...conn }) => conn);
        this.context.globalState.update(this.storageKey, toSave).then(
          () => {
            // Migration complete - silent in production/tests
          },
          (error: any) => {
            console.warn('Failed to save migrated connections:', error);
          }
        );
      } catch (error) {
        console.warn('Failed to save migrated connections:', error);
      }
    }
    return finalConnections;
  }

  public static getInstance(context: vscode.ExtensionContext): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(context);
    }
    return ConnectionManager.instance;
  }

  private async loadConnections(): Promise<WeaviateConnection[]> {
    try {
      var connections = this.context.globalState.get<WeaviateConnection[]>(this.storageKey) || [];
      // Check and save migrations
      const migratedConnections = await this.checkConnectionsMigration(connections);
      // Ensure all loaded connections start as disconnected
      this.connections = migratedConnections.map((conn: WeaviateConnection) => ({
        ...conn,
        status: 'disconnected' as const,
      }));
      // Rehydrate secrets into in-memory connections
      for (const conn of this.connections) {
        if (conn.apiKeyPresent) {
          conn.apiKey = await this.getSecret(conn.id, 'apiKey');
        }
        if (conn.passwordPresent) {
          conn.password = await this.getSecret(conn.id, 'password');
        }
      }
      // Notify listeners (e.g. tree view) that connections are ready
      this._onConnectionsChanged.fire();
      return this.connections;
    } catch (error) {
      console.error('Error loading connections, starting with empty list:', error);
      this.connections = [];
      return this.connections;
    }
  }

  private async saveConnections() {
    // Strip raw secret values — only boolean presence flags are persisted to globalState
    const toSave = this.connections.map(({ apiKey, password, ...conn }) => conn);
    await this.context.globalState.update(this.storageKey, toSave);
    this._onConnectionsChanged.fire();
  }

  public async addConnection(
    connection: Omit<WeaviateConnection, 'id' | 'status'>
  ): Promise<WeaviateConnection> {
    // Use mutex to prevent race conditions during concurrent additions
    return (this.addConnectionMutex = this.addConnectionMutex.then(async () => {
      try {
        // Validate required fields
        if (!connection.name || connection.name.trim() === '') {
          throw new Error('Connection name is required');
        }

        if (connection.type === 'custom') {
          if (!connection.httpHost || connection.httpHost.trim() === '') {
            throw new Error('HTTP host is required for custom connections');
          }
        } else if (connection.type === 'cloud') {
          if (!connection.cloudUrl || connection.cloudUrl.trim() === '') {
            throw new Error('Cloud URL is required for cloud connections');
          }
          if (
            connection.authType !== 'clientPassword' &&
            (!connection.apiKey || connection.apiKey.trim() === '')
          ) {
            throw new Error('API key is required for cloud connections');
          }
        }

        if (
          connection.authType === 'clientPassword' &&
          (!connection.username || connection.username.trim() === '')
        ) {
          throw new Error('Username is required for client password authentication');
        }

        // Check for duplicate connection names
        const existingConnection = this.connections.find(
          (c) => c.name.toLowerCase() === connection.name.toLowerCase()
        );
        if (existingConnection) {
          // Provide more detailed error information
          const errorMsg = `A connection with this name already exists (ID: ${existingConnection.id}, Type: ${existingConnection.type})`;
          console.warn('Connection name conflict:', {
            attemptedName: connection.name,
            existingConnection: {
              id: existingConnection.id,
              name: existingConnection.name,
              type: existingConnection.type,
            },
            allConnectionNames: this.connections.map((c) => c.name),
          });
          throw new Error(errorMsg);
        }

        const timestamp = Date.now();
        // Generate unique ID with more entropy to avoid collisions during concurrent operations
        const uniqueId =
          process.env.NODE_ENV === 'test'
            ? timestamp.toString() + Math.random().toString(36).slice(2, 11)
            : timestamp.toString() + Math.random().toString(36).slice(2, 11);

        const newConnection: WeaviateConnection = {
          ...connection,
          id: uniqueId,
          status: 'disconnected',
          lastUsed: timestamp,
          connectionVersion: ConnectionManager.currentVersion,
        };

        // Store secrets securely; set presence flags
        if (connection.apiKey) {
          await this.storeSecret(newConnection.id, 'apiKey', connection.apiKey);
          newConnection.apiKeyPresent = true;
        }
        if (connection.password) {
          await this.storeSecret(newConnection.id, 'password', connection.password);
          newConnection.passwordPresent = true;
        }

        this.connections.push(newConnection);

        try {
          await this.saveConnections();
        } catch (error) {
          // If saving fails, still return the connection but log the error
          console.warn('Failed to persist connection to storage:', error);
          // Still fire the event since the connection is in memory
          this._onConnectionsChanged.fire();
        }

        return newConnection;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to add connection');
      }
    }));
  }

  public async updateConnection(id: string, updates: Partial<WeaviateConnection>) {
    const index = this.connections.findIndex((c) => c.id === id);
    if (index === -1) {
      return null;
    }

    // If updating the name, check for conflicts with other connections
    if (updates.name && updates.name.trim() !== '') {
      const existingConnection = this.connections.find(
        (c) =>
          c.id !== id && // Exclude the current connection being updated
          c.name.toLowerCase() === updates.name!.toLowerCase()
      );
      if (existingConnection) {
        throw new Error(
          `A connection with this name already exists (ID: ${existingConnection.id}, Type: ${existingConnection.type})`
        );
      }
    }

    // Handle secret fields: update secrets and set presence flags accordingly
    const secretUpdates: Partial<WeaviateConnection> = {};
    if ('apiKey' in updates) {
      if (updates.apiKey) {
        await this.storeSecret(id, 'apiKey', updates.apiKey);
        secretUpdates.apiKeyPresent = true;
      } else {
        await this.deleteSecret(id, 'apiKey');
        secretUpdates.apiKeyPresent = false;
      }
    }
    if ('password' in updates) {
      if (updates.password) {
        await this.storeSecret(id, 'password', updates.password);
        secretUpdates.passwordPresent = true;
      } else {
        await this.deleteSecret(id, 'password');
        secretUpdates.passwordPresent = false;
      }
    }

    this.connections[index] = {
      ...this.connections[index],
      ...updates,
      ...secretUpdates,
      lastUsed: Date.now(),
    };
    await this.saveConnections();
    return this.connections[index];
  }

  public async deleteConnection(id: string): Promise<boolean> {
    const index = this.connections.findIndex((c: WeaviateConnection) => c.id === id);
    if (index === -1) {
      return false;
    }

    // Clean up secrets
    await this.deleteSecret(id, 'apiKey');
    await this.deleteSecret(id, 'password');

    // Remove client without updating connection status (since we're deleting it)
    this.clients.delete(id);
    this.connections.splice(index, 1);
    await this.saveConnections();
    return true;
  }

  public getConnections(): WeaviateConnection[] {
    return [...this.connections].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  }

  public getConnection(id: string): WeaviateConnection | undefined {
    return this.connections.find((c) => c.id === id);
  }

  public async connect(id: string): Promise<WeaviateConnection | null> {
    const connection = this.getConnection(id);
    if (!connection) {
      return null;
    }

    try {
      let client: WeaviateClient | undefined;
      const headers = {
        'X-Weaviate-Client-Integration': WEAVIATE_INTEGRATION_HEADER,
      };
      if (connection.type === 'cloud' && connection.cloudUrl) {
        const cloudAuthCredentials =
          connection.authType === 'clientPassword' && connection.username
            ? new AuthUserPasswordCredentials({
                username: connection.username,
                password: connection.password,
              })
            : new weaviate.ApiKey(connection.apiKey || '');
        client = await weaviate.connectToWeaviateCloud(connection.cloudUrl, {
          authCredentials: cloudAuthCredentials,
          skipInitChecks: connection.skipInitChecks,
          headers: headers,
          timeout: {
            init: connection.timeoutInit,
            query: connection.timeoutQuery,
            insert: connection.timeoutInsert,
          },
        });
      } else {
        // Extract only the fields needed for connectToCustom
        //  Use gRPC for faster performance on v1.27.0+
        const customOptions: ConnectToCustomOptions = {
          httpHost: connection.httpHost,
          httpPort: connection.httpPort,
          httpSecure: connection.httpSecure,
          skipInitChecks: connection.skipInitChecks,
          headers: headers,
          timeout: {
            init: connection.timeoutInit,
            query: connection.timeoutQuery,
            insert: connection.timeoutInsert,
          },
        };

        // Only add gRPC options if they're configured
        if (connection.grpcHost && connection.grpcPort) {
          customOptions.grpcHost = connection.grpcHost;
          customOptions.grpcPort = connection.grpcPort;
          customOptions.grpcSecure = connection.grpcSecure;
        }

        if (connection.authType === 'clientPassword' && connection.username) {
          customOptions.authCredentials = new AuthUserPasswordCredentials({
            username: connection.username,
            password: connection.password,
          });
        } else if (connection.apiKey) {
          customOptions.authCredentials = new weaviate.ApiKey(connection.apiKey);
        }

        try {
          // Attempt connection with gRPC (if configured)
          client = await weaviate.connectToCustom(customOptions);
        } catch (error: any) {
          // Detect gRPC compatibility error
          console.log('Initial connection error:', error);

          // Check for gRPC compatibility issues more comprehensively
          const isGrpcError =
            error.message.includes('gRPC') ||
            error.message.includes('is not supported') ||
            error.message.includes('v1.26.7') ||
            error.message.includes('v1.27.0') ||
            (error.name === 'WeaviateStartUpError' && error.message.includes('gRPC'));

          if (isGrpcError) {
            console.warn('gRPC failed, retrying with HTTP-only...');

            // Create a new options object without gRPC parameters
            const httpOnlyOptions: ConnectToCustomOptions = {
              httpHost: connection.httpHost,
              httpPort: connection.httpPort,
              httpSecure: connection.httpSecure,
              grpcHost: undefined, // Explicitly set to undefined
              grpcPort: undefined, // Explicitly set to undefined
              grpcSecure: undefined, // Explicitly set to undefined
              skipInitChecks: true, // Force skip init checks to avoid gRPC compatibility issues
              headers: {
                'X-Weaviate-Client-Integration': WEAVIATE_INTEGRATION_HEADER,
              },
              timeout: {
                init: connection.timeoutInit,
                query: connection.timeoutQuery,
                insert: connection.timeoutInsert,
              },
            };

            if (connection.authType === 'clientPassword' && connection.username) {
              httpOnlyOptions.authCredentials = new AuthUserPasswordCredentials({
                username: connection.username,
                password: connection.password,
              });
            } else if (connection.apiKey) {
              httpOnlyOptions.authCredentials = new weaviate.ApiKey(connection.apiKey);
            }

            try {
              // Retry with HTTP-only
              client = await weaviate.connectToCustom(httpOnlyOptions);
              console.log('HTTP-only connection successful');
            } catch (httpError: any) {
              console.error('HTTP-only connection also failed:', httpError);
              throw httpError;
            }
          } else {
            throw error;
          }
        }
      }
      if (!client) {
        throw new Error('Failed to create Weaviate client');
      }

      // Test connection by getting server meta
      const is_ready = await client.isReady();
      if (!is_ready) {
        throw new Error('Weaviate server is not ready');
      }

      this.clients.set(id, client);
      const updated = await this.updateConnection(id, { status: 'connected' });
      return updated || null;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to connect to ${connection.name}: ${error}`);
      return null;
    }
  }

  public async disconnect(id: string): Promise<boolean> {
    this.clients.delete(id);
    try {
      await this.updateConnection(id, { status: 'disconnected' });
      return true;
    } catch (error) {
      console.error(`Error disconnecting connection ${id}:`, error);
      return false;
    }
  }

  public getClient(id: string): WeaviateClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Debug method to get all connection names for troubleshooting
   * @returns Array of connection names currently in memory
   */
  public getConnectionNames(): string[] {
    return this.connections.map((c) => c.name);
  }

  /**
   * Debug method to check if a connection name exists (case-insensitive)
   * @param name - Connection name to check
   * @returns Object with details about the name conflict
   */
  public checkNameConflict(name: string): {
    exists: boolean;
    conflictingConnection?: WeaviateConnection;
  } {
    const conflictingConnection = this.connections.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    return {
      exists: !!conflictingConnection,
      conflictingConnection,
    };
  }

  /**
   * Clear all connections - USE WITH CAUTION! This will remove all stored connections.
   * @returns Promise that resolves when all connections are cleared
   */
  public async clearAllConnections(): Promise<void> {
    // Delete all secrets before clearing the array
    for (const conn of this.connections) {
      await this.deleteSecret(conn.id, 'apiKey');
      await this.deleteSecret(conn.id, 'password');
    }

    // Disconnect all active clients
    this.clients.clear();

    // Clear the connections array
    this.connections = [];

    // Clear from persistent storage
    await this.saveConnections();

    console.log('All connections have been cleared');
  }

  /**
   * Add a link to a connection
   * @param connectionId - The ID of the connection
   * @param link - The link to add
   * @returns Promise that resolves when the link is added
   */
  public async addConnectionLink(connectionId: string, link: ConnectionLink): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (!connection.links) {
      connection.links = [];
    }

    connection.links.push(link);
    await this.saveConnections();
    this._onConnectionsChanged.fire();
  }

  /**
   * Update a link in a connection
   * @param connectionId - The ID of the connection
   * @param linkIndex - The index of the link to update
   * @param updatedLink - The updated link data
   * @returns Promise that resolves when the link is updated
   */
  public async updateConnectionLink(
    connectionId: string,
    linkIndex: number,
    updatedLink: ConnectionLink
  ): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (!connection.links || linkIndex < 0 || linkIndex >= connection.links.length) {
      throw new Error('Link not found');
    }

    connection.links[linkIndex] = updatedLink;
    await this.saveConnections();
    this._onConnectionsChanged.fire();
  }

  /**
   * Remove a link from a connection
   * @param connectionId - The ID of the connection
   * @param linkIndex - The index of the link to remove
   * @returns Promise that resolves when the link is removed
   */
  public async removeConnectionLink(connectionId: string, linkIndex: number): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (!connection.links || linkIndex < 0 || linkIndex >= connection.links.length) {
      throw new Error('Link not found');
    }

    connection.links.splice(linkIndex, 1);
    await this.saveConnections();
    this._onConnectionsChanged.fire();
  }

  /**
   * Get all links for a connection
   * @param connectionId - The ID of the connection
   * @returns Array of connection links
   */
  public getConnectionLinks(connectionId: string): ConnectionLink[] {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return connection.links || [];
  }

  public async showAddConnectionDialog(): Promise<{
    connection: WeaviateConnection;
    shouldConnect: boolean;
  } | null> {
    return this.showConnectionDialog();
  }

  public async showEditConnectionDialog(
    connectionId: string
  ): Promise<{ connection: WeaviateConnection; shouldConnect: boolean } | null> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    return this.showConnectionDialog(connection);
  }

  private async showConnectionDialog(
    connection?: WeaviateConnection
  ): Promise<{ connection: WeaviateConnection; shouldConnect: boolean } | null> {
    return new Promise((resolve) => {
      const isEditMode = !!connection;
      const panel = vscode.window.createWebviewPanel(
        'weaviateConnection',
        isEditMode ? 'Edit Weaviate Connection' : 'Add Weaviate Connection',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
        }
      );
      const iconPath = {
        light: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'add.svg'),
        dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'add-dark.svg'),
      };
      panel.iconPath = iconPath;

      // Set the HTML content for the webview (loaded from dist)
      panel.webview.html = this._getHtmlForWebview(panel.webview);

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'ready':
              // Send initial data to the React component
              panel.webview.postMessage({
                command: 'initData',
                connection: {
                  name: connection?.name || '',
                  type: connection?.type || 'custom',
                  httpHost: connection?.httpHost || 'localhost',
                  httpPort: connection?.httpPort || 8080,
                  httpSecure: connection?.httpSecure || false,
                  grpcHost: connection?.grpcHost || 'localhost',
                  grpcPort: connection?.grpcPort || 50051,
                  grpcSecure: connection?.grpcSecure || false,
                  cloudUrl: connection?.cloudUrl || '',
                  autoConnect: connection?.autoConnect || false,
                  openClusterViewOnConnect: connection?.openClusterViewOnConnect !== false,
                  timeoutInit: connection?.timeoutInit || 30,
                  timeoutQuery: connection?.timeoutQuery || 60,
                  timeoutInsert: connection?.timeoutInsert || 120,
                  skipInitChecks: connection?.skipInitChecks || false,
                  links: connection?.links || [],
                  authType: connection?.authType || 'apiKey',
                  username: connection?.username || '',
                },
                apiKeyPresent: !!(connection?.apiKeyPresent ?? !!connection?.apiKey),
                passwordPresent: !!(connection?.passwordPresent ?? !!connection?.password),
                isEditMode,
                connectionVersion:
                  connection?.connectionVersion || ConnectionManager.currentVersion,
              });
              break;
            case 'save':
              try {
                const { name, httpHost, apiKey, type } = message.connection;
                if (type === 'custom') {
                  if (!name || !httpHost) {
                    panel.webview.postMessage({
                      command: 'error',
                      message: 'Name and httpHost are required',
                    });
                    return;
                  }
                }
                if (type === 'cloud') {
                  const cloudUrlChanged = !!(
                    connection &&
                    connection.cloudUrl &&
                    message.connection.cloudUrl &&
                    connection.cloudUrl !== message.connection.cloudUrl
                  );
                  const authType = message.connection.authType || 'apiKey';
                  const needsApiKey =
                    authType !== 'clientPassword' &&
                    (!isEditMode ||
                      !connection ||
                      connection.type !== 'cloud' ||
                      !(connection.apiKeyPresent ?? !!connection.apiKey) ||
                      cloudUrlChanged);
                  if (!name || !message.connection.cloudUrl || (needsApiKey && !apiKey)) {
                    panel.webview.postMessage({
                      command: 'error',
                      message: needsApiKey
                        ? 'Name, cloudUrl and apiKey are required'
                        : 'Name and cloudUrl are required',
                    });
                    return;
                  }
                }

                if (
                  message.connection.authType === 'clientPassword' &&
                  !message.connection.username?.trim()
                ) {
                  panel.webview.postMessage({
                    command: 'error',
                    message: 'Username is required for client password authentication',
                  });
                  return;
                }

                let updatedConnection: WeaviateConnection | null = null;

                if (isEditMode && connection) {
                  // Build update payload, handling API key removal
                  const updatePayload = { ...message.connection };
                  delete updatePayload.removeApiKey;
                  delete updatePayload.removePassword;
                  if (message.removeApiKey === true) {
                    updatePayload.apiKey = undefined;
                  }
                  if (message.removePassword === true) {
                    updatePayload.password = undefined;
                  }
                  updatedConnection = await this.updateConnection(connection.id, updatePayload);
                } else {
                  // Add new connection
                  updatedConnection = await this.addConnection({
                    name: message.connection.name.trim(),
                    httpHost: message.connection.httpHost?.trim(),
                    httpPort: message.connection.httpPort,
                    grpcHost: message.connection.grpcHost?.trim(),
                    grpcPort: message.connection.grpcPort,
                    grpcSecure: message.connection.grpcSecure,
                    httpSecure: message.connection.httpSecure,
                    authType: message.connection.authType || 'apiKey',
                    apiKey: apiKey?.trim() || undefined,
                    username: message.connection.username?.trim() || undefined,
                    password: message.connection.password?.trim() || undefined,
                    type: message.connection.cloudUrl === undefined ? 'custom' : 'cloud',
                    cloudUrl: message.connection.cloudUrl?.trim() || undefined,
                    timeoutInit: message.connection.timeoutInit || undefined,
                    timeoutQuery: message.connection.timeoutQuery || undefined,
                    timeoutInsert: message.connection.timeoutInsert || undefined,
                    skipInitChecks: message.connection.skipInitChecks,
                    autoConnect: message.connection.autoConnect || false,
                    openClusterViewOnConnect: message.connection.openClusterViewOnConnect,
                    links: message.connection.links || [],
                  });
                }

                if (updatedConnection) {
                  panel.dispose();
                  resolve({ connection: updatedConnection, shouldConnect: false });
                }
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : isEditMode
                      ? 'Failed to update connection'
                      : 'Failed to add connection';
                panel.webview.postMessage({
                  command: 'error',
                  message: errorMessage,
                });
              }
              break;
            case 'saveAndConnect':
              try {
                const { name, httpHost, apiKey, type } = message.connection;
                if (type === 'custom') {
                  if (!name || !httpHost) {
                    panel.webview.postMessage({
                      command: 'error',
                      message: 'Name and httpHost are required',
                    });
                    return;
                  }
                }
                if (type === 'cloud') {
                  const cloudUrlChanged = !!(
                    connection &&
                    connection.cloudUrl &&
                    message.connection.cloudUrl &&
                    connection.cloudUrl !== message.connection.cloudUrl
                  );
                  const authType = message.connection.authType || 'apiKey';
                  const needsApiKey =
                    authType !== 'clientPassword' &&
                    (!isEditMode ||
                      !connection ||
                      connection.type !== 'cloud' ||
                      !(connection.apiKeyPresent ?? !!connection.apiKey) ||
                      cloudUrlChanged);
                  if (!name || !message.connection.cloudUrl || (needsApiKey && !apiKey)) {
                    panel.webview.postMessage({
                      command: 'error',
                      message: needsApiKey
                        ? 'Name, cloudUrl and apiKey are required'
                        : 'Name and cloudUrl are required',
                    });
                    return;
                  }
                }

                if (
                  message.connection.authType === 'clientPassword' &&
                  !message.connection.username?.trim()
                ) {
                  panel.webview.postMessage({
                    command: 'error',
                    message: 'Username is required for client password authentication',
                  });
                  return;
                }

                let updatedConnection: WeaviateConnection | null = null;

                if (isEditMode && connection) {
                  // Build update payload, handling API key removal
                  const updatePayload = { ...message.connection };
                  delete updatePayload.removeApiKey;
                  delete updatePayload.removePassword;
                  if (message.removeApiKey === true) {
                    updatePayload.apiKey = undefined;
                  }
                  if (message.removePassword === true) {
                    updatePayload.password = undefined;
                  }
                  updatedConnection = await this.updateConnection(connection.id, updatePayload);
                } else {
                  // Add new connection
                  updatedConnection = await this.addConnection({
                    name: message.connection.name.trim(),
                    httpHost: message.connection.httpHost?.trim(),
                    httpPort: message.connection.httpPort,
                    grpcHost: message.connection.grpcHost?.trim(),
                    grpcPort: message.connection.grpcPort,
                    grpcSecure: message.connection.grpcSecure,
                    httpSecure: message.connection.httpSecure,
                    authType: message.connection.authType || 'apiKey',
                    apiKey: apiKey?.trim() || undefined,
                    username: message.connection.username?.trim() || undefined,
                    password: message.connection.password?.trim() || undefined,
                    type: message.connection.cloudUrl === undefined ? 'custom' : 'cloud',
                    cloudUrl: message.connection.cloudUrl?.trim() || undefined,
                    timeoutInit: message.connection.timeoutInit || undefined,
                    timeoutQuery: message.connection.timeoutQuery || undefined,
                    timeoutInsert: message.connection.timeoutInsert || undefined,
                    skipInitChecks: message.connection.skipInitChecks,
                    autoConnect: message.connection.autoConnect || false,
                    openClusterViewOnConnect: message.connection.openClusterViewOnConnect,
                    links: message.connection.links || [],
                  });
                }

                if (updatedConnection) {
                  panel.dispose();
                  resolve({ connection: updatedConnection, shouldConnect: true });
                }
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : isEditMode
                      ? 'Failed to update connection'
                      : 'Failed to add connection';
                panel.webview.postMessage({
                  command: 'error',
                  message: errorMessage,
                });
              }
              break;
            case 'cancel':
              panel.dispose();
              resolve(null);
              break;
          }
        },
        undefined,
        this.context.subscriptions
      );
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    const htmlPath = vscode.Uri.joinPath(distPath, 'connection.html');
    let html = '';

    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read connection HTML file:', error);
      return `<!DOCTYPE html>
        <html>
        <body>
          <h1>Error loading Connection panel</h1>
          <p>The webview bundle has not been built. Please run: npm run build:webview</p>
        </body>
        </html>`;
    }

    // Replace asset paths to use webview URIs
    html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, assetPath) => {
      if (assetPath.startsWith('http') || assetPath.startsWith('//')) {
        return match;
      }
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, assetPath));
      return `${attr}="${assetUri}"`;
    });

    // Add CSP
    const cspSource = webview.cspSource;
    html = html.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-{{nonce}}' ${cspSource}; script-src 'nonce-{{nonce}}' ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource}; connect-src ${cspSource};">`
    );

    // Replace nonce placeholder
    const nonce = this._getNonce();
    html = html.replace(/{{nonce}}/g, nonce);

    return html;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}

// Helper function to get the connection manager instance
export function getConnectionManager(context: vscode.ExtensionContext): ConnectionManager {
  return ConnectionManager.getInstance(context);
}
