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

    public async addConnection(connection: Omit<WeaviateConnection, 'id' | 'status'>) {
        const newConnection: WeaviateConnection = {
            ...connection,
            id: Date.now().toString(),
            status: 'disconnected',
            lastUsed: Date.now()
        };
        
        this.connections.push(newConnection);
        await this.saveConnections();
        return newConnection;
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
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this connection',
            placeHolder: 'e.g., Production Cluster',
            validateInput: value => !value ? 'Name is required' : null
        });
        if (!name) {
            return null;
        }

        const url = await vscode.window.showInputBox({
            prompt: 'Enter the Weaviate server URL',
            placeHolder: 'e.g., localhost:8080 or weaviate.example.com',
            validateInput: value => !value ? 'URL is required' : null
        });
        if (!url) {
            return null;
        }

        const useAuth = await vscode.window.showQuickPick(
            ['No authentication', 'API Key'],
            { placeHolder: 'Does this instance require authentication?' }
        );

        let apiKey: string | undefined;
        if (useAuth === 'API Key') {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your API key',
                password: true
            });
            if (key === undefined) {
                return null;
            }
            apiKey = key;
        }

        if (url) {
            return this.addConnection({ name, url, apiKey });
        }
        return null;
    }
}

// Helper function to get the connection manager instance
export function getConnectionManager(context: vscode.ExtensionContext): ConnectionManager {
    return ConnectionManager.getInstance(context);
}
