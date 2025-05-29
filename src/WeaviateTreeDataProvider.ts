import * as vscode from 'vscode';
import * as weaviate from 'weaviate-ts-client';

// Define the structure for our tree items
export class WeaviateTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'collection' | 'message' | 'object',
        public readonly connectionId?: string, // To associate collections with a connection
        public iconPath?: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon,
        public readonly contextValue?: string // Used to show specific commands for items
    ) {
        super(label, collapsibleState);
        this.iconPath = iconPath;
        this.contextValue = contextValue;
    }
}

// Type for connection config storage
interface ConnectionConfig {
    id: string;
    name: string;
    url: string;
    apiKey?: string;
    status: 'connected' | 'disconnected';
}

export class WeaviateTreeDataProvider implements vscode.TreeDataProvider<WeaviateTreeItem> {
    // Event emitter for tree data changes
    private _onDidChangeTreeData: vscode.EventEmitter<WeaviateTreeItem | undefined | null | void> = new vscode.EventEmitter<WeaviateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WeaviateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private connections: ConnectionConfig[] = [];
    private collections: { [connectionId: string]: WeaviateTreeItem[] } = {};
    private weaviateClients: { [connectionId: string]: any } = {};
    private context: vscode.ExtensionContext;
    // Filter text for the search box
    private filterText: string = '';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // Initialize with mock data
        this.loadMockData();
        
        // Set context value for empty connections state (for viewsWelcome)
        vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', this.connections.length === 0);
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
        // Mock Connections
        this.connections = [
            { 
                id: 'demo-cluster-id', 
                name: 'demo-cluster', 
                url: 'http://localhost:8080', 
                status: 'connected' 
            },
            { 
                id: 'another-cluster-id', 
                name: 'another-cluster', 
                url: 'http://localhost:8081', 
                status: 'disconnected' 
            }
        ];

        // Mock Collections for demo-cluster
        this.collections['demo-cluster-id'] = [
            new WeaviateTreeItem(
                'Products', 
                vscode.TreeItemCollapsibleState.Collapsed, 
                'collection', 
                'demo-cluster-id', 
                new vscode.ThemeIcon('database'), 
                'weaviateCollection'
            ),
            new WeaviateTreeItem(
                'Cldraces', 
                vscode.TreeItemCollapsibleState.None, 
                'collection', 
                'demo-cluster-id', 
                new vscode.ThemeIcon('database'), 
                'weaviateCollection'
            ),
            new WeaviateTreeItem(
                'Users', 
                vscode.TreeItemCollapsibleState.Collapsed, 
                'collection', 
                'demo-cluster-id', 
                new vscode.ThemeIcon('database'), 
                'weaviateCollection'
            )
        ];

        // Mock Objects for Products collection
        const productsItem = this.collections['demo-cluster-id'][0];
        productsItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
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
    async addConnection(config: { name: string, url: string, apiKey?: string }): Promise<void> {
        try {
            const id = `conn-${Date.now()}`;
            const newConnection = {
                id,
                name: config.name,
                url: config.url,
                apiKey: config.apiKey,
                status: 'disconnected' as 'disconnected'
            };
            
            this.connections.push(newConnection);
            
            // Update empty state context
            vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', false);
            
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Connection '${config.name}' added.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add connection: ${error}`);
        }
    }

    // Connect to a Weaviate instance
    async connect(connectionId: string): Promise<void> {
        try {
            const connection = this.connections.find(c => c.id === connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }
            
            // Create Weaviate client
            const clientConfig: any = {
                host: connection.url,
                headers: {}
            };
            
            if (connection.apiKey) {
                clientConfig.headers['Authorization'] = `Bearer ${connection.apiKey}`;
            }
            
            // For mockup demo, just set as connected
            connection.status = 'connected';
            
            // In a real implementation, we'd initialize the client and fetch collections:
            // this.weaviateClients[connectionId] = weaviate.client(clientConfig);
            // await this.fetchCollections(connectionId);
            
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Connected to ${connection.name}.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
        }
    }

    // Disconnect from a Weaviate instance
    disconnect(connectionId: string): void {
        const connection = this.connections.find(c => c.id === connectionId);
        if (connection) {
            connection.status = 'disconnected';
            // Remove client
            delete this.weaviateClients[connectionId];
            
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Disconnected from ${connection.name}.`);
        }
    }

    // Edit a connection
    async editConnection(connectionId: string, config: { name: string, url: string, apiKey?: string }): Promise<void> {
        const connectionIndex = this.connections.findIndex(c => c.id === connectionId);
        if (connectionIndex !== -1) {
            // If connected, disconnect first
            if (this.connections[connectionIndex].status === 'connected') {
                this.disconnect(connectionId);
            }
            
            this.connections[connectionIndex] = {
                ...this.connections[connectionIndex],
                ...config
            };
            
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Connection '${config.name}' updated.`);
        }
    }

    // Delete a connection
    deleteConnection(connectionId: string): void {
        const connectionIndex = this.connections.findIndex(c => c.id === connectionId);
        if (connectionIndex !== -1) {
            const connectionName = this.connections[connectionIndex].name;
            
            // If connected, disconnect first
            if (this.connections[connectionIndex].status === 'connected') {
                this.disconnect(connectionId);
            }
            
            // Remove connection
            this.connections.splice(connectionIndex, 1);
            
            // Remove collections for this connection
            delete this.collections[connectionId];
            
            // Update empty state context
            vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', this.connections.length === 0);
            
            this._onDidChangeTreeData.fire();
            vscode.window.showInformationMessage(`Connection '${connectionName}' deleted.`);
        }
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
    
    // Fetch collections from Weaviate (would be implemented with real API)
    async fetchCollections(connectionId: string): Promise<void> {
        try {
            // In real implementation, would fetch from Weaviate API:
            // const client = this.weaviateClients[connectionId];
            // const schema = await client.schema.getter().do();
            // ...
            
            // For demo, do nothing - we're using mock data
            
            this._onDidChangeTreeData.fire();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch collections: ${error}`);
        }
    }

    // View schema for a collection
    async viewSchema(connectionId: string, collectionName: string): Promise<void> {
        try {
            // In real implementation, would fetch schema from Weaviate API
            // For demo, show mock schema
            const mockSchema = {
                class: collectionName,
                properties: [
                    { name: 'name', dataType: ['string'] },
                    { name: 'description', dataType: ['text'] },
                    { name: 'price', dataType: ['number'] },
                    { name: 'image', dataType: ['blob'] }
                ],
                vectorizer: 'text2vec-openai'
            };
            
            // Create a new untitled JSON file with the schema
            const document = await vscode.workspace.openTextDocument({
                content: JSON.stringify(mockSchema, null, 2),
                language: 'json'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to view schema: ${error}`);
        }
    }

    // Open query editor for a collection
    async queryCollection(connectionId: string, collectionName: string): Promise<void> {
        try {
            // In real implementation, would open a custom query editor
            // For demo, open an untitled GraphQL file with a template query
            const templateQuery = `{
  Get {
    ${collectionName} {
      name
      description
      # Add more properties here
      _additional {
        id
        vector
      }
    }
  }
}`;
            
            const document = await vscode.workspace.openTextDocument({
                content: templateQuery,
                language: 'graphql'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open query editor: ${error}`);
        }
    }

    // Delete a collection
    async deleteCollection(connectionId: string, collectionName: string): Promise<void> {
        try {
            const connection = this.connections.find(c => c.id === connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }
            
            // In real implementation, would delete using Weaviate API
            // For demo, just remove from our local array
            const collectionsArray = this.collections[connectionId] || [];
            const collectionIndex = collectionsArray.findIndex(c => c.label === collectionName);
            
            if (collectionIndex !== -1) {
                collectionsArray.splice(collectionIndex, 1);
                this._onDidChangeTreeData.fire();
                vscode.window.showInformationMessage(`Collection '${collectionName}' deleted.`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete collection: ${error}`);
        }
    }
}
