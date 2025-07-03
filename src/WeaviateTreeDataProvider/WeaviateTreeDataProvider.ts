import * as vscode from 'vscode';
import { ConnectionManager, WeaviateConnection } from '../services/ConnectionManager';
import { WeaviateTreeItem, ConnectionConfig, CollectionsMap, CollectionWithSchema, ExtendedSchemaClass, SchemaClass } from '../types';
import { ViewRenderer } from '../views/ViewRenderer';

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
     * Shows a raw collection configuration view in a webview
     * @param item - The tree item representing the collection
     */
    public async handleViewRawConfig(item: WeaviateTreeItem): Promise<void> {
        if (!item.connectionId || !item.label) {
            vscode.window.showErrorMessage('Cannot view raw config: Missing connection or collection name');
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

            // Create and show a webview with the raw configuration
            const panel = vscode.window.createWebviewPanel(
                'weaviateRawConfig',
                `Raw Config: ${collectionName}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            // Format the raw config as HTML
            panel.webview.html = this.getRawConfigHtml(collection.schema, item.connectionId);

        } catch (error) {
            console.error('Error viewing raw config:', error);
            vscode.window.showErrorMessage(
                `Failed to view raw config: ${error instanceof Error ? error.message : String(error)}`
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

    /**
     * Generates HTML for displaying raw collection configuration in a webview
     * @param schema The schema to display
     * @param connectionId The connection ID for context
     */
    private getRawConfigHtml(schema: SchemaClass, connectionId: string): string {
        return this.viewRenderer.renderRawConfig(schema, connectionId);
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
        } else if (element.itemType === 'vectorConfig' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('arrow-both');
            element.tooltip = 'Vector configuration and modules';
        } else if (element.itemType === 'indexes' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('search');
            element.tooltip = 'Index configuration';
        } else if (element.itemType === 'statistics' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('graph');
            element.tooltip = 'Collection statistics';
        } else if (element.itemType === 'sharding' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('layout');
            element.tooltip = 'Sharding and replication configuration';
        } else if (element.itemType === 'serverInfo' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('server');
            element.tooltip = 'Server version and information';
        } else if (element.itemType === 'clusterHealth' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('pulse');
            element.tooltip = 'Cluster status and health';
        } else if (element.itemType === 'modules' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('extensions');
            element.tooltip = 'Available Weaviate modules';
        } else if (element.itemType === 'collectionsGroup' && !element.iconPath) {
            element.iconPath = new vscode.ThemeIcon('database');
            element.tooltip = 'Collections in this instance';
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
    async getChildren(element?: WeaviateTreeItem): Promise<WeaviateTreeItem[]> {
        // No connections case
        if (this.connections.length === 0) {
            return [
                new WeaviateTreeItem(
                    'No connections found. Click + to add.', 
                    vscode.TreeItemCollapsibleState.None, 
                    'message'
                )
            ];
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
            
            return connectionItems;
        } 
        else if (element.itemType === 'connection' && element.connectionId) {
            // Connection level - show server info and collections
            const connection = this.connections.find(conn => conn.id === element.connectionId);
            
            if (!connection || connection.status !== 'connected') {
                const message = connection?.status === 'connected' 
                    ? 'Loading...'
                    : 'Not connected. Right-click and select "Connect" to view information.';
                
                return [
                    new WeaviateTreeItem(
                        message,
                        vscode.TreeItemCollapsibleState.None, 
                        'message',
                        element.connectionId
                    )
                ];
            }

            const items: WeaviateTreeItem[] = [];

            // Add server information section
            items.push(new WeaviateTreeItem(
                'Server Information',
                vscode.TreeItemCollapsibleState.Collapsed,
                'serverInfo',
                element.connectionId,
                undefined,
                'serverInfo',
                new vscode.ThemeIcon('server'),
                'weaviateServerInfo'
            ));

            // Add cluster health section
            items.push(new WeaviateTreeItem(
                'Cluster Health',
                vscode.TreeItemCollapsibleState.Collapsed,
                'clusterHealth',
                element.connectionId,
                undefined,
                'clusterHealth',
                new vscode.ThemeIcon('pulse'),
                'weaviateClusterHealth'
            ));

            // Add modules section
            items.push(new WeaviateTreeItem(
                'Available Modules',
                vscode.TreeItemCollapsibleState.Collapsed,
                'modules',
                element.connectionId,
                undefined,
                'modules',
                new vscode.ThemeIcon('extensions'),
                'weaviateModules'
            ));

            // Add collections section
            const collections = this.collections[element.connectionId] || [];
            const collectionsLabel = collections.length > 0 
                ? `Collections (${collections.length})`
                : 'Collections';
            
            items.push(new WeaviateTreeItem(
                collectionsLabel,
                vscode.TreeItemCollapsibleState.Expanded,
                'collectionsGroup',
                element.connectionId,
                undefined,
                'collections',
                new vscode.ThemeIcon('database'),
                'weaviateCollectionsGroup'
            ));

            return items;
        }
        else if (element.itemType === 'collectionsGroup' && element.connectionId) {
            // Collections group - show actual collections
            const collections = this.collections[element.connectionId] || [];
            
            if (collections.length === 0) {
                return [
                    new WeaviateTreeItem(
                        'No collections found. Right-click parent connection to add a collection.',
                        vscode.TreeItemCollapsibleState.None, 
                        'message',
                        element.connectionId
                    )
                ];
            }
            
            return collections;
        }
        else if (element.itemType === 'collection') {
            // Collection level - show various collection aspects
            const items = [
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
                    'Vector Configuration',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'vectorConfig',
                    element.connectionId,
                    element.label,
                    'vectorConfig',
                    new vscode.ThemeIcon('arrow-both')
                ),
                new WeaviateTreeItem(
                    'Indexes',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'indexes',
                    element.connectionId,
                    element.label,
                    'indexes',
                    new vscode.ThemeIcon('search')
                ),
                new WeaviateTreeItem(
                    'Statistics',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'statistics',
                    element.connectionId,
                    element.label,
                    'statistics',
                    new vscode.ThemeIcon('graph')
                ),
                new WeaviateTreeItem(
                    'Sharding',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'sharding',
                    element.connectionId,
                    element.label,
                    'sharding',
                    new vscode.ThemeIcon('layout')
                )
            ];
            
            return items;
        }

        else if (element.itemType === 'properties' && element.connectionId && element.collectionName) {
            // Find the collection schema
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
            if (!collection) {
                return [
                    new WeaviateTreeItem('No properties available', vscode.TreeItemCollapsibleState.None, 'message')
                ];
            }
            
            const schema = (collection as any).schema;
            if (!schema || !schema.properties || !Array.isArray(schema.properties)) {
                return [
                    new WeaviateTreeItem('No properties defined', vscode.TreeItemCollapsibleState.None, 'message')
                ];
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
            
            return propertyItems;
        }
        else if (element.itemType === 'vectorConfig' && element.connectionId && element.collectionName) {
            // Vector configuration section
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
                         if (!collection) {
                 return [
                     new WeaviateTreeItem('No vector configuration available', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }
            
            const schema = (collection as any).schema;
            const vectorItems: WeaviateTreeItem[] = [];
            
            // Vectorizer info
            if (schema?.vectorizer) {
                vectorItems.push(new WeaviateTreeItem(
                    `Vectorizer: ${schema.vectorizer}`,
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    element.collectionName,
                    'vectorizer',
                    new vscode.ThemeIcon('gear'),
                    'weaviateVectorConfig'
                ));
            }

            // Module config
            if (schema?.moduleConfig) {
                const moduleNames = Object.keys(schema.moduleConfig);
                moduleNames.forEach(moduleName => {
                    vectorItems.push(new WeaviateTreeItem(
                        `Module: ${moduleName}`,
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        moduleName,
                        new vscode.ThemeIcon('extensions'),
                        'weaviateVectorConfig'
                    ));
                });
            }

            // Vector index type
            if (schema?.vectorIndexType) {
                vectorItems.push(new WeaviateTreeItem(
                    `Index Type: ${schema.vectorIndexType}`,
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    element.collectionName,
                    'vectorIndexType',
                    new vscode.ThemeIcon('list-tree'),
                    'weaviateVectorConfig'
                ));
            }

                         if (vectorItems.length === 0) {
                 return [
                     new WeaviateTreeItem('No vector configuration found', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }

             return vectorItems;
        }
        else if (element.itemType === 'indexes' && element.connectionId && element.collectionName) {
            // Indexes section
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
                         if (!collection) {
                 return [
                     new WeaviateTreeItem('No index information available', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }
            
            const schema = (collection as any).schema;
            const indexItems: WeaviateTreeItem[] = [];
            
            // Inverted index
            if (schema?.invertedIndexConfig) {
                indexItems.push(new WeaviateTreeItem(
                    'Inverted Index: Enabled',
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    element.collectionName,
                    'invertedIndex',
                    new vscode.ThemeIcon('search'),
                    'weaviateIndex'
                ));
            }

            // Vector index
            if (schema?.vectorIndexConfig) {
                const vectorIndexType = schema.vectorIndexType || 'hnsw';
                indexItems.push(new WeaviateTreeItem(
                    `Vector Index: ${vectorIndexType.toUpperCase()}`,
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    element.collectionName,
                    'vectorIndex',
                    new vscode.ThemeIcon('arrow-both'),
                    'weaviateIndex'
                ));
            }

            // Property-specific indexes
            if (schema?.properties) {
                const indexedProps = schema.properties.filter((prop: any) => prop.indexInverted !== false);
                if (indexedProps.length > 0) {
                    indexItems.push(new WeaviateTreeItem(
                        `Indexed Properties: ${indexedProps.length}`,
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        'indexedProperties',
                        new vscode.ThemeIcon('symbol-property'),
                        'weaviateIndex'
                    ));
                }
            }

            if (indexItems.length === 0) {
                return [
                    new WeaviateTreeItem('No index information found', vscode.TreeItemCollapsibleState.None, 'message')
                ];
            }

            return indexItems;
        }
        else if (element.itemType === 'statistics' && element.connectionId && element.collectionName) {
            // Statistics section - fetch live data
            try {
                const client = this.connectionManager.getClient(element.connectionId);
                                 if (!client) {
                     return [
                         new WeaviateTreeItem('Client not available', vscode.TreeItemCollapsibleState.None, 'message')
                     ];
                 }

                const statsItems: WeaviateTreeItem[] = [];

                // Get object count
                try {
                    const aggregate = await client.graphql.aggregate()
                        .withClassName(element.collectionName)
                        .withFields('meta { count }')
                        .do();
                    
                    const count = aggregate?.data?.Aggregate?.[element.collectionName]?.[0]?.meta?.count || 0;
                    statsItems.push(new WeaviateTreeItem(
                        `Objects: ${count.toLocaleString()}`,
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        'objectCount',
                        new vscode.ThemeIcon('database'),
                        'weaviateStatistic'
                    ));
                } catch (error) {
                    console.warn('Could not fetch object count:', error);
                    statsItems.push(new WeaviateTreeItem(
                        'Objects: Unable to fetch',
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        'objectCount',
                        new vscode.ThemeIcon('database'),
                        'weaviateStatistic'
                    ));
                }

                // Get tenant count if multi-tenancy is enabled
                const collection = this.collections[element.connectionId]?.find(
                    item => item.label === element.collectionName
                );
                const schema = (collection as any)?.schema;
                
                if (schema?.multiTenancyConfig?.enabled) {
                    try {
                        const tenants = await client.schema.tenantsGetter(element.collectionName).do();
                        statsItems.push(new WeaviateTreeItem(
                            `Tenants: ${tenants.length}`,
                            vscode.TreeItemCollapsibleState.None,
                            'object',
                            element.connectionId,
                            element.collectionName,
                            'tenantCount',
                            new vscode.ThemeIcon('organization'),
                            'weaviateStatistic'
                        ));
                    } catch (error) {
                        console.warn('Could not fetch tenant count:', error);
                    }
                }

                                 return statsItems;
            } catch (error) {
                console.error('Error fetching statistics:', error);
                                 return [
                     new WeaviateTreeItem('Error fetching statistics', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
            }
        }
        else if (element.itemType === 'sharding' && element.connectionId && element.collectionName) {
            // Sharding section
            const collection = this.collections[element.connectionId]?.find(
                item => item.label === element.collectionName
            );
            
                         if (!collection) {
                 return [
                     new WeaviateTreeItem('No sharding information available', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }
            
            const schema = (collection as any).schema;
            const shardingItems: WeaviateTreeItem[] = [];
            
            // Sharding config
            if (schema?.shardingConfig) {
                const config = schema.shardingConfig;
                
                if (config.virtualPerPhysical) {
                    shardingItems.push(new WeaviateTreeItem(
                        `Virtual Per Physical: ${config.virtualPerPhysical}`,
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        'virtualPerPhysical',
                        new vscode.ThemeIcon('layout'),
                        'weaviateSharding'
                    ));
                }

                if (config.desiredCount) {
                    shardingItems.push(new WeaviateTreeItem(
                        `Desired Count: ${config.desiredCount}`,
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        'desiredCount',
                        new vscode.ThemeIcon('layout'),
                        'weaviateSharding'
                    ));
                }

                if (config.actualCount) {
                    shardingItems.push(new WeaviateTreeItem(
                        `Actual Count: ${config.actualCount}`,
                        vscode.TreeItemCollapsibleState.None,
                        'object',
                        element.connectionId,
                        element.collectionName,
                        'actualCount',
                        new vscode.ThemeIcon('layout'),
                        'weaviateSharding'
                    ));
                }
            }

            // Replication config
            if (schema?.replicationConfig) {
                const replicationFactor = schema.replicationConfig.factor || 1;
                shardingItems.push(new WeaviateTreeItem(
                    `Replication Factor: ${replicationFactor}`,
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    element.collectionName,
                    'replicationFactor',
                    new vscode.ThemeIcon('mirror'),
                    'weaviateSharding'
                ));
            }

            // Multi-tenancy
            if (schema?.multiTenancyConfig) {
                const isEnabled = schema.multiTenancyConfig.enabled ? 'Enabled' : 'Disabled';
                shardingItems.push(new WeaviateTreeItem(
                    `Multi-Tenancy: ${isEnabled}`,
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    element.collectionName,
                    'multiTenancy',
                    new vscode.ThemeIcon('organization'),
                    'weaviateSharding'
                ));
            }

                         if (shardingItems.length === 0) {
                 return [
                     new WeaviateTreeItem('No sharding configuration found', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }

                          return shardingItems;
         }
         else if (element.itemType === 'serverInfo' && element.connectionId) {
             // Server information section
             try {
                 const client = this.connectionManager.getClient(element.connectionId);
                 if (!client) {
                     return [
                         new WeaviateTreeItem('Client not available', vscode.TreeItemCollapsibleState.None, 'message')
                     ];
                 }

                 const serverItems: WeaviateTreeItem[] = [];

                 // Get server meta information
                 try {
                     const meta = await client.misc.metaGetter().do();
                     
                     if (meta.version) {
                         serverItems.push(new WeaviateTreeItem(
                             `Version: ${meta.version}`,
                             vscode.TreeItemCollapsibleState.None,
                             'object',
                             element.connectionId,
                             undefined,
                             'version',
                             new vscode.ThemeIcon('tag'),
                             'weaviateServerDetail'
                         ));
                     }

                     if (meta.gitHash) {
                         serverItems.push(new WeaviateTreeItem(
                             `Git Hash: ${meta.gitHash.substring(0, 8)}`,
                             vscode.TreeItemCollapsibleState.None,
                             'object',
                             element.connectionId,
                             undefined,
                             'gitHash',
                             new vscode.ThemeIcon('git-commit'),
                             'weaviateServerDetail'
                         ));
                     }

                     if (meta.hostname) {
                         serverItems.push(new WeaviateTreeItem(
                             `Hostname: ${meta.hostname}`,
                             vscode.TreeItemCollapsibleState.None,
                             'object',
                             element.connectionId,
                             undefined,
                             'hostname',
                             new vscode.ThemeIcon('server'),
                             'weaviateServerDetail'
                         ));
                     }

                 } catch (error) {
                     console.warn('Could not fetch server meta:', error);
                     serverItems.push(new WeaviateTreeItem(
                         'Unable to fetch server information',
                         vscode.TreeItemCollapsibleState.None,
                         'message'
                     ));
                 }

                 return serverItems;
             } catch (error) {
                 console.error('Error fetching server information:', error);
                 return [
                     new WeaviateTreeItem('Error fetching server information', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }
         }
         else if (element.itemType === 'clusterHealth' && element.connectionId) {
             // Cluster health section
             try {
                 const client = this.connectionManager.getClient(element.connectionId);
                 if (!client) {
                     return [
                         new WeaviateTreeItem('Client not available', vscode.TreeItemCollapsibleState.None, 'message')
                     ];
                 }

                 const healthItems: WeaviateTreeItem[] = [];

                 try {
                     // Try to get cluster status (this might not be available in all Weaviate versions)
                     const meta = await client.misc.metaGetter().do();
                     
                     // Show basic connectivity status
                     healthItems.push(new WeaviateTreeItem(
                         'Status: Connected',
                         vscode.TreeItemCollapsibleState.None,
                         'object',
                         element.connectionId,
                         undefined,
                         'status',
                         new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')),
                         'weaviateClusterDetail'
                     ));

                     // If we can get schema, show collection count
                     const schema = await client.schema.getter().do();
                     const collectionCount = schema?.classes?.length || 0;
                     healthItems.push(new WeaviateTreeItem(
                         `Collections: ${collectionCount}`,
                         vscode.TreeItemCollapsibleState.None,
                         'object',
                         element.connectionId,
                         undefined,
                         'collectionCount',
                         new vscode.ThemeIcon('database'),
                         'weaviateClusterDetail'
                     ));

                 } catch (error) {
                     console.warn('Could not fetch cluster health:', error);
                     healthItems.push(new WeaviateTreeItem(
                         'Status: Connected (limited info)',
                         vscode.TreeItemCollapsibleState.None,
                         'object',
                         element.connectionId,
                         undefined,
                         'status',
                         new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground')),
                         'weaviateClusterDetail'
                     ));
                 }

                 return healthItems;
             } catch (error) {
                 console.error('Error fetching cluster health:', error);
                 return [
                     new WeaviateTreeItem('Error fetching cluster health', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }
         }
         else if (element.itemType === 'modules' && element.connectionId) {
             // Available modules section
             try {
                 const client = this.connectionManager.getClient(element.connectionId);
                 if (!client) {
                     return [
                         new WeaviateTreeItem('Client not available', vscode.TreeItemCollapsibleState.None, 'message')
                     ];
                 }

                 const moduleItems: WeaviateTreeItem[] = [];

                 try {
                     const meta = await client.misc.metaGetter().do();
                     
                     if (meta.modules) {
                         const modules = Object.keys(meta.modules);
                         
                         if (modules.length > 0) {
                             modules.forEach(moduleName => {
                                 const moduleInfo = meta.modules[moduleName];
                                 const version = moduleInfo?.version || 'unknown';
                                 
                                 moduleItems.push(new WeaviateTreeItem(
                                     `${moduleName} (v${version})`,
                                     vscode.TreeItemCollapsibleState.None,
                                     'object',
                                     element.connectionId,
                                     undefined,
                                     moduleName,
                                     new vscode.ThemeIcon('extensions'),
                                     'weaviateModule'
                                 ));
                             });
                         } else {
                             moduleItems.push(new WeaviateTreeItem(
                                 'No modules available',
                                 vscode.TreeItemCollapsibleState.None,
                                 'message'
                             ));
                         }
                     } else {
                         moduleItems.push(new WeaviateTreeItem(
                             'Module information not available',
                             vscode.TreeItemCollapsibleState.None,
                             'message'
                         ));
                     }

                 } catch (error) {
                     console.warn('Could not fetch modules:', error);
                     moduleItems.push(new WeaviateTreeItem(
                         'Unable to fetch module information',
                         vscode.TreeItemCollapsibleState.None,
                         'message'
                     ));
                 }

                 return moduleItems;
             } catch (error) {
                 console.error('Error fetching modules:', error);
                 return [
                     new WeaviateTreeItem('Error fetching modules', vscode.TreeItemCollapsibleState.None, 'message')
                 ];
             }
         }
         
         return [];
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
                
                // Update the connection in our local list to update the UI state
                const connectionIndex = this.connections.findIndex(c => c.id === connectionId);
                if (connectionIndex >= 0) {
                    this.connections[connectionIndex].status = 'connected';
                    
                    // Fire tree change event to update connection state right away
                    // This makes the connection item rerender with 'connected' status icon
                    this._onDidChangeTreeData.fire();
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
     * Deletes a collection from the Weaviate instance
     * @param connectionId - The ID of the connection
     * @param collectionName - The name of the collection to delete
     * @throws Error if deletion fails
     */
    async deleteCollection(connectionId: string, collectionName: string): Promise<void> {
        try {
            // Get client for this connection
            const connection = this.connectionManager.getConnection(connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }
            
            const client = this.connectionManager.getClient(connectionId);
            if (!client) {
                throw new Error('Client not initialized');
            }
            
            // Delete the collection using the schema API
            await client.schema.classDeleter()
                .withClassName(collectionName)
                .do();
            
            // Update local state
            if (this.collections[connectionId]) {
                this.collections[connectionId] = this.collections[connectionId].filter(
                    collection => collection.collectionName !== collectionName
                );
            }
            
            // Refresh the tree view
            this.refresh();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error in deleteCollection:', error);
            vscode.window.showErrorMessage(`Failed to delete collection: ${errorMessage}`);
            throw new Error(`Failed to delete collection: ${errorMessage}`);
        }
    }

    /**
     * Refreshes connection info for a specific connection
     * @param connectionId - The ID of the connection to refresh
     */
    async refreshConnectionInfo(connectionId: string): Promise<void> {
        try {
            // Reconnect to refresh the connection info
            await this.connect(connectionId, true);
            await this.fetchCollections(connectionId);
            this.refresh();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error refreshing connection info:', error);
            throw new Error(`Failed to refresh connection info: ${errorMessage}`);
        }
    }

    /**
     * Refreshes statistics for a specific collection
     * @param connectionId - The ID of the connection
     * @param collectionName - The name of the collection
     */
    async refreshStatistics(connectionId: string, collectionName: string): Promise<void> {
        try {
            // Simply refresh the tree view to trigger statistics reload
            this.refresh();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error refreshing statistics:', error);
            throw new Error(`Failed to refresh statistics: ${errorMessage}`);
        }
    }

    /**
     * Exports a collection schema to a file
     * @param connectionId - The ID of the connection
     * @param collectionName - The name of the collection to export
     */
    async exportSchema(connectionId: string, collectionName: string): Promise<void> {
        try {
            const collection = this.collections[connectionId]?.find(
                col => col.label === collectionName
            ) as CollectionWithSchema | undefined;

            if (!collection?.schema) {
                throw new Error('Collection schema not found');
            }

            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${collectionName}_schema.json`),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                }
            });

            if (!saveUri) {
                return; // User cancelled
            }

            // Export schema as formatted JSON
            const schemaJson = JSON.stringify(collection.schema, null, 2);
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(schemaJson, 'utf8'));
            
            vscode.window.showInformationMessage(`Schema exported to ${saveUri.fsPath}`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error exporting schema:', error);
            throw new Error(`Failed to export schema: ${errorMessage}`);
        }
    }

    /**
     * Duplicates a collection by creating a new collection with the same schema
     * @param connectionId - The ID of the connection
     * @param collectionName - The name of the collection to duplicate
     */
    async duplicateCollection(connectionId: string, collectionName: string): Promise<void> {
        try {
            const collection = this.collections[connectionId]?.find(
                col => col.label === collectionName
            ) as CollectionWithSchema | undefined;

            if (!collection?.schema) {
                throw new Error('Collection schema not found');
            }

            // Ask for new collection name
            const newName = await vscode.window.showInputBox({
                prompt: `Enter name for duplicated collection (original: ${collectionName})`,
                value: `${collectionName}_copy`,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Collection name cannot be empty';
                    }
                    if (value === collectionName) {
                        return 'New name must be different from original';
                    }
                    return null;
                }
            });

            if (!newName) {
                return; // User cancelled
            }

            const client = this.connectionManager.getClient(connectionId);
            if (!client) {
                throw new Error('Client not initialized');
            }

            // Create duplicate schema with new name
            const duplicateSchema = { ...collection.schema };
            duplicateSchema.class = newName.trim();

            // Create the new collection
            await client.schema.classCreator()
                .withClass(duplicateSchema)
                .do();

            // Refresh collections
            await this.fetchCollections(connectionId);
            
            vscode.window.showInformationMessage(`Collection duplicated as "${newName}"`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error duplicating collection:', error);
            throw new Error(`Failed to duplicate collection: ${errorMessage}`);
        }
    }

    /**
     * Shows performance metrics for a collection
     * @param connectionId - The ID of the connection
     * @param collectionName - The name of the collection
     */
    async viewCollectionMetrics(connectionId: string, collectionName: string): Promise<void> {
        try {
            const collection = this.collections[connectionId]?.find(
                col => col.label === collectionName
            ) as CollectionWithSchema | undefined;

            if (!collection?.schema) {
                throw new Error('Collection schema not found');
            }

            // Create and show a webview with collection metrics
            const panel = vscode.window.createWebviewPanel(
                'weaviateCollectionMetrics',
                `Metrics: ${collectionName}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            // Generate metrics HTML
            panel.webview.html = this.viewRenderer.renderCollectionMetrics(collection.schema, connectionId);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error viewing collection metrics:', error);
            throw new Error(`Failed to view collection metrics: ${errorMessage}`);
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
