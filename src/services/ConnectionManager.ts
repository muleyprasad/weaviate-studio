import * as vscode from 'vscode';
import weaviate from 'weaviate-ts-client';

export interface WeaviateConnection {
    id: string;
    name: string;
    url: string;
    apiKey?: string;
    status: 'connected' | 'disconnected';
    lastUsed?: number;
}

export class ConnectionManager {
    private static instance: ConnectionManager;
    private readonly storageKey = 'weaviate-connections';
    private _onConnectionsChanged = new vscode.EventEmitter<void>();
    public readonly onConnectionsChanged = this._onConnectionsChanged.event;
    private connections: WeaviateConnection[] = [];
    private clients: Map<string, any> = new Map();

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
            // Validate connection URL
            try {
                new URL(connection.url);
            } catch (error) {
                throw new Error('Invalid URL format. Please include http:// or https://');
            }

            // Check for duplicate connection names
            const nameExists = this.connections.some(c => c.name.toLowerCase() === connection.name.toLowerCase());
            if (nameExists) {
                throw new Error('A connection with this name already exists');
            }

            // Check for duplicate URLs
            const urlExists = this.connections.some(c => c.url === connection.url);
            if (urlExists) {
                throw new Error('A connection with this URL already exists');
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
            const client = weaviate.client({
                scheme: connection.url.startsWith('https') ? 'https' : 'http',
                host: connection.url.replace(/^https?:\/\//, ''),
                apiKey: connection.apiKey ? new weaviate.ApiKey(connection.apiKey) : undefined,
            });

            // Test connection by getting server meta
            await client.misc.metaGetter().do();
            
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

    public getClient(id: string): any | undefined {
        return this.clients.get(id);
    }

    public async showAddConnectionDialog(): Promise<WeaviateConnection | null> {
        return new Promise((resolve) => {
            const panel = vscode.window.createWebviewPanel(
                'weaviateAddConnection',
                'Add Weaviate Connection',
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
                                const { name, url, apiKey } = message.connection;
                                if (!name || !url) {
                                    panel.webview.postMessage({
                                        command: 'error',
                                        message: 'Name and URL are required'
                                    });
                                    return;
                                }

                                // Validate URL format
                                try {
                                    new URL(url);
                                } catch (e) {
                                    panel.webview.postMessage({
                                        command: 'error',
                                        message: 'Please enter a valid URL (e.g., http://localhost:8080)'
                                    });
                                    return;
                                }

                                const connection = await this.addConnection({
                                    name: name.trim(),
                                    url: url.trim(),
                                    apiKey: apiKey?.trim() || undefined
                                });
                                
                                if (connection) {
                                    panel.dispose();
                                    resolve(connection);
                                }
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : 'Failed to add connection';
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
            panel.webview.html = this.getWebviewContent();
        });
    }

    private getWebviewContent(): string {
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
                    input[type="password"] {
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
                </style>
            </head>
            <body>
                <div class="form-group">
                    <label for="connectionName">Connection Name</label>
                    <input type="text" id="connectionName" placeholder="e.g., Production Cluster">
                    <div id="nameError" class="error"></div>
                </div>
                <div class="form-group">
                    <label for="connectionUrl">Weaviate URL</label>
                    <input type="text" id="connectionUrl" placeholder="http://localhost:8080">
                    <div id="urlError" class="error"></div>
                </div>
                <div class="form-group">
                    <label for="apiKey">API Key (optional)</label>
                    <input type="password" id="apiKey" placeholder="Leave empty if not required">
                </div>
                <div id="formError" class="error"></div>
                <div class="button-container">
                    <button class="cancel-button" id="cancelButton">Cancel</button>
                    <button class="save-button" id="saveButton">Save Connection</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('saveButton').addEventListener('click', () => {
                        const name = document.getElementById('connectionName').value.trim();
                        const url = document.getElementById('connectionUrl').value.trim();
                        const apiKey = document.getElementById('apiKey').value.trim();
                        
                        // Clear previous errors
                        document.querySelectorAll('.error').forEach(el => {
                            el.style.display = 'none';
                            el.textContent = '';
                        });
                        
                        // Basic validation
                        if (!name) {
                            showError('nameError', 'Name is required');
                            return;
                        }
                        
                        if (!url) {
                            showError('urlError', 'URL is required');
                            return;
                        }
                        
                        // Send data to extension
                        vscode.postMessage({
                            command: 'save',
                            connection: { name, url, apiKey }
                        });
                    });
                    
                    document.getElementById('cancelButton').addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    });
                    
                    // Handle Enter key in input fields
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            document.getElementById('saveButton').click();
                        } else if (e.key === 'Escape') {
                            document.getElementById('cancelButton').click();
                        }
                    });
                    
                    // Listen for messages from the extension
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
                    
                    // Focus the first input field when the webview loads
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
