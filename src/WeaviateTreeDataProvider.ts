import * as vscode from 'vscode';
import * as weaviate from 'weaviate-ts-client';
import { ConnectionManager, WeaviateConnection } from './services/ConnectionManager';

/**
 * Represents a property in a Weaviate schema
 */
interface SchemaProperty {
    name: string;
    dataType: string[];
    description?: string;
    indexInverted?: boolean;
    moduleConfig?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Represents a class/collection in a Weaviate schema
 */
interface SchemaClass {
    class: string;
    description?: string;
    properties?: SchemaProperty[];
    vectorizer?: string;
    moduleConfig?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Extends WeaviateTreeItem to include schema information
 */
interface CollectionWithSchema extends WeaviateTreeItem {
    schema?: SchemaClass;
}

/**
 * Maps connection IDs to their respective collections
 */
interface CollectionsMap {
    [connectionId: string]: CollectionWithSchema[];
}

/**
 * Configuration for a Weaviate connection
 */
interface ConnectionConfig extends WeaviateConnection {
    /** Last time this connection was used */
    lastUsed?: number;
}

/**
 * Represents an item in the Weaviate Explorer tree view.
 * Extends vscode.TreeItem to include Weaviate-specific properties.
 */
export class WeaviateTreeItem extends vscode.TreeItem {
    /**
     * Creates a new instance of WeaviateTreeItem
     * @param label - The display label for the tree item
     * @param collapsibleState - The collapsible state of the tree item
     * @param itemType - The type of the tree item (connection, collection, metadata, etc.)
     * @param connectionId - Optional ID of the Weaviate connection this item belongs to
     * @param collectionName - Optional name of the collection this item belongs to
     * @param itemId - Optional ID for properties/vectors to identify the parent
     * @param iconPath - Optional icon for the tree item
     * @param contextValue - Optional context value used for conditional visibility/commands
     * @param description - Optional description text shown next to the label
     */
    constructor(
        public readonly label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'collection' | 'metadata' | 'properties' | 'vectors' | 'property' | 'message' | 'object',
        public readonly connectionId?: string,
        public readonly collectionName?: string,
        public readonly itemId?: string,
        iconPath?: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon,
        contextValue?: string,
        description?: string
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
    // Filter text for the search box
    private filterText: string = '';

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
     * Sets the filter text and refreshes the tree view
     * @param text - The text to filter tree items by
     * 
     * @remarks
     * This method updates the filter text used to filter the tree view items
     * and triggers a refresh of the tree view to apply the filter.
     */
    setFilterText(text: string): void {
        this.filterText = text;
        this._onDidChangeTreeData.fire();
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
        if (element.itemType === 'metadata' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('info');
            element.tooltip = 'View collection metadata';
        } else if (element.itemType === 'properties' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('symbol-property');
            element.tooltip = 'View collection properties';
        } else if (element.itemType === 'vectors' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('symbol-array');
            element.tooltip = 'View vector configuration';
        } else if (element.itemType === 'property' && !element.iconPath) {
            // Set different icons based on property type
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
            
            return Promise.resolve(applyFilter(connectionItems));
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
            
            return Promise.resolve(applyFilter(collections));
        }
        else if (element.itemType === 'collection') {
            // Collection level - show metadata, properties, and vectors
            const items = [
                new WeaviateTreeItem(
                    'Metadata',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'metadata',
                    element.connectionId,
                    element.label,
                    'metadata',
                    new vscode.ThemeIcon('info')
                ),
                new WeaviateTreeItem(
                    'Properties',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'properties',
                    element.connectionId,
                    element.label,
                    'properties',
                    new vscode.ThemeIcon('symbol-property')
                ),
                new WeaviateTreeItem(
                    'Vectors',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'vectors',
                    element.connectionId,
                    element.label,
                    'vectors',
                    new vscode.ThemeIcon('symbol-array')
                )
            ];
            
            return Promise.resolve(applyFilter(items));
        }
        // Handle child nodes for metadata, properties, and vectors
        else if (element.itemType === 'metadata' && element.connectionId && element.collectionName) {
            // Find the collection schema
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
            if (!collection) {
                return Promise.resolve([
                    new WeaviateTreeItem('No metadata available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const schema = (collection as any).schema;
            if (!schema) {
                return Promise.resolve([
                    new WeaviateTreeItem('No schema data available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const metadataItems = [
                new WeaviateTreeItem(`Class: ${schema.class}`, vscode.TreeItemCollapsibleState.None, 'property', element.connectionId, element.collectionName, 'class'),
                new WeaviateTreeItem(`Vectorizer: ${schema.vectorizer || 'none'}`, vscode.TreeItemCollapsibleState.None, 'property', element.connectionId, element.collectionName, 'vectorizer'),
                new WeaviateTreeItem(`Vector Index Type: ${schema.vectorIndexType || 'hnsw'}`, vscode.TreeItemCollapsibleState.None, 'property', element.connectionId, element.collectionName, 'indexType')
            ];
            
            if (schema.moduleConfig) {
                Object.entries(schema.moduleConfig).forEach(([moduleName, config]) => {
                    metadataItems.push(
                        new WeaviateTreeItem(
                            `Module: ${moduleName}`,
                            vscode.TreeItemCollapsibleState.None,
                            'property',
                            element.connectionId,
                            element.collectionName,
                            `module-${moduleName}`,
                            new vscode.ThemeIcon('extensions')
                        )
                    );
                });
            }
            
            return Promise.resolve(metadataItems);
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
                const icon = getPropertyIcon(prop.dataType);
                const description = prop.description ? ` - ${prop.description}` : '';
                
                return new WeaviateTreeItem(
                    `${prop.name} (${dataType})${description}`,
                    vscode.TreeItemCollapsibleState.None,
                    'property',
                    element.connectionId,
                    element.collectionName,
                    prop.name,
                    icon
                );
            });
            
            return Promise.resolve(propertyItems);
        }
        else if (element.itemType === 'vectors' && element.connectionId && element.collectionName) {
            // Find the collection schema
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
            if (!collection) {
                return Promise.resolve([
                    new WeaviateTreeItem('No vector configuration available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const schema = (collection as any).schema;
            if (!schema) {
                return Promise.resolve([
                    new WeaviateTreeItem('No vector configuration available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const vectorItems = [];
            
            // Add vector index configuration
            if (schema.vectorIndexConfig) {
                vectorItems.push(
                    new WeaviateTreeItem(
                        `Distance: ${schema.vectorIndexConfig.distance || 'cosine'}`,
                        vscode.TreeItemCollapsibleState.None,
                        'property',
                        element.connectionId,
                        element.collectionName,
                        'vector-distance',
                        new vscode.ThemeIcon('ruler')
                    )
                );
                
                if (schema.vectorIndexConfig.efConstruction) {
                    vectorItems.push(
                        new WeaviateTreeItem(
                            `EF Construction: ${schema.vectorIndexConfig.efConstruction}`,
                            vscode.TreeItemCollapsibleState.None,
                            'property',
                            element.connectionId,
                            element.collectionName,
                            'vector-ef-construction',
                            new vscode.ThemeIcon('settings')
                        )
                    );
                }
                
                if (schema.vectorIndexConfig.ef) {
                    vectorItems.push(
                        new WeaviateTreeItem(
                            `EF: ${schema.vectorIndexConfig.ef}`,
                            vscode.TreeItemCollapsibleState.None,
                            'property',
                            element.connectionId,
                            element.collectionName,
                            'vector-ef',
                            new vscode.ThemeIcon('settings')
                        )
                    );
                }
                
                if (schema.vectorIndexConfig.maxConnections) {
                    vectorItems.push(
                        new WeaviateTreeItem(
                            `Max Connections: ${schema.vectorIndexConfig.maxConnections}`,
                            vscode.TreeItemCollapsibleState.None,
                            'property',
                            element.connectionId,
                            element.collectionName,
                            'vector-max-connections',
                            new vscode.ThemeIcon('link')
                        )
                    );
                }
            }
            
            // Add vectorizer information if available
            if (schema.vectorizer) {
                vectorItems.push(
                    new WeaviateTreeItem(
                        `Vectorizer: ${schema.vectorizer}`,
                        vscode.TreeItemCollapsibleState.None,
                        'property',
                        element.connectionId,
                        element.collectionName,
                        'vectorizer',
                        new vscode.ThemeIcon('symbol-function')
                    )
                );
            }
            
            // Add vector index type
            if (schema.vectorIndexType) {
                vectorItems.push(
                    new WeaviateTreeItem(
                        `Index Type: ${schema.vectorIndexType}`,
                        vscode.TreeItemCollapsibleState.None,
                        'property',
                        element.connectionId,
                        element.collectionName,
                        'vector-index-type',
                        new vscode.ThemeIcon('list-tree')
                    )
                );
            }
            
            return Promise.resolve(vectorItems.length > 0 ? vectorItems : [
                new WeaviateTreeItem('No vector configuration available', vscode.TreeItemCollapsibleState.None, 'message')
            ]);
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

    // --- Connection Management Methods ---
    
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
            const schema = await client.schema.getter().do() as { classes?: SchemaClass[] };
            this.collections[connectionId] = (schema.classes || []).map((cls: SchemaClass) => {
                // Store the full schema with the collection for later use
                const collectionItem = new WeaviateTreeItem(
                    cls.class,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'collection',
                    connectionId,
                    cls.class, // collectionName
                    undefined, // itemId
                    new vscode.ThemeIcon('database'),
                    'weaviateCollection',
                    cls.description
                ) as CollectionWithSchema;
                
                // Store the raw schema data for this collection
                collectionItem.schema = cls;
                
                return collectionItem;
            });
            
            this.refresh();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to fetch collections: ${errorMessage}`);
        }
    }

    // View schema for a collection
    async viewSchema(connectionId: string, collectionName: string): Promise<void> {
        const client = this.connectionManager.getClient(connectionId);
        if (!client) {
            vscode.window.showErrorMessage('Not connected to Weaviate instance');
            return;
        }

        try {
            // First try to get the schema from our cached collection
            const collection = this.collections[connectionId]?.find(
                (item: WeaviateTreeItem) => item.label === collectionName
            ) as CollectionWithSchema | undefined;
            
            let schemaData: SchemaClass;
            
            if (collection?.schema) {
                // Use cached schema if available
                schemaData = collection.schema;
            } else {
                // Fall back to fetching from the server
                const schema = await client.schema.getter(collectionName).do() as SchemaClass;
                schemaData = schema;
                
                // Cache the schema for future use
                if (collection) {
                    collection.schema = schemaData;
                }
            }
            
            // Create a webview panel to display the schema
            const panel = vscode.window.createWebviewPanel(
                'weaviateSchemaViewer',
                `Schema: ${collectionName}`,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            
            // Format the schema for display
            const formattedSchema = JSON.stringify(schemaData, null, 2);
            
            // Create HTML content with syntax highlighting
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Schema: ${collectionName}</title>
                    <style>
                        body {
                            font-family: var(--vscode-font-family);
                            padding: 0 20px;
                            color: var(--vscode-foreground);
                            background-color: var(--vscode-editor-background);
                            margin: 0;
                            line-height: 1.5;
                        }
                        pre {
                            background-color: var(--vscode-textCodeBlock-background);
                            border-radius: 3px;
                            padding: 16px;
                            overflow: auto;
                            max-height: calc(100vh - 60px);
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 16px;
                            padding-bottom: 8px;
                            border-bottom: 1px solid var(--vscode-panel-border);
                        }
                        .title {
                            font-size: 1.2em;
                            font-weight: 600;
                        }
                        .actions {
                            display: flex;
                            gap: 8px;
                        }
                        button {
                            background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 4px 12px;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 12px;
                        }
                        button:hover {
                            background-color: var(--vscode-button-hoverBackground);
                        }
                        .copy-message {
                            color: var(--vscode-foreground);
                            font-size: 12px;
                            opacity: 0;
                            transition: opacity 0.3s;
                        }
                        .visible {
                            opacity: 1;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">Schema: ${collectionName}</div>
                        <div class="actions">
                            <button id="copyButton">Copy to Clipboard</button>
                            <span id="copyMessage" class="copy-message">Copied!</span>
                        </div>
                    </div>
                    <pre><code id="json">${formattedSchema}</code></pre>
                    
                    <script>
                        // Apply syntax highlighting
                        document.addEventListener('DOMContentLoaded', () => {
                            const jsonElement = document.getElementById('json');
                            const jsonString = jsonElement.textContent;
                            try {
                                const json = JSON.parse(jsonString);
                                jsonElement.textContent = JSON.stringify(json, null, 2);
                                
                                // Basic syntax highlighting
                                let highlighted = jsonElement.textContent
                                    .replace(/"([^"]+)":/g, '"<span style="color: #9CDCFE;">$1</span>":')
                                    .replace(/: "([^"]+)"/g, ': "<span style="color: #CE9178;">$1</span>"')
                                    .replace(/: (true|false|null|\d+)/g, ': <span style="color: #569CD6;">$1</span>');
                                
                                jsonElement.innerHTML = highlighted;
                                
                                // Copy to clipboard functionality
                                const copyButton = document.getElementById('copyButton');
                                const copyMessage = document.getElementById('copyMessage');
                                
                                copyButton.addEventListener('click', () => {
                                    navigator.clipboard.writeText(jsonString)
                                        .then(() => {
                                            copyMessage.classList.add('visible');
                                            setTimeout(() => {
                                                copyMessage.classList.remove('visible');
                                            }, 2000);
                                        })
                                        .catch(err => {
                                            console.error('Failed to copy: ', err);
                                        });
                                });
                            } catch (e) {
                                console.error('Error parsing JSON:', e);
                            }
                        });
                    </script>
                </body>
                </html>
            `;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to fetch schema: ${errorMessage}`);
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
