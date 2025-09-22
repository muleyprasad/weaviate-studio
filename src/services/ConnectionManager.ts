import * as vscode from 'vscode';
import weaviate, { WeaviateClient } from 'weaviate-client';

export interface WeaviateConnection {
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
    lastUsed?: number;

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
}

export class ConnectionManager {
    private static instance: ConnectionManager;
    private readonly storageKey = 'weaviate-connections';
    private _onConnectionsChanged = new vscode.EventEmitter<void>();
    public readonly onConnectionsChanged = this._onConnectionsChanged.event;
    private connections: WeaviateConnection[] = [];
    private clients: Map<string, WeaviateClient> = new Map();

    private constructor(private readonly context: vscode.ExtensionContext) {
        this.loadConnections();
    }

    public static getInstance(context: vscode.ExtensionContext): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager(context);
        }
        return ConnectionManager.instance;
    }

    private async loadConnections(): Promise<WeaviateConnection[]> {
        const connections = this.context.globalState.get<WeaviateConnection[]>(this.storageKey) || [];
        // Ensure all loaded connections start as disconnected
        this.connections = connections.map((conn: WeaviateConnection) => ({
            ...conn,
            status: 'disconnected' as const
        }));
        return this.connections;
    }

    private async saveConnections() {
        await this.context.globalState.update(this.storageKey, this.connections);
        this._onConnectionsChanged.fire();
    }

    public async addConnection(connection: Omit<WeaviateConnection, 'id' | 'status'>): Promise<WeaviateConnection> {
        try {

            // Check for duplicate connection names
            const nameExists = this.connections.some(c => c.name.toLowerCase() === connection.name.toLowerCase());
            if (nameExists) {
                throw new Error('A connection with this name already exists');
            }

            const newConnection: WeaviateConnection = {
                ...connection,
                id: Date.now().toString(),
                status: 'disconnected',
                lastUsed: Date.now()
            };
            
            this.connections.push(newConnection);
            await this.saveConnections();
            this._onConnectionsChanged.fire();
            
            return newConnection;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to add connection');
        }
    }

    public async updateConnection(id: string, updates: Partial<WeaviateConnection>) {
        const index = this.connections.findIndex(c => c.id === id);
        if (index === -1) {
            return null;
        }
        
        this.connections[index] = { ...this.connections[index], ...updates, lastUsed: Date.now() };
        await this.saveConnections();
        return this.connections[index];
    }

    public async deleteConnection(id: string): Promise<boolean> {
        const index = this.connections.findIndex((c: WeaviateConnection) => c.id === id);
        if (index === -1) {
            return false;
        }
        
        await this.disconnect(id);
        this.connections.splice(index, 1);
        await this.saveConnections();
        return true;
    }

    public getConnections(): WeaviateConnection[] {
        return [...this.connections].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    }

    public getConnection(id: string): WeaviateConnection | undefined {
        return this.connections.find(c => c.id === id);
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
                    timeout: {
                        init: connection.timeoutInit,
                        query: connection.timeoutQuery,
                        insert: connection.timeoutInsert,
                    }
                });
            } else {
                client = await weaviate.connectToCustom(connection);
            }
            if (!client) {
                throw new Error('Failed to create Weaviate client');
            }

            // Test connection by getting server meta

            const is_ready = await client.isReady();
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

    private async showConnectionDialog(connection?: WeaviateConnection): Promise<WeaviateConnection | null> {
        return new Promise((resolve) => {
            const isEditMode = !!connection;
            const panel = vscode.window.createWebviewPanel(
                'weaviateConnection',
                isEditMode ? 'Edit Weaviate Connection' : 'Add Weaviate Connection',
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
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
                                            message: 'Name and httpHost are required'
                                        });
                                        return;
                                    }
                                }
                                if (type === 'cloud') {
                                    if (!name || !message.connection.cloudUrl || !apiKey) {
                                        panel.webview.postMessage({
                                            command: 'error',
                                            message: 'Name, cloudUrl and apiKey are required'
                                        });
                                        return;
                                    }
                                }

                                let updatedConnection: WeaviateConnection | null = null;
                                
                                if (isEditMode && connection) {
                                    // Update existing connection
                                    updatedConnection = await this.updateConnection(connection.id,message.connection);
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
                                        type: message.connection.cloudUrl === undefined? 'custom' : 'cloud',
                                        cloudUrl: message.connection.cloudUrl?.trim() || undefined,
                                        timeoutInit: message.connection.timeoutInit || undefined,
                                        timeoutQuery: message.connection.timeoutQuery || undefined,
                                        timeoutInsert: message.connection.timeoutInsert || undefined,
                                    });
                                }
                                
                                if (updatedConnection) {
                                    panel.dispose();
                                    resolve(updatedConnection);
                                }
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : 
                                    isEditMode ? 'Failed to update connection' : 'Failed to add connection';
                                panel.webview.postMessage({
                                    command: 'error',
                                    message: errorMessage
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
a: ${connection?.type}
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
      <input type="password" id="apiKeyCustom" placeholder="Leave empty if not required" value="${connection?.apiKey || ''}">
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
      <input type="password" id="apiKeyCloud" placeholder="Required for cloud" value="${connection?.apiKey || ''}">
      <div id="apiKeyError" class="error"></div>
    </div>
  </div>

  <!-- Advanced settings -->
  <div class="advanced">
    <span class="advanced-toggle" id="toggleAdvanced">Show Advanced Settings ▾</span>
    <div class="advanced-settings" id="advancedSettings">
      <div class="form-group">
        <label for="timeoutInit">Timeout (Init, ms)</label>
        <input type="number" id="timeoutInit" value="${connection?.timeoutInit || 3000}">
      </div>
      <div class="form-group">
        <label for="timeoutQuery">Timeout (Query, ms)</label>
        <input type="number" id="timeoutQuery" value="${connection?.timeoutQuery || 5000}">
      </div>
      <div class="form-group">
        <label for="timeoutInsert">Timeout (Insert, ms)</label>
        <input type="number" id="timeoutInsert" value="${connection?.timeoutInsert || 5000}">
      </div>
    </div>
  </div>

  <div id="formError" class="error"></div>
  <div class="button-container">
    <button class="cancel-button" id="cancelButton">Cancel</button>
    <button class="save-button" id="saveButton">${connection ? 'Update' : 'Save'} Connection</button>
  </div>

  <script>
  const vscode = acquireVsCodeApi();

  // Get dropdown element
  const connectionTypeDropdown = document.getElementById('connectionType');
  let currentType = '${connection?.type || "custom"}';
  connectionTypeDropdown.value = currentType;

  // Function to update which fields are visible
  const updateFieldsVisibility = (type) => {
    document.getElementById('customFields').style.display = type === 'custom' ? 'block' : 'none';
    document.getElementById('cloudFields').style.display = type === 'cloud' ? 'block' : 'none';
  };

  // Set initial visibility based on connection type
  updateFieldsVisibility(currentType);

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

    // Clear errors
    document.querySelectorAll('.error').forEach(el => {
      el.style.display = 'none';
      el.textContent = '';
    });

    if (!name) {
      showError('nameError', 'Name is required');
      return;
    }

    let connection = { name, type: currentType, timeoutInit, timeoutQuery, timeoutInsert };

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

      connection = { name, type: "custom", httpHost, httpPort, httpSecure, grpcHost, grpcPort, grpcSecure, apiKey: apiKeyCustom };
    } else {
      const cloudUrl = document.getElementById('cloudUrl').value.trim();
      if (!cloudUrl) {
        showError('cloudUrlError', 'Cloud URL is required');
        return;
      }
      if (!apiKeyCloud) {
        showError('apiKeyError', 'API Key is required for cloud connection');
        return;
      }
      connection = { name, type: "cloud", cloudUrl, apiKey: apiKeyCloud };
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
