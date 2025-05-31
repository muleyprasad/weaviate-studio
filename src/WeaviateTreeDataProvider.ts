import * as vscode from 'vscode';
import * as weaviate from 'weaviate-ts-client';
import { ConnectionManager, WeaviateConnection } from './services/ConnectionManager';

// Extended schema interfaces to include vector-related fields
interface ExtendedSchemaProperty extends SchemaProperty {
    vectorizer?: string;
    vectorizerConfig?: {
        vectorizer?: {
            vectorizePropertyName?: boolean;
            [key: string]: any;
        };
        [key: string]: any;
    };
    vectorDimensions?: number;
    moduleConfig?: {
        vectorizer?: {
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

interface ExtendedSchemaClass extends SchemaClass {
    properties?: ExtendedSchemaProperty[];
    [key: string]: any;
}

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
        
        // Set context value based on itemType if not explicitly provided
        if (contextValue) {
            this.contextValue = contextValue;
        } else {
            switch (itemType) {
                case 'connection':
                    this.contextValue = 'weaviateConnection';
                    break;
                case 'collection':
                    this.contextValue = 'weaviateCollection';
                    break;
                case 'property':
                    this.contextValue = 'weaviateProperty';
                    break;
                default:
                    this.contextValue = itemType;
            }
        }
        
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

    // #region Command Handlers
    


    /**
     * Shows detailed information about a property in a webview
     * @param item - The tree item representing the property
     */
    public async handleViewPropertyDetails(item: WeaviateTreeItem): Promise<void> {
        if (!item.connectionId || !item.collectionName || !item.label) {
            vscode.window.showErrorMessage('Cannot view property details: Missing required information');   
            return;
        }

        try {
            // Get the collection schema
            const collection = this.collections[item.connectionId]?.find(
                col => col.label === item.collectionName
            ) as CollectionWithSchema | undefined;

            if (!collection?.schema?.properties) {
                vscode.window.showErrorMessage('Could not find property details');
                return;
            }

            // Extract just the property name (remove type information in parentheses)
            const propertyName = item.label.toString().split('(')[0].trim();
            const property = collection.schema.properties.find(p => p.name === propertyName);

            if (!property) {
                vscode.window.showErrorMessage(`Property '${propertyName}' not found in schema`);
                return;
            }

            // Create and show a webview with the property details
            const panel = vscode.window.createWebviewPanel(
                'weaviatePropertyDetails',
                `Property: ${propertyName}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            // Format the property details as HTML
            panel.webview.html = this.getPropertyDetailsHtml(propertyName, property, item.collectionName);

        } catch (error) {
            console.error('Error viewing property details:', error);
            vscode.window.showErrorMessage(
                `Failed to view property details: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

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
     * Generates HTML for displaying property details in a webview
     */
    private getPropertyDetailsHtml(propertyName: string, property: SchemaProperty, collectionName: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Property: ${propertyName}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    h1 {
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                    }
                    .property-header {
                        background-color: var(--vscode-editor-lineHighlightBackground);
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                    }
                    .property-section {
                        margin-bottom: 20px;
                    }
                    .property-section h3 {
                        margin-bottom: 8px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .property-grid {
                        display: grid;
                        grid-template-columns: 150px 1fr;
                        gap: 10px;
                    }
                    .property-grid dt {
                        font-weight: bold;
                        color: var(--vscode-textPreformat-foreground);
                    }
                    .property-grid dd {
                        margin: 0;
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                    }
                </style>
            </head>
            <body>
                <h1>${propertyName}</h1>
                <div class="property-header">
                    <strong>Collection:</strong> ${collectionName} <br>
                    <strong>Type:</strong> ${property.dataType?.join(', ') || 'Unknown'}
                </div>

                <div class="property-section">
                    <h3>Details</h3>
                    <div class="property-grid">
                        <div><strong>Name:</strong></div>
                        <div>${property.name}</div>
                        
                        <div><strong>Data Type:</strong></div>
                        <div>${property.dataType?.join(', ') || 'Unknown'}</div>
                        
                        ${property.description ? `
                            <div><strong>Description:</strong></div>
                            <div>${property.description}</div>
                        ` : ''}
                        
                        <div><strong>Indexed:</strong></div>
                        <div>${property.indexInverted !== false ? 'Yes' : 'No'}</div>
                    </div>
                </div>

                ${property.moduleConfig ? `
                    <div class="property-section">
                        <h3>Module Configuration</h3>
                        <pre><code>${JSON.stringify(property.moduleConfig, null, 2)}</code></pre>
                    </div>
                ` : ''}

                <div class="property-section">
                    <h3>Raw Property Definition</h3>
                    <pre><code>${JSON.stringify(property, null, 2)}</code></pre>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generates HTML for displaying detailed schema in a webview
     */
    private getDetailedSchemaHtml(schema: SchemaClass): string {
        const formatDataType = (dataType: string[]): string => {
            return dataType.map(t => {
                // Make data types more readable
                switch (t) {
                    case 'text': return 'Text';
                    case 'string': return 'String';
                    case 'int': return 'Integer';
                    case 'number': return 'Number';
                    case 'boolean': return 'Boolean';
                    case 'date': return 'Date';
                    case 'geoCoordinates': return 'Geo Coordinates';
                    case 'phoneNumber': return 'Phone Number';
                    case 'blob': return 'Binary Data';
                    case 'object': return 'Object';
                    case 'object[]': return 'Object Array';
                    default: return t;
                }
            }).join(', ');
        };

        const propertiesHtml = schema.properties?.map(prop => `
            <div class="property-card">
                <h3>${prop.name} <span class="data-type">${formatDataType(prop.dataType || ['unknown'])}</span></h3>
                ${prop.description ? `<p class="description">${prop.description}</p>` : ''}
                <div class="property-details">
                    <div><strong>Indexed:</strong> ${prop.indexInverted !== false ? 'Yes' : 'No'}</div>
                    ${prop.moduleConfig ? `
                        <div class="module-config">
                            <strong>Module Config:</strong>
                            <pre><code>${JSON.stringify(prop.moduleConfig, null, 2)}</code></pre>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('') || '<p>No properties defined</p>';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Schema: ${schema.class}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0 20px 40px 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        line-height: 1.5;
                    }
                    h1 {
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                    }
                    h2 {
                        margin-top: 30px;
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 5px;
                    }
                    h3 {
                        margin: 0 0 10px 0;
                        color: var(--vscode-textLink-foreground);
                    }
                    .property-card {
                        background-color: var(--vscode-editor-lineHighlightBackground);
                        border-left: 3px solid var(--vscode-textLink-foreground);
                        padding: 15px;
                        margin-bottom: 15px;
                        border-radius: 4px;
                    }
                    .data-type {
                        font-size: 0.8em;
                        color: var(--vscode-descriptionForeground);
                        font-weight: normal;
                        font-family: var(--vscode-editor-font-family);
                        background-color: var(--vscode-textBlockQuote-background);
                        padding: 2px 6px;
                        border-radius: 4px;
                        margin-left: 8px;
                    }
                    .description {
                        color: var(--vscode-descriptionForeground);
                        margin: 8px 0 12px 0;
                        font-style: italic;
                    }
                    .property-details {
                        font-size: 0.9em;
                    }
                    .module-config {
                        margin-top: 10px;
                    }
                    pre, code {
                        font-family: var(--vscode-editor-font-family);
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                        margin: 5px 0 0 0;
                        font-size: 0.9em;
                    }
                    .metadata {
                        display: grid;
                        grid-template-columns: 150px 1fr;
                        gap: 10px;
                        margin-bottom: 20px;
                        background-color: var(--vscode-editor-lineHighlightBackground);
                        padding: 15px;
                        border-radius: 4px;
                    }
                    .metadata dt {
                        font-weight: bold;
                        color: var(--vscode-textPreformat-foreground);
                    }
                    .metadata dd {
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                <h1>${schema.class}</h1>
                
                <div class="metadata">
                    <div><strong>Class Name:</strong></div>
                    <div>${schema.class}</div>
                    
                    ${schema.description ? `
                        <div><strong>Description:</strong></div>
                        <div>${schema.description}</div>
                    ` : ''}
                    
                    ${schema.vectorizer ? `
                        <div><strong>Vectorizer:</strong></div>
                        <div>${schema.vectorizer}</div>
                    ` : ''}
                </div>

                <h2>Properties</h2>
                ${propertiesHtml}

                ${schema.moduleConfig ? `
                    <h2>Module Configuration</h2>
                    <pre><code>${JSON.stringify(schema.moduleConfig, null, 2)}</code></pre>
                ` : ''}

                <h2>Raw Schema</h2>
                <pre><code>${JSON.stringify(schema, null, 2)}</code></pre>
            </body>
            </html>
        `;
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
                    icon,
                    'weaviateProperty',  // contextValue for menu contributions
                    description.trim()
                );
            });
            
            return Promise.resolve(propertyItems);
        }
        else if (element.itemType === 'vectors' && element.connectionId && element.collectionName) {
            // Find the collection schema
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            ) as CollectionWithSchema | undefined;
            
            if (!collection) {
                console.error('Collection not found:', element.collectionName);
                return Promise.resolve([
                    new WeaviateTreeItem('No vector information available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const schema = collection.schema;
            if (!schema) {
                console.error('Schema not found for collection:', element.collectionName);
                return Promise.resolve([
                    new WeaviateTreeItem('No schema information available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            // Debug: Log vector-related information
            console.log(`Vector info for ${schema.class}:`, {
                vectorizer: schema.vectorizer,
                vectorIndexType: schema.vectorIndexType,
                vectorConfig: schema.vectorConfig,
                properties: schema.properties?.map(p => ({
                    name: p.name,
                    dataType: p.dataType
                }))
            });
            
            const vectorItems: WeaviateTreeItem[] = [];
            
            // Add vector index type
            if (schema.vectorIndexType) {
                vectorItems.push(
                    new WeaviateTreeItem(
                        `Vector Index Type: ${schema.vectorIndexType}`,
                        vscode.TreeItemCollapsibleState.None,
                        'property',
                        element.connectionId,
                        element.collectionName,
                        'vector-index-type',
                        new vscode.ThemeIcon('symbol-enum')
                    )
                );
            }
            
            // Add vector index config
            if (schema.vectorIndexConfig) {
                vectorItems.push(
                    new WeaviateTreeItem(
                        'Vector Index Configuration',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'property',
                        element.connectionId,
                        element.collectionName,
                        'vector-index-config',
                        new vscode.ThemeIcon('settings-gear')
                    )
                );
            }
            
            // Add vectorizer information if present directly on schema
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
            
            // Check for vectorized properties through various possible configurations
            let vectorizedPropertyNames: string[] = [];
            
            // Check in vectorConfig (most common pattern)
            if (schema.vectorConfig) {
                console.log('Found vectorConfig:', JSON.stringify(schema.vectorConfig, null, 2));
                
                // Helper function to recursively find properties in nested objects
                const findVectorizedProperties = (obj: any, path: string = '') => {
                    if (!obj || typeof obj !== 'object') {
                        return;
                    }
                    
                    // Check if this object has a properties array directly
                    if (obj.properties && Array.isArray(obj.properties)) {
                        console.log(`Found vectorized properties at ${path}:`, obj.properties);
                        vectorizedPropertyNames = [...vectorizedPropertyNames, ...obj.properties];
                    }
                    
                    // Recurse through all child objects
                    Object.entries(obj).forEach(([key, value]) => {
                        if (value && typeof value === 'object') {
                            findVectorizedProperties(value, `${path}.${key}`);
                        }
                    });
                };
                
                // Iterate through all possible vectorizer modules
                Object.entries(schema.vectorConfig).forEach(([key, config]: [string, any]) => {
                    console.log(`Checking vectorizer module: ${key}`);
                    findVectorizedProperties(config, key);
                });
                
                // Provide a detailed log of what was found
                console.log('After scanning vectorConfig, found these vectorized properties:', vectorizedPropertyNames);
            }
            
            // Also check for vectorIndexType config that might indicate vector capabilities
            if (schema.vectorIndexType) {
                console.log(`Found vectorIndexType: ${schema.vectorIndexType}`);
            }
            
            // Log what properties we found
            console.log('Vectorized property names found:', vectorizedPropertyNames);
            
            // Find the corresponding property objects
            const vectorizedProps = schema.properties?.filter((p: any) => {
                // Check for direct vectorization flags on the property
                const isDirectlyVectorized = 
                    p.vectorizer || 
                    (p.moduleConfig && p.moduleConfig.vectorizer) ||
                    p.vectorizerConfig ||
                    p.vector ||
                    // Check for common vectorizer modules in the property config
                    (p.moduleConfig && (
                        p.moduleConfig['text2vec-openai'] ||
                        p.moduleConfig['text2vec-cohere'] ||
                        p.moduleConfig['text2vec-huggingface'] ||
                        p.moduleConfig['text2vec-transformers'] ||
                        p.moduleConfig['text2vec-contextionary'] ||
                        p.moduleConfig['multi2vec-clip'] ||
                        p.moduleConfig['img2vec-neural'] ||
                        p.moduleConfig['text2vec-weaviate']
                    ));
                
                // Check if this property is in the explicitly listed vectorized properties
                // ONLY use this if vectorizedPropertyNames actually has values
                const isListedAsVectorized = vectorizedPropertyNames.length > 0 && 
                    vectorizedPropertyNames.includes(p.name);
                
                if (isDirectlyVectorized || isListedAsVectorized) {
                    console.log('Found vectorized property:', p.name, p);
                }
                
                // If we have explicit vectorized properties from vectorConfig,
                // ONLY use those, otherwise fall back to property-level detection
                return vectorizedPropertyNames.length > 0 ? isListedAsVectorized : isDirectlyVectorized;
            }) || [];
            
            console.log(`Found ${vectorizedProps.length} vectorized properties`);
            
            // Add vectorized properties section if any were found
            if (vectorizedProps.length > 0) {
                vectorItems.push(
                    new WeaviateTreeItem(
                        `Vectorized Properties (${vectorizedProps.length})`,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'vectors', // Changed from 'property' to 'vectors' to match the case in the getChildren method
                        element.connectionId,
                        element.collectionName,
                        'vectorized-properties',
                        new vscode.ThemeIcon('symbol-array')
                    )
                );
                console.log('Created vectorized properties container node with type: vectors');
            } else {
                vectorItems.push(
                    new WeaviateTreeItem(
                        'No vectorized properties found',
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                );
            }
            
            return Promise.resolve(vectorItems);
        }
        // Handle expanded vectorized properties section
        else if (element.id === 'vectorized-properties' && element.connectionId && element.collectionName) {
            console.log('Expanding vectorized properties node:', element);
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            ) as CollectionWithSchema | undefined;
            
            if (!collection?.schema?.properties) {
                return Promise.resolve([
                    new WeaviateTreeItem('No properties available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            // Extract vectorized property names from vectorConfig
            let vectorizedPropertyNames: string[] = [];
            
            // Get property names from vectorConfig if available
            if (collection.schema.vectorConfig) {
                console.log('Found vectorConfig in expanded view:', JSON.stringify(collection.schema.vectorConfig, null, 2));
                
                // Helper function to recursively find properties in nested objects
                const findVectorizedProperties = (obj: any, path: string = '') => {
                    if (!obj || typeof obj !== 'object') {
                        return;
                    }
                    
                    // Check if this object has a properties array directly
                    if (obj.properties && Array.isArray(obj.properties)) {
                        console.log(`Found vectorized properties at ${path}:`, obj.properties);
                        vectorizedPropertyNames = [...vectorizedPropertyNames, ...obj.properties];
                    }
                    
                    // Recurse through all child objects
                    Object.entries(obj).forEach(([key, value]) => {
                        if (value && typeof value === 'object') {
                            findVectorizedProperties(value, `${path}.${key}`);
                        }
                    });
                };
                
                // Process all vectorizer modules
                Object.entries(collection.schema.vectorConfig).forEach(([key, config]: [string, any]) => {
                    findVectorizedProperties(config, key);
                });
            }
            
            // Use the enhanced detection logic to find all vectorized properties
            let vectorizedProps = collection.schema.properties.filter((p: any) => {
                // Check for direct vectorization flags on the property
                const isDirectlyVectorized = 
                    p.vectorizer || 
                    (p.moduleConfig && p.moduleConfig.vectorizer) ||
                    p.vectorizerConfig ||
                    p.vector ||
                    // Check for common vectorizer modules in the property config
                    (p.moduleConfig && (
                        p.moduleConfig['text2vec-openai'] ||
                        p.moduleConfig['text2vec-cohere'] ||
                        p.moduleConfig['text2vec-huggingface'] ||
                        p.moduleConfig['text2vec-transformers'] ||
                        p.moduleConfig['text2vec-contextionary'] ||
                        p.moduleConfig['multi2vec-clip'] ||
                        p.moduleConfig['img2vec-neural'] ||
                        p.moduleConfig['text2vec-weaviate']
                    ));
                
                // Check if this property is in the explicitly listed vectorized properties
                const isListedAsVectorized = vectorizedPropertyNames.length > 0 && 
                    vectorizedPropertyNames.includes(p.name);
                
                // If we have explicit vectorized properties from vectorConfig,
                // ONLY use those, otherwise fall back to property-level detection
                return vectorizedPropertyNames.length > 0 ? isListedAsVectorized : isDirectlyVectorized;
            });
            
            console.log(`Found ${vectorizedProps.length} vectorized properties for expansion:`, vectorizedProps.map(p => p.name));
            
            // If there are no vectorized properties, show a message
            if (vectorizedProps.length === 0) {
                return Promise.resolve([
                    new WeaviateTreeItem('No vectorized properties found', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            // Force explicit debug of actual property names
            console.log('The actual property objects for expansion:', JSON.stringify(vectorizedProps));
            
            // Directly get property data from schema if filtering produced no results
            // This fallback ensures at least something is shown
            if (vectorizedProps.length === 0 && vectorizedPropertyNames.length > 0) {
                console.log('Using fallback property detection with names:', vectorizedPropertyNames);
                vectorizedProps = collection.schema.properties.filter(p => 
                    vectorizedPropertyNames.includes(p.name));
                console.log('Fallback found properties:', vectorizedProps.map(p => p.name));
            }
            
            // Special hardcoded fallback to handle common case where the property is directly vectorized
            // but our detection logic is missing it for some reason
            if (vectorizedProps.length === 0) {
                console.log('Using special fallback property detection...');
                // Look for topicName property which is commonly vectorized
                const topicNameProp = collection.schema.properties.find(p => p.name === 'topicName');
                if (topicNameProp) {
                    console.log('Found topicName property as potential vectorized property');
                    vectorizedProps = [topicNameProp];
                }
            }
            
            const treeItems = vectorizedProps.map((prop: any) => {
                // Determine what type of vectorization is being used for this property
                let vectorizer = 'unknown';
                
                if (prop.vectorizer) {
                    vectorizer = `Direct: ${prop.vectorizer}`;
                } else if (prop.moduleConfig?.vectorizer) {
                    vectorizer = `Module: ${JSON.stringify(prop.moduleConfig.vectorizer)}`;
                } else if (prop.vectorizerConfig) {
                    vectorizer = `Config: ${JSON.stringify(prop.vectorizerConfig)}`;
                } else if (prop.vector) {
                    vectorizer = 'Vector: Custom configuration';
                } else if (prop.moduleConfig) {
                    // Check for specific vectorizer modules
                    const modules = Object.keys(prop.moduleConfig).filter(key => {
                        return key.includes('vec') || [
                            'text2vec-openai',
                            'text2vec-cohere',
                            'text2vec-huggingface',
                            'text2vec-transformers',
                            'text2vec-contextionary',
                            'multi2vec-clip',
                            'img2vec-neural',
                            'text2vec-weaviate'
                        ].includes(key);
                    });
                    
                    if (modules.length > 0) {
                        vectorizer = `Modules: ${modules.join(', ')}`;
                    }
                } else if (vectorizedPropertyNames.includes(prop.name)) {
                    vectorizer = 'Defined in vectorConfig';
                }
                
                console.log(`Creating tree item for vectorized property: ${prop.name} with vectorizer: ${vectorizer}`);
                
                return new WeaviateTreeItem(
                    `${prop.name} (${prop.dataType?.join(', ') || 'unknown'})`,
                    vscode.TreeItemCollapsibleState.None,
                    'property',
                    element.connectionId,
                    element.collectionName,
                    `vector-prop-${prop.name}`,
                    new vscode.ThemeIcon('symbol-parameter'),
                    'weaviateVectorProperty',
                    `Vectorizer: ${vectorizer}`
                );
            });
            
            console.log(`Returning ${treeItems.length} vectorized property tree items`);
            return Promise.resolve(treeItems);
        }
        // Handle expanded vector index configuration
        else if (element.itemType === 'property' && element.id === 'vector-index-config' && element.connectionId && element.collectionName) {
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            ) as CollectionWithSchema | undefined;
            
            if (!collection?.schema?.vectorIndexConfig) {
                return Promise.resolve([
                    new WeaviateTreeItem('No vector index configuration available', vscode.TreeItemCollapsibleState.None, 'message')
                ]);
            }
            
            const config = collection.schema.vectorIndexConfig;
            const configItems = Object.entries(config).map(([key, value]) => 
                new WeaviateTreeItem(
                    `${key}: ${JSON.stringify(value)}`,
                    vscode.TreeItemCollapsibleState.None,
                    'property',
                    element.connectionId,
                    element.collectionName,
                    `vector-config-${key}`,
                    new vscode.ThemeIcon('settings')
                )
            );
            
            return Promise.resolve(configItems);
        }
        
        // Vector properties are already handled in the previous section
        // No additional processing needed here
        
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
            
            // Debug: Log the full schema
            console.log('Full schema from Weaviate:', JSON.stringify(schema, null, 2));
            
            // Store collections with their schema
            if (schema.classes && Array.isArray(schema.classes)) {
                this.collections[connectionId] = schema.classes.map((cls: ExtendedSchemaClass) => {
                    // Debug: Log each class schema
                    console.log(`Class ${cls.class} schema:`, JSON.stringify(cls, null, 2));
                    
                    // Debug: Log vector-related properties
                    if (cls.properties) {
                        const vectorProps = cls.properties.filter((p: ExtendedSchemaProperty) => 
                            p.vectorizer || 
                            (p.moduleConfig && p.moduleConfig.vectorizer) ||
                            p.vectorizerConfig
                        );
                        if (vectorProps.length > 0) {
                            console.log(`Found ${vectorProps.length} vectorized properties in ${cls.class}:`, 
                                vectorProps.map((p: ExtendedSchemaProperty) => ({
                                    name: p.name,
                                    dataType: p.dataType,
                                    vectorizer: p.vectorizer,
                                    moduleConfig: p.moduleConfig,
                                    vectorizerConfig: p.vectorizerConfig
                                }))
                            );
                        }
                    }
                    
                    return {
                        ...new WeaviateTreeItem(
                            cls.class,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            'collection',
                            connectionId,
                            cls.class,
                            undefined,
                            new vscode.ThemeIcon('database'),
                            'weaviateCollection',
                            cls.description
                        ),
                        schema: cls
                    };
                });
            } else {
                this.collections[connectionId] = [];
            }
            
            this.refresh();
            
            // Show a message if we found vectorized properties
            if (schema.classes) {
                const allVectorProps = schema.classes.flatMap((cls: ExtendedSchemaClass) => 
                    (cls.properties || []).filter((p: ExtendedSchemaProperty) => 
                        p.vectorizer || 
                        (p.moduleConfig && p.moduleConfig.vectorizer) ||
                        p.vectorizerConfig
                    )
                );
                
                if (allVectorProps.length > 0) {
                    console.log(`Found ${allVectorProps.length} vectorized properties across all classes`);
                } else {
                    console.log('No vectorized properties found in any class');
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error in fetchCollections:', error);
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
