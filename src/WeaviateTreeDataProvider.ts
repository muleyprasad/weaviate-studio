import * as vscode from 'vscode';
import * as weaviate from 'weaviate-ts-client';
import { ConnectionManager, WeaviateConnection } from './services/ConnectionManager';

// Define the structure for our tree items
export class WeaviateTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'collection' | 'message' | 'object',
        public readonly connectionId?: string, // To associate collections with a connection
        iconPath?: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon,
        contextValue?: string, // Used to show specific commands for items
        description?: string // Optional description
    ) {
        super(label, collapsibleState);
        this.iconPath = iconPath;
        this.contextValue = contextValue;
        if (description) {
            // @ts-ignore - We're setting a read-only property here
            this.description = description;
        }
    }
}

// Alias for backward compatibility
type ConnectionConfig = WeaviateConnection;

export class WeaviateTreeDataProvider implements vscode.TreeDataProvider<WeaviateTreeItem> {
    // Event emitter for tree data changes
    private _onDidChangeTreeData: vscode.EventEmitter<WeaviateTreeItem | undefined | null | void> = new vscode.EventEmitter<WeaviateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WeaviateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private connections: ConnectionConfig[] = [];
    private collections: { [connectionId: string]: WeaviateTreeItem[] } = {};
    private context: vscode.ExtensionContext;
    private connectionManager: ConnectionManager;
    // Filter text for the search box
    private filterText: string = '';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.connectionManager = ConnectionManager.getInstance(context);
        
        // Load saved connections
        this.loadConnections();
        
        // Set context value for empty connections state (for viewsWelcome)
        vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', this.connections.length === 0);
        
        // Listen for connection changes
        this.connectionManager.onConnectionsChanged(() => {
            this.loadConnections();
            this.refresh();
        });
    }
    
    private async loadConnections() {
        this.connections = this.connectionManager.getConnections();
        // Try to connect to all previously connected instances
        await Promise.all(
            this.connections
                .filter(conn => conn.status === 'connected')
                .map(conn => this.connect(conn.id))
        );
    }

    // Handle filter text changes
    setFilterText(text: string): void {
        this.filterText = text;
        this._onDidChangeTreeData.fire();
    }

    // Refresh tree view
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // Helper to get connected status theme icon
    getStatusIcon(status: 'connected' | 'disconnected'): vscode.ThemeIcon {
        if (status === 'connected') {
            // Green dot for connected
            return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
        } else {
            // Gray/hollow dot for disconnected
            return new vscode.ThemeIcon('circle-outline');
        }
    }

    // Load mock data for demonstration
    loadMockData(): void {
        // No longer needed as we're using real connections
    }

    // TreeDataProvider implementation
    getTreeItem(element: WeaviateTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: WeaviateTreeItem): Thenable<WeaviateTreeItem[]> {
        // Apply filtering if needed
        const applyFilter = (items: WeaviateTreeItem[]): WeaviateTreeItem[] => {
            if (!this.filterText) {
                return items;
            }
            return items.filter(item => 
                item.label.toLowerCase().includes(this.filterText.toLowerCase())
            );
        };

        // No connections case
        if (this.connections.length === 0) {
            return Promise.resolve([
                new WeaviateTreeItem(
                    'No connections found. Click + to add.', 
                    vscode.TreeItemCollapsibleState.None, 
                    'message'
                )
            ]);
        }

        if (!element) {
            // Root level - show connections
            const connectionItems = this.connections.map(conn => {
                const contextValue = conn.status === 'connected' ? 'weaviateConnectionActive' : 'weaviateConnection';
                const item = new WeaviateTreeItem(
                    conn.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'connection',
                    conn.id,
                    this.getStatusIcon(conn.status),
                    contextValue
                );
                item.description = conn.url;
                item.tooltip = `${conn.name} (${conn.url})\nStatus: ${conn.status}`;
                
                // Only expand connected clusters
                if (conn.status === 'connected') {
                    item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                }
                
                return item;
            });
            
            return Promise.resolve(applyFilter(connectionItems));
        } 
        else if (element.itemType === 'connection' && element.connectionId) {
            // Connection level - show collections
            const collections = this.collections[element.connectionId] || [];
            
            if (collections.length === 0) {
                return Promise.resolve([
                    new WeaviateTreeItem(
                        'No collections found. Right-click to add a collection.', 
                        vscode.TreeItemCollapsibleState.None, 
                        'message'
                    )
                ]);
            }
            
            return Promise.resolve(applyFilter(collections));
        }
        else if (element.itemType === 'collection' && element.label === 'Products') {
            // Collection level - show objects (only for Products demo)
            const objects = [
                new WeaviateTreeItem('Object A', vscode.TreeItemCollapsibleState.None, 'object', element.connectionId, new vscode.ThemeIcon('symbol-property')),
                new WeaviateTreeItem('Object B', vscode.TreeItemCollapsibleState.None, 'object', element.connectionId, new vscode.ThemeIcon('symbol-property'))
            ];
            
            return Promise.resolve(applyFilter(objects));
        }
        else if (element.itemType === 'collection' && element.label === 'Users') {
            // Collection level - show objects (only for Users demo)
            const objects = [
                new WeaviateTreeItem('User 1', vscode.TreeItemCollapsibleState.None, 'object', element.connectionId, new vscode.ThemeIcon('symbol-property')),
                new WeaviateTreeItem('User 2', vscode.TreeItemCollapsibleState.None, 'object', element.connectionId, new vscode.ThemeIcon('symbol-property'))
            ];
            
            return Promise.resolve(applyFilter(objects));
        }
        
        return Promise.resolve([]);
    }

    // --- Connection Management Methods ---
    
    // Add a new connection
    async addConnection(): Promise<void> {
        const connection = await this.connectionManager.showAddConnectionDialog();
        if (connection) {
            await this.connect(connection.id);
            this.refresh();
        }
    }

    // Connect to a Weaviate instance
    async connect(connectionId: string): Promise<boolean> {
        const connection = await this.connectionManager.connect(connectionId);
        if (connection) {
            await this.fetchCollections(connectionId);
            this.refresh();
            vscode.window.showInformationMessage(`Connected to ${connection.name}`);
            return true;
        }
        return false;
    }

    // Disconnect from a Weaviate instance
    async disconnect(connectionId: string): Promise<void> {
        const connection = this.connections.find(c => c.id === connectionId);
        if (connection) {
            await this.connectionManager.disconnect(connectionId);
            this.refresh();
            vscode.window.showInformationMessage(`Disconnected from ${connection.name}`);
        }
    }

    // Edit a connection
    async editConnection(connectionId: string): Promise<void> {
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) return;
        
        const name = await vscode.window.showInputBox({
            value: connection.name,
            prompt: 'Edit connection name',
            validateInput: value => !value ? 'Name is required' : null
        });
        if (name === undefined) return;
        
        const url = await vscode.window.showInputBox({
            value: connection.url,
            prompt: 'Edit Weaviate server URL',
            validateInput: value => !value ? 'URL is required' : null
        });
        if (url === undefined) return;
        
        const useAuth = await vscode.window.showQuickPick(
            ['No authentication', 'API Key'],
            { 
                placeHolder: connection.apiKey ? 'Using API Key authentication' : 'No authentication',
                canPickMany: false
            }
        );
        
        let apiKey = connection.apiKey;
        if (useAuth === 'API Key') {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your API key (leave empty to keep current)',
                password: true
            });
            if (key === undefined) return;
            if (key) apiKey = key;
        } else if (useAuth === 'No authentication') {
            apiKey = undefined;
        }
        
        await this.connectionManager.updateConnection(connectionId, { name, url, apiKey });
        this.refresh();
        vscode.window.showInformationMessage(`Updated connection: ${name}`);
    }


    
    // Get the total number of connections
    getConnectionCount(): number {
        return this.connections.length;
    }
    
    // Get a connection by its ID
    getConnectionById(connectionId: string): ConnectionConfig | undefined {
        return this.connections.find(c => c.id === connectionId);
    }

    // --- Collection Management Methods ---
    
    // Fetch collections from Weaviate
    async fetchCollections(connectionId: string): Promise<void> {
        const client = this.connectionManager.getClient(connectionId);
        if (!client) {
            vscode.window.showErrorMessage('Not connected to Weaviate instance');
            return;
        }

        try {
            const schema = await client.schema.getter().do();
            this.collections[connectionId] = (schema.classes || []).map((cls: any) => 
                new WeaviateTreeItem(
                    cls.class,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'collection',
                    connectionId,
                    new vscode.ThemeIcon('database'),
                    'weaviateCollection',
                    cls.description
                )
            );
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch collections: ${error}`);
        }
    }

    // Query a collection
    async queryCollection(connectionId: string, collectionName: string): Promise<void> {
        try {
            const client = this.connectionManager.getClient(connectionId);
            if (!client) {
                throw new Error('Not connected to this Weaviate instance');
            }
            
            // Open query editor with collection context
            await vscode.commands.executeCommand('weaviate.queryCollection', connectionId, collectionName);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to query collection: ${error}`);
        }
    }

    // View schema for a collection
    async viewSchema(connectionId: string, collectionName: string): Promise<void> {
        try {
            const client = this.connectionManager.getClient(connectionId);
            if (!client) {
                throw new Error('Not connected to this Weaviate instance');
            }
            
            const schema = await client.schema.getter(collectionName).do();
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(schema, null, 2),
                language: 'json'
            });
            
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to view schema: ${error}`);
        }
    }

    // Open query editor for a collection
    async openQueryEditor(connectionId: string, collectionName: string): Promise<void> {
        try {
            // In real implementation, would open a custom query editor
            // For demo, open a new untitled document with a sample query
            const templateQuery = `{
  "query": {
    "$query": {
      "class": "${collectionName}",
      "vector": [0.1, 0.2, 0.3],  // Replace with actual vector
      "limit": 10
    }
  }
}`;
            
            const document = await vscode.workspace.openTextDocument({
                content: templateQuery,
                language: 'json'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open query editor: ${error}`);
        }
    }

    // Delete a connection
    async deleteConnection(connectionId: string): Promise<void> {
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) return;
        
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the connection "${connection.name}"?`,
            { modal: true },
            'Delete'
        );
        
        if (confirm === 'Delete') {
            await this.connectionManager.deleteConnection(connectionId);
            this.refresh();
            vscode.window.showInformationMessage(`Deleted connection: ${connection.name}`);
            // Remove collections for this connection
            delete this.collections[connectionId];
            
            // Update empty state context
            vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', this.connections.length === 0);
            
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Connection '${connection.name}' deleted.`);
        }
    }
}
