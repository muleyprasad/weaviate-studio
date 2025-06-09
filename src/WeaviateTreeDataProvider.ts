import * as vscode from 'vscode';
import { ConnectionManager, WeaviateConnection } from './services/ConnectionManager';
import { WeaviateTreeItem, ConnectionConfig, CollectionsMap, CollectionWithSchema, ExtendedSchemaClass, SchemaClass } from './types';
import { ViewRenderer } from './views/ViewRenderer';

/**
 * Provides data for the Weaviate Explorer tree view, displaying connections,
 * collections, and their properties in a hierarchical structure.
 * 
 * This class implements the VS Code TreeDataProvider interface to display
 * Weaviate connections, collections, and their properties in the VS Code
 * Explorer view. It handles the data retrieval, filtering, and display
 * of Weaviate schema information.
 */
export class WeaviateTreeDataProvider implements vscode.TreeDataProvider<WeaviateTreeItem> {
    // Event emitter for tree data changes
    /** Event emitter for tree data changes */
    private _onDidChangeTreeData: vscode.EventEmitter<WeaviateTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<WeaviateTreeItem | undefined | null | void>();
    
    /** Event that fires when the tree data changes */
    readonly onDidChangeTreeData: vscode.Event<WeaviateTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    /** List of Weaviate connections */
    private connections: ConnectionConfig[] = [];
    
    /** Map of connection IDs to their collections */
    private collections: CollectionsMap = {};
    
    /** VS Code extension context */
    private readonly context: vscode.ExtensionContext;
    
    /** Manages Weaviate connections */
    private readonly connectionManager: ConnectionManager;
    
    /** Handles view rendering */
    private readonly viewRenderer: ViewRenderer;
    
    private isRefreshing = false;

    /**
     * Creates a new instance of the WeaviateTreeDataProvider
     * @param context - The VS Code extension context
     * 
     * @remarks
     * The constructor initializes the connection manager, loads initial connections,
     * and sets up event listeners for connection changes. It uses a debounce mechanism
     * to prevent excessive refreshes when multiple connection changes occur in quick succession.
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.connectionManager = ConnectionManager.getInstance(context);
        this.viewRenderer = ViewRenderer.getInstance(context);
        
        // Initial load of connections
        this.connections = this.connectionManager.getConnections();
        
        // Set initial empty state
        this.updateEmptyState();
        
        // Listen for connection changes with debounce
        let refreshTimeout: NodeJS.Timeout;
        this.connectionManager.onConnectionsChanged(() => {
            if (this.isRefreshing) {
                return;
            }
            
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(async () => {
                this.isRefreshing = true;
                try {
                    this.connections = this.connectionManager.getConnections();
                    this.updateEmptyState();
                    this._onDidChangeTreeData.fire();
                } finally {
                    this.isRefreshing = false;
                }
            }, 100); // 100ms debounce
        });
    }
    
    /**
     * Updates the VS Code context to reflect whether there are any connections
     * 
     * @remarks
     * This method sets a VS Code context variable 'weaviateConnectionsEmpty' that can be used
     * to control the visibility of UI elements based on whether there are any connections.
     * It's called whenever the connections list changes.
     */
    private updateEmptyState(): void {
        vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', this.connections.length === 0);
    }

    /**
     * Refreshes the tree view to reflect any changes in the data
     * 
     * @remarks
     * This method triggers a refresh of the tree view by emitting the
     * `_onDidChangeTreeData` event. It should be called whenever the underlying
     * data changes and the UI needs to be updated.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // #region Command Handlers

    /**
     * Shows a detailed schema view for a collection in a webview
     * @param item - The tree item representing the collection
     */
    public async handleViewDetailedSchema(item: WeaviateTreeItem): Promise<void> {
        if (!item.connectionId || !item.label) {
            vscode.window.showErrorMessage('Cannot view schema: Missing connection or collection name');
            return;
        }

        try {
            const collectionName = item.label.toString();
            const collection = this.collections[item.connectionId]?.find(
                col => col.label === collectionName
            ) as CollectionWithSchema | undefined;

            if (!collection?.schema) {
                vscode.window.showErrorMessage('Could not find schema for collection');
                return;
            }

            // Create and show a webview with the detailed schema
            const panel = vscode.window.createWebviewPanel(
                'weaviateDetailedSchema',
                `Schema: ${collectionName}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            // Format the schema as HTML
            panel.webview.html = this.getDetailedSchemaHtml(collection.schema);

        } catch (error) {
            console.error('Error viewing detailed schema:', error);
            vscode.window.showErrorMessage(
                `Failed to view detailed schema: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Generates HTML for displaying detailed schema in a webview
     * @param schema The schema to display
     */
    private getDetailedSchemaHtml(schema: SchemaClass): string {
        return this.viewRenderer.renderDetailedSchema(schema);
    }
    
    // #endregion Command Handlers

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

    // #region TreeDataProvider Implementation
    
    /**
     * Converts a tree item into a VS Code TreeItem for display in the explorer view
     * @param element - The tree item to convert
     * @returns A VS Code TreeItem ready for display
     * 
     * @remarks
     * This method is called by VS Code to get the UI representation of a tree item.
     * It sets appropriate icons and tooltips based on the item type and properties.
     */
    getTreeItem(element: WeaviateTreeItem): vscode.TreeItem {
        // Set appropriate icons and tooltips based on item type
        if (element.itemType === 'properties' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('symbol-property');
            element.tooltip = 'View collection properties';
        } else if (element.itemType === 'property') {
            // Ensure property items have the correct context value
            if (!element.contextValue) {
                element.contextValue = 'weaviateProperty';
            }
            
            // Set different icons based on property type if no icon is set
            if (!element.iconPath) {
                const label = element.label as string;
                if (label.includes('(text)') || label.includes('(string)')) {
                    element.iconPath = new vscode.ThemeIcon('symbol-text');
                } else if (label.includes('(number)') || label.includes('(int)') || label.includes('(float)')) {
                    element.iconPath = new vscode.ThemeIcon('symbol-number');
                } else if (label.includes('(boolean)') || label.includes('(bool)')) {
                    element.iconPath = new vscode.ThemeIcon('symbol-boolean');
                } else if (label.includes('(date)') || label.includes('(datetime)')) {
                    element.iconPath = new vscode.ThemeIcon('calendar');
                } else {
                    element.iconPath = new vscode.ThemeIcon('symbol-property');
                }
            }
        }
        
        return element;
    }

    /**
     * Gets the children of a tree item, or the root items if no item is provided
     * @param element - The parent tree item, or undefined to get root items
     * @returns A promise that resolves to an array of child tree items
     * 
     * @remarks
     * This method is called by VS Code to populate the tree view. It handles:
     * - Root level: Shows connections or a message if no connections exist
     * - Connection level: Shows collections for the connection
     * - Collection level: Shows metadata, properties, and vector configurations
     */
    getChildren(element?: WeaviateTreeItem): Thenable<WeaviateTreeItem[]> {
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
                    undefined, // collectionName
                    undefined, // itemId
                    this.getStatusIcon(conn.status),
                    contextValue
                );
                item.tooltip = `${conn.name} (${conn.url})\nStatus: ${conn.status}`;
                
                // Only expand connected clusters
                if (conn.status === 'connected') {
                    item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                }
                
                return item;
            });
            
            return Promise.resolve(connectionItems);
        } 
        else if (element.itemType === 'connection' && element.connectionId) {
            // Connection level - show collections
            const collections = this.collections[element.connectionId] || [];
            
            if (collections.length === 0) {
                const connection = this.connections.find(conn => conn.id === element.connectionId);
                let message = 'Not connected';
                
                if (connection) {
                    message = connection.status === 'connected' 
                        ? 'No collections found. Right-click to add a collection.'
                        : 'Not connected. Right-click and select "Connect" to view collections.';
                }
                
                return Promise.resolve([
                    new WeaviateTreeItem(
                        message,
                        vscode.TreeItemCollapsibleState.None, 
                        'message',
                        element.connectionId
                    )
                ]);
            }
            
            return Promise.resolve(collections);
        }
        else if (element.itemType === 'collection') {
            // Collection level - show properties
            const items = [
                new WeaviateTreeItem(
                    'Properties',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'properties',
                    element.connectionId,
                    element.label,
                    'properties',
                    new vscode.ThemeIcon('symbol-property')
                )
            ];
            
            return Promise.resolve(items);
        }

        else if (element.itemType === 'properties' && element.connectionId && element.collectionName) {
            // Find the collection schema
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
            if (!collection) {
                return Promise.resolve([
                    new WeaviateTreeItem('No properties available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const schema = (collection as any).schema;
            if (!schema || !schema.properties || !Array.isArray(schema.properties)) {
                return Promise.resolve([
                    new WeaviateTreeItem('No properties defined', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            // Map property types to icons
            const getPropertyIcon = (dataType: string[]): vscode.ThemeIcon => {
                const type = Array.isArray(dataType) ? dataType[0] : dataType;
                switch (type) {
                    case 'text':
                    case 'string':
                        return new vscode.ThemeIcon('symbol-text');
                    case 'int':
                    case 'number':
                    case 'float':
                    case 'number[]':
                        return new vscode.ThemeIcon('symbol-number');
                    case 'boolean':
                        return new vscode.ThemeIcon('symbol-boolean');
                    case 'date':
                    case 'dateTime':
                        return new vscode.ThemeIcon('calendar');
                    case 'object':
                    case 'object[]':
                        return new vscode.ThemeIcon('symbol-object');
                    case 'geoCoordinates':
                        return new vscode.ThemeIcon('location');
                    case 'phoneNumber':
                        return new vscode.ThemeIcon('device-mobile');
                    case 'blob':
                        return new vscode.ThemeIcon('file-binary');
                    default:
                        return new vscode.ThemeIcon('symbol-property');
                }
            };
            
            const propertyItems = schema.properties.map((prop: any) => {
                const dataType = Array.isArray(prop.dataType) ? prop.dataType.join(' | ') : prop.dataType;
                const description = prop.description ? ` - ${prop.description}` : '';
                const icon = getPropertyIcon(prop.dataType);
                
                return new WeaviateTreeItem(
                    `${prop.name} (${dataType})${description}`,
                    vscode.TreeItemCollapsibleState.None,
                    'property',
                    element.connectionId,
                    element.collectionName,
                    prop.name,
                    icon,
                    'weaviateProperty',
                    description.trim()
                );
            });
            
            return Promise.resolve(propertyItems);
        }
        
        return Promise.resolve([]);
    }

    // --- Connection Management Methods ---
    
    // Add a new connection
    async addConnection(connectionDetails?: { name: string; url: string; apiKey?: string }): Promise<WeaviateConnection | null> {
        try {
            if (!connectionDetails) {
                // If no details provided, show the dialog
                return await this.connectionManager.showAddConnectionDialog();
            }

            // Validate connection details
            if (!connectionDetails.name || !connectionDetails.url) {
                throw new Error('Name and URL are required');
            }

            // Add the connection
            const connection = await this.connectionManager.addConnection(connectionDetails);
            
            if (connection) {
                // Try to connect to the new connection
                await this.connect(connection.id);
                // Refresh the tree view to show the new connection
                this.refresh();
                vscode.window.showInformationMessage(`Successfully added connection: ${connection.name}`);
                return connection;
            }
            
            return null;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            vscode.window.showErrorMessage(`Failed to add connection: ${errorMessage}`);
            return null;
        }
    }

    // Connect to a Weaviate instance
    async connect(connectionId: string, silent = false): Promise<boolean> {
        if (this.isRefreshing && !silent) {
            return false;
        }
        
        try {
            const connection = await this.connectionManager.connect(connectionId);
            if (connection) {
                // Don't show messages during silent connections (like on startup)
                if (!silent) {
                    vscode.window.showInformationMessage(`Connected to ${connection.name}`);
                }
                
                // Only fetch collections if we're not in a refresh loop
                if (!this.isRefreshing) {
                    await this.fetchCollections(connectionId);
                }
                
                return true;
            }
            return false;
        } catch (error) {
            if (!silent) {
                vscode.window.showErrorMessage(`Failed to connect: ${error}`);
            }
            return false;
        }
    }

    // Disconnect from a Weaviate instance
    async disconnect(connectionId: string): Promise<void> {
        const connection = this.connections.find(c => c.id === connectionId);
        if (connection) {
            await this.connectionManager.disconnect(connectionId);
            // Clear collections for this connection
            delete this.collections[connectionId];
            // Refresh connections and update tree view
            this.connections = this.connectionManager.getConnections();
            this.refresh();
            vscode.window.showInformationMessage(`Disconnected from ${connection.name}`);
        }
    }

    // Edit a connection
    async editConnection(connectionId: string, updates?: { name: string; url: string; apiKey?: string }): Promise<void> {
        try {
            if (updates) {
                // If updates are provided, apply them directly
                await this.connectionManager.updateConnection(connectionId, updates);
                this.refresh();
                vscode.window.showInformationMessage('Connection updated successfully');
            } else {
                // Show the edit dialog
                const updatedConnection = await this.connectionManager.showEditConnectionDialog(connectionId);
                if (updatedConnection) {
                    this.refresh();
                    vscode.window.showInformationMessage('Connection updated successfully');
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update connection';
            vscode.window.showErrorMessage(`Failed to update connection: ${errorMessage}`);
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
    
    // Fetch collections from Weaviate
    async fetchCollections(connectionId: string): Promise<void> {
        try {
            const connection = this.connectionManager.getConnection(connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }

            // Get the client for this connection
            const client = this.connectionManager.getClient(connectionId);
            if (!client) {
                throw new Error('Client not initialized');
            }

            // Get schema from Weaviate
            const schema = await client.schema.getter().do() as { classes?: ExtendedSchemaClass[] };
            
            // Store collections with their schema
            if (schema.classes && Array.isArray(schema.classes)) {
                this.collections[connectionId] = schema.classes.map((cls: ExtendedSchemaClass) => ({
                    label: cls.class,
                    description: '',
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    itemType: 'collection',
                    connectionId: connectionId,
                    collectionName: cls.class,
                    iconPath: new vscode.ThemeIcon('database'),
                    contextValue: 'weaviateCollection',
                    tooltip: cls.description,
                    schema: cls
                } as CollectionWithSchema));
            } else {
                this.collections[connectionId] = [];
            }
            
            this.refresh();
            
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error in fetchCollections:', error);
            vscode.window.showErrorMessage(`Failed to fetch collections: ${errorMessage}`);
        }
    }

    /**
     * Opens a query editor for the specified collection
     * @param connectionId - The ID of the connection
     * @param collectionName - The name of the collection to query
     */
    async openQueryEditor(connectionId: string, collectionName: string): Promise<void> {
        try {
            // Use the registered command that's already wired up in extension.ts
            // This will open a new tab if this collection isn't already open
            await vscode.commands.executeCommand(
                'weaviate.queryCollection', 
                connectionId, 
                collectionName
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open query editor: ${errorMessage}`);
        }
    }

    /**
     * Deletes a connection without showing any confirmation dialogs.
     * Callers are responsible for showing confirmation dialogs if needed.
     * @param connectionId The ID of the connection to delete
     * @returns The name of the deleted connection
     * @throws Error if the connection doesn't exist or deletion fails
     */
    async deleteConnection(connectionId: string): Promise<string> {
        const connection = this.connections.find((c: WeaviateConnection) => c.id === connectionId);
        if (!connection) {
            throw new Error('Connection not found');
        }
        
        try {
            await this.connectionManager.deleteConnection(connectionId);
            
            // Clean up related data
            delete this.collections[connectionId];
            
            // Update empty state context
            await vscode.commands.executeCommand('setContext', 'weaviateConnectionsEmpty', this.connections.length === 0);
            
            this._onDidChangeTreeData.fire(undefined);
            return connection.name;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete connection: ${errorMessage}`);
        }
    }
}
