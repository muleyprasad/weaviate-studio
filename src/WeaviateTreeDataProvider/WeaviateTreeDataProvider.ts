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
                { 
                    enableScripts: true,
                    retainContextWhenHidden: true 
                }
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
                
                if ((schema as any)?.multiTenancyConfig?.enabled) {
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
     * Shows the Add Collection dialog for creating a new collection
     * @param connectionId - The ID of the connection to add the collection to
     */
    async addCollection(connectionId: string): Promise<void> {
        try {
            const connection = this.connectionManager.getConnection(connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }

            if (connection.status !== 'connected') {
                throw new Error('Connection must be active to add collections');
            }

            // Create and show the Add Collection webview panel
            const panel = vscode.window.createWebviewPanel(
                'weaviateAddCollection',
                'Add Collection',
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            // Set the webview content
            panel.webview.html = this.getAddCollectionHtml();

            // Handle messages from the webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.command) {
                        case 'create':
                            try {
                                await this.createCollection(connectionId, message.schema);
                                panel.dispose();
                                vscode.window.showInformationMessage(`Collection "${message.schema.class}" created successfully`);
                                await this.fetchCollections(connectionId);
                            } catch (error) {
                                panel.webview.postMessage({
                                    command: 'error',
                                    message: error instanceof Error ? error.message : String(error)
                                });
                            }
                            break;
                        case 'cancel':
                            panel.dispose();
                            break;
                        case 'getVectorizers':
                            try {
                                const client = this.connectionManager.getClient(connectionId);
                                const vectorizers = await this.getAvailableVectorizers(connectionId);

                                // Send vectorizers
                                panel.webview.postMessage({
                                    command: 'vectorizers',
                                    vectorizers: vectorizers
                                });

                                // Also send server version information
                                try {
                                    if (client) {
                                        const meta = await client.misc.metaGetter().do();
                                        panel.webview.postMessage({
                                            command: 'serverVersion',
                                            version: meta.version || 'unknown'
                                        });
                                    }
                                } catch (_) {
                                    // ignore version errors
                                }
                            } catch (error) {
                                panel.webview.postMessage({
                                    command: 'error',
                                    message: `Failed to fetch vectorizers: ${error instanceof Error ? error.message : String(error)}`
                                });
                            }
                            break;
                        case 'getCollections':
                            try {
                                const collections = this.collections[connectionId] || [];
                                panel.webview.postMessage({
                                    command: 'collections',
                                    collections: collections.map(col => col.label)
                                });
                            } catch (error) {
                                panel.webview.postMessage({
                                    command: 'error',
                                    message: `Failed to fetch collections: ${error instanceof Error ? error.message : String(error)}`
                                });
                            }
                            break;
                        case 'serverVersion':
                            // serverVersion handled in webview only
                            break;
                    }
                },
                undefined,
                this.context.subscriptions
            );

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error showing add collection dialog:', error);
            throw new Error(`Failed to show add collection dialog: ${errorMessage}`);
        }
    }

    /**
     * Creates a new collection using the Weaviate API
     * @param connectionId - The ID of the connection
     * @param schema - The collection schema to create
     */
    private async createCollection(connectionId: string, schema: any): Promise<void> {
        const client = this.connectionManager.getClient(connectionId);
        if (!client) {
            throw new Error('Client not initialized');
        }

        // Basic validation
        if (!schema.class) {
            throw new Error('Collection name is required');
        }
        
        // Build schema object
        const schemaObject = {
            class: schema.class,
            description: schema.description || undefined,
            vectorizer: schema.vectorizer === 'none' ? undefined : schema.vectorizer,
            properties: schema.properties || []  // Include properties from the form
        } as any;
        
        if (schema.vectorIndexType) {
            schemaObject.vectorIndexType = schema.vectorIndexType;
        }
        if (schema.vectorIndexConfig) {
            schemaObject.vectorIndexConfig = schema.vectorIndexConfig;
        }
        if (schema.moduleConfig) {
            schemaObject.moduleConfig = schema.moduleConfig;
        }
        
        // Create the collection using the schema API
        await client.schema.classCreator()
            .withClass(schemaObject)
            .do();
    }

    /**
     * Gets available vectorizers from the Weaviate instance
     * @param connectionId - The ID of the connection
     * @returns Array of available vectorizers
     */
    private async getAvailableVectorizers(connectionId: string): Promise<string[]> {
        const client = this.connectionManager.getClient(connectionId);
        if (!client) {
            throw new Error('Client not initialized');
        }

        try {
            const meta = await client.misc.metaGetter().do();
            
            // Extract vectorizer names from modules
            const vectorizers: string[] = ['none']; // Default option
            
            if (meta.modules) {
                const moduleNames = Object.keys(meta.modules);
                console.log('Available modules:', moduleNames); // Debug log
                
                // Add common vectorizers based on available modules
                if (moduleNames.includes('text2vec-openai')) {
                    vectorizers.push('text2vec-openai');
                }
                if (moduleNames.includes('text2vec-cohere')) {
                    vectorizers.push('text2vec-cohere');
                }
                if (moduleNames.includes('text2vec-huggingface')) {
                    vectorizers.push('text2vec-huggingface');
                }
                if (moduleNames.includes('text2vec-transformers')) {
                    vectorizers.push('text2vec-transformers');
                }
                if (moduleNames.includes('text2vec-contextionary')) {
                    vectorizers.push('text2vec-contextionary');
                }
                if (moduleNames.includes('multi2vec-clip')) {
                    vectorizers.push('multi2vec-clip');
                }
                if (moduleNames.includes('multi2vec-bind')) {
                    vectorizers.push('multi2vec-bind');
                }
                if (moduleNames.includes('img2vec-neural')) {
                    vectorizers.push('img2vec-neural');
                }
                if (moduleNames.includes('ref2vec-centroid')) {
                    vectorizers.push('ref2vec-centroid');
                }
            }
            
            console.log('Available vectorizers:', vectorizers); // Debug log
            return vectorizers;
        } catch (error) {
            console.warn('Could not fetch vectorizers, using defaults:', error);
            return ['none', 'text2vec-openai', 'text2vec-cohere', 'text2vec-huggingface', 'text2vec-contextionary'];
        }
    }

    /**
     * Generates HTML for the Add Collection webview
     * @returns The HTML content for the webview
     */
    private getAddCollectionHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Add Collection</title>
                <style>
                    /* Reset and base styles */
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                        font-size: 14px;
                        line-height: 1.4;
                        color: #2D2D2D;
                        background-color: #FFFFFF;
                        margin: 0;
                        padding: 0;
                    }
                    
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 24px;
                    }
                    
                    /* Header */
                    .header {
                        margin-bottom: 32px;
                    }
                    
                    .header h2 {
                        margin: 0 0 8px 0;
                        font-size: 16px;
                        font-weight: bold;
                        color: #2D2D2D;
                    }
                    
                    .header .subtitle {
                        color: #6A6A6A;
                        font-size: 14px;
                        font-weight: normal;
                    }
                    
                    /* Form Layout */
                    .form-section {
                        margin-bottom: 24px;
                        border: 1px solid #CCCCCC;
                        border-radius: 4px;
                        background: #FFFFFF;
                        overflow: hidden;
                    }
                    
                    .section-header {
                        padding: 16px 20px;
                        background: #F3F3F3;
                        border-bottom: 1px solid #CCCCCC;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        font-weight: bold;
                        font-size: 16px;
                        color: #2D2D2D;
                        transition: background-color 0.2s ease;
                    }
                    
                    .section-header:hover {
                        background: #E8E8E8;
                    }
                    
                    .section-header .icon {
                        transition: transform 0.2s ease;
                        font-size: 12px;
                        color: #6A6A6A;
                    }
                    
                    .section-header.collapsed .icon {
                        transform: rotate(-90deg);
                    }
                    
                    .section-content {
                        padding: 20px;
                        display: block;
                        transition: all 0.2s ease;
                    }
                    
                    .section-content.collapsed {
                        display: none;
                    }
                    
                    /* Form Fields */
                    .form-field {
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 20px;
                    }
                    
                    .form-field:last-child {
                        margin-bottom: 0;
                    }
                    
                    .form-field label {
                        font-weight: normal;
                        margin-bottom: 8px;
                        font-size: 14px;
                        color: #6A6A6A;
                        display: block;
                    }
                    
                    .form-field label.required::after {
                        content: " *";
                        color: #D32F2F;
                    }
                    
                    .form-field input,
                    .form-field select,
                    .form-field textarea {
                        height: 32px;
                        padding: 0 12px;
                        border: 1px solid #CCCCCC;
                        background: #F3F3F3;
                        color: #2D2D2D;
                        border-radius: 4px;
                        font-family: inherit;
                        font-size: 14px;
                        transition: border-color 0.2s ease;
                        width: 100%;
                    }
                    
                    .form-field textarea {
                        height: auto;
                        min-height: 80px;
                        padding: 8px 12px;
                        resize: vertical;
                    }
                    
                    .form-field input:focus,
                    .form-field select:focus,
                    .form-field textarea:focus {
                        outline: none;
                        border-color: #007ACC;
                        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
                    }
                    
                    .form-field .hint {
                        font-size: 12px;
                        color: #6A6A6A;
                        margin-top: 4px;
                        font-style: italic;
                    }
                    
                    .form-field .error-text {
                        font-size: 12px;
                        color: #D32F2F;
                        margin-top: 4px;
                        display: none;
                    }
                    
                    /* Side-by-side fields */
                    .form-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 16px;
                    }
                    
                    /* Properties Section */
                    .properties-container {
                        min-height: 80px;
                        border: 2px dashed #CCCCCC;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #F3F3F3;
                        margin-bottom: 16px;
                        transition: border-color 0.2s ease;
                    }
                    
                    .properties-container.has-properties {
                        border: 1px solid #CCCCCC;
                        border-style: solid;
                        padding: 16px;
                        min-height: auto;
                        background: #FFFFFF;
                    }
                    
                    .no-properties {
                        text-align: center;
                        color: #6A6A6A;
                        font-style: italic;
                        font-size: 14px;
                    }
                    
                    .property-card {
                        background: #F3F3F3;
                        border: 1px solid #CCCCCC;
                        border-radius: 4px;
                        padding: 16px;
                        margin-bottom: 12px;
                        position: relative;
                    }
                    
                    .property-card:last-child {
                        margin-bottom: 0;
                    }
                    
                    .property-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    }
                    
                    .property-name {
                        font-weight: bold;
                        font-size: 14px;
                        color: #2D2D2D;
                    }
                    
                    .property-actions button {
                        padding: 6px 12px;
                        font-size: 12px;
                        border: 1px solid #CCCCCC;
                        border-radius: 4px;
                        cursor: pointer;
                        background: #FFFFFF;
                        color: #6A6A6A;
                        transition: all 0.2s ease;
                    }
                    
                    .property-actions button:hover {
                        background: #F3F3F3;
                    }
                    
                    .property-actions button.danger {
                        background: #D32F2F;
                        color: #FFFFFF;
                        border-color: #D32F2F;
                    }
                    
                    .property-actions button.danger:hover {
                        background: #B71C1C;
                    }
                    
                    .property-fields {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                    }
                    
                    .property-field {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .property-field label {
                        font-size: 12px;
                        margin-bottom: 6px;
                        color: #6A6A6A;
                    }
                    
                    .property-field input,
                    .property-field select,
                    .property-field textarea {
                        height: 28px;
                        padding: 0 8px;
                        font-size: 12px;
                    }
                    
                    .property-field textarea {
                        height: auto;
                        min-height: 60px;
                        padding: 6px 8px;
                    }
                    
                    .property-field.full-width {
                        grid-column: 1 / -1;
                    }
                    
                    .property-field input[type="checkbox"] {
                        width: auto;
                        height: auto;
                        margin-right: 8px;
                    }
                    
                    .inline-checkbox {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .inline-checkbox label {
                        margin-bottom: 0;
                        cursor: pointer;
                    }
                    
                    /* Buttons */
                    .button-group {
                        display: flex;
                        gap: 8px;
                        margin-top: 32px;
                        justify-content: flex-end;
                    }
                    
                    button {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 14px;
                        font-weight: normal;
                        transition: all 0.2s ease;
                        min-height: 32px;
                    }
                    
                    .primary-button {
                        background: #007ACC;
                        color: #FFFFFF;
                        border: 1px solid #007ACC;
                    }
                    
                    .primary-button:hover {
                        background: #005A9E;
                        border-color: #005A9E;
                    }
                    
                    .secondary-button {
                        background: transparent;
                        color: #6A6A6A;
                        border: 1px solid #CCCCCC;
                    }
                    
                    .secondary-button:hover {
                        background: #F3F3F3;
                    }
                    
                    .add-property-btn {
                        background: transparent;
                        color: #007ACC;
                        border: none;
                        padding: 0;
                        font-size: 14px;
                        text-decoration: underline;
                        text-align: left;
                        margin-bottom: 16px;
                    }
                    
                    .add-property-btn:hover {
                        color: #005A9E;
                        background: transparent;
                    }
                    
                    /* Error Handling */
                    .error {
                        color: #D32F2F;
                        background: #FFEBEE;
                        border: 1px solid #FFCDD2;
                        padding: 12px 16px;
                        border-radius: 4px;
                        margin-top: 16px;
                        display: none;
                        font-size: 14px;
                    }
                    
                    /* JSON Preview */
                    .json-preview {
                        background: #F3F3F3;
                        border: 1px solid #CCCCCC;
                        padding: 16px;
                        border-radius: 4px;
                        max-height: 300px;
                        overflow: auto;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        font-size: 12px;
                        color: #2D2D2D;
                        white-space: pre;
                        line-height: 1.4;
                    }
                    
                    /* Dropdown styling */
                    select {
                        appearance: none;
                        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236A6A6A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
                        background-repeat: no-repeat;
                        background-position: right 8px center;
                        background-size: 16px;
                        padding-right: 32px;
                    }
                    
                    /* Responsive */
                    @media (max-width: 600px) {
                        .container {
                            padding: 16px;
                        }
                        
                        .form-row {
                            grid-template-columns: 1fr;
                        }
                        
                        .property-fields {
                            grid-template-columns: 1fr;
                        }
                        
                        .button-group {
                            flex-direction: column;
                        }
                    }
                    
                    /* Accessibility */
                    button:focus,
                    input:focus,
                    select:focus,
                    textarea:focus {
                        outline: 2px solid #007ACC;
                        outline-offset: 2px;
                    }
                    
                    /* Animation for collapsible sections */
                    .section-content {
                        transition: all 0.2s ease;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Create New Collection</h2>
                        <div class="subtitle">Define your collection's structure and configuration</div>
                    </div>
                    
                                        <form id="collectionForm">
                        <!-- Basic Settings Section -->
                        <div class="form-section">
                            <div class="section-header" data-section="basic">
                                <span>Basic Settings</span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content" id="basicContent">
                                <div class="form-field">
                                    <label for="collectionName" class="required">Collection Name</label>
                                    <input type="text" id="collectionName" name="collectionName" required placeholder="e.g., Articles, Products, Documents" aria-describedby="nameHint nameError">
                                    <div class="hint" id="nameHint">Choose a descriptive name for your collection</div>
                                    <div class="error-text" id="nameError" role="alert"></div>
                                </div>
                                <div class="form-field">
                                    <label for="description">Description</label>
                                    <textarea id="description" name="description" placeholder="Optional description of what this collection contains"></textarea>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Vectorizer & Index Type Section -->
                        <div class="form-section">
                            <div class="section-header" data-section="vectorizer">
                                <span>Vectorizer & Index Type</span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content" id="vectorizerContent">
                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="vectorizer">Vectorizer</label>
                                        <select id="vectorizer" name="vectorizer" aria-describedby="vectorizerHint">
                                            <option value="none">None (Manual vectors)</option>
                                            <option value="text2vec-openai">OpenAI</option>
                                            <option value="text2vec-cohere">Cohere</option>
                                            <option value="text2vec-huggingface">Hugging Face</option>
                                        </select>
                                        <div class="hint" id="vectorizerHint">How text will be converted to vectors</div>
                                    </div>
                                    <div class="form-field">
                                        <label for="vectorIndexType">Index Type</label>
                                        <select id="vectorIndexType" name="vectorIndexType" aria-describedby="indexHint">
                                            <option value="hnsw">HNSW (Recommended)</option>
                                            <option value="flat">Flat</option>
                                        </select>
                                        <div class="hint" id="indexHint">Vector search algorithm</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Properties Section -->
                        <div class="form-section">
                            <div class="section-header" data-section="properties">
                                <span>Properties</span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content" id="propertiesContent">
                                <button type="button" class="add-property-btn" id="addPropertyButton">+ Add Property</button>
                                <div class="properties-container" id="propertiesContainer">
                                    <div class="no-properties">No properties added yet. Click "Add Property" to define your data structure.</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Advanced Settings Section -->
                        <div class="form-section">
                            <div class="section-header collapsed" data-section="advanced">
                                <span>Advanced Settings</span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content collapsed" id="advancedContent">
                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="efConstruction">EF Construction</label>
                                        <input type="number" id="efConstruction" min="4" value="128" aria-describedby="efHint">
                                        <div class="hint" id="efHint">HNSW build quality (higher = better, slower)</div>
                                    </div>
                                    <div class="form-field">
                                        <label for="maxConnections">Max Connections</label>
                                        <input type="number" id="maxConnections" min="4" value="16" aria-describedby="maxConnHint">
                                        <div class="hint" id="maxConnHint">HNSW graph connections</div>
                                    </div>
                                </div>
                                <div class="form-field">
                                    <label class="inline-checkbox">
                                        <input type="checkbox" id="multiTenancyToggle" aria-describedby="mtHint">
                                        <span>Enable Multi-Tenancy</span>
                                    </label>
                                    <div class="hint" id="mtHint">Allow collection to be partitioned by tenant</div>
                                </div>
                                <div id="moduleConfigContainer"></div>
                            </div>
                        </div>
                        
                        <!-- Schema Preview Section -->
                        <div class="form-section">
                            <div class="section-header collapsed" data-section="preview">
                                <span>Schema Preview</span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content collapsed" id="previewContent">
                                <pre id="jsonPreview" class="json-preview" role="textbox" aria-label="JSON Schema Preview">{\n  \n}</pre>
                            </div>
                        </div>
                        
                        <div class="error" id="formError" role="alert" aria-live="polite"></div>
                        
                        <div class="button-group">
                            <button type="submit" class="primary-button">Create Collection</button>
                            <button type="button" class="secondary-button" id="cancelButton">Cancel</button>
                        </div>
                    </form>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let propertyCounter = 0;
                    let properties = [];
                    let existingCollections = [];
                    let vectorIndexConfigState = { efConstruction: 128, maxConnections: 16 };
                    let moduleConfigState = {};
                    let multiTenancyEnabled = false;
                    let serverVersion = 'unknown';
                    
                    // Data type definitions
                    const dataTypes = [
                        { value: 'text', label: 'Text', description: 'Long text content, vectorizable', supportsArray: true },
                        { value: 'string', label: 'String', description: 'Short text, not vectorizable', supportsArray: true },
                        { value: 'int', label: 'Integer', description: 'Whole numbers', supportsArray: true },
                        { value: 'number', label: 'Number', description: 'Decimal numbers', supportsArray: true },
                        { value: 'boolean', label: 'Boolean', description: 'True/false values', supportsArray: true },
                        { value: 'date', label: 'Date', description: 'ISO 8601 date format', supportsArray: true },
                        { value: 'geoCoordinates', label: 'Geo Coordinates', description: 'Latitude/longitude pairs', supportsArray: false },
                        { value: 'phoneNumber', label: 'Phone Number', description: 'International phone numbers', supportsArray: false },
                        { value: 'blob', label: 'Blob', description: 'Binary data (images, files)', supportsArray: false },
                        { value: 'object', label: 'Object', description: 'Nested JSON objects', supportsArray: true },
                        { value: 'uuid', label: 'UUID', description: 'Universally unique identifiers', supportsArray: true },
                        { value: 'reference', label: 'Reference', description: 'Reference to another collection', supportsArray: true }
                    ];
                    
                    // Section toggle functionality
                    document.querySelectorAll('.section-header').forEach(header => {
                        header.addEventListener('click', () => {
                            const section = header.dataset.section;
                            const content = document.getElementById(section + 'Content');
                            const isCollapsed = header.classList.contains('collapsed');
                            
                            if (isCollapsed) {
                                header.classList.remove('collapsed');
                                content.classList.remove('collapsed');
                            } else {
                                header.classList.add('collapsed');
                                content.classList.add('collapsed');
                            }
                        });
                    });
                    
                    // Initialize form
                    function initForm() {
                        // Request data from extension
                    vscode.postMessage({ command: 'getVectorizers' });
                    vscode.postMessage({ command: 'getCollections' });
                    
                        // Set up event listeners
                        setupEventListeners();
                        
                        // Initial renders
                        renderModuleConfig();
                        updateJsonPreview();
                        
                        // Focus collection name
                        document.getElementById('collectionName').focus();
                    }
                    
                                        function setupEventListeners() {
                        // Collection name validation with inline error
                        document.getElementById('collectionName').addEventListener('input', (e) => {
                            const input = e.target.value.trim();
                            const errorElement = document.getElementById('nameError');
                            
                            if (input && existingCollections.includes(input)) {
                                showInlineError('nameError', 'A collection with this name already exists');
                            } else {
                                hideInlineError('nameError');
                            }
                            
                            // Also update main error display
                            if (input && existingCollections.includes(input)) {
                                showError('A collection with this name already exists');
                            } else {
                                hideError();
                            }
                            
                            updateJsonPreview();
                        });
                        
                        // Other form fields
                        document.getElementById('description').addEventListener('input', updateJsonPreview);
                        document.getElementById('vectorizer').addEventListener('change', (e) => {
                            updateJsonPreview();
                            renderModuleConfig();
                        });
                        document.getElementById('vectorIndexType').addEventListener('change', updateJsonPreview);
                        document.getElementById('multiTenancyToggle').addEventListener('change', (e) => {
                            multiTenancyEnabled = e.target.checked;
                            updateJsonPreview();
                        });
                        
                        // Advanced settings
                        document.getElementById('efConstruction').addEventListener('input', (e) => {
                            vectorIndexConfigState.efConstruction = parseInt(e.target.value || 0);
                            updateJsonPreview();
                        });
                        document.getElementById('maxConnections').addEventListener('input', (e) => {
                            vectorIndexConfigState.maxConnections = parseInt(e.target.value || 0);
                            updateJsonPreview();
                        });
                        
                        // Property management
                        document.getElementById('addPropertyButton').addEventListener('click', addProperty);
                        
                        // Form submission
                        document.getElementById('collectionForm').addEventListener('submit', handleSubmit);
                        document.getElementById('cancelButton').addEventListener('click', () => {
                            vscode.postMessage({ command: 'cancel' });
                        });
                    }
                    
                    function renderModuleConfig() {
                        const container = document.getElementById('moduleConfigContainer');
                        const vectorizer = document.getElementById('vectorizer').value;
                        container.innerHTML = '';
                        moduleConfigState = {};
                        
                        if (vectorizer === 'text2vec-openai') {
                            container.innerHTML = \`
                                <div class="form-field">
                                    <label>OpenAI Configuration</label>
                                    <div class="form-row">
                                        <div class="form-field">
                                            <label for="openaiModel">Model</label>
                                            <input type="text" id="openaiModel" placeholder="text-embedding-ada-002">
                                        </div>
                                        <div class="form-field">
                                            <label for="openaiBaseUrl">Base URL (Optional)</label>
                                            <input type="text" id="openaiBaseUrl" placeholder="https://api.openai.com/v1">
                                        </div>
                                    </div>
                                </div>\`;
                            
                            document.getElementById('openaiModel').addEventListener('input', (e) => {
                                moduleConfigState.model = e.target.value.trim();
                                updateJsonPreview();
                            });
                            document.getElementById('openaiBaseUrl').addEventListener('input', (e) => {
                                moduleConfigState.baseURL = e.target.value.trim();
                                updateJsonPreview();
                            });
                        }
                        updateJsonPreview();
                    }
                    
                    function addProperty() {
                        const propertyId = 'prop_' + (++propertyCounter);
                        const property = {
                            id: propertyId,
                            name: '',
                            dataType: 'text',
                            isArray: false,
                            description: ''
                        };
                        
                        properties.push(property);
                        renderProperties();
                        
                        // Focus the name input
                        setTimeout(() => {
                            const nameInput = document.getElementById(propertyId + '_name');
                            if (nameInput) nameInput.focus();
                        }, 100);
                        
                        updateJsonPreview();
                    }
                    
                    function removeProperty(propertyId) {
                        properties = properties.filter(p => p.id !== propertyId);
                        renderProperties();
                        updateJsonPreview();
                    }
                    
                    function updateProperty(propertyId, field, value) {
                        const prop = properties.find(p => p.id === propertyId);
                        if (prop) {
                            prop[field] = value;
                            if (field === 'name') renderProperties();
                        }
                        updateJsonPreview();
                    }
                    
                    function renderProperties() {
                        const container = document.getElementById('propertiesContainer');
                        
                        if (properties.length === 0) {
                            container.innerHTML = '<div class="no-properties">No properties added yet. Click "Add Property" to define your data structure.</div>';
                            container.classList.remove('has-properties');
                            return;
                        }
                        
                        container.innerHTML = '';
                        container.classList.add('has-properties');
                        
                        properties.forEach(prop => {
                            const card = createPropertyCard(prop);
                            container.appendChild(card);
                        });
                    }
                    
                    function createPropertyCard(prop) {
                        const card = document.createElement('div');
                        card.className = 'property-card';
                        
                        // Header
                        const header = document.createElement('div');
                        header.className = 'property-header';
                        
                        const nameSpan = document.createElement('div');
                        nameSpan.className = 'property-name';
                        nameSpan.textContent = prop.name || 'New Property';
                        header.appendChild(nameSpan);
                        
                        const actions = document.createElement('div');
                        actions.className = 'property-actions';
                        
                        const removeBtn = document.createElement('button');
                        removeBtn.textContent = 'Remove';
                        removeBtn.className = 'danger';
                        removeBtn.addEventListener('click', () => removeProperty(prop.id));
                        actions.appendChild(removeBtn);
                        
                        header.appendChild(actions);
                        card.appendChild(header);
                        
                        // Fields
                        const fields = document.createElement('div');
                        fields.className = 'property-fields';
                        
                        // Name field
                        const nameField = createField('Name', 'input', prop.id + '_name', {
                            value: prop.name,
                            placeholder: 'propertyName',
                            onchange: (e) => updateProperty(prop.id, 'name', e.target.value)
                        });
                        fields.appendChild(nameField);
                        
                        // Data type field
                        const typeField = createSelectField('Type', prop.id + '_type', dataTypes.map(dt => ({
                            value: dt.value,
                            label: dt.label,
                            selected: prop.dataType === dt.value
                        })), (e) => {
                            const newDataType = e.target.value;
                            updateProperty(prop.id, 'dataType', newDataType);
                            updateArrayCheckbox(prop);
                            updateTargetCollectionField(prop);
                            
                            if (newDataType === 'reference') {
                                vscode.postMessage({ command: 'getCollections' });
                            }
                        });
                        fields.appendChild(typeField);
                        
                        // Target collection field (for reference type)
                        const targetCollectionField = document.createElement('div');
                        targetCollectionField.className = 'property-field';
                        targetCollectionField.id = prop.id + '_target_collection_field';
                        targetCollectionField.style.display = prop.dataType === 'reference' ? 'block' : 'none';
                        
                        const targetCollectionLabel = document.createElement('label');
                        targetCollectionLabel.textContent = 'Target Collection';
                        targetCollectionField.appendChild(targetCollectionLabel);
                        
                        const targetCollectionSelect = document.createElement('select');
                        targetCollectionSelect.id = prop.id + '_target_collection';
                        targetCollectionSelect.onchange = (e) => updateProperty(prop.id, 'targetCollection', e.target.value);
                        
                        const loadingOption = document.createElement('option');
                        loadingOption.value = '';
                        loadingOption.textContent = 'Loading collections...';
                        loadingOption.disabled = true;
                        targetCollectionSelect.appendChild(loadingOption);
                        
                        targetCollectionField.appendChild(targetCollectionSelect);
                        fields.appendChild(targetCollectionField);
                        
                        // Array checkbox
                        const arrayField = createArrayField(prop);
                        fields.appendChild(arrayField);
                        
                        // Description field
                        const descField = createField('Description', 'textarea', prop.id + '_desc', {
                            value: prop.description,
                            placeholder: 'Optional description',
                            onchange: (e) => updateProperty(prop.id, 'description', e.target.value)
                        });
                        descField.className += ' full-width';
                        fields.appendChild(descField);
                        
                        card.appendChild(fields);
                        return card;
                    }
                    
                    function createField(label, type, id, options = {}) {
                        const field = document.createElement('div');
                        field.className = 'property-field';
                        
                        const labelEl = document.createElement('label');
                        labelEl.textContent = label;
                        field.appendChild(labelEl);
                        
                        const input = document.createElement(type);
                        input.id = id;
                        Object.assign(input, options);
                        field.appendChild(input);
                        
                        return field;
                    }
                    
                    function createSelectField(label, id, options, onchange) {
                        const field = document.createElement('div');
                        field.className = 'property-field';
                        
                        const labelEl = document.createElement('label');
                        labelEl.textContent = label;
                        field.appendChild(labelEl);
                        
                        const select = document.createElement('select');
                        select.id = id;
                        select.onchange = onchange;
                        
                        options.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt.value;
                            option.textContent = opt.label;
                            option.selected = opt.selected;
                            select.appendChild(option);
                        });
                        
                        field.appendChild(select);
                        return field;
                    }
                    
                    function createArrayField(prop) {
                        const field = document.createElement('div');
                        field.className = 'property-field';
                        
                        const labelEl = document.createElement('label');
                        labelEl.textContent = 'Array';
                        field.appendChild(labelEl);
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = prop.id + '_array';
                        checkbox.checked = prop.isArray;
                        checkbox.onchange = (e) => updateProperty(prop.id, 'isArray', e.target.checked);
                        
                        const dataType = dataTypes.find(dt => dt.value === prop.dataType);
                        checkbox.disabled = !dataType?.supportsArray;
                        
                        field.appendChild(checkbox);
                        
                        return field;
                    }
                    
                    function updateArrayCheckbox(prop) {
                        const checkbox = document.getElementById(prop.id + '_array');
                        if (checkbox) {
                            const dataType = dataTypes.find(dt => dt.value === prop.dataType);
                            checkbox.disabled = !dataType?.supportsArray;
                            if (!dataType?.supportsArray) {
                                checkbox.checked = false;
                                prop.isArray = false;
                            }
                        }
                    }
                    
                    function updateTargetCollectionField(prop) {
                        const field = document.getElementById(prop.id + '_target_collection_field');
                        if (field) {
                            field.style.display = prop.dataType === 'reference' ? 'block' : 'none';
                        }
                    }
                    
                    function handleSubmit(e) {
                        e.preventDefault();
                        
                        const formData = new FormData(e.target);
                        let collectionName = formData.get('collectionName').trim();
                        const description = formData.get('description').trim();
                        const vectorizer = formData.get('vectorizer');
                        const vectorIndexType = document.getElementById('vectorIndexType').value;
                        const mtEnabled = document.getElementById('multiTenancyToggle').checked;
                        
                        // Validation
                        if (!collectionName) {
                            showError('Collection name is required');
                            return;
                        }
                        if (existingCollections.includes(collectionName)) {
                            showError('A collection with this name already exists');
                            return;
                        }
                        
                        // Build schema
                        const schema = {
                            class: collectionName,
                            description: description || undefined,
                            vectorizer: vectorizer === 'none' ? undefined : vectorizer,
                            properties: properties.map(function(prop) {
                                const propSchema = {
                                    name: prop.name.trim(),
                                    dataType: prop.dataType === 'reference' && prop.targetCollection
                                        ? (prop.isArray ? [prop.targetCollection + '[]'] : [prop.targetCollection])
                                        : (prop.isArray ? [prop.dataType + '[]'] : [prop.dataType]),
                                    description: prop.description ? prop.description.trim() : undefined
                                };
                                return propSchema;
                            }),
                            vectorIndexType: vectorIndexType,
                            vectorIndexConfig: vectorIndexType === 'hnsw' ? {
                                efConstruction: vectorIndexConfigState.efConstruction,
                                maxConnections: vectorIndexConfigState.maxConnections
                            } : undefined,
                            moduleConfig: Object.keys(moduleConfigState).length > 0 ? { 'text2vec-openai': { ...moduleConfigState } } : undefined,
                            multiTenancyConfig: mtEnabled ? { enabled: true } : undefined
                        };
                        
                        vscode.postMessage({
                            command: 'create',
                            schema: schema
                        });
                    }
                    
                    function updateJsonPreview() {
                        const collectionName = document.getElementById('collectionName').value.trim();
                        const descriptionVal = document.getElementById('description').value.trim();
                        const vectorizerVal = document.getElementById('vectorizer').value;
                        const vectorIndexTypeVal = document.getElementById('vectorIndexType').value;
                        const vectorIndexConfigVal = vectorIndexTypeVal === 'hnsw' ? { ...vectorIndexConfigState } : null;
                        const moduleConfigVal = Object.keys(moduleConfigState).length > 0 ? { 'text2vec-openai': { ...moduleConfigState } } : null;
                        const mtVal = document.getElementById('multiTenancyToggle').checked ? { enabled: true } : undefined;
                        
                        const schemaObj = {
                            class: collectionName || '<collectionName>',
                            description: descriptionVal || undefined,
                            vectorizer: vectorizerVal === 'none' ? undefined : vectorizerVal,
                            properties: properties.map(function(prop) {
                                const dataType = prop.dataType === 'reference' && prop.targetCollection
                                    ? (prop.isArray ? [prop.targetCollection + '[]'] : [prop.targetCollection])
                                    : (prop.isArray ? [prop.dataType + '[]'] : [prop.dataType]);
                                return {
                                    name: prop.name.trim() || '<propertyName>',
                                    dataType: dataType,
                                    description: prop.description ? prop.description.trim() : undefined
                                };
                            }),
                            vectorIndexType: vectorIndexTypeVal,
                            vectorIndexConfig: vectorIndexConfigVal,
                            moduleConfig: moduleConfigVal,
                            multiTenancyConfig: mtVal
                        };
                        document.getElementById('jsonPreview').textContent = JSON.stringify(schemaObj, null, 2);
                    }
                    
                    function showError(message) {
                        const errorElement = document.getElementById('formError');
                        errorElement.textContent = message;
                        errorElement.style.display = 'block';
                    }
                    
                    function hideError() {
                        document.getElementById('formError').style.display = 'none';
                    }
                    
                    function showInlineError(elementId, message) {
                        const errorElement = document.getElementById(elementId);
                        if (errorElement) {
                            errorElement.textContent = message;
                            errorElement.style.display = 'block';
                        }
                    }
                    
                    function hideInlineError(elementId) {
                        const errorElement = document.getElementById(elementId);
                        if (errorElement) {
                            errorElement.style.display = 'none';
                        }
                    }
                    
                    // Message handling
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'error':
                                showError(message.message);
                                break;
                            case 'vectorizers':
                                updateVectorizerOptions(message.vectorizers);
                                break;
                            case 'collections':
                                updateCollectionOptions(message.collections);
                                existingCollections = message.collections || [];
                                break;
                            case 'serverVersion':
                                serverVersion = message.version || 'unknown';
                                break;
                        }
                    });
                    
                    function updateVectorizerOptions(vectorizers) {
                        const select = document.getElementById('vectorizer');
                        select.innerHTML = '';
                        
                        vectorizers.forEach(vectorizer => {
                            const option = document.createElement('option');
                            option.value = vectorizer;
                            option.textContent = vectorizer === 'none' ? 'None (Manual vectors)' : 
                                vectorizer.replace('text2vec-', '').replace('multi2vec-', '').replace('img2vec-', '');
                            select.appendChild(option);
                        });
                    }
                    
                    function updateCollectionOptions(collections) {
                        properties.forEach(prop => {
                            const select = document.getElementById(prop.id + '_target_collection');
                            if (select) {
                                select.innerHTML = '';
                                
                                const placeholderOption = document.createElement('option');
                                placeholderOption.value = '';
                                placeholderOption.textContent = 'Select target collection';
                                select.appendChild(placeholderOption);
                                
                                collections.forEach(collection => {
                                    const option = document.createElement('option');
                                    option.value = collection;
                                    option.textContent = collection;
                                    option.selected = prop.targetCollection === collection;
                                    select.appendChild(option);
                                });
                            }
                        });
                        updateJsonPreview();
                    }
                    
                    // Initialize when DOM is ready
                    document.addEventListener('DOMContentLoaded', initForm);
                </script>
            </body>
            </html>
        `;
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
