import * as vscode from 'vscode';
import weaviate, { WeaviateClient } from 'weaviate-client';

export interface ConnectionLink {
  name: string;
  url: string;
}

export interface WeaviateConnection {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  lastUsed?: number;
  links?: ConnectionLink[];

  // Either cloud or custom (discriminated union with "type")
  type: 'custom' | 'cloud';

  // Common (for both types)
  apiKey?: string;

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

  // backwards compatibility
  url?: string; // old field, to be migrated
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private static readonly currentVersion = '2'; // Current connection configuration version
  private readonly storageKey = 'weaviate-connections';
  private _onConnectionsChanged = new vscode.EventEmitter<void>();
  public readonly onConnectionsChanged = this._onConnectionsChanged.event;
  private connections: WeaviateConnection[] = [];
  private clients: Map<string, WeaviateClient> = new Map();
  private addConnectionMutex: Promise<any> = Promise.resolve(); // Mutex to prevent race conditions

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.loadConnections().catch((error) => {
      console.error('Failed to load connections during initialization:', error);
    });
  }

  private checkConnectionsMigration(connections: WeaviateConnection[]): WeaviateConnection[] {
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
    // if it doesn't have connectionVersion, need to migrate
    const migratedConnections = validConnections.map((conn) => {
      try {
        if (conn.connectionVersion === ConnectionManager.currentVersion) {
          // future migrations here
          return conn;
        } else if (!conn.connectionVersion) {
          // may be new connection without version
          if (conn.httpHost || conn.cloudUrl) {
            need_to_save = true;
            return { ...conn, connectionVersion: ConnectionManager.currentVersion };
          }
          // old connection, need to migrate
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
            // url should be in format http(s)://host:port; add default scheme if missing
            let rawUrl = conn.url;
            if (!/^https?:\/\//i.test(rawUrl)) {
              rawUrl = `http://${rawUrl}`;
            }
            const url = new URL(rawUrl);
            delete conn.url;
            conn.httpHost = url.hostname;
            // If no port is specified, choose sensible defaults: 443 for https, 8080 for http
            const hasExplicitPort = url.port && url.port.trim().length > 0;
            conn.httpPort = hasExplicitPort
              ? parseInt(url.port, 10)
              : url.protocol === 'https:'
                ? 443
                : 8080;
            conn.httpSecure = url.protocol === 'https:';
            conn.grpcHost = url.hostname;
            conn.grpcPort = 50051; // default grpc port
            conn.grpcSecure = url.protocol === 'https:'; // default to false
            conn.connectionVersion = ConnectionManager.currentVersion;

            need_to_save = true;
          }
        }
        return conn;
      } catch (error) {
        console.warn('Error migrating connection, skipping:', conn, error);
        return null;
      }
    });

    // Filter out any null values from failed migrations
    const finalConnections = migratedConnections.filter(
      (conn): conn is WeaviateConnection => conn !== null && conn !== undefined
    );

    if (need_to_save) {
      try {
        this.context.globalState.update(this.storageKey, finalConnections).then(
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
      const migratedConnections = this.checkConnectionsMigration(connections);
      // Ensure all loaded connections start as disconnected
      this.connections = migratedConnections.map((conn: WeaviateConnection) => ({
        ...conn,
        status: 'disconnected' as const,
      }));
      return this.connections;
    } catch (error) {
      console.error('Error loading connections, starting with empty list:', error);
      this.connections = [];
      return this.connections;
    }
  }

  private async saveConnections() {
    await this.context.globalState.update(this.storageKey, this.connections);
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
          if (!connection.apiKey || connection.apiKey.trim() === '') {
            throw new Error('API key is required for cloud connections');
          }
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
            ? timestamp.toString() + Math.random().toString(36).substr(2, 9)
            : timestamp.toString() + Math.random().toString(36).substr(2, 9);

        const newConnection: WeaviateConnection = {
          ...connection,
          id: uniqueId,
          status: 'disconnected',
          lastUsed: timestamp,
          connectionVersion: ConnectionManager.currentVersion,
        };

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

    // clear the connection index, keep only the id and last used
    this.connections[index] = { ...this.connections[index], ...updates, lastUsed: Date.now() };
    await this.saveConnections();
    return this.connections[index];
  }

  public async deleteConnection(id: string): Promise<boolean> {
    const index = this.connections.findIndex((c: WeaviateConnection) => c.id === id);
    if (index === -1) {
      return false;
    }

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
      if (connection.type === 'cloud' && connection.cloudUrl) {
        client = await weaviate.connectToWeaviateCloud(connection.cloudUrl, {
          authCredentials: new weaviate.ApiKey(connection.apiKey || ''),
          skipInitChecks: connection.skipInitChecks,

          timeout: {
            init: connection.timeoutInit,
            query: connection.timeoutQuery,
            insert: connection.timeoutInsert,
          },
        });
      } else {
        // Extract only the fields needed for connectToCustom
        client = await weaviate.connectToCustom({
          httpHost: connection.httpHost,
          httpPort: connection.httpPort,
          grpcHost: connection.grpcHost,
          grpcPort: connection.grpcPort,
          httpSecure: connection.httpSecure,
          grpcSecure: connection.grpcSecure,
          authCredentials: new weaviate.ApiKey(connection.apiKey || ''),
          type: connection.type,
          skipInitChecks: connection.skipInitChecks,
          timeout: {
            init: connection.timeoutInit,
            query: connection.timeoutQuery,
            insert: connection.timeoutInsert,
          },
        } as any);
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
      throw new Error('Connection not found');
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
      throw new Error('Connection not found');
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
      throw new Error('Connection not found');
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
      throw new Error('Connection not found');
    }

    return connection.links || [];
  }

  public async showAddConnectionDialog(): Promise<WeaviateConnection | null> {
    return this.showConnectionDialog();
  }

  public async showEditConnectionDialog(connectionId: string): Promise<WeaviateConnection | null> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }
    return this.showConnectionDialog(connection);
  }

  private async showConnectionDialog(
    connection?: WeaviateConnection
  ): Promise<WeaviateConnection | null> {
    return new Promise((resolve) => {
      const isEditMode = !!connection;
      const panel = vscode.window.createWebviewPanel(
        'weaviateConnection',
        isEditMode ? 'Edit Weaviate Connection' : 'Add Weaviate Connection',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
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
                  const needsApiKey =
                    !isEditMode ||
                    !connection ||
                    connection.type !== 'cloud' ||
                    !connection.apiKey ||
                    cloudUrlChanged;
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

                let updatedConnection: WeaviateConnection | null = null;

                if (isEditMode && connection) {
                  // Update existing connection
                  updatedConnection = await this.updateConnection(
                    connection.id,
                    message.connection
                  );
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
                    apiKey: apiKey?.trim() || undefined,
                    type: message.connection.cloudUrl === undefined ? 'custom' : 'cloud',
                    cloudUrl: message.connection.cloudUrl?.trim() || undefined,
                    timeoutInit: message.connection.timeoutInit || undefined,
                    timeoutQuery: message.connection.timeoutQuery || undefined,
                    timeoutInsert: message.connection.timeoutInsert || undefined,
                    skipInitChecks: message.connection.skipInitChecks,
                  });
                }

                if (updatedConnection) {
                  panel.dispose();
                  resolve(updatedConnection);
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

      // Set the HTML content for the webview
      panel.webview.html = this.getWebviewContent(connection);
    });
  }

  private getWebviewContent(connection?: WeaviateConnection): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add Weaviate Connection</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="text"],
    input[type="password"],
    input[type="number"],
    select {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 2px;
      box-sizing: border-box;
    }
    .error {
      color: var(--vscode-errorForeground);
      margin-top: 5px;
      display: none;
    }
    .button-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    button {
      margin-left: 10px;
      padding: 5px 12px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
    }
    .save-button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .cancel-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .advanced {
      margin-top: 10px;
    }
    .advanced-toggle {
      cursor: pointer;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 10px;
      display: inline-block;
    }
    .advanced-settings {
      display: none;
      margin-top: 10px;
      border: 1px solid var(--vscode-input-border);
      padding: 10px;
      border-radius: 4px;
    }
    .link-item {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      gap: 10px;
    }
    .link-input {
      flex: 1;
    }
    .link-input input {
      width: 100%;
      padding: 5px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 2px;
    }
    .remove-link-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      padding: 5px 8px;
      font-size: 12px;
    }
    .remove-link-button:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
  </style>
</head>
<body>
  <!-- Connection type dropdown -->
  <div class="form-group">
    <label for="connectionType">Connection Type</label>
    <select id="connectionType">
    <option value="custom">Custom</option>
    <option value="cloud">Cloud</option>
    </select>
  </div>
  
  <!-- Connection name -->
  <div class="form-group">
    <label for="connectionName">Connection Name</label>
    <input type="text" id="connectionName" placeholder="e.g., Production Cluster" value="${connection?.name || ''}">
    <div id="nameError" class="error"></div>
  </div>

  <!-- Custom fields -->
  <div id="customFields">
    <div class="form-group">
      <label for="httpHost">Weaviate HTTP Host</label>
      <input type="text" id="httpHost" placeholder="localhost" value="${connection?.httpHost || 'localhost'}">
      <div id="httpHostError" class="error"></div>
    </div>
    <div class="form-group">
      <label for="httpPort">Weaviate HTTP Port</label>
      <input type="number" id="httpPort" placeholder="8080" value="${connection?.httpPort || 8080}">
    </div>
    <div class="form-group">
      <label><input type="checkbox" id="httpSecure" ${connection?.httpSecure ? 'checked' : ''}> Use Secure HTTP (HTTPS)</label>
    </div>
    <div class="form-group">
      <label for="grpcHost">Weaviate gRPC Host</label>
      <input type="text" id="grpcHost" placeholder="localhost" value="${connection?.grpcHost || 'localhost'}">
    </div>
    <div class="form-group">
      <label for="grpcPort">Weaviate gRPC Port</label>
      <input type="number" id="grpcPort" placeholder="9090" value="${connection?.grpcPort || 50051}">
    </div>
    <div class="form-group">
      <label><input type="checkbox" id="grpcSecure" ${connection?.grpcSecure ? 'checked' : ''}> Use Secure gRPC (TLS)</label>
    </div>
    <div id="customApiKeyContainer" class="form-group">
      <label for="apiKeyCustom">API Key (optional)</label>
      <input type="password" id="apiKeyCustom" placeholder="${connection ? 'Leave blank to keep existing key' : 'Leave empty if not required'}" value="">
      ${connection ? '<small>If you leave this blank, the current API key will remain unchanged.</small>' : ''}
    </div>
  </div>

  <!-- Cloud fields -->
  <div id="cloudFields" style="display: none;">
    <div class="form-group">
      <label for="cloudUrl">Cloud URL</label>
      <input type="text" id="cloudUrl" placeholder="https://your-instance.weaviate.network" value="${connection?.cloudUrl || ''}">
      <div id="cloudUrlError" class="error"></div>
    </div>
    <div class="form-group">
      <label for="apiKeyCloud">API Key</label>
      <input type="password" id="apiKeyCloud" placeholder="${connection ? 'Leave blank to keep existing key' : 'Required for cloud'}" value="">
      ${connection ? '<small>If left blank, the existing API key will be preserved.</small>' : ''}
      <div id="apiKeyError" class="error"></div>
    </div>
  </div>

  <!-- Advanced settings -->
  <div class="advanced">
    <span class="advanced-toggle" id="toggleAdvanced">Show Advanced Settings ▾</span>
    
    <div class="advanced-settings" id="advancedSettings">
      <div class="form-group">
        <label for="timeoutInit">Timeout (Init, seconds)</label>
        <input type="number" id="timeoutInit" value="${connection?.timeoutInit || 30}">
      </div>
      <div class="form-group">
        <label for="timeoutQuery">Timeout (Query, seconds)</label>
        <input type="number" id="timeoutQuery" value="${connection?.timeoutQuery || 60}">
      </div>
      <div class="form-group">
        <label for="timeoutInsert">Timeout (Insert, seconds)</label>
        <input type="number" id="timeoutInsert" value="${connection?.timeoutInsert || 120}">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="skipInitChecks" ${connection?.skipInitChecks ? 'checked' : ''}> Skip Initial Checks</label>
      </div>
    </div>
  </div>

  <!-- Connection Links section -->
  <div class="form-group">
    <label>Connection Links</label>
    <div id="linksContainer">
      <!-- Links will be dynamically added here -->
    </div>
    <button type="button" id="addLinkButton" style="margin-top: 10px; padding: 5px 10px; background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px; cursor: pointer;">+ Add Link</button>
  </div>

  <div id="formError" class="error"></div>
  <div class="button-container">
    <button class="cancel-button" id="cancelButton">Cancel</button>
    <button class="save-button" id="saveButton">${connection ? 'Update' : 'Save'} Connection</button>
  </div>
  <small>Connection version: ${connection ? connection.connectionVersion || ConnectionManager.currentVersion : ConnectionManager.currentVersion}</small>


  <script>
  const vscode = acquireVsCodeApi();

  // Track edit state without exposing secrets
  const isEditMode = ${connection ? 'true' : 'false'};
  const existingType = '${connection?.type || ''}';
  const existingApiKeyPresent = ${connection?.apiKey ? 'true' : 'false'};
  const existingCloudUrl = '${connection?.cloudUrl || ''}'.trim();

  // Get dropdown element
  const connectionTypeDropdown = document.getElementById('connectionType');
  let currentType = '${connection?.type || 'custom'}';
  connectionTypeDropdown.value = currentType;

  // Initialize links array
  let links = ${connection?.links ? JSON.stringify(connection.links) : '[]'};

  // Function to update which fields are visible
  const updateFieldsVisibility = (type) => {
    document.getElementById('customFields').style.display = type === 'custom' ? 'block' : 'none';
    document.getElementById('cloudFields').style.display = type === 'cloud' ? 'block' : 'none';
  };

  // Set initial visibility based on connection type
  updateFieldsVisibility(currentType);

  // Functions for managing links
  function renderLinks() {
    const container = document.getElementById('linksContainer');
    container.innerHTML = '';
    
    links.forEach((link, index) => {
      const linkDiv = document.createElement('div');
      linkDiv.className = 'link-item';
      linkDiv.innerHTML = \`
        <div class="link-input">
          <input type="text" placeholder="Link name" value="\${link.name}" data-index="\${index}" data-field="name">
        </div>
        <div class="link-input">
          <input type="url" placeholder="https://example.com" value="\${link.url}" data-index="\${index}" data-field="url">
        </div>
        <button type="button" class="remove-link-button" data-index="\${index}">Remove</button>
      \`;
      container.appendChild(linkDiv);
    });

    // Add event listeners for link inputs
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        links[index][field] = e.target.value;
      });
    });

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-link-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        links.splice(index, 1);
        renderLinks();
      });
    });
  }

  function addLink() {
    links.push({ name: '', url: '' });
    renderLinks();
  }

  // Initialize links display
  renderLinks();

  // Add link button listener
  document.getElementById('addLinkButton').addEventListener('click', addLink);

  // Dropdown change listener
  connectionTypeDropdown.addEventListener('change', (e) => {
    currentType = e.target.value;
    updateFieldsVisibility(currentType);
  });

  // Advanced toggle
  document.getElementById('toggleAdvanced').addEventListener('click', () => {
    const adv = document.getElementById('advancedSettings');
    adv.style.display = adv.style.display === 'block' ? 'none' : 'block';
  });

  // Save button
  document.getElementById('saveButton').addEventListener('click', () => {
    const name = document.getElementById('connectionName').value.trim();
    const apiKeyCustom = document.getElementById('apiKeyCustom').value.trim();
    const apiKeyCloud = document.getElementById('apiKeyCloud').value.trim();
    const timeoutInit = parseInt(document.getElementById('timeoutInit').value, 10);
    const timeoutQuery = parseInt(document.getElementById('timeoutQuery').value, 10);
    const timeoutInsert = parseInt(document.getElementById('timeoutInsert').value, 10);
    const skipInitChecks = document.getElementById('skipInitChecks').checked;

    // Clear errors
    document.querySelectorAll('.error').forEach(el => {
      el.style.display = 'none';
      el.textContent = '';
    });

    if (!name) {
      showError('nameError', 'Name is required');
      return;
    }

    // Filter out empty links
    const validLinks = links.filter(link => link.name.trim() && link.url.trim());

    let connection = { name, type: currentType, timeoutInit, timeoutQuery, timeoutInsert, skipInitChecks, links: validLinks };

    if (currentType === "custom") {
      const httpHost = document.getElementById('httpHost').value.trim();
      const httpPort = parseInt(document.getElementById('httpPort').value, 10);
      const grpcHost = document.getElementById('grpcHost').value.trim();
      const grpcPort = parseInt(document.getElementById('grpcPort').value, 10);
      const httpSecure = document.getElementById('httpSecure').checked;
      const grpcSecure = document.getElementById('grpcSecure').checked;

      if (!httpHost) {
        showError('httpHostError', 'HTTP Host is required');
        return;
      }

      connection = { name, type: "custom", httpHost, httpPort, httpSecure, grpcHost, grpcPort, grpcSecure, timeoutInit, timeoutQuery, timeoutInsert, skipInitChecks, links: validLinks };
      if (apiKeyCustom) {
        connection.apiKey = apiKeyCustom;
      }
    } else {
      const cloudUrl = document.getElementById('cloudUrl').value.trim();
      if (!cloudUrl) {
        showError('cloudUrlError', 'Cloud URL is required');
        return;
      }
      const cloudUrlChanged = isEditMode && existingCloudUrl && cloudUrl && existingCloudUrl !== cloudUrl;
      const requiresApiKey = !isEditMode || currentType !== existingType || !existingApiKeyPresent || cloudUrlChanged;
      if (requiresApiKey && !apiKeyCloud) {
        showError('apiKeyError', 'API Key is required for cloud connection');
        return;
      }
      connection = { name, type: "cloud", cloudUrl, timeoutInit, timeoutQuery, timeoutInsert, skipInitChecks, links: validLinks };
      if (apiKeyCloud) {
        connection.apiKey = apiKeyCloud;
      }
    }

    vscode.postMessage({ command: 'save', connection });
  });

  // Cancel button
  document.getElementById('cancelButton').addEventListener('click', () => {
    vscode.postMessage({ command: 'cancel' });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('saveButton').click();
    } else if (e.key === 'Escape') {
      document.getElementById('cancelButton').click();
    }
  });

  // Handle messages from extension
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'error') {
      showError('formError', message.message);
    }
  });

  function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
      element.style.display = 'block';
    }
  }

  // Focus on the connection name input
  document.getElementById('connectionName').focus();
</script>


  </body>
</html>


        `;
  }
}

// Helper function to get the connection manager instance
export function getConnectionManager(context: vscode.ExtensionContext): ConnectionManager {
  return ConnectionManager.getInstance(context);
}
