import * as vscode from 'vscode';
import { ConnectionManager, WeaviateConnection } from '../services/ConnectionManager';
import {
  WeaviateTreeItem,
  ConnectionConfig,
  CollectionsMap,
  CollectionWithSchema,
  ExtendedSchemaClass,
  SchemaClass,
  WeaviateMetadata,
  BackupItem,
  AliasItem,
} from '../types';
import { ViewRenderer } from '../views/ViewRenderer';
import { QueryEditorPanel } from '../query-editor/extension/QueryEditorPanel';
import { AddCollectionPanel } from '../views/AddCollectionPanel';
import { ClusterPanel } from '../views/ClusterPanel';
import { CollectionConfig, Node, ShardingConfig, VectorConfig } from 'weaviate-client';
import * as https from 'https';
import * as http from 'http';

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

  /** Cache of cluster nodes per connection */
  private clusterNodesCache: Record<string, Node<'verbose'>[]> = {};

  /** Cache of cluster metadata per connection */
  private clusterMetadataCache: Record<string, WeaviateMetadata> = {};

  /** Cache of cluster metadata per connection */
  private clusterStatisticsCache: Record<string, any> = {};

  /** Cache of backups per connection */
  private backupsCache: Record<string, BackupItem[]> = {};

  /** Cache of aliases per connection */
  private aliasesCache: Record<string, AliasItem[]> = {};

  /** VS Code extension context */
  private readonly context: vscode.ExtensionContext;

  /** Manages Weaviate connections */
  private readonly connectionManager: ConnectionManager;

  /** Handles view rendering */
  private readonly viewRenderer: ViewRenderer;

  /** Reference to the TreeView for programmatic control */
  private treeView?: vscode.TreeView<WeaviateTreeItem>;

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
   * Sets the TreeView reference for programmatic control
   * @param treeView - The TreeView instance
   */
  public setTreeView(treeView: vscode.TreeView<WeaviateTreeItem>): void {
    this.treeView = treeView;
  }

  /**
   * Gets the parent of a tree element (required for TreeView.reveal API)
   * @param element - The tree element to get the parent for
   * @returns The parent element or undefined if it's a root element
   */
  public getParent(element: WeaviateTreeItem): vscode.ProviderResult<WeaviateTreeItem> {
    // Root level connections have no parent
    if (element.itemType === 'connection') {
      return undefined;
    }

    // For all other items, the parent is the connection
    if (element.connectionId) {
      const connection = this.connections.find((conn) => conn.id === element.connectionId);
      if (connection) {
        return new WeaviateTreeItem(
          `${connection.type === 'cloud' ? '☁️' : '🔗'} ${connection.name}`,
          vscode.TreeItemCollapsibleState.Expanded,
          'connection',
          connection.id,
          undefined, // collectionName
          undefined, // itemId
          this.getStatusIcon(connection.status),
          connection.status === 'connected' ? 'connectedConnection' : 'disconnectedConnection'
        );
      }
    }

    return undefined;
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
    vscode.commands.executeCommand(
      'setContext',
      'weaviateConnectionsEmpty',
      this.connections.length === 0
    );
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
        (col) => col.label === collectionName
      ) as CollectionWithSchema | undefined;

      if (!collection?.schema) {
        vscode.window.showErrorMessage('Could not find schema for collection');
        return;
      }

      // Create and show a webview with the detailed schema
      const panel = vscode.window.createWebviewPanel(
        'weaviateDetailedSchema',
        `Collection: ${collectionName}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
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
  private getDetailedSchemaHtml(schema: CollectionConfig): string {
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
    } else if (element.itemType === 'invertedIndex' && !element.iconPath) {
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
    } else if (element.itemType === 'modules' && !element.iconPath) {
      element.iconPath = new vscode.ThemeIcon('extensions');
      element.tooltip = 'Available Weaviate modules';
    } else if (element.itemType === 'collectionsGroup' && !element.iconPath) {
      element.iconPath = new vscode.ThemeIcon('database');
      element.tooltip = 'Collections in this instance';
    } else if (element.itemType === 'backups' && !element.iconPath) {
      element.iconPath = new vscode.ThemeIcon('archive');
      element.tooltip = 'Backups for this cluster';
    } else if (element.itemType === 'backupItem' && !element.iconPath) {
      element.iconPath = new vscode.ThemeIcon('file-zip');
      element.tooltip = 'Backup details';
    } else if (element.itemType === 'aliases' && !element.iconPath) {
      element.iconPath = new vscode.ThemeIcon('link');
      element.tooltip = 'Aliases for this cluster';
    } else if (element.itemType === 'aliasItem' && !element.iconPath) {
      element.iconPath = new vscode.ThemeIcon('symbol-reference');
      element.tooltip = 'Alias details';
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
        } else if (
          label.includes('(number)') ||
          label.includes('(int)') ||
          label.includes('(float)')
        ) {
          element.iconPath = new vscode.ThemeIcon('symbol-number');
        } else if (label.includes('(boolean)') || label.includes('(bool)')) {
          element.iconPath = new vscode.ThemeIcon('symbol-boolean');
        } else if (label.includes('(date)') || label.includes('(datetime)')) {
          element.iconPath = new vscode.ThemeIcon('calendar');
        } else {
          element.iconPath = new vscode.ThemeIcon('symbol-property');
        }
      }
      // Use the property's description as the tooltip when available
      if (!element.tooltip && element.description) {
        // Tooltip accepts string | MarkdownString | undefined. Normalize description which
        // may be boolean `true` to a string fallback (use label or empty string).
        const desc =
          typeof element.description === 'string'
            ? element.description
            : typeof element.label === 'string'
              ? element.label
              : '';
        element.tooltip = desc;
      }
    } else if (element.itemType === 'propertyItem') {
      // propertyItem is used for individual properties in the list. Mirror the same
      // treatment as 'property' so the description is available as tooltip and icons
      // are set based on the label when missing.
      if (!element.contextValue) {
        element.contextValue = 'weaviateProperty';
      }

      if (!element.iconPath) {
        const label = element.label as string;
        if (label.includes('(text)') || label.includes('(string)')) {
          element.iconPath = new vscode.ThemeIcon('symbol-text');
        } else if (
          label.includes('(number)') ||
          label.includes('(int)') ||
          label.includes('(float)')
        ) {
          element.iconPath = new vscode.ThemeIcon('symbol-number');
        } else if (label.includes('(boolean)') || label.includes('(bool)')) {
          element.iconPath = new vscode.ThemeIcon('symbol-boolean');
        } else if (label.includes('(date)') || label.includes('(datetime)')) {
          element.iconPath = new vscode.ThemeIcon('calendar');
        } else {
          element.iconPath = new vscode.ThemeIcon('symbol-property');
        }
      }

      if (!element.tooltip && element.description) {
        const desc =
          typeof element.description === 'string'
            ? element.description
            : typeof element.label === 'string'
              ? element.label
              : '';
        element.tooltip = desc;
      }
    } else if (element.itemType === 'connectionLink') {
      // Make connection links clickable
      if (element.description) {
        element.tooltip = `Click to open: ${element.description}`;
        element.command = {
          command: 'weaviate-studio.openLink',
          title: 'Open Link',
          arguments: [element.description],
        };
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
    // Helper function to map property types to icons
    const getPropertyTypeIcon = (dataType: any): vscode.ThemeIcon => {
      // Normalize dataType to string - handle both array and string formats
      let type: string;
      if (Array.isArray(dataType)) {
        type = dataType[0] || '';
      } else if (typeof dataType === 'string') {
        type = dataType;
      } else {
        type = String(dataType || '');
      }

      // Convert to lowercase for case-insensitive matching
      const typeLC = type.toLowerCase();

      if (typeLC === 'text' || typeLC === 'string') {
        return new vscode.ThemeIcon('symbol-text');
      } else if (
        typeLC === 'int' ||
        typeLC === 'number' ||
        typeLC === 'float' ||
        typeLC === 'number[]'
      ) {
        return new vscode.ThemeIcon('symbol-number');
      } else if (typeLC === 'boolean') {
        return new vscode.ThemeIcon('symbol-boolean');
      } else if (typeLC === 'date' || typeLC === 'datetime') {
        return new vscode.ThemeIcon('calendar');
      } else if (typeLC === 'object' || typeLC === 'object[]') {
        return new vscode.ThemeIcon('symbol-object');
      } else if (typeLC === 'geocoordinates') {
        return new vscode.ThemeIcon('location');
      } else if (typeLC === 'phonenumber') {
        return new vscode.ThemeIcon('device-mobile');
      } else if (typeLC === 'blob') {
        return new vscode.ThemeIcon('file-binary');
      } else {
        return new vscode.ThemeIcon('symbol-property');
      }
    };

    // No connections case
    if (this.connections.length === 0) {
      return [
        new WeaviateTreeItem(
          'No connections found. Click + to add.',
          vscode.TreeItemCollapsibleState.None,
          'message'
        ),
      ];
    }
    if (element && !element.connectionId) {
      // If no connection ID is present, we are at the root level
      throw new Error('Invalid tree item: Missing connection ID');
    }

    if (!element) {
      // Root level - show connections
      const connectionItems = this.connections.map((conn) => {
        const contextValue =
          conn.status === 'connected' ? 'weaviateConnectionActive' : 'weaviateConnection';
        const item = new WeaviateTreeItem(
          `${conn.type === 'cloud' ? '☁️' : '🔗'} ${conn.name}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'connection',
          conn.id,
          undefined, // collectionName
          undefined, // itemId
          this.getStatusIcon(conn.status),
          contextValue
        );
        // Tooltip should reflect the connection type
        const hostInfo =
          conn.type === 'cloud'
            ? conn.cloudUrl || 'cloud'
            : `${conn.httpHost || ''}${conn.httpPort ? `:${conn.httpPort}` : ''}`;
        item.tooltip = `${conn.name} (${hostInfo})\nStatus: ${conn.status}`;

        // Only expand connected clusters
        if (conn.status === 'connected') {
          item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }

        return item;
      });

      return connectionItems;
    } else if (element.itemType === 'connection' && element.connectionId) {
      // Connection level - show server info and collections
      const connection = this.connections.find((conn) => conn.id === element.connectionId);

      if (!connection || connection.status !== 'connected') {
        const message =
          connection?.status === 'connected'
            ? 'Loading...'
            : 'Not connected. Right-click and select "Connect" to view information.';

        return [
          new WeaviateTreeItem(
            message,
            vscode.TreeItemCollapsibleState.None,
            'message',
            element.connectionId
          ),
        ];
      }

      const items: WeaviateTreeItem[] = [];

      // Add cluster information section
      items.push(
        new WeaviateTreeItem(
          'Cluster Information',
          vscode.TreeItemCollapsibleState.Collapsed,
          'serverInfo',
          element.connectionId,
          undefined,
          'serverInfo',
          new vscode.ThemeIcon('dashboard'),
          'weaviateServerInfo'
        )
      );

      // Add connection links section
      const connectionData = this.connectionManager.getConnection(element.connectionId);
      const links = connectionData?.links || [];
      if (links.length > 0) {
        items.push(
          new WeaviateTreeItem(
            `Links (${links.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'connectionLinks',
            element.connectionId,
            undefined,
            'connectionLinks',
            new vscode.ThemeIcon('link'),
            'weaviateConnectionLinks'
          )
        );
      }

      // Add cluster nodes section
      const stats = this.clusterStatisticsCache[element.connectionId];
      let nodes_synchronized = stats?.synchronized ? 'Synchronized' : 'Not Synchronized';
      let nodes_count = this.clusterNodesCache[element.connectionId]?.length;
      items.push(
        new WeaviateTreeItem(
          `${nodes_count || 0} Node${nodes_count === 1 ? '' : 's'} ${nodes_synchronized}`,
          vscode.TreeItemCollapsibleState.Expanded,
          'clusterNodes',
          element.connectionId,
          undefined,
          'clusterNodes',
          new vscode.ThemeIcon('terminal-ubuntu'),
          'weaviateClusterNodes'
        )
      );

      // Add collections section
      const collections = this.collections[element.connectionId] || [];
      const collectionsLabel =
        collections.length > 0 ? `Collections (${collections.length})` : 'Collections';

      items.push(
        new WeaviateTreeItem(
          collectionsLabel,
          vscode.TreeItemCollapsibleState.Expanded,
          'collectionsGroup',
          element.connectionId,
          undefined,
          'collections',
          new vscode.ThemeIcon('database'),
          'weaviateCollectionsGroup'
        )
      );

      // Add aliases section
      const cachedAliases = this.aliasesCache[element.connectionId] || [];
      const aliasesLabel =
        cachedAliases.length > 0 ? `Aliases (${cachedAliases.length})` : 'Aliases';

      items.push(
        new WeaviateTreeItem(
          aliasesLabel,
          vscode.TreeItemCollapsibleState.Collapsed,
          'aliases',
          element.connectionId,
          undefined,
          'aliases',
          new vscode.ThemeIcon('link'),
          'weaviateAliases'
        )
      );

      // Add backups section
      // Get cached backup count if available
      const cachedBackups = this.backupsCache[element.connectionId] || [];
      const backupsLabel =
        cachedBackups.length > 0 ? `Backups (${cachedBackups.length})` : 'Backups';

      items.push(
        new WeaviateTreeItem(
          backupsLabel,
          vscode.TreeItemCollapsibleState.Collapsed,
          'backups',
          element.connectionId,
          undefined,
          'backups',
          new vscode.ThemeIcon('archive'),
          'weaviateBackups'
        )
      );

      return items;
    } else if (element.itemType === 'collectionsGroup' && element.connectionId) {
      // Collections group - show actual collections
      const collections = this.collections[element.connectionId] || [];

      if (collections.length === 0) {
        return [
          new WeaviateTreeItem(
            'No collections found. Right-click parent connection to add a collection.',
            vscode.TreeItemCollapsibleState.None,
            'message',
            element.connectionId
          ),
        ];
      }

      return collections;
    } else if (element.itemType === 'collection' && element.connectionId) {
      let collection = this.collections[element.connectionId]?.find(
        (col) => col.label === element.collectionName
      )?.schema;
      if (!collection) {
        throw new Error('Collection data not available!');
      }
      let properties = collection?.properties || [];
      let property_count = properties ? properties.length : 0;
      // Configured Vectors Count
      const vectorizers = collection.vectorizers;
      let configured_vectors_count = vectorizers ? Object.keys(vectorizers).length : 0;
      const multi_tenancy_enabled = collection?.multiTenancy.enabled;
      const items = [
        new WeaviateTreeItem(
          `Properties (${property_count})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'properties',
          element.connectionId,
          element.label,
          'properties',
          new vscode.ThemeIcon('symbol-property')
        ),
        new WeaviateTreeItem(
          `Vectors (${configured_vectors_count})`,
          configured_vectors_count
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          'vectorConfig',
          element.connectionId,
          element.label,
          'vectorConfig',
          new vscode.ThemeIcon('arrow-both')
        ),
        new WeaviateTreeItem(
          'Inverted Index',
          vscode.TreeItemCollapsibleState.Collapsed,
          'invertedIndex',
          element.connectionId,
          element.label,
          'invertedIndex',
          new vscode.ThemeIcon('search')
        ),
        new WeaviateTreeItem(
          `Generative Configuration`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'generativeConfig',
          element.connectionId,
          element.label,
          'generative',
          new vscode.ThemeIcon('lightbulb-autofix')
        ),
        new WeaviateTreeItem(
          `Reranker Configuration`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'rerankerConfig',
          element.connectionId,
          element.label,
          'reranker',
          new vscode.ThemeIcon('filter')
        ),
        new WeaviateTreeItem(
          'Replication',
          vscode.TreeItemCollapsibleState.Collapsed,
          'collectionReplication',
          element.connectionId,
          element.label,
          'replication',
          new vscode.ThemeIcon('activate-breakpoints')
        ),
        new WeaviateTreeItem(
          'Sharding',
          vscode.TreeItemCollapsibleState.Collapsed,
          'sharding',
          element.connectionId,
          element.label,
          'sharding',
          new vscode.ThemeIcon('layout')
        ),
        new WeaviateTreeItem(
          multi_tenancy_enabled ? 'Multi Tenancy' : 'Multi Tenancy (Disabled)',
          multi_tenancy_enabled
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          'multiTenancy',
          element.connectionId,
          element.label,
          'multiTenancy',
          new vscode.ThemeIcon('organization')
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
      ];
      return items;
    } else if (
      element.itemType === 'properties' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Find the collection schema
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );

      if (!collection) {
        return [
          new WeaviateTreeItem(
            'No properties available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const schema = (collection as any).schema;
      if (!schema || !schema.properties || !Array.isArray(schema.properties)) {
        return [
          new WeaviateTreeItem(
            'No properties defined',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const propertyItems = schema.properties.map((prop: any) => {
        // Normalize dataType for display
        let dataTypeDisplay: string;
        if (Array.isArray(prop.dataType)) {
          dataTypeDisplay = prop.dataType.join(' | ');
        } else {
          dataTypeDisplay = String(prop.dataType || 'unknown');
        }

        const description = prop.description ?? undefined;
        const icon = getPropertyTypeIcon(prop.dataType);

        // Check if property has nested properties (object type)
        const hasNestedProperties =
          prop.nestedProperties &&
          Array.isArray(prop.nestedProperties) &&
          prop.nestedProperties.length > 0;

        return new WeaviateTreeItem(
          `${prop.name} (${dataTypeDisplay})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'propertyItem',
          element.connectionId,
          element.collectionName,
          prop.name,
          icon,
          'weaviateProperty',
          description?.trim() ?? ''
        );
      });

      return propertyItems;
    } else if (
      element.itemType === 'propertyItem' &&
      element.connectionId &&
      element.collectionName &&
      element.itemId
    ) {
      const vectorItems: WeaviateTreeItem[] = [];
      // Find the collection schema
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );

      if (!collection) {
        return [
          new WeaviateTreeItem(
            'No properties available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      // Find the property - need to search recursively in nested properties
      const findProperty = (props: any[], propName: string): any => {
        for (const prop of props) {
          if (prop.name === propName) {
            return prop;
          }
          // Search in nested properties recursively
          if (prop.nestedProperties && Array.isArray(prop.nestedProperties)) {
            const found = findProperty(prop.nestedProperties, propName);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      const property = findProperty(collection.schema?.properties || [], element.itemId);

      if (!property) {
        return [
          new WeaviateTreeItem(
            'Property not found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      // Check if property has nested properties
      if (
        property.nestedProperties &&
        Array.isArray(property.nestedProperties) &&
        property.nestedProperties.length > 0
      ) {
        // Render nested properties
        const nestedItems = property.nestedProperties.map((nestedProp: any) => {
          // Normalize dataType for display
          let dataTypeDisplay: string;
          if (Array.isArray(nestedProp.dataType)) {
            dataTypeDisplay = nestedProp.dataType.join(' | ');
          } else {
            dataTypeDisplay = String(nestedProp.dataType || 'unknown');
          }

          const description = nestedProp.description ?? undefined;
          const icon = getPropertyTypeIcon(nestedProp.dataType);
          const hasNestedProperties =
            nestedProp.nestedProperties &&
            Array.isArray(nestedProp.nestedProperties) &&
            nestedProp.nestedProperties.length > 0;

          return new WeaviateTreeItem(
            `${nestedProp.name} (${dataTypeDisplay})`,
            hasNestedProperties
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.Collapsed,
            'propertyItem',
            element.connectionId,
            element.collectionName,
            nestedProp.name,
            icon,
            'weaviateProperty',
            description?.trim() ?? ''
          );
        });

        return nestedItems;
      }

      // Show property details (for properties without nested properties)
      for (const [key, value] of Object.entries(
        await this.flattenObject(property, ['nestedProperties'])
      )) {
        vectorItems.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'propertyItem',
            element.connectionId,
            element.collectionName,
            property.name,
            new vscode.ThemeIcon('symbol-property'),
            'weaviateProperty'
          )
        );
      }
      return vectorItems;
    } else if (
      element.itemType === 'vectorConfig' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Vector configuration section
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );

      if (!collection) {
        return [
          new WeaviateTreeItem(
            'No Vectors available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      // const vectorItems: WeaviateTreeItem[] = [];
      // const schema = collection.schema;
      // const schema_config = schema.config.get()
      // // Vectorizer info
      // if (schema?.vectorizers) {
      //     schema.vectorizers.forEach((vec: string) => {
      //         vectorItems.push(new WeaviateTreeItem(
      //             `Vectorizer: ${vec}`,
      //             vscode.TreeItemCollapsibleState.None,
      //             'object',
      //             element.connectionId,
      //             element.collectionName,
      //             'vectorizer',
      //             new vscode.ThemeIcon('gear'),
      //             'weaviateVectorConfig'
      //         ));
      //     });
      // }

      // Module config
      // if (schema?.moduleConfig) {
      //     const moduleNames = Object.keys(schema.moduleConfig);
      //     moduleNames.forEach(moduleName => {
      //         vectorItems.push(new WeaviateTreeItem(
      //             `Module: ${moduleName}`,
      //             vscode.TreeItemCollapsibleState.None,
      //             'object',
      //             element.connectionId,
      //             element.collectionName,
      //             moduleName,
      //             new vscode.ThemeIcon('extensions'),
      //             'weaviateVectorConfig'
      //         ));
      //     });
      // }

      // Vectorizers
      const vectorItems: WeaviateTreeItem[] = [];
      for (let key in collection.schema?.vectorizers) {
        let value = collection.schema?.vectorizers[key];
        vectorItems.push(
          new WeaviateTreeItem(
            `${key} - ${value.vectorizer.name}`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'vectorConfigDetail',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('list-tree'),
            'vectorConfigDetail'
          )
        );
      }

      if (vectorItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No vector configuration found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return vectorItems;
    } else if (
      element.itemType === 'generativeConfig' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Generative configuration section
      const collection = this.collections[element.connectionId]?.find(
        (col) => col.label === element.collectionName
      );
      let generativeItems: WeaviateTreeItem[] = [];
      const data = await this.flattenObject(collection?.schema?.generative || {}, [], '', false);
      Object.entries(data).forEach(([key, value]) => {
        generativeItems.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('lightbulb-autofix'),
            'generativeConfig'
          )
        );
      });
      if (generativeItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No generative configuration found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return generativeItems;
    } else if (
      element.itemType === 'rerankerConfig' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Reranker configuration section (mirror of generative)
      const collection = this.collections[element.connectionId]?.find(
        (col) => col.label === element.collectionName
      );
      let rerankerItems: WeaviateTreeItem[] = [];
      const data = await this.flattenObject(collection?.schema?.reranker || {}, [], '', false);
      Object.entries(data).forEach(([key, value]) => {
        rerankerItems.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('filter'),
            'rerankerConfig'
          )
        );
      });
      if (rerankerItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No reranker configuration found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return rerankerItems;
    } else if (
      element.itemType === 'collectionReplication' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Replication section
      const replicationItems: WeaviateTreeItem[] = [];
      const collectionReplication = this.collections[element.connectionId]?.find(
        (col) => col.label === element.collectionName
      )?.schema?.replication;

      Object.entries(collectionReplication || {}).forEach(([key, value]) => {
        replicationItems.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('activate-breakpoints'),
            'collectionReplication'
          )
        );
      });

      if (replicationItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No replication configuration found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return replicationItems;
    }
    if (
      element.itemType === 'vectorConfigDetail' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Vector configuration detail section
      const vectorItemDetails: WeaviateTreeItem[] = [];
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );

      if (!collection) {
        return [
          new WeaviateTreeItem(
            'No Vectors available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
      const vectorizer = collection.schema?.vectorizers[element.itemId || ''];
      const flattened_vectorizer = await this.flattenObject(vectorizer || {}, [], '', true);
      // for each object in vectorizer, create a tree item
      for (let key in flattened_vectorizer) {
        const value = flattened_vectorizer[key];
        vectorItemDetails.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('list-tree'),
            'vectorConfigDetail'
          )
        );
      }
      return vectorItemDetails;
    } else if (
      element.itemType === 'invertedIndex' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Indexes section
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );

      if (!collection) {
        return [
          new WeaviateTreeItem(
            'No index information available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const schema = (collection as any).schema;
      const indexItems: WeaviateTreeItem[] = [];

      // Inverted index
      const invertedIndex = await this.flattenObject(schema.invertedIndex || {}, [], '', false);
      Object.entries(invertedIndex || {}).forEach(([key, value]) => {
        indexItems.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('search'),
            'invertedIndexItem'
          )
        );
      });

      // Vector index
      if (schema?.vectorIndexConfig) {
        const vectorIndexType = schema.vectorIndexType || 'hnsw';
        indexItems.push(
          new WeaviateTreeItem(
            `Vector Index: ${vectorIndexType.toUpperCase()}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            'vectorIndex',
            new vscode.ThemeIcon('arrow-both'),
            'weaviateIndex'
          )
        );
      }

      // Property-specific indexes
      if (schema?.properties) {
        const indexedProps = schema.properties.filter((prop: any) => prop.indexInverted !== false);
        if (indexedProps.length > 0) {
          indexItems.push(
            new WeaviateTreeItem(
              `Indexed Properties: ${indexedProps.length}`,
              vscode.TreeItemCollapsibleState.None,
              'object',
              element.connectionId,
              element.collectionName,
              'indexedProperties',
              new vscode.ThemeIcon('symbol-property'),
              'weaviateIndex'
            )
          );
        }
      }

      if (indexItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No index information found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return indexItems;
    } else if (
      element.itemType === 'statistics' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Statistics section - fetch live data
      try {
        const client = this.connectionManager.getClient(element.connectionId);
        if (!client) {
          return [
            new WeaviateTreeItem(
              'Client not available',
              vscode.TreeItemCollapsibleState.None,
              'message'
            ),
          ];
        }

        const statsItems: WeaviateTreeItem[] = [];

        // Get tenant count if multi-tenancy is enabled
        const collection = this.collections[element.connectionId]?.find(
          (item) => item.label === element.collectionName
        );
        const schema = (collection as any)?.schema;
        // Get object count
        if (!schema.multiTenancy?.enabled) {
          try {
            const aggregate = await client.collections
              .get(element.collectionName)
              .aggregate.overAll();
            const count = aggregate.totalCount || 0;
            statsItems.push(
              new WeaviateTreeItem(
                `Objects: ${count.toLocaleString()}`,
                vscode.TreeItemCollapsibleState.None,
                'object',
                element.connectionId,
                element.collectionName,
                'objectCount',
                new vscode.ThemeIcon('database'),
                'weaviateStatistic'
              )
            );
          } catch (error) {
            console.warn('Could not fetch object count:', error);
            statsItems.push(
              new WeaviateTreeItem(
                'Objects: Unable to fetch',
                vscode.TreeItemCollapsibleState.None,
                'object',
                element.connectionId,
                element.collectionName,
                'objectCount',
                new vscode.ThemeIcon('database'),
                'weaviateStatistic'
              )
            );
          }
        }

        if ((schema as any)?.multiTenancy?.enabled) {
          try {
            const multiCollection = client.collections.use(element.collectionName);
            const tenants = await multiCollection.tenants.get();
            const tenantCount = Object.keys(tenants).length;
            statsItems.push(
              new WeaviateTreeItem(
                `Tenants: ${tenantCount}`,
                vscode.TreeItemCollapsibleState.None,
                'object',
                element.connectionId,
                element.collectionName,
                'tenantCount',
                new vscode.ThemeIcon('organization'),
                'weaviateStatistic'
              )
            );
          } catch (error) {
            console.warn('Could not fetch tenant count:', error);
          }
        }

        return statsItems;
      } catch (error) {
        console.error('Error fetching statistics:', error);
        return [
          new WeaviateTreeItem(
            'Error fetching statistics',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'sharding' && element.connectionId && element.collectionName) {
      // Sharding section
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );

      if (!collection) {
        return [
          new WeaviateTreeItem(
            'No sharding information available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const schema = (collection as any).schema;
      const shardingItems: WeaviateTreeItem[] = [];

      // Sharding config
      if (schema?.sharding) {
        const config = schema.sharding as ShardingConfig;
        for (const [key, value] of Object.entries(config)) {
          shardingItems.push(
            new WeaviateTreeItem(
              `${key}: ${value}`,
              vscode.TreeItemCollapsibleState.None,
              'object',
              element.connectionId,
              element.collectionName,
              key,
              new vscode.ThemeIcon('layout'),
              'weaviateSharding'
            )
          );
        }
      }

      if (shardingItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No sharding configuration found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return shardingItems;
    } else if (element.itemType === 'serverInfo' && element.connectionId) {
      // Server information section
      try {
        const serverItems: WeaviateTreeItem[] = [];
        // Get server meta information
        try {
          const meta = this.clusterMetadataCache[element.connectionId] as WeaviateMetadata;
          if (!meta) {
            throw new Error('Meta not available');
          }

          if (meta.version) {
            serverItems.push(
              new WeaviateTreeItem(
                `Version: ${meta.version}`,
                vscode.TreeItemCollapsibleState.None,
                'object',
                element.connectionId,
                undefined,
                'version',
                new vscode.ThemeIcon('tag'),
                'weaviateServerDetail'
              )
            );
          }

          if (meta.grpcMaxMessageSize) {
            serverItems.push(
              new WeaviateTreeItem(
                `gRPC Max Message Size: ${meta.grpcMaxMessageSize}`,
                vscode.TreeItemCollapsibleState.None,
                'object',
                element.connectionId,
                undefined,
                'grpcMaxMessageSize',
                new vscode.ThemeIcon('git-commit'),
                'weaviateServerDetail'
              )
            );
          }

          if (meta.hostname) {
            serverItems.push(
              new WeaviateTreeItem(
                `Hostname: ${meta.hostname}`,
                vscode.TreeItemCollapsibleState.None,
                'object',
                element.connectionId,
                undefined,
                'hostname',
                new vscode.ThemeIcon('server'),
                'weaviateServerDetail'
              )
            );
          }

          // available modules
          serverItems.push(
            new WeaviateTreeItem(
              `Available Modules (${meta.modules ? Object.keys(meta.modules).length : 0})`,
              vscode.TreeItemCollapsibleState.Collapsed,
              'modules',
              element.connectionId,
              undefined,
              'modules',
              new vscode.ThemeIcon('extensions'),
              'weaviateModules'
            )
          );
        } catch (error) {
          console.warn('Could not fetch server meta:', error);
          serverItems.push(
            new WeaviateTreeItem(
              'Unable to fetch server information',
              vscode.TreeItemCollapsibleState.None,
              'message'
            )
          );
        }

        return serverItems;
      } catch (error) {
        console.error('Error fetching server information:', error);
        return [
          new WeaviateTreeItem(
            'Error fetching server information',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'modules' && element.connectionId) {
      // Available modules section
      try {
        const client = this.connectionManager.getClient(element.connectionId);
        if (!client) {
          return [
            new WeaviateTreeItem(
              'Client not available',
              vscode.TreeItemCollapsibleState.None,
              'message'
            ),
          ];
        }

        const moduleItems: WeaviateTreeItem[] = [];

        try {
          const meta = this.clusterMetadataCache[element.connectionId] as WeaviateMetadata;

          if (meta.modules) {
            const modules = Object.keys(meta.modules);

            if (modules.length > 0) {
              modules.forEach((moduleName) => {
                const moduleInfo = meta.modules?.[moduleName];
                const version = meta.version || 'unknown';

                moduleItems.push(
                  new WeaviateTreeItem(
                    `${moduleName} (v${version})`,
                    vscode.TreeItemCollapsibleState.None,
                    'object',
                    element.connectionId,
                    undefined,
                    moduleName,
                    new vscode.ThemeIcon('extensions'),
                    'weaviateModule'
                  )
                );
              });
            } else {
              moduleItems.push(
                new WeaviateTreeItem(
                  'No modules available',
                  vscode.TreeItemCollapsibleState.None,
                  'message'
                )
              );
            }
          } else {
            moduleItems.push(
              new WeaviateTreeItem(
                'Module information not available',
                vscode.TreeItemCollapsibleState.None,
                'message'
              )
            );
          }
        } catch (error) {
          console.warn('Could not fetch modules:', error);
          moduleItems.push(
            new WeaviateTreeItem(
              'Unable to fetch module information',
              vscode.TreeItemCollapsibleState.None,
              'message'
            )
          );
        }

        return moduleItems;
      } catch (error) {
        console.error('Error fetching modules:', error);
        return [
          new WeaviateTreeItem(
            'Error fetching modules',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'clusterNodes' && element.connectionId) {
      try {
        const client = this.connectionManager.getClient(element.connectionId);
        if (!client) {
          return [
            new WeaviateTreeItem(
              'Client not available',
              vscode.TreeItemCollapsibleState.None,
              'message'
            ),
          ];
        }

        const clusterNodeItems: WeaviateTreeItem[] = [];

        try {
          const clusterNodes = this.clusterNodesCache[element.connectionId];
          if (clusterNodes && clusterNodes.length > 0) {
            clusterNodes.forEach((node) => {
              let is_leader = false;
              if (element.connectionId) {
                is_leader =
                  this.clusterStatisticsCache[element.connectionId]?.statistics[0]?.leaderId ===
                  node.name;
              }
              clusterNodeItems.push(
                new WeaviateTreeItem(
                  `${is_leader ? '👑' : '🫡'} ${node.status === 'HEALTHY' ? '🟩' : '🟥'} ${node.name} (${node.stats.objectCount} objects and ${node.stats.shardCount} shards)`,
                  vscode.TreeItemCollapsibleState.Collapsed,
                  'clusterNode',
                  element.connectionId,
                  undefined,
                  node.name,
                  new vscode.ThemeIcon('server'),
                  'weaviateClusterNode'
                )
              );
            });
          } else {
            clusterNodeItems.push(
              new WeaviateTreeItem(
                'No cluster nodes available',
                vscode.TreeItemCollapsibleState.None,
                'message'
              )
            );
          }
        } catch (error) {
          console.warn('Could not fetch cluster nodes:', error);
          clusterNodeItems.push(
            new WeaviateTreeItem(
              'Unable to fetch cluster node information',
              vscode.TreeItemCollapsibleState.None,
              'message'
            )
          );
        }
        return clusterNodeItems;
      } catch (error) {
        console.error('Error fetching cluster nodes:', error);
        return [
          new WeaviateTreeItem(
            'Error fetching cluster nodes',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'clusterNode' && element.connectionId) {
      try {
        const node = this.clusterNodesCache[element.connectionId]?.find(
          (n) => n.name === element.itemId
        );
        if (!node) {
          return [
            new WeaviateTreeItem(
              'No node details to show',
              vscode.TreeItemCollapsibleState.None,
              'message'
            ),
          ];
        }

        const nodeDetails: WeaviateTreeItem[] = [];
        const flatten_node = await this.flattenObject(node, ['shards'], '', true);

        nodeDetails.push(
          new WeaviateTreeItem(
            `Statistics`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'weaviateClusterNodeStatistics',
            element.connectionId,
            undefined,
            node.name,
            new vscode.ThemeIcon('graph'),
            'weaviateClusterNodeStatistics'
          )
        );

        // Node status except for shards key
        Object.keys(flatten_node).forEach((key) => {
          const value = flatten_node[key];

          nodeDetails.push(
            new WeaviateTreeItem(
              `${key}: ${value}`,
              vscode.TreeItemCollapsibleState.None,
              'object',
              element.connectionId,
              undefined,
              'status',
              new vscode.ThemeIcon(
                node.status === 'HEALTHY' ? 'check' : 'warning',
                new vscode.ThemeColor(
                  node.status === 'HEALTHY'
                    ? 'testing.iconPassed'
                    : 'problemsWarningIcon.foreground'
                )
              ),
              'weaviateClusterNodeDetail'
            )
          );
        });

        // Optionally, add more node details here if needed
        return nodeDetails;
      } catch (error) {
        console.error(`Error fetching node details for node ${element.label}:`, error);
        return [
          new WeaviateTreeItem(
            'Error fetching node details',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'clusterShards' && element.connectionId) {
      try {
        const shards =
          this.clusterNodesCache[element.connectionId]?.find((n) => n.name === element.label)
            ?.shards || [];
        if (!shards) {
          return [
            new WeaviateTreeItem(
              'No Shards to show',
              vscode.TreeItemCollapsibleState.None,
              'message'
            ),
          ];
        }

        const shardItems: WeaviateTreeItem[] = [];

        if (shards.length > 0) {
          shards.forEach((shard) => {
            shardItems.push(
              new WeaviateTreeItem(
                `Shard ${shard.name} - ${shard.class}`,
                vscode.TreeItemCollapsibleState.None,
                'clusterShards',
                element.connectionId,
                undefined,
                shard.name,
                new vscode.ThemeIcon('database'),
                'weaviateClusterShard'
              )
            );
          });
        } else {
          shardItems.push(
            new WeaviateTreeItem(
              'No shards available',
              vscode.TreeItemCollapsibleState.None,
              'message'
            )
          );
        }

        return shardItems;
      } catch (error) {
        console.error(`Error fetching shards for node ${element.itemId}:`, error);
        return [
          new WeaviateTreeItem(
            'Error fetching shard info',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'weaviateClusterNodeStatistics' && element.connectionId) {
      const nodeStats: WeaviateTreeItem[] = [];
      const raw_stats = element.itemId
        ? this.clusterStatisticsCache[element.connectionId]
        : undefined;
      const this_node_stats = await this.flattenObject(
        raw_stats['statistics'].find((n: any) => n.name === element.itemId)
      );
      const statistics = await this.flattenObject(this_node_stats);
      // Node status except for shards key
      Object.keys(statistics).forEach((key) => {
        const value = statistics[key];

        nodeStats.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'status',
            new vscode.ThemeIcon(
              statistics['status'] === 'HEALTHY' ? 'check' : 'warning',
              new vscode.ThemeColor(
                statistics['status'] === 'HEALTHY'
                  ? 'testing.iconPassed'
                  : 'problemsWarningIcon.foreground'
              )
            ),
            'weaviateStatusDetail'
          )
        );
      });
      return nodeStats;
    } else if (element.itemType === 'multiTenancy' && element.connectionId) {
      const collection = this.collections[element.connectionId]?.find(
        (item) => item.label === element.collectionName
      );
      const MultiTenancyItems: WeaviateTreeItem[] = [];
      const schema = collection?.schema;
      // Multi-tenancy
      if (schema?.multiTenancy) {
        for (const [key, value] of Object.entries(schema.multiTenancy)) {
          MultiTenancyItems.push(
            new WeaviateTreeItem(
              `${key}: ${value}`,
              vscode.TreeItemCollapsibleState.None,
              'object',
              element.connectionId,
              element.collectionName,
              key,
              new vscode.ThemeIcon('organization'),
              'MultiTenancy'
            )
          );
        }
      }
      return MultiTenancyItems;
    } else if (element.itemType === 'backups' && element.connectionId) {
      // Backups section - fetch backups from all backends
      const client = this.connectionManager.getClient(element.connectionId);
      if (!client) {
        return [
          new WeaviateTreeItem(
            'Client not available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const backupItems: WeaviateTreeItem[] = [];

      // Get available backup modules from cluster metadata
      const meta = this.clusterMetadataCache[element.connectionId];
      const availableBackends: ('filesystem' | 's3' | 'gcs' | 'azure')[] = [];
      let hasBackupModule = false;

      if (meta?.modules) {
        const moduleNames = Object.keys(meta.modules);

        // Map module names to backend types
        if (moduleNames.includes('backup-filesystem')) {
          availableBackends.push('filesystem');
          hasBackupModule = true;
        }
        if (moduleNames.includes('backup-s3')) {
          availableBackends.push('s3');
          hasBackupModule = true;
        }
        if (moduleNames.includes('backup-gcs')) {
          availableBackends.push('gcs');
          hasBackupModule = true;
        }
        if (moduleNames.includes('backup-azure')) {
          availableBackends.push('azure');
          hasBackupModule = true;
        }
      }

      // If no backup modules found, show a helpful message
      if (!hasBackupModule) {
        const noModuleItem = new WeaviateTreeItem(
          'Backup module not found. Click to learn more.',
          vscode.TreeItemCollapsibleState.None,
          'message',
          element.connectionId,
          undefined,
          'noBackupModule',
          new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground')),
          'weaviateNoBackupModule'
        );

        // Make it clickable to open documentation
        noModuleItem.tooltip = 'Click to open backup configuration documentation';
        noModuleItem.command = {
          command: 'weaviate-studio.openLink',
          title: 'Open Backup Documentation',
          arguments: ['https://docs.weaviate.io/deploy/configuration/backups'],
        };

        return [noModuleItem];
      }

      try {
        // Fetch backups only from available backends in parallel
        const backupPromises = availableBackends.map(async (backend) => {
          try {
            const backups = await client.backup.list(backend);
            return { backend, backups };
          } catch (error) {
            // Backend might not be configured, that's okay
            return { backend, backups: [] };
          }
        });

        const results = await Promise.all(backupPromises);
        let totalBackups = 0;

        // Collect all backups and store in cache
        const allBackups: BackupItem[] = [];
        results.forEach(({ backend, backups }) => {
          backups.forEach((backup: any) => {
            // Calculate duration if startedAt and completedAt are present
            let duration = undefined;
            if (backup.startedAt && backup.completedAt) {
              duration = this.humanizeDuration(backup.startedAt, backup.completedAt);
            }
            allBackups.push({ ...backup, backend, duration });
            totalBackups++;
          });
        });

        this.backupsCache[element.connectionId] = allBackups;

        // Create tree items for each backup
        allBackups.forEach((backup) => {
          const statusIcon =
            backup.status === 'SUCCESS'
              ? 'check'
              : backup.status === 'FAILED'
                ? 'error'
                : backup.status === 'CANCELED'
                  ? 'circle-slash'
                  : 'sync~spin';

          const statusColor =
            backup.status === 'SUCCESS'
              ? 'testing.iconPassed'
              : backup.status === 'FAILED'
                ? 'testing.iconFailed'
                : backup.status === 'CANCELED'
                  ? 'problemsWarningIcon.foreground'
                  : 'foreground';

          // Use precalculated duration from cache
          let descriptionText = '';

          // Add collections count if available
          if (backup.classes && Array.isArray(backup.classes) && backup.classes.length > 0) {
            descriptionText = `${backup.classes.length} collection${backup.classes.length !== 1 ? 's' : ''}`;
          }

          // Add duration if available
          if (backup.duration) {
            if (descriptionText) {
              descriptionText += ` (took ${backup.duration})`;
            } else {
              descriptionText = `took ${backup.duration}`;
            }
          }

          // Set contextValue based on backup status
          const contextValueMap: Record<string, string> = {
            SUCCESS: 'weaviateBackupSuccess',
            FAILED: 'weaviateBackupFailed',
            CANCELED: 'weaviateBackupCanceled',
            STARTED: 'weaviateBackupInProgress',
            TRANSFERRING: 'weaviateBackupInProgress',
          };
          const contextValue = contextValueMap[backup.status] || 'weaviateBackup';

          backupItems.push(
            new WeaviateTreeItem(
              `${backup.id}`,
              vscode.TreeItemCollapsibleState.Collapsed,
              'backupItem',
              element.connectionId,
              undefined,
              backup.id,
              new vscode.ThemeIcon(statusIcon, new vscode.ThemeColor(statusColor)),
              contextValue,
              descriptionText
            )
          );
        });

        if (backupItems.length === 0) {
          return [
            new WeaviateTreeItem(
              'No backups found',
              vscode.TreeItemCollapsibleState.None,
              'message'
            ),
          ];
        }

        return backupItems;
      } catch (error) {
        console.error('Error fetching backups:', error);
        return [
          new WeaviateTreeItem(
            'Error fetching backups',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }
    } else if (element.itemType === 'aliases' && element.connectionId) {
      // Aliases section - use cached data, don't fetch on expand
      const allAliases = this.aliasesCache[element.connectionId] || [];

      if (allAliases.length === 0) {
        return [
          new WeaviateTreeItem('No aliases found', vscode.TreeItemCollapsibleState.None, 'message'),
        ];
      }

      // Sort aliases by alias name, then by collection name
      const sortedAliases = [...allAliases].sort((a, b) => {
        const aliasCompare = a.alias.localeCompare(b.alias);
        if (aliasCompare !== 0) {
          return aliasCompare;
        }
        return a.collection.localeCompare(b.collection);
      });

      // Create tree items for each alias
      const aliasItems: WeaviateTreeItem[] = sortedAliases.map((aliasItem) => {
        const aliasTreeItem = new WeaviateTreeItem(
          aliasItem.alias,
          vscode.TreeItemCollapsibleState.None,
          'aliasItem',
          element.connectionId,
          undefined,
          aliasItem.alias,
          new vscode.ThemeIcon('symbol-reference'),
          'weaviateAliasItem',
          `→ ${aliasItem.collection}`
        );

        // Add tooltip with full information
        aliasTreeItem.tooltip = `Alias: ${aliasItem.alias}\nTarget Collection: ${aliasItem.collection}`;

        return aliasTreeItem;
      });

      return aliasItems;
    } else if (element.itemType === 'backupItem' && element.connectionId && element.itemId) {
      // Backup item details - show detailed information about a specific backup
      const backups = this.backupsCache[element.connectionId] || [];
      const backup = backups.find((b) => b.id === element.itemId);

      if (!backup) {
        return [
          new WeaviateTreeItem(
            'Backup details not available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const backupDetailItems: WeaviateTreeItem[] = [];

      // Backend
      backupDetailItems.push(
        new WeaviateTreeItem(
          `Backend: ${backup.backend}`,
          vscode.TreeItemCollapsibleState.None,
          'object',
          element.connectionId,
          undefined,
          'backend',
          new vscode.ThemeIcon('server-environment')
        )
      );

      // Status
      backupDetailItems.push(
        new WeaviateTreeItem(
          `Status: ${backup.status}`,
          vscode.TreeItemCollapsibleState.None,
          'object',
          element.connectionId,
          undefined,
          'status',
          new vscode.ThemeIcon('info')
        )
      );

      // Collections count
      if (backup.classes && Array.isArray(backup.classes)) {
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Collections: ${backup.classes.length}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'collectionsCount',
            new vscode.ThemeIcon('database')
          )
        );
      }

      // Started At
      if (backup.startedAt) {
        const startedDate = new Date(backup.startedAt);
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Started: ${startedDate.toLocaleString()}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'startedAt',
            new vscode.ThemeIcon('clock')
          )
        );
      }

      // Completed At
      if (backup.completedAt) {
        const completedDate = new Date(backup.completedAt);
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Completed: ${completedDate.toLocaleString()}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'completedAt',
            new vscode.ThemeIcon('check')
          )
        );
      }

      // Duration (if available)
      if (backup.duration) {
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Duration: ${backup.duration}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'duration',
            new vscode.ThemeIcon('watch')
          )
        );
      }

      // Path
      if (backup.path) {
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Path: ${backup.path}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'path',
            new vscode.ThemeIcon('folder')
          )
        );
      }

      // Error (if any)
      if (backup.error) {
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Error: ${backup.error}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'error',
            new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'))
          )
        );
      }

      // Collections
      if (backup.collections && backup.collections.length > 0) {
        backupDetailItems.push(
          new WeaviateTreeItem(
            `Collections (${backup.collections.length})`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            undefined,
            'collections',
            new vscode.ThemeIcon('database')
          )
        );

        // List each collection
        backup.collections.forEach((collectionName: string) => {
          backupDetailItems.push(
            new WeaviateTreeItem(
              `  • ${collectionName}`,
              vscode.TreeItemCollapsibleState.None,
              'object',
              element.connectionId,
              undefined,
              collectionName,
              new vscode.ThemeIcon('symbol-class')
            )
          );
        });
      }

      return backupDetailItems;
    } else if (element.itemType === 'connectionLinks' && element.connectionId) {
      // Show individual connection links
      const connectionData = this.connectionManager.getConnection(element.connectionId);
      const links = connectionData?.links || [];

      const linkItems: WeaviateTreeItem[] = [];

      links.forEach((link, index) => {
        linkItems.push(
          new WeaviateTreeItem(
            link.name,
            vscode.TreeItemCollapsibleState.None,
            'connectionLink',
            element.connectionId,
            undefined,
            index.toString(),
            new vscode.ThemeIcon('link-external'),
            'weaviateConnectionLink',
            link.url
          )
        );
      });

      if (linkItems.length === 0) {
        return [
          new WeaviateTreeItem(
            'No links available',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      return linkItems;
    }
    return [];
  }

  // --- Connection Management Methods ---

  // Add a new connection
  async addConnection(connectionDetails?: WeaviateConnection): Promise<WeaviateConnection | null> {
    try {
      if (!connectionDetails) {
        // If no details provided, show the dialog
        const result = await this.connectionManager.showAddConnectionDialog();

        // Check if we should auto-connect
        if (result?.shouldConnect) {
          await this.connect(result.connection.id);
        }

        return result?.connection || null;
      }

      // Validate connection details
      if (!connectionDetails.name || !connectionDetails.httpHost) {
        throw new Error('Name and HTTP host are required');
      }
      // Add the connection with required fields
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
        const connectionIndex = this.connections.findIndex((c) => c.id === connectionId);
        if (connectionIndex >= 0) {
          this.connections[connectionIndex].status = 'connected';

          // Fire tree change event to update connection state right away
          // This makes the connection item rerender with 'connected' status icon
          this._onDidChangeTreeData.fire();

          // Auto-expand the connection tree item if TreeView is available
          if (this.treeView) {
            const connectionItem = new WeaviateTreeItem(
              `${connection.type === 'cloud' ? '☁️' : '🔗'} ${connection.name}`,
              vscode.TreeItemCollapsibleState.Expanded,
              'connection',
              connection.id,
              undefined, // collectionName
              undefined, // itemId
              this.getStatusIcon(connection.status),
              'connectedConnection'
            );

            // Use setTimeout to ensure the tree has been updated before revealing
            setTimeout(() => {
              this.treeView?.reveal(connectionItem, { expand: true });
            }, 100);
          }
        }

        // Only fetch collections if we're not in a refresh loop
        if (!this.isRefreshing) {
          await this.fetchData(connectionId);
        }

        // Auto-open cluster view by default (unless explicitly disabled)
        if (connection.openClusterViewOnConnect !== false && !silent) {
          vscode.commands.executeCommand('weaviate.viewClusterInfo', { connectionId });
        }

        // Do not auto-open the query editor on connect. Let the user open it
        // explicitly from a collection to ensure a valid context/connection.

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
    const connection = this.connections.find((c) => c.id === connectionId);
    if (connection) {
      await this.connectionManager.disconnect(connectionId);
      // Clear collections for this connection
      delete this.collections[connectionId];
      // Close cluster panel if it's open for this connection
      ClusterPanel.closeForConnection(connectionId);
      // Refresh connections and update tree view
      this.connections = this.connectionManager.getConnections();
      this.refresh();
      vscode.window.showInformationMessage(`Disconnected from ${connection.name}`);
    }
  }

  // Edit a connection
  async editConnection(
    connectionId: string,
    updates?: { name: string; url: string; apiKey?: string }
  ): Promise<void> {
    try {
      if (updates) {
        // If updates are provided, apply them directly
        await this.connectionManager.updateConnection(connectionId, updates);
        this.refresh();
        vscode.window.showInformationMessage('Connection updated successfully');
      } else {
        // Show the edit dialog
        const result = await this.connectionManager.showEditConnectionDialog(connectionId);
        if (result) {
          this.refresh();
          vscode.window.showInformationMessage('Connection updated successfully');

          // Check if we should auto-connect
          if (result.shouldConnect) {
            await this.connect(result.connection.id);
          }
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
    return this.connections.find((c) => c.id === connectionId);
  }

  // Get the connection manager (for debugging purposes)
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get backup details by connection ID and backup ID
   * @param connectionId - The ID of the connection
   * @param backupId - The ID of the backup
   * @returns The backup details or undefined if not found
   */
  getBackupDetails(connectionId: string, backupId: string): any {
    const backups = this.backupsCache[connectionId] || [];
    return backups.find((b) => b.id === backupId);
  }

  // --- Data Fetch Methods ---

  /**
   * Fetches server statistics for a connection
   * @param connectionId - The ID of the connection
   */
  async fetchServerStatistics(connectionId: string): Promise<void> {
    try {
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Get stats from server
      // use direct request as the client does not support this endpoint yet
      const clusterStats = await this.fetchClusterStatistics(
        {
          httpSecure: connection.httpSecure ?? false,
          httpHost: connection.httpHost ?? '',
          httpPort: connection.httpPort ?? 8080,
          apiKey: connection.apiKey,
          cloudUrl: connection.cloudUrl ?? '',
          type: connection.type ?? 'local',
        },
        connectionId
      );
      // map the the result per node name
      let clusterStatsMapped: { [key: string]: any } = {};
      if (clusterStats) {
        try {
          const statsJson = JSON.parse(clusterStats);
          // Map the stats to the clusterStatsMapped object
          for (const [nodeName, nodeStats] of Object.entries(statsJson)) {
            clusterStatsMapped[nodeName] = nodeStats;
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to parse cluster stats: ${errorMessage}`);
        }
      }
      this.clusterStatisticsCache[connectionId] = clusterStatsMapped;

      // Refresh the tree view
      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in fetchServerStatistics:', error);
      vscode.window.showErrorMessage(`Failed to fetch server statistics: ${errorMessage}`);
    }
  }

  /**
   * Fetches metadata for a connection
   * @param connectionId - The ID of the connection
   */
  async fetchMetadata(connectionId: string): Promise<void> {
    try {
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        throw new Error('Client not initialized');
      }

      // Get metaData from Weaviate
      const metaData = await client.getMeta();
      this.clusterMetadataCache[connectionId] = metaData;

      // Refresh the tree view
      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in fetchMetadata:', error);
      vscode.window.showErrorMessage(`Failed to fetch metadata: ${errorMessage}`);
    }
  }

  /**
   * Fetches cluster nodes for a connection
   * @param connectionId - The ID of the connection
   */
  async fetchNodes(connectionId: string): Promise<void> {
    try {
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        throw new Error('Client not initialized');
      }

      // Get Nodes from Weaviate
      const clusterNodes = await client.cluster.nodes({ output: 'verbose' });
      this.clusterNodesCache[connectionId] = clusterNodes;

      // Refresh the tree view
      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in fetchNodes:', error);
      vscode.window.showErrorMessage(`Failed to fetch cluster nodes: ${errorMessage}`);
    }
  }

  /**
   * Fetches collections for a connection
   * @param connectionId - The ID of the connection
   */
  async fetchCollectionsData(connectionId: string): Promise<void> {
    try {
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        throw new Error('Client not initialized');
      }

      // Get collections from Weaviate
      const collections = await client.collections.listAll();
      // Store collections with their schema
      if (collections && Array.isArray(collections)) {
        // sort collections alphabetically by name
        this.collections[connectionId] = collections
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (collection) =>
              ({
                label: collection.name,
                description: collection.description,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                itemType: 'collection',
                connectionId: connectionId,
                collectionName: collection.name,
                iconPath: new vscode.ThemeIcon('database'),
                contextValue: 'weaviateCollection',
                tooltip: collection.description,
                schema: collection,
              }) as unknown as CollectionWithSchema
          );
      } else {
        this.collections[connectionId] = [];
      }

      // Refresh the tree view
      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in fetchCollectionsData:', error);
      vscode.window.showErrorMessage(`Failed to fetch collections: ${errorMessage}`);
    }
  }

  /**
   * Fetches all data (collections, stats, metadata, nodes, and backups) for a connection
   * @param connectionId - The ID of the connection
   */
  async fetchData(connectionId: string): Promise<void> {
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

      // Fetch all data in parallel for better performance
      await Promise.all([
        this.fetchServerStatistics(connectionId),
        this.fetchMetadata(connectionId),
        this.fetchNodes(connectionId),
        this.fetchCollectionsData(connectionId),
        this.fetchAliases(connectionId),
      ]);

      // Fetch backups in the background to populate cache for count display
      this.fetchBackups(connectionId).catch((error: unknown) => {
        console.warn('Error fetching backups (non-critical):', error);
      });

      // Refresh the tree view to show updated data
      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in fetchData:', error);
      vscode.window.showErrorMessage(`Failed to fetch data: ${errorMessage}`);
    }
  }

  /**
   * Fetches backups from all backends and populates the cache
   * @param connectionId - The ID of the connection
   */
  private async fetchBackups(connectionId: string): Promise<void> {
    const client = this.connectionManager.getClient(connectionId);
    if (!client) {
      return;
    }

    // Get available backup modules from cluster metadata
    const meta = this.clusterMetadataCache[connectionId];
    const availableBackends: ('filesystem' | 's3' | 'gcs' | 'azure')[] = [];
    let hasBackupModule = false;

    if (meta?.modules) {
      const moduleNames = Object.keys(meta.modules);

      // Map module names to backend types
      if (moduleNames.includes('backup-filesystem')) {
        availableBackends.push('filesystem');
        hasBackupModule = true;
      }
      if (moduleNames.includes('backup-s3')) {
        availableBackends.push('s3');
        hasBackupModule = true;
      }
      if (moduleNames.includes('backup-gcs')) {
        availableBackends.push('gcs');
        hasBackupModule = true;
      }
      if (moduleNames.includes('backup-azure')) {
        availableBackends.push('azure');
        hasBackupModule = true;
      }
    }

    // If no backup modules found, set empty cache and return
    if (!hasBackupModule) {
      this.backupsCache[connectionId] = [];
      return;
    }

    try {
      // Fetch backups only from available backends in parallel
      const backupPromises = availableBackends.map(async (backend) => {
        try {
          const backups = await client.backup.list(backend);
          return { backend, backups };
        } catch (error) {
          // Backend might not be configured, that's okay
          return { backend, backups: [] };
        }
      });

      const results = await Promise.all(backupPromises);

      // Collect all backups and store in cache
      const allBackups: BackupItem[] = [];
      results.forEach(({ backend, backups }) => {
        backups.forEach((backup: any) => {
          // Calculate duration if startedAt and completedAt are present
          let duration = undefined;
          if (backup.startedAt && backup.completedAt) {
            duration = this.humanizeDuration(backup.startedAt, backup.completedAt);
          }
          allBackups.push({ ...backup, backend, duration });
        });
      });

      this.backupsCache[connectionId] = allBackups;

      // Refresh tree to update the count
      this.refresh();
    } catch (error) {
      console.error('Error fetching backups:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Refreshes backups for a connection (public method that can be called from UI)
   * @param connectionId - The ID of the connection
   */
  async refreshBackups(connectionId: string): Promise<void> {
    try {
      await this.fetchBackups(connectionId);
      vscode.window.showInformationMessage('Backups refreshed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Show notification even on error
      vscode.window.showWarningMessage(`Backups refresh completed with issues: ${errorMessage}`);
    }
  }

  /**
   * Refreshes aliases for a connection (public method that can be called from UI)
   * @param connectionId - The ID of the connection
   */
  async refreshAliases(connectionId: string, reveal: boolean = false): Promise<void> {
    try {
      // Fetch fresh data from server
      await this.fetchAliases(connectionId);
      // Trigger refresh - fire entire tree to ensure parent connection updates the label
      this.refresh();

      // Add a small delay to ensure the refresh completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reveal and expand the Aliases item if requested
      if (reveal && this.treeView) {
        // Use setTimeout to ensure the tree has been updated before revealing
        setTimeout(async () => {
          // First, ensure the connection is expanded
          const connection = this.connections.find((conn) => conn.id === connectionId);
          if (connection) {
            const connectionItem = new WeaviateTreeItem(
              `${connection.type === 'cloud' ? '☁️' : '🔗'} ${connection.name}`,
              vscode.TreeItemCollapsibleState.Expanded,
              'connection',
              connection.id,
              undefined,
              undefined,
              this.getStatusIcon(connection.status),
              connection.status === 'connected' ? 'connectedConnection' : 'disconnectedConnection'
            );

            // Expand the connection first
            await this.treeView?.reveal(connectionItem, { expand: true });

            // Then reveal and expand the Aliases item
            const cachedAliases = this.aliasesCache[connectionId] || [];
            const aliasesLabel =
              cachedAliases.length > 0 ? `Aliases (${cachedAliases.length})` : 'Aliases';

            const aliasesTreeItem = new WeaviateTreeItem(
              aliasesLabel,
              vscode.TreeItemCollapsibleState.Expanded,
              'aliases',
              connectionId,
              undefined,
              'aliases',
              new vscode.ThemeIcon('link'),
              'weaviateAliases'
            );

            // Small delay to ensure connection is expanded first
            setTimeout(() => {
              this.treeView?.reveal(aliasesTreeItem, { expand: true, select: false, focus: false });
            }, 100);
          }
        }, 100);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing aliases:', error);
      vscode.window.showErrorMessage(`Failed to refresh aliases: ${errorMessage}`);
    }
  }

  /**
   * Fetches aliases and populates the cache
   * @param connectionId - The ID of the connection
   */
  private async fetchAliases(connectionId: string): Promise<void> {
    const client = this.connectionManager.getClient(connectionId);
    if (!client) {
      return;
    }

    try {
      // Fetch all aliases
      const aliasesResponse = await client.alias.listAll();
      const allAliases: AliasItem[] = aliasesResponse
        ? (aliasesResponse as any[]).map((aliasObj: any) => ({
            alias: aliasObj.alias,
            collection: aliasObj.collection,
          }))
        : [];

      // Sort aliases by alias name, then by collection name before caching
      const sortedAliases = allAliases.sort((a, b) => {
        const aliasCompare = a.alias.localeCompare(b.alias);
        if (aliasCompare !== 0) {
          return aliasCompare;
        }
        return a.collection.localeCompare(b.collection);
      });

      // Store sorted aliases in cache
      this.aliasesCache[connectionId] = sortedAliases;
    } catch (error) {
      console.error('Error fetching aliases:', error);
      // On error, keep existing cache or set empty array
      if (!this.aliasesCache[connectionId]) {
        this.aliasesCache[connectionId] = [];
      }
    }
  }

  /**
   * Refreshes collections for a connection (public method that can be called from UI)
   * @param connectionId - The ID of the connection
   */
  async refreshCollections(connectionId: string, silent: boolean = false): Promise<void> {
    try {
      await this.fetchCollectionsData(connectionId);
      if (!silent) {
        vscode.window.showInformationMessage('Collections refreshed successfully');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing collections:', error);
      throw new Error(`Failed to refresh collections: ${errorMessage}`);
    }
  }

  /**
   * Refreshes cluster nodes for a connection (public method that can be called from UI)
   * @param connectionId - The ID of the connection
   */
  async refreshNodes(connectionId: string): Promise<void> {
    try {
      await this.fetchNodes(connectionId);
      vscode.window.showInformationMessage('Nodes refreshed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing nodes:', error);
      throw new Error(`Failed to refresh nodes: ${errorMessage}`);
    }
  }

  /**
   * Refreshes metadata for a connection (public method that can be called from UI)
   * @param connectionId - The ID of the connection
   */
  async refreshMetadata(connectionId: string): Promise<void> {
    try {
      await this.fetchMetadata(connectionId);
      vscode.window.showInformationMessage('Metadata refreshed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing metadata:', error);
      throw new Error(`Failed to refresh metadata: ${errorMessage}`);
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
      await client.collections.delete(collectionName);

      // Update local state
      if (this.collections[connectionId]) {
        this.collections[connectionId] = this.collections[connectionId].filter(
          (collection) => collection.collectionName !== collectionName
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
   * Deletes all collections from the Weaviate instance
   * @param connectionId - The ID of the connection
   * @throws Error if deletion fails
   */
  async deleteAllCollections(connectionId: string): Promise<void> {
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

      // Delete all collections using the collections API
      await client.collections.deleteAll();

      // Clear local collections state
      this.collections[connectionId] = [];

      // Refresh the tree view
      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error in deleteAllCollections:', error);
      throw new Error(`Failed to delete all collections: ${errorMessage}`);
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

      // Refresh server statistics first
      await this.fetchServerStatistics(connectionId);

      // Call public refresh methods sequentially to show individual toasts
      await this.refreshMetadata(connectionId).catch(() => {});
      await this.refreshNodes(connectionId).catch(() => {});
      await this.refreshCollections(connectionId).catch(() => {});
      await this.refreshBackups(connectionId).catch(() => {});

      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
   * Converts a raw Weaviate schema to a properly formatted API schema
   * @param schema - The raw schema from Weaviate
   * @returns The formatted schema ready for API consumption
   */
  private convertSchemaToApiFormat(schema: any): any {
    // Helper function to recursively process properties and nested properties
    const processProperty = (prop: any): any => {
      const dataType = Array.isArray(prop?.dataType)
        ? prop.dataType
        : [prop?.dataType].filter(Boolean);

      const { vectorizerConfig, indexInverted, ...rest } = prop || {};
      const converted: any = {
        ...rest,
        dataType,
      };

      if (vectorizerConfig) {
        converted.moduleConfig = vectorizerConfig;
      }

      // If tokenization explicitly 'none', omit it
      if (converted.tokenization === 'none') {
        delete converted.tokenization;
      }

      // Recursively process nested properties for object types
      if (converted.nestedProperties && Array.isArray(converted.nestedProperties)) {
        converted.nestedProperties = converted.nestedProperties.map(processProperty);
      }

      return converted;
    };

    // Convert properties to request format: ensure dataType is array, move vectorizerConfig -> moduleConfig, drop indexInverted
    const fixed_properties = (schema.properties || []).map(processProperty);

    // Convert vectorizers -> vectorConfig with proper index mapping
    const fixed_vectorConfig = schema.vectorizers
      ? Object.fromEntries(
          Object.entries(schema.vectorizers).map(([key, vec]: [string, any]) => {
            // vectorizer
            const vectorizerName = vec?.vectorizer?.name || 'none';
            const vCfg: any = { ...(vec?.vectorizer?.config || {}) };
            // rename vectorizeCollectionName -> vectorizeClassName if present
            if (vCfg.vectorizeCollectionName !== undefined) {
              vCfg.vectorizeClassName = vCfg.vectorizeCollectionName;
              delete vCfg.vectorizeCollectionName;
            }
            // attach properties if present at this level
            if (Array.isArray(vec?.properties) && vec.properties.length > 0) {
              vCfg.properties = vec.properties;
            }

            // index type and config
            const vectorIndexType = vec?.indexType || vec?.indexConfig?.type || 'hnsw';
            const vectorIndexConfig: any = {};
            const srcIdx = vec?.indexConfig || {};

            // top-level distance
            if (srcIdx.distance) {
              vectorIndexConfig.distanceMetric = srcIdx.distance;
            }
            if (srcIdx.threshold !== undefined) {
              vectorIndexConfig.threshold = srcIdx.threshold;
            }
            if (srcIdx.skip !== undefined) {
              vectorIndexConfig.skip = srcIdx.skip;
            }

            // hnsw - check both nested structure and flat structure
            if (srcIdx.hnsw) {
              // Nested structure: indexConfig.hnsw contains the config
              const h: any = { ...srcIdx.hnsw };
              if (h.distance) {
                h.distanceMetric = h.distance;
                delete h.distance;
              }
              if (h.quantizer) {
                const q = h.quantizer;
                if (q.type === 'pq') {
                  h.pq = {
                    enabled: true,
                    internalBitCompression: q.bitCompression || false,
                    segments: q.segments,
                    centroids: q.centroids,
                    trainingLimit: q.trainingLimit,
                    encoder: q.encoder,
                  };
                } else if (q.type === 'rq') {
                  h.rq = {
                    enabled: true,
                    bits: q.bits,
                    rescoreLimit: q.rescoreLimit,
                  };
                }
                delete h.quantizer;
              }
              if (h.type) {
                delete h.type;
              }
              vectorIndexConfig.hnsw = h;
            } else if (vectorIndexType === 'hnsw' && Object.keys(srcIdx).length > 0) {
              // Flat structure: all HNSW properties are directly in indexConfig
              const h: any = { ...srcIdx };

              // Remove fields that are not part of HNSW config
              delete h.type;

              if (h.distance) {
                h.distanceMetric = h.distance;
                delete h.distance;
              }

              // Handle quantizer if present
              if (h.quantizer) {
                const q = h.quantizer;
                if (q.type === 'pq') {
                  h.pq = {
                    enabled: true,
                    internalBitCompression: q.bitCompression || false,
                    segments: q.segments,
                    centroids: q.centroids,
                    trainingLimit: q.trainingLimit,
                    encoder: q.encoder,
                  };
                } else if (q.type === 'rq') {
                  h.rq = {
                    enabled: true,
                    bits: q.bits,
                    rescoreLimit: q.rescoreLimit,
                  };
                }
                delete h.quantizer;
              }

              // Only add to vectorIndexConfig if there are actual config values
              if (Object.keys(h).length > 0) {
                vectorIndexConfig.hnsw = h;
              }
            }

            // flat
            if (srcIdx.flat) {
              const f: any = { ...srcIdx.flat };
              if (f.distance) {
                f.distanceMetric = f.distance;
                delete f.distance;
              }
              if (f.quantizer) {
                const q = f.quantizer;
                if (q.type === 'bq') {
                  f.bq = {
                    enabled: true,
                    cache: q.cache || false,
                    rescoreLimit: q.rescoreLimit ?? -1,
                  };
                }
                delete f.quantizer;
              }
              if (f.type) {
                delete f.type;
              }
              vectorIndexConfig.flat = f;
            }

            return [
              key,
              {
                vectorizer: { [vectorizerName]: vCfg },
                vectorIndexType,
                vectorIndexConfig,
              },
            ];
          })
        )
      : undefined;

    // Build final API schema from scratch (no spread) to avoid server-only fields
    const apiSchema: any = {
      class: schema.name,
      properties: fixed_properties,
    };

    // Add description if it exists
    if (schema.description) {
      apiSchema.description = schema.description;
    }

    if (schema.invertedIndex) {
      apiSchema.invertedIndexConfig = schema.invertedIndex;
    }
    if (schema.multiTenancy) {
      apiSchema.multiTenancyConfig = schema.multiTenancy;
    }
    if (schema.replication) {
      apiSchema.replicationConfig = schema.replication;
    }
    if (schema.sharding) {
      const { actualCount, actualVirtualCount, ...shardingConfig } = schema.sharding;
      apiSchema.shardingConfig = shardingConfig;
    }
    if (fixed_vectorConfig) {
      apiSchema.vectorConfig = fixed_vectorConfig;
    }
    if (schema.generative) {
      apiSchema.moduleConfig = schema.generative;
    }

    return apiSchema;
  }

  /**
   * Exports a collection schema to a file
   * @param connectionId - The ID of the connection
   * @param collectionName - The name of the collection to export
   */
  async exportSchema(connectionId: string, collectionName: string): Promise<void> {
    try {
      // Get the Weaviate client
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${collectionName}_weaviate_schema.json`),
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*'],
        },
      });

      if (!saveUri) {
        return; // User cancelled
      }

      // Export collection using client.collections.export() and convert to API format
      const exportedSchema = await client.collections.export(collectionName);
      const apiSchema = this.convertSchemaToApiFormat(exportedSchema);
      const schemaJson = JSON.stringify(apiSchema, null, 2);
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(schemaJson, 'utf8'));

      console.log(`Collection "${collectionName}" exported successfully to ${saveUri.fsPath}`);
      vscode.window.showInformationMessage(`Schema exported to ${saveUri.fsPath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error exporting schema:', error);
      throw new Error(`Failed to export schema: ${errorMessage}`);
    }
  }

  /**
   * Shows the Add Collection dialog for creating a new collection
   * @param connectionId - The ID of the connection to add the collection to
   */
  /**
   * Shows the Add Collection dialog for creating a new collection
   * @param connectionId - The ID of the connection to add the collection to
   * @param initialSchema - Optional initial schema to pre-populate the form
   */
  async addCollection(connectionId: string, initialSchema?: any): Promise<void> {
    // Validate connection first - these errors should not be caught and re-wrapped
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.status !== 'connected') {
      throw new Error('Connection must be active to add collections');
    }

    try {
      // Create the panel with callbacks
      const panel = AddCollectionPanel.createOrShow(
        this.context.extensionUri,
        async (schema: any) => {
          // On create callback
          await this.createCollection(connectionId, schema);
          await this.fetchData(connectionId);
        },
        async (message: any, postMessage: (msg: any) => void) => {
          // On message callback for handling webview requests
          switch (message.command) {
            case 'getVectorizers':
              try {
                const vectorizers = await this.getAvailableVectorizers(connectionId);
                const modules = this.clusterMetadataCache[connectionId]?.modules || {};
                postMessage({
                  command: 'vectorizers',
                  vectorizers: vectorizers,
                  modules: modules,
                });

                // Also send server version
                const version = this.clusterMetadataCache[connectionId]?.version;
                postMessage({
                  command: 'serverVersion',
                  version: version || 'unknown',
                });

                // Send the number of nodes
                const nodesNumber = this.clusterNodesCache[connectionId]?.length || 1;
                postMessage({
                  command: 'nodesNumber',
                  nodesNumber: nodesNumber,
                });
              } catch (error) {
                postMessage({
                  command: 'error',
                  message: `Failed to fetch vectorizers: ${error instanceof Error ? error.message : String(error)}`,
                });
              }
              break;
            case 'getCollections':
              try {
                const collections = this.collections[connectionId] || [];
                postMessage({
                  command: 'collections',
                  collections: collections.map((col) => col.label),
                });
              } catch (error) {
                postMessage({
                  command: 'error',
                  message: `Failed to fetch collections: ${error instanceof Error ? error.message : String(error)}`,
                });
              }
              break;
          }
        },
        initialSchema
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error showing add collection dialog:', error);
      throw new Error(`Failed to show add collection dialog: ${errorMessage}`);
    }
  }

  /**
   * Shows the Add Collection with Options dialog for creating a new collection
   * @param connectionId - The ID of the connection to add the collection to
   */
  async addCollectionWithOptions(connectionId: string): Promise<void> {
    // Validate connection first - these errors should not be caught and re-wrapped
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.status !== 'connected') {
      throw new Error('Connection must be active to add collections');
    }

    try {
      // Create and show the Collection Options webview panel
      const panel = vscode.window.createWebviewPanel(
        'weaviateAddCollectionOptions',
        'Create Collection',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      // Set the webview content
      panel.webview.html = this.getCollectionOptionsHtml(connectionId);

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'selectOption':
              // Handle option selection
              switch (message.option) {
                case 'fromScratch':
                  // Close the options panel and open the new Add Collection panel
                  panel.dispose();
                  await this.addCollection(connectionId);
                  break;
                case 'cloneExisting':
                  // Show clone collection selection first
                  panel.webview.html = await this.getCloneCollectionHtml(connectionId);
                  this.setupCloneCollectionMessageHandlers(panel, connectionId);
                  break;
                case 'importFromFile':
                  // Show import file selection first
                  panel.webview.html = this.getImportCollectionHtml();
                  this.setupImportCollectionMessageHandlers(panel, connectionId);
                  break;
              }
              break;
            case 'back':
              // Return to options selection
              panel.webview.html = this.getCollectionOptionsHtml(connectionId);
              break;
            case 'cancel':
              panel.dispose();
              break;
          }
        },
        undefined,
        this.context.subscriptions
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error showing add collection options dialog:', error);
      throw new Error(`Failed to show add collection options dialog: ${errorMessage}`);
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

    // Determine server major version to pick schema format (v1 vs v2)
    const serverVersion = this.clusterMetadataCache[connectionId]?.version || '';
    const serverMajor = parseInt(serverVersion.split('.')[0] || '0', 10);
    const useV2Types = serverMajor >= 2; // v2 uses string dataType; v1 uses string[]

    // Build schema object
    const schemaObject = {
      class: schema.class,
      properties: (schema.properties || []).map((p: any) => {
        // Normalize incoming dataType to canonical string with [] suffix for arrays
        let dt: any = p?.dataType;
        if (Array.isArray(dt)) {
          dt = dt[0];
        }
        // Ensure string
        dt = String(dt);
        // For v1, wrap in array; for v2, keep as string
        const normalizedDt = useV2Types ? dt : [dt];
        return { ...p, dataType: normalizedDt };
      }), // Include properties from the form
    } as any;

    // Add description if provided (don't include if empty to avoid sending empty strings)
    if (schema.description && schema.description.trim()) {
      schemaObject.description = schema.description;
    }

    // Handle vectorConfig (new multi-vectorizer format)
    if (schema.vectorConfig) {
      schemaObject.vectorConfig = schema.vectorConfig;
    }
    // Handle legacy single vectorizer format for backward compatibility
    else if (schema.vectorizer && schema.vectorizer !== 'none') {
      schemaObject.vectorizer = schema.vectorizer;
      if (schema.vectorIndexType) {
        schemaObject.vectorIndexType = schema.vectorIndexType;
      }
      if (schema.vectorIndexConfig) {
        schemaObject.vectorIndexConfig = schema.vectorIndexConfig;
      }
      if (schema.moduleConfig) {
        schemaObject.moduleConfig = schema.moduleConfig;
      }
    }

    // Handle multiTenancyConfig
    if (schema.multiTenancyConfig) {
      schemaObject.multiTenancyConfig = schema.multiTenancyConfig;
    }

    // Handle replicationConfig
    if (schema.replicationConfig) {
      schemaObject.replicationConfig = schema.replicationConfig;
    }

    // Create the collection using the schema API
    // return if any error here
    try {
      await client.collections.createFromSchema(schemaObject);
    } catch (error) {
      // on error, show dialog with error message
      console.error('Error creating collection:', error);
      throw error;
    }
  }

  /**
   * Gets available vectorizers from the Weaviate instance
   * @param connectionId - The ID of the connection
   * @returns Array of available vectorizers
   */
  private async getAvailableVectorizers(connectionId: string): Promise<string[]> {
    // Define all possible vectorizers
    const allVectorizers = [
      'none', // Manual vectors
      'text2vec-openai', // OpenAI
      'text2vec-cohere', // Cohere
      'text2vec-huggingface', // Hugging Face
      'text2vec-transformers', // Local transformers
      'text2vec-contextionary', // Contextionary
      'multi2vec-clip', // CLIP
      'multi2vec-bind', // BIND
      'img2vec-neural', // Neural image vectorizer
      'ref2vec-centroid', // Reference centroid
    ];

    try {
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        throw new Error('Client not initialized');
      }

      const meta = this.clusterMetadataCache[connectionId];

      // If no modules info available, return all vectorizers
      if (!meta?.modules) {
        return allVectorizers;
      }

      // Filter vectorizers based on available modules
      const availableVectorizers = ['none']; // Always include manual vectors
      const moduleNames = Object.keys(meta.modules);

      // Only include vectorizers whose names exactly match a module name
      allVectorizers.slice(1).forEach((vectorizer) => {
        if (moduleNames.includes(vectorizer)) {
          availableVectorizers.push(vectorizer);
        }
      });

      return availableVectorizers;
    } catch (error) {
      // Log error for debugging but don't expose to user
      console.error('Error fetching vectorizers:', error);
      // Return all possible vectorizers as fallback
      return allVectorizers;
    }
  }

  // LEGACY: The following methods are no longer used for the main "Add Collection" flow.
  // They have been replaced by AddCollectionPanel (React webview) in src/views/AddCollectionPanel.ts
  // These can be safely removed once all migration is verified complete.

  /**
   * Generates HTML for the Add Collection webview
   * @param initialSchema - Optional initial schema to pre-populate the form
   * @returns The HTML content for the webview
   * @deprecated Use AddCollectionPanel instead
   */
  private getAddCollectionHtml(initialSchema?: any): string {
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
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif);
                        font-size: 14px;
                        line-height: 1.4;
                        color: var(--vscode-foreground, #2D2D2D);
                        background-color: var(--vscode-editor-background, #FFFFFF);
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
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .header .subtitle {
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        font-size: 14px;
                        font-weight: normal;
                    }
                    
                    /* Form Layout */
                    .form-section {
                        margin-bottom: 24px;
                        border: 1px solid var(--vscode-panel-border, #CCCCCC);
                        border-radius: 4px;
                        background: var(--vscode-editor-background, #FFFFFF);
                        overflow: hidden;
                    }
                    
                    .section-header {
                        height: 48px;
                        padding: 0 16px;
                        background: var(--vscode-sideBar-background, #F3F3F3);
                        border-bottom: 1px solid var(--vscode-panel-border, #CCCCCC);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        font-weight: bold;
                        font-size: 16px;
                        color: var(--vscode-foreground, #2D2D2D);
                        transition: background-color 0.2s ease;
                    }
                    
                    .section-header:hover {
                        background: var(--vscode-list-hoverBackground, #E8E8E8);
                    }
                    
                    .section-header .icon {
                        transition: transform 0.2s ease;
                        font-size: 16px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                    }
                    
                    .section-header.collapsed .icon {
                        transform: rotate(-90deg);
                    }

                    .section-counter {
                        font-weight: normal;
                        font-size: 14px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        margin-left: 8px;
                    }
                    
                    .section-content {
                        padding: 20px;
                        display: block;
                        transition: all 180ms ease-in-out;
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
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        display: block;
                    }
                    
                    .form-field label.required::after {
                        content: " *";
                        color: var(--vscode-errorForeground, #D32F2F);
                    }
                    
                    .form-field input,
                    .form-field select,
                    .form-field textarea {
                        height: 32px;
                        padding: 0 12px;
                        border: 1px solid var(--vscode-input-border, #CCCCCC);
                        background: var(--vscode-input-background, #F3F3F3);
                        color: var(--vscode-input-foreground, #2D2D2D);
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
                        border-color: var(--vscode-focusBorder, #007ACC);
                        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
                    }
                    
                    .form-field .hint {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground, #9E9E9E);
                        margin-top: 4px;
                        font-style: italic;
                    }
                    
                    .form-field .error-text {
                        font-size: 12px;
                        color: var(--vscode-errorForeground, #D32F2F);
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
                        background: var(--vscode-sideBar-background, #F7F7F7);
                        border: 1px solid var(--vscode-panel-border, #E0E0E0);
                        border-radius: 4px;
                        padding: 16px;
                        min-height: 120px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .properties-container.has-properties {
                        background: var(--vscode-sideBar-background, #F7F7F7);
                        border: 1px solid var(--vscode-panel-border, #E0E0E0);
                        padding: 16px;
                        min-height: auto;
                    }
                    
                    .no-properties {
                        text-align: center;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        font-style: italic;
                        font-size: 14px;
                        padding: 32px 16px;
                    }
                    
                    .property-card {
                        background: var(--vscode-editor-background, #FFFFFF);
                        border: 1px solid var(--vscode-panel-border, #DADADA);
                        border-radius: 4px;
                        padding: 12px;
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
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .property-actions button {
                        background: none;
                        border: none;
                        color: var(--vscode-errorForeground, #D32F2F);
                        cursor: pointer;
                        font-size: 12px;
                        padding: 4px 8px;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                    }
                    
                    .property-actions button:hover {
                        background: var(--vscode-list-hoverBackground, #FFEBEE);
                    }
                    
                    .property-fields {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }

                    .property-field-row {
                        display: flex;
                        gap: 12px;
                        align-items: flex-end;
                    }
                    
                    .property-field {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .property-field.name-field {
                        flex: 2;
                    }
                    
                    .property-field.type-field {
                        flex: 1.5;
                    }

                    .property-field.array-field {
                        flex: 0 0 auto;
                        min-width: 80px;
                    }
                    
                    .property-field label {
                        font-size: 12px;
                        margin-bottom: 8px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        padding-right: 12px;
                    }
                    
                    .property-field input,
                    .property-field select,
                    .property-field textarea {
                        height: 32px;
                        padding: 0 12px;
                        font-size: 12px;
                        border: 1px solid var(--vscode-input-border, #CCCCCC);
                        border-radius: 4px;
                        background: var(--vscode-input-background, #FFFFFF);
                        color: var(--vscode-input-foreground, #2D2D2D);
                        transition: border-color 0.2s ease;
                    }
                    
                    .property-field input:focus,
                    .property-field select:focus,
                    .property-field textarea:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder, #007ACC);
                        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
                    }
                    
                    .property-field textarea {
                        height: auto;
                        min-height: 60px;
                        padding: 8px 12px;
                    }
                    
                    .property-field.full-width {
                        flex: 1 1 100%;
                        width: 100%;
                    }
                    
                    .property-field input[type="checkbox"] {
                        width: 16px;
                        height: 16px;
                        margin: 0;
                        appearance: none;
                        border: 1px solid var(--vscode-input-border, #CCCCCC);
                        border-radius: 2px;
                        background: var(--vscode-input-background, #FFFFFF);
                        cursor: pointer;
                        position: relative;
                        transition: all 0.2s ease;
                    }
                    
                    .property-field input[type="checkbox"]:checked {
                        background: var(--vscode-button-background, #007ACC);
                        border-color: var(--vscode-button-background, #007ACC);
                    }
                    
                    .property-field input[type="checkbox"]:checked::after {
                        content: '✓';
                        position: absolute;
                        top: -2px;
                        left: 2px;
                        color: var(--vscode-button-foreground, #FFFFFF);
                        font-size: 10px;
                        font-weight: bold;
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

                    /* Enhanced checkbox group styling */
                    .checkbox-group {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 16px;
                        padding: 12px 16px;
                        background: var(--vscode-sideBar-background, #F7F7F7);
                        border-radius: 4px;
                        border: 1px solid var(--vscode-panel-border, #E0E0E0);
                    }

                    .checkbox-label {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 0;
                        cursor: pointer;
                        font-size: 13px;
                        color: var(--vscode-foreground, #2D2D2D);
                        transition: color 0.2s ease;
                    }

                    .checkbox-label:hover {
                        color: var(--vscode-button-background, #007ACC);
                    }

                    .checkbox-label input[type="checkbox"] {
                        width: 16px;
                        height: 16px;
                        margin: 0;
                        appearance: none;
                        border: 2px solid var(--vscode-input-border, #CCCCCC);
                        border-radius: 3px;
                        background: var(--vscode-input-background, #FFFFFF);
                        cursor: pointer;
                        position: relative;
                        transition: all 0.2s ease;
                        flex-shrink: 0;
                    }

                    .checkbox-label input[type="checkbox"]:hover {
                        border-color: var(--vscode-button-background, #007ACC);
                    }

                    .checkbox-label input[type="checkbox"]:checked {
                        background: var(--vscode-button-background, #007ACC);
                        border-color: var(--vscode-button-background, #007ACC);
                    }

                    .checkbox-label input[type="checkbox"]:checked::after {
                        content: '✓';
                        position: absolute;
                        top: -1px;
                        left: 2px;
                        color: var(--vscode-button-foreground, #FFFFFF);
                        font-size: 12px;
                        font-weight: bold;
                    }

                    .checkbox-text {
                        font-weight: 500;
                        user-select: none;
                    }

                    .index-config-row {
                        margin-top: 8px;
                    }

                    /* Tokenization field styling */
                    .tokenization-field {
                        margin-top: 8px;
                    }

                    .tokenization-field label {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        margin-bottom: 4px;
                    }
                    
                    /* Mobile responsive for properties */
                    @media (max-width: 600px) {
                        .property-field-row {
                            flex-direction: column;
                            gap: 8px;
                            align-items: stretch;
                        }
                        
                        .property-field.name-field,
                        .property-field.type-field,
                        .property-field.array-field {
                            flex: 1;
                        }
                        
                        .checkbox-group {
                            flex-direction: column;
                            gap: 12px;
                        }
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
                        background: var(--vscode-button-background, #007ACC);
                        color: var(--vscode-button-foreground, #FFFFFF);
                        border: 1px solid var(--vscode-button-background, #007ACC);
                    }
                    
                    .primary-button:hover {
                        background: var(--vscode-button-hoverBackground, #005A9E);
                        border-color: var(--vscode-button-hoverBackground, #005A9E);
                    }
                    
                    .secondary-button {
                        background: transparent;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        border: 1px solid var(--vscode-input-border, #CCCCCC);
                    }
                    
                    .secondary-button:hover {
                        background: var(--vscode-list-hoverBackground, #F3F3F3);
                    }
                    
                    .add-property-btn {
                        background: transparent;
                        color: var(--vscode-button-background, #007ACC);
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
                    
                    /* Vectorizer Configuration */
                    .vector-config-container {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }
                    
                    .vectorizer-card {
                        background: var(--vscode-editor-background, #FFFFFF);
                        border: 1px solid var(--vscode-panel-border, #DADADA);
                        border-radius: 4px;
                        padding: 16px;
                        position: relative;
                    }
                    
                    .vectorizer-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                    }
                    
                    .vectorizer-name-input {
                        display: flex;
                        align-items: center;
                        flex: 1;
                    }
                    
                    .vectorizer-name-input label {
                        margin-right: 8px;
                        font-weight: bold;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .vectorizer-name-input input {
                        flex: 1;
                        max-width: 200px;
                    }
                    
                    .vectorizer-name {
                        font-weight: bold;
                        font-size: 14px;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .vectorizer-remove-btn {
                        background: transparent;
                        color: var(--vscode-errorForeground, #D32F2F);
                        border: none;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    
                    .vectorizer-remove-btn:hover {
                        background: var(--vscode-list-errorForeground, rgba(211, 47, 47, 0.1));
                    }
                    
                    .vector-actions {
                        margin-top: 16px;
                    }
                    
                    .add-vectorizer-btn {
                        background: transparent;
                        color: var(--vscode-button-background, #007ACC);
                        border: none;
                        padding: 0;
                        font-size: 14px;
                        text-decoration: underline;
                        text-align: left;
                        cursor: pointer;
                    }
                    
                    .add-vectorizer-btn:hover {
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
                        transition: all 180ms ease-in-out;
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
                        
                        <!-- Properties Section -->
                        <div class="form-section">
                            <div class="section-header" data-section="properties">
                                <span>Properties <span class="section-counter" id="propertiesCounter">(0)</span></span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content" id="propertiesContent">
                                <button type="button" class="add-property-btn" id="addPropertyButton">+ Add Property</button>
                            <div class="properties-container" id="propertiesContainer">
                                    <div class="no-properties">No properties added yet. Click "Add Property" to define your data structure.</div>
                            </div>
                            </div>
                        </div>
                        
                        <!-- Vectorizer Configuration Section -->
                        <div class="form-section">
                            <div class="section-header" data-section="vectorizer">
                                <span>Vectorizer Configuration <span class="section-counter" id="vectorizersCounter">(0)</span></span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content" id="vectorizerContent">
                                <div id="vectorConfigContainer">
                                    <!-- Multi-vectorizer support will be rendered here -->
                                </div>
                                <div class="vector-actions">
                                    <button type="button" class="add-vectorizer-btn" id="addVectorizerButton">+ Add Vectorizer</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Multi-Tenancy Section -->
                        <div class="form-section">
                            <div class="section-header" data-section="multitenancy">
                                <span>Multi-Tenancy</span>
                                <span class="icon">▼</span>
                            </div>
                            <div class="section-content" id="multitenancyContent">
                                <div class="form-field">
                                    <label class="inline-checkbox">
                                        <input type="checkbox" id="multiTenancyToggle" aria-describedby="mtHint">
                                        <span>Enable Multi-Tenancy</span>
                                    </label>
                                    <div class="hint" id="mtHint">Allow collection to be partitioned by tenant</div>
                                </div>
                                <div class="form-field" id="multiTenancyOptions" style="display:none;">
                                    <div class="checkbox-group">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="autoTenantCreation">
                                            <span class="checkbox-text">Auto Tenant Creation</span>
                                        </label>
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="autoTenantActivation">
                                            <span class="checkbox-text">Auto Tenant Activation</span>
                                        </label>
                                    </div>
                                </div>
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
                    let vectorCounter = 0;
                    let properties = [];
                    let vectorizers = [];
                    let availableVectorizers = [];
                    let existingCollections = [];
                    let moduleConfigState = {};
                    let multiTenancyEnabled = false;
                    let autoTenantCreation = false;
                    let autoTenantActivation = false;
                    let serverVersion = 'unknown';
                    
                    // Initial schema data (if provided)
                    const initialSchema = ${initialSchema ? JSON.stringify(initialSchema) : 'null'};
                    
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
                    
                    // Tokenization options
                    const tokenizationOptions = [
                        { value: '', label: 'Default', description: 'Use default tokenization' },
                        { value: 'word', label: 'Word', description: 'Tokenize by word' },
                        { value: 'whitespace', label: 'Whitespace', description: 'Tokenize by whitespace' },
                        { value: 'lowercase', label: 'Lowercase', description: 'Tokenize by lowercase' },
                        { value: 'field', label: 'Field', description: 'Tokenize by field' },
                        { value: 'gse', label: 'GSE', description: 'Tokenize using GSE (Chinese/Japanese) - requires server support' },
                        { value: 'trigram', label: 'Trigram', description: 'Tokenize into trigrams - requires server support' },
                        { value: 'kagome_ja', label: 'Kagome JA', description: 'Tokenize using Kagome (Japanese) - requires server support' },
                        { value: 'kagome_kr', label: 'Kagome KR', description: 'Tokenize using Kagome (Korean) - requires server support' }
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
                    function populateFormFromSchema(schema) {
                        if (!schema) return;
                        
                        // Basic settings
                        const collectionNameInput = document.getElementById('collectionName');
                        if (schema.class && collectionNameInput) {
                            collectionNameInput.value = schema.class;
                        }
                        
                        const descriptionInput = document.getElementById('description');
                        if (schema.description && descriptionInput) {
                            descriptionInput.value = schema.description;
                        }
                        
                        // Handle vectorConfig (new format) or legacy vectorizer
                        if (schema.vectorConfig) {
                            // New multi-vectorizer format
                            vectorizers = [];
                            vectorCounter = 0;
                            for (const [vectorName, vectorConfig] of Object.entries(schema.vectorConfig)) {
                                const vectorizerType = Object.keys(vectorConfig.vectorizer)[0];
                                const moduleConfig = vectorConfig.vectorizer[vectorizerType] || {};
                                addVectorizer(vectorName, vectorizerType);
                                const vectorizer = vectorizers[vectorizers.length - 1];
                                vectorizer.moduleConfig = moduleConfig;
                                vectorizer.vectorIndexType = vectorConfig.vectorIndexType || 'hnsw';
                                vectorizer.vectorIndexConfig = vectorConfig.vectorIndexConfig || { efConstruction: 128, maxConnections: 16 };
                            }
                        } else {
                            // Legacy single vectorizer format
                            const vectorizerType = schema.vectorizer || 'none';
                            addVectorizer('default', vectorizerType);
                            if (schema.moduleConfig && vectorizers.length > 0) {
                                vectorizers[0].moduleConfig = schema.moduleConfig[vectorizerType] || {};
                            }
                            if (schema.vectorIndexType && vectorizers.length > 0) {
                                vectorizers[0].vectorIndexType = schema.vectorIndexType;
                            }
                            if (schema.vectorIndexConfig && vectorizers.length > 0) {
                                vectorizers[0].vectorIndexConfig = schema.vectorIndexConfig;
                            }
                        }
                        
                        // Properties: normalize incoming schema to editing model
                        if (schema.properties && Array.isArray(schema.properties)) {
                            const builtinTypes = new Set(['text', 'string', 'int', 'number', 'boolean', 'date', 'geoCoordinates', 'phoneNumber', 'blob', 'object', 'uuid']);
                            properties = schema.properties.map((p, idx) => {
                                let dt = p?.dataType;
                                if (Array.isArray(dt)) {
                                    dt = dt[0];
                                }
                                dt = dt || '';
                                let isArray = false;
                                if (typeof dt === 'string' && dt.endsWith('[]')) {
                                    isArray = true;
                                    dt = dt.slice(0, -2);
                                }
                                let dataType = dt;
                                let targetCollection = '';
                                if (!builtinTypes.has(dt)) {
                                    // Treat as reference
                                    targetCollection = dt;
                                    dataType = 'reference';
                                }
                                return {
                                    id: 'prop_' + (++propertyCounter),
                                    name: p.name || '',
                                    dataType: dataType || 'text',
                                    isArray: !!isArray,
                                    targetCollection: targetCollection || undefined,
                                    description: p.description || '',
                                    tokenization: p.tokenization || '',
                                    indexFilterable: typeof p.indexFilterable === 'boolean' ? p.indexFilterable : true,
                                    indexSearchable: typeof p.indexSearchable === 'boolean' ? p.indexSearchable : true,
                                    indexRangeFilters: typeof p.indexRangeFilters === 'boolean' ? p.indexRangeFilters : false
                                };
                            });
                            renderProperties();
                        }
                        
                        // Render vectorizers after populating them
                        renderVectorizers();
                        
                        // Module config
                        if (schema.moduleConfig) {
                            moduleConfigState = { ...schema.moduleConfig[schema.vectorizer] || {} };
                        }
                        
                        // Vector index config (handled per vectorizer in vectorizers array)
                        
                        // Multi-tenancy - check both multiTenancyConfig and multiTenancy properties
                        const mtConfig = schema.multiTenancyConfig || schema.multiTenancy;
                        if (mtConfig) {
                            multiTenancyEnabled = !!mtConfig.enabled;
                            const mtToggle = document.getElementById('multiTenancyToggle');
                            if (mtToggle) {
                                mtToggle.checked = multiTenancyEnabled;
                                // Trigger change event to ensure options are shown/hidden properly
                                mtToggle.dispatchEvent(new Event('change'));
                            }
                            autoTenantCreation = !!mtConfig.autoTenantCreation;
                            autoTenantActivation = !!mtConfig.autoTenantActivation;
                            const atc = document.getElementById('autoTenantCreation');
                            const ata = document.getElementById('autoTenantActivation');
                            if (atc) atc.checked = autoTenantCreation;
                            if (ata) ata.checked = autoTenantActivation;
                        }
                    }
                    
                    function initForm() {
                        // Request data from extension first
                    vscode.postMessage({ command: 'getVectorizers' });
                    vscode.postMessage({ command: 'getCollections' });
                    
                        // Set up event listeners first
                        setupEventListeners();
                        
                        // Initialize form with initial schema if provided
                        if (initialSchema) {
                            populateFormFromSchema(initialSchema);
                        }
                        // Do not add default vectorizer - user will add them manually
                        
                        // Initial renders
                        renderVectorizers();
                        renderProperties();
                        updateJsonPreview();
                        
                        // Focus collection name (unless pre-populated)
                        if (!initialSchema) {
                            document.getElementById('collectionName').focus();
                        }
                    }
                    
                                        function setupEventListeners() {
                        // Collection name validation with inline error
                    const collectionNameInput = document.getElementById('collectionName');
                    if (collectionNameInput) {
                        collectionNameInput.addEventListener('input', (e) => {
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
                    }
                    
                        // Other form fields
                    const descriptionInput = document.getElementById('description');
                    if (descriptionInput) {
                        descriptionInput.addEventListener('input', updateJsonPreview);
                    }
                        
                        const multiTenancyToggle = document.getElementById('multiTenancyToggle');
                        const multiTenancyOptions = document.getElementById('multiTenancyOptions');
                        const autoTenantCreationEl = document.getElementById('autoTenantCreation');
                        const autoTenantActivationEl = document.getElementById('autoTenantActivation');
                        if (multiTenancyToggle) {
                            multiTenancyToggle.addEventListener('change', (e) => {
                                multiTenancyEnabled = e.target.checked;
                                if (multiTenancyOptions) {
                                    multiTenancyOptions.style.display = multiTenancyEnabled ? 'block' : 'none';
                                }
                                updateJsonPreview();
                            });
                        }
                        if (autoTenantCreationEl) {
                            autoTenantCreationEl.addEventListener('change', (e) => {
                                autoTenantCreation = e.target.checked;
                                updateJsonPreview();
                            });
                        }
                        if (autoTenantActivationEl) {
                            autoTenantActivationEl.addEventListener('change', (e) => {
                                autoTenantActivation = e.target.checked;
                                updateJsonPreview();
                            });
                        }
                    
                    // Property management
                        const addPropertyButton = document.getElementById('addPropertyButton');
                        if (addPropertyButton) {
                            addPropertyButton.addEventListener('click', addProperty);
                        }
                        
                        // Vectorizer management
                        const addVectorizerButton = document.getElementById('addVectorizerButton');
                        if (addVectorizerButton) {
                            addVectorizerButton.addEventListener('click', () => {
                                const suggestedName = vectorizers.length === 0 ? 'default' : 'vector' + (vectorizers.length + 1);
                                addVectorizer(suggestedName, 'none');
                                renderVectorizers();
                                updateJsonPreview();
                            });
                        }
                        
                        // Form submission
                        const collectionForm = document.getElementById('collectionForm');
                        if (collectionForm) {
                            collectionForm.addEventListener('submit', handleSubmit);
                        }
                        
                        const cancelButton = document.getElementById('cancelButton');
                        if (cancelButton) {
                            cancelButton.addEventListener('click', () => {
                                vscode.postMessage({ command: 'cancel' });
                            });
                        }
                    }

                    // Expose functions to window for HTML event handlers
                    window.updateProperty = updateProperty;
                    
                    function addVectorizer(name, vectorizerType) {
                        const vectorizer = {
                            id: ++vectorCounter,
                            name: name,
                            vectorizer: vectorizerType,
                            vectorIndexType: 'hnsw',
                            vectorIndexConfig: { efConstruction: 128, maxConnections: 16 },
                            moduleConfig: {}
                        };
                        vectorizers.push(vectorizer);
                    }
                    
                    function removeVectorizer(id) {
                        vectorizers = vectorizers.filter(v => v.id !== id);
                        renderVectorizers();
                        updateJsonPreview();
                    }
                    
                    function renderVectorizers() {
                        const container = document.getElementById('vectorConfigContainer');
                        const counter = document.getElementById('vectorizersCounter');
                        if (!container) return;
                        
                        // Update counter
                        if (counter) {
                            counter.textContent = '(' + vectorizers.length + ')';
                        }
                        
                        container.innerHTML = '';
                        
                        if (vectorizers.length === 0) {
                            container.innerHTML = '<div class="no-vectorizers" style="text-align: center; color: var(--vscode-descriptionForeground); padding: 20px; font-style: italic;">No vectorizers added yet. Click "Add Vectorizer" to configure vector embeddings.</div>';
                            return;
                        }
                        
                        vectorizers.forEach(vectorizer => {
                            const card = document.createElement('div');
                            card.className = 'vectorizer-card';
                            
                            const removeButton = vectorizers.length > 0 
                                ? \`<button type="button" class="vectorizer-remove-btn" onclick="removeVectorizer(\${vectorizer.id})">Remove</button>\`
                                : '';
                            
                            card.innerHTML = \`
                                <div class="vectorizer-header">
                                    <div class="vectorizer-name-input">
                                        <label>Vector Name:</label>
                                        <input type="text" value="\${vectorizer.name}" onchange="updateVectorizerName(\${vectorizer.id}, this.value)" placeholder="e.g., default, semantic, content" style="margin-left: 8px; padding: 4px 8px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground);">
                                    </div>
                                    \${removeButton}
                                </div>
                                <div class="form-row">
                                    <div class="form-field">
                                        <label for="vectorizer_\${vectorizer.id}">Vectorizer</label>
                                        <select id="vectorizer_\${vectorizer.id}" onchange="updateVectorizerType(\${vectorizer.id}, this.value)">
                                            <option value="none" \${vectorizer.vectorizer === 'none' ? 'selected' : ''}>None (Manual vectors)</option>
                                            <option value="text2vec-openai" \${vectorizer.vectorizer === 'text2vec-openai' ? 'selected' : ''}>OpenAI</option>
                                            <option value="text2vec-cohere" \${vectorizer.vectorizer === 'text2vec-cohere' ? 'selected' : ''}>Cohere</option>
                                            <option value="text2vec-huggingface" \${vectorizer.vectorizer === 'text2vec-huggingface' ? 'selected' : ''}>Hugging Face</option>
                                        </select>
                                    </div>
                                    <div class="form-field">
                                        <label for="vectorIndexType_\${vectorizer.id}">Index Type</label>
                                        <select id="vectorIndexType_\${vectorizer.id}" onchange="updateVectorizerIndexType(\${vectorizer.id}, this.value)">
                                            <option value="hnsw" \${vectorizer.vectorIndexType === 'hnsw' ? 'selected' : ''}>HNSW (Recommended)</option>
                                            <option value="flat" \${vectorizer.vectorIndexType === 'flat' ? 'selected' : ''}>Flat</option>
                                        </select>
                                    </div>
                                </div>
                                <div id="moduleConfig_\${vectorizer.id}"></div>
                            \`;
                            container.appendChild(card);
                            
                            // Render module config for this vectorizer
                            renderModuleConfigForVectorizer(vectorizer);
                        });
                    }
                    
                    function updateVectorizerType(id, vectorizerType) {
                        const vectorizer = vectorizers.find(v => v.id === id);
                        if (vectorizer) {
                            vectorizer.vectorizer = vectorizerType;
                            vectorizer.moduleConfig = {};
                            renderModuleConfigForVectorizer(vectorizer);
                            updateJsonPreview();
                        }
                    }
                    
                    function updateVectorizerName(id, name) {
                        const vectorizer = vectorizers.find(v => v.id === id);
                        if (vectorizer) {
                            vectorizer.name = name.trim() || 'vector' + id;
                            updateJsonPreview();
                        }
                    }
                    
                    function updateVectorizerIndexType(id, indexType) {
                        const vectorizer = vectorizers.find(v => v.id === id);
                        if (vectorizer) {
                            vectorizer.vectorIndexType = indexType;
                            updateJsonPreview();
                        }
                    }
                    
                    function renderModuleConfigForVectorizer(vectorizer) {
                        const container = document.getElementById(\`moduleConfig_\${vectorizer.id}\`);
                        if (!container) return;
                        
                        container.innerHTML = '';
                        
                        if (vectorizer.vectorizer === 'text2vec-openai') {
                            const configDiv = document.createElement('div');
                            configDiv.className = 'module-config';
                            
                            const modelSelected1 = vectorizer.moduleConfig.model === 'text-embedding-3-small' ? 'selected' : '';
                            const modelSelected2 = vectorizer.moduleConfig.model === 'text-embedding-3-large' ? 'selected' : '';
                            const modelSelected3 = vectorizer.moduleConfig.model === 'text-embedding-ada-002' ? 'selected' : '';
                            const baseUrlValue = vectorizer.moduleConfig.baseURL || 'https://api.openai.com';
                            
                            configDiv.innerHTML = \`
                                <h4>OpenAI Configuration</h4>
                                <div class="form-field">
                                    <label for="openaiModel_\${vectorizer.id}">Model</label>
                                    <select id="openaiModel_\${vectorizer.id}" onchange="updateVectorizerModuleConfig(\${vectorizer.id}, 'model', this.value)">
                                        <option value="text-embedding-3-small" \${modelSelected1}>text-embedding-3-small</option>
                                        <option value="text-embedding-3-large" \${modelSelected2}>text-embedding-3-large</option>
                                        <option value="text-embedding-ada-002" \${modelSelected3}>text-embedding-ada-002</option>
                                    </select>
                                </div>
                                <div class="form-field">
                                    <label for="openaiBaseUrl_\${vectorizer.id}">Base URL</label>
                                    <input type="url" id="openaiBaseUrl_\${vectorizer.id}" value="\${baseUrlValue}" onchange="updateVectorizerModuleConfig(\${vectorizer.id}, 'baseURL', this.value)" placeholder="https://api.openai.com">
                                </div>
                            \`;
                            container.appendChild(configDiv);
                        } else if (vectorizer.vectorizer === 'text2vec-cohere') {
                            const configDiv = document.createElement('div');
                            configDiv.className = 'module-config';
                            
                            const cohereModelSelected1 = vectorizer.moduleConfig.model === 'embed-multilingual-v3.0' ? 'selected' : '';
                            const cohereModelSelected2 = vectorizer.moduleConfig.model === 'embed-english-v3.0' ? 'selected' : '';
                            const cohereBaseUrlValue = vectorizer.moduleConfig.baseUrl || 'https://api.cohere.ai';
                            
                            configDiv.innerHTML = \`
                                <h4>Cohere Configuration</h4>
                                <div class="form-field">
                                    <label for="cohereModel_\${vectorizer.id}">Model</label>
                                    <select id="cohereModel_\${vectorizer.id}" onchange="updateVectorizerModuleConfig(\${vectorizer.id}, 'model', this.value)">
                                        <option value="embed-multilingual-v3.0" \${cohereModelSelected1}>embed-multilingual-v3.0</option>
                                        <option value="embed-english-v3.0" \${cohereModelSelected2}>embed-english-v3.0</option>
                                    </select>
                                </div>
                                <div class="form-field">
                                    <label for="cohereBaseUrl_\${vectorizer.id}">Base URL</label>
                                    <input type="url" id="cohereBaseUrl_\${vectorizer.id}" value="\${cohereBaseUrlValue}" onchange="updateVectorizerModuleConfig(\${vectorizer.id}, 'baseUrl', this.value)" placeholder="https://api.cohere.ai">
                                </div>
                            \`;
                            container.appendChild(configDiv);
                        }
                    }
                    
                    function updateVectorizerModuleConfig(id, key, value) {
                        const vectorizer = vectorizers.find(v => v.id === id);
                        if (vectorizer) {
                            vectorizer.moduleConfig[key] = value;
                            updateJsonPreview();
                        }
                    }
                    
                    function addProperty() {
                        const propertyId = 'prop_' + (++propertyCounter);
                        const property = {
                            id: propertyId,
                            name: '',
                            dataType: 'text',
                            isArray: false,
                            description: '',
                            tokenization: '',
                            indexFilterable: true,
                            indexSearchable: true,
                            indexRangeFilters: false
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
                        const counter = document.getElementById('propertiesCounter');
                        
                        // Update counter
                        if (counter) {
                            counter.textContent = '(' + properties.length + ')';
                        }
                        
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
                        // Ensure target collection dropdowns are always updated after rendering
                        updateCollectionOptions(existingCollections);
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
                        removeBtn.addEventListener('click', () => removeProperty(prop.id));
                        actions.appendChild(removeBtn);
                        
                        header.appendChild(actions);
                        card.appendChild(header);
                        
                        // Fields - reorganized in multiple rows
                        const fields = document.createElement('div');
                        fields.className = 'property-fields';
                        
                        // First row: Name, Type, Array
                        const firstRow = document.createElement('div');
                        firstRow.className = 'property-field-row';
                        
                        // Name field
                        const nameField = createField('Name', 'input', prop.id + '_name', {
                            value: prop.name,
                            placeholder: 'propertyName',
                            onchange: (e) => updateProperty(prop.id, 'name', e.target.value)
                        });
                        nameField.classList.add('name-field');
                        firstRow.appendChild(nameField);
                        
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
                            updateTokenizationField(prop);
                            updateRangeFiltersField(prop);
                            
                            if (newDataType === 'reference') {
                                vscode.postMessage({ command: 'getCollections' });
                            }
                        });
                        typeField.classList.add('type-field');
                        firstRow.appendChild(typeField);
                        
                        // Array checkbox
                        const arrayField = createArrayField(prop);
                        arrayField.classList.add('array-field');
                        firstRow.appendChild(arrayField);
                        
                        fields.appendChild(firstRow);

                        // Second row: Tokenization (for text and string types)
                        const tokenizationField = createSelectField('Tokenization', prop.id + '_tokenization', tokenizationOptions.map(opt => ({
                            value: opt.value,
                            label: opt.label,
                            selected: prop.tokenization === opt.value
                        })), (e) => updateProperty(prop.id, 'tokenization', e.target.value));
                        tokenizationField.classList.add('tokenization-field', 'full-width');
                        tokenizationField.id = prop.id + '_tokenization_field';
                        tokenizationField.style.display = (prop.dataType === 'text' || prop.dataType === 'string') ? 'block' : 'none';
                        fields.appendChild(tokenizationField);

                        // Third row: Index configuration checkboxes
                        const indexConfigRow = document.createElement('div');
                        indexConfigRow.className = 'property-field full-width index-config-row';
                        indexConfigRow.innerHTML = \`
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="\${prop.id}_indexFilterable" \${prop.indexFilterable ? 'checked' : ''} 
                                           onchange="updateProperty('\${prop.id}', 'indexFilterable', this.checked)">
                                    <span class="checkbox-text">Index Filterable</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="\${prop.id}_indexSearchable" \${prop.indexSearchable ? 'checked' : ''} 
                                           onchange="updateProperty('\${prop.id}', 'indexSearchable', this.checked)">
                                    <span class="checkbox-text">Index Searchable</span>
                                </label>
                                <label class="checkbox-label" id="\${prop.id}_indexRangeFilters_label" style="display: \${['int', 'number', 'date'].includes(prop.dataType) ? 'flex' : 'none'}">
                                    <input type="checkbox" id="\${prop.id}_indexRangeFilters" \${prop.indexRangeFilters ? 'checked' : ''} 
                                           onchange="updateProperty('\${prop.id}', 'indexRangeFilters', this.checked)">
                                    <span class="checkbox-text">Index Range Filters</span>
                                </label>
                            </div>
                        \`;
                        fields.appendChild(indexConfigRow);

                        // Fourth row: Description field
                        const descField = createField('Description', 'textarea', prop.id + '_desc', {
                            value: prop.description,
                            placeholder: 'Optional description',
                            onchange: (e) => updateProperty(prop.id, 'description', e.target.value)
                        });
                        descField.className += ' full-width';
                        fields.appendChild(descField);
                        
                        card.appendChild(fields);
                        // Target collection field (for reference type) - full width below type
                        const targetCollectionField = document.createElement('div');
                        targetCollectionField.className = 'property-field full-width';
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
                        card.appendChild(targetCollectionField);
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

                    function updateTokenizationField(prop) {
                        const field = document.getElementById(prop.id + '_tokenization_field');
                        if (field) {
                            const showTokenization = prop.dataType === 'text' || prop.dataType === 'string';
                            field.style.display = showTokenization ? 'block' : 'none';
                        }
                    }

                    function updateRangeFiltersField(prop) {
                        const label = document.getElementById(prop.id + '_indexRangeFilters_label');
                        if (label) {
                            const showRangeFilters = ['int', 'number', 'date'].includes(prop.dataType);
                            label.style.display = showRangeFilters ? 'flex' : 'none';
                            if (!showRangeFilters) {
                                const checkbox = document.getElementById(prop.id + '_indexRangeFilters');
                                if (checkbox) {
                                    checkbox.checked = false;
                                    prop.indexRangeFilters = false;
                                }
                            }
                        }
                    }
                    
                    function handleSubmit(e) {
                        e.preventDefault();
                        
                        const formData = new FormData(e.target);
                        let collectionName = formData.get('collectionName').trim();
                        const description = formData.get('description').trim();
                        const mtEnabled = document.getElementById('multiTenancyToggle') ? document.getElementById('multiTenancyToggle').checked : false;
                        
                        // Validation
                        if (!collectionName) {
                            showError('Collection name is required');
                            return;
                        }
                        if (existingCollections.includes(collectionName)) {
                            showError('A collection with this name already exists');
                            return;
                        }
                        
                        // Build vectorConfig from vectorizers
                        const vectorConfig = {};
                        const moduleConfig = {};
                        
                        vectorizers.forEach(vectorizer => {
                            if (vectorizer.vectorizer !== 'none') {
                                vectorConfig[vectorizer.name] = {
                                    vectorizer: {
                                        [vectorizer.vectorizer]: { ...vectorizer.moduleConfig }
                                    },
                                    vectorIndexConfig: {
                                        cleanupIntervalSeconds: 300,
                                        distanceMetric: 'cosine',
                                        dynamicEfMin: 100,
                                        dynamicEfMax: 500,
                                        dynamicEfFactor: 8,
                                        ef: -1,
                                        efConstruction: vectorizer.vectorIndexConfig.efConstruction,
                                        filterStrategy: 'sweeping',
                                        flatSearchCutoff: 40000,
                                        maxConnections: vectorizer.vectorIndexConfig.maxConnections,
                                        skip: false,
                                        vectorCacheMaxObjects: 1000000000000
                                    },
                                    vectorIndexType: vectorizer.vectorIndexType
                                };
                            } else {
                                vectorConfig[vectorizer.name] = {
                                    vectorizer: { none: {} },
                                    vectorIndexConfig: {
                                        cleanupIntervalSeconds: 300,
                                        distanceMetric: 'cosine',
                                        dynamicEfMin: 100,
                                        dynamicEfMax: 500,
                                        dynamicEfFactor: 8,
                                        ef: -1,
                                        efConstruction: vectorizer.vectorIndexConfig.efConstruction,
                                        filterStrategy: 'sweeping',
                                        flatSearchCutoff: 40000,
                                        maxConnections: vectorizer.vectorIndexConfig.maxConnections,
                                        skip: false,
                                        vectorCacheMaxObjects: 1000000000000
                                    },
                                    vectorIndexType: vectorizer.vectorIndexType
                                };
                            }
                        });
                        
                        // Build schema
                        const schema = {
                            class: collectionName,
                            description: description || undefined,
                            properties: properties.map(function(prop) {
                                const propSchema = {
                                    name: prop.name.trim(),
                                    dataType: (function () {
                                        let dt = (prop.dataType === 'reference' && prop.targetCollection)
                                            ? prop.targetCollection
                                            : prop.dataType;
                                        if (prop.isArray) {
                                            dt = dt + '[]';
                                        }
                                        return dt;
                                    })(),
                                    description: prop.description ? prop.description.trim() : undefined
                                };

                                // Add tokenization if specified and applicable
                                if (prop.tokenization && prop.tokenization !== '' && (prop.dataType === 'text' || prop.dataType === 'string')) {
                                    propSchema.tokenization = prop.tokenization;
                                }

                                // Add indexing properties
                                if (typeof prop.indexFilterable === 'boolean') {
                                    propSchema.indexFilterable = prop.indexFilterable;
                                }
                                if (typeof prop.indexSearchable === 'boolean') {
                                    propSchema.indexSearchable = prop.indexSearchable;
                                }
                                if (typeof prop.indexRangeFilters === 'boolean' && ['int', 'number', 'date'].includes(prop.dataType)) {
                                    propSchema.indexRangeFilters = prop.indexRangeFilters;
                                }

                                return propSchema;
                            }),
                            multiTenancyConfig: {
                                enabled: mtEnabled,
                                autoTenantCreation: mtEnabled ? !!autoTenantCreation : false,
                                autoTenantActivation: mtEnabled ? !!autoTenantActivation : false
                            }
                        };
                        
                        // Only add vectorConfig if there are vectorizers
                        if (Object.keys(vectorConfig).length > 0) {
                            schema.vectorConfig = vectorConfig;
                        }
                        
                        vscode.postMessage({
                            command: 'create',
                            schema: schema
                        });
                    }
                    
                    function updateJsonPreview() {
                        const collectionName = document.getElementById('collectionName').value.trim();
                        const descriptionVal = document.getElementById('description').value.trim();
                        const mtVal = document.getElementById('multiTenancyToggle') ? document.getElementById('multiTenancyToggle').checked : false;
                        
                        // Build vectorConfig from vectorizers
                        const vectorConfig = {};
                        vectorizers.forEach(vectorizer => {
                            if (vectorizer.vectorizer !== 'none') {
                                vectorConfig[vectorizer.name] = {
                                    vectorizer: {
                                        [vectorizer.vectorizer]: { ...vectorizer.moduleConfig }
                                    },
                                    vectorIndexConfig: {
                                        cleanupIntervalSeconds: 300,
                                        distanceMetric: 'cosine',
                                        dynamicEfMin: 100,
                                        dynamicEfMax: 500,
                                        dynamicEfFactor: 8,
                                        ef: -1,
                                        efConstruction: vectorizer.vectorIndexConfig.efConstruction,
                                        filterStrategy: 'sweeping',
                                        flatSearchCutoff: 40000,
                                        maxConnections: vectorizer.vectorIndexConfig.maxConnections,
                                        skip: false,
                                        vectorCacheMaxObjects: 1000000000000
                                    },
                                    vectorIndexType: vectorizer.vectorIndexType
                                };
                            } else {
                                vectorConfig[vectorizer.name] = {
                                    vectorizer: { none: {} },
                                    vectorIndexConfig: {
                                        cleanupIntervalSeconds: 300,
                                        distanceMetric: 'cosine',
                                        dynamicEfMin: 100,
                                        dynamicEfMax: 500,
                                        dynamicEfFactor: 8,
                                        ef: -1,
                                        efConstruction: vectorizer.vectorIndexConfig.efConstruction,
                                        filterStrategy: 'sweeping',
                                        flatSearchCutoff: 40000,
                                        maxConnections: vectorizer.vectorIndexConfig.maxConnections,
                                        skip: false,
                                        vectorCacheMaxObjects: 1000000000000
                                    },
                                    vectorIndexType: vectorizer.vectorIndexType
                                };
                            }
                        });
                        
                        const schemaObj = {
                            class: collectionName || 'collectionName',
                            description: descriptionVal || undefined,
                            properties: properties.map(function(prop) {
                                const dt = (function () {
                                    let t = (prop.dataType === 'reference' && prop.targetCollection)
                                        ? prop.targetCollection
                                        : prop.dataType;
                                    if (prop.isArray) {
                                        t = t + '[]';
                                    }
                                    return t;
                                })();
                                const propObj = {
                                    name: prop.name.trim() || 'propertyName',
                                    dataType: dt,
                                    description: prop.description ? prop.description.trim() : undefined
                                };

                                // Add tokenization if specified and applicable
                                if (prop.tokenization && prop.tokenization !== '' && (prop.dataType === 'text' || prop.dataType === 'string')) {
                                    propObj.tokenization = prop.tokenization;
                                }

                                // Add indexing properties
                                if (typeof prop.indexFilterable === 'boolean') {
                                    propObj.indexFilterable = prop.indexFilterable;
                                }
                                if (typeof prop.indexSearchable === 'boolean') {
                                    propObj.indexSearchable = prop.indexSearchable;
                                }
                                if (typeof prop.indexRangeFilters === 'boolean' && ['int', 'number', 'date'].includes(prop.dataType)) {
                                    propObj.indexRangeFilters = prop.indexRangeFilters;
                                }

                                return propObj;
                            }),
                            multiTenancyConfig: {
                                enabled: mtVal,
                                autoTenantCreation: mtVal ? !!autoTenantCreation : false,
                                autoTenantActivation: mtVal ? !!autoTenantActivation : false
                            }
                        };
                        
                        // Only add vectorConfig if there are vectorizers
                        if (Object.keys(vectorConfig).length > 0) {
                            schemaObj.vectorConfig = vectorConfig;
                        }
                        
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
                    
                    function updateVectorizerOptions(vectorizerList) {
                        availableVectorizers = vectorizerList;
                        // Update all vectorizer selects in the vectorizer cards
                        vectorizers.forEach(vectorizer => {
                            const select = document.getElementById(\`vectorizer_\${vectorizer.id}\`);
                            if (select) {
                                select.innerHTML = '';
                                vectorizerList.forEach(v => {
                                    const option = document.createElement('option');
                                    option.value = v;
                                    option.textContent = v === 'none' ? 'None (Manual vectors)' : 
                                        v.replace('text2vec-', '').replace('multi2vec-', '').replace('img2vec-', '');
                                    if (v === vectorizer.vectorizer) {
                                        option.selected = true;
                                    }
                                    select.appendChild(option);
                                });
                            }
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
                    
                    // Make functions globally accessible for onclick handlers
                    window.removeVectorizer = removeVectorizer;
                    window.updateVectorizerType = updateVectorizerType;
                    window.updateVectorizerName = updateVectorizerName;
                    window.updateVectorizerIndexType = updateVectorizerIndexType;
                    window.updateVectorizerModuleConfig = updateVectorizerModuleConfig;
                    
                    // Initialize when DOM is ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initForm);
                    } else {
                        // DOM is already ready, call initForm with a small delay to ensure everything is rendered
                        setTimeout(initForm, 10);
                    }
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
      await vscode.commands.executeCommand(
        'setContext',
        'weaviateConnectionsEmpty',
        this.connections.length === 0
      );

      this._onDidChangeTreeData.fire(undefined);
      return connection.name;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete connection: ${errorMessage}`);
    }
  }

  /**
   * Fetches cluster statistics from the Weaviate instance.
   * Callers are responsible for showing confirmation dialogs if needed.
   * @param connectionId The ID of the connection to fetch statistics for
   * @returns The cluster statistics
   * @throws Error if the connection doesn't exist or fetching fails
   */
  async fetchClusterStatistics(
    connection: {
      httpSecure: boolean;
      httpHost: string;
      httpPort: number;
      apiKey?: string;
      cloudUrl?: string;
      type: string;
    },
    connectionId: string
  ) {
    var protocol = connection.httpSecure ? https : http;
    let url: string = '';
    if (connection.type === 'cloud') {
      // remove https or http if couldUrl has it
      if (connection.cloudUrl) {
        connection.cloudUrl = connection.cloudUrl.replace(/^https?:\/\//, '');
      }
      url = `https://${connection.cloudUrl}/v1/cluster/statistics`;
      protocol = https;
    } else {
      url = `${connection.httpSecure ? 'https' : 'http'}://${connection.httpHost}:${connection.httpPort}/v1/cluster/statistics`;
    }

    return new Promise<any>((resolve, reject) => {
      protocol
        .get(
          url,
          {
            headers: {
              ...(connection.apiKey && { Authorization: `Bearer ${connection.apiKey}` }),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                resolve(data);
              } catch (err) {
                reject(err);
              }
            });
          }
        )
        .on('error', reject);
    });
  }

  /**
   * Humanizes duration between two timestamps
   * @param startedAt - Start timestamp
   * @param completedAt - End timestamp
   * @returns Humanized duration string (e.g., "2h 30m", "45s", "5m 12s")
   */
  private humanizeDuration(startedAt: string, completedAt: string): string | null {
    try {
      const start = new Date(startedAt).getTime();
      const end = new Date(completedAt).getTime();
      const diffMs = end - start;

      if (diffMs < 0 || isNaN(diffMs)) {
        return null;
      }

      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      const parts: string[] = [];

      if (days > 0) {
        parts.push(`${days}d`);
      }
      if (hours % 24 > 0) {
        parts.push(`${hours % 24}h`);
      }
      if (minutes % 60 > 0) {
        parts.push(`${minutes % 60}m`);
      }
      if (seconds % 60 > 0 && hours === 0) {
        // Only show seconds if less than an hour
        parts.push(`${seconds % 60}s`);
      }

      return parts.length > 0 ? parts.join(' ') : '0s';
    } catch (error) {
      return null;
    }
  }

  async flattenObject(
    node: Record<string, unknown>,
    exclude_keys: string[] = [],
    parentKey = '',
    sorted?: boolean
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    const filteredNode = Object.fromEntries(
      Object.entries(node).filter(([key]) => !exclude_keys.includes(key))
    );

    for (const [key, value] of Object.entries(filteredNode)) {
      const newKey = parentKey ? `${parentKey} ${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // recurse into nested object
        const flattenedChild = await this.flattenObject(
          value as Record<string, unknown>,
          exclude_keys,
          newKey
        );
        Object.assign(result, flattenedChild);
      } else {
        result[newKey] = value;
      }
    }
    if (sorted) {
      return Object.fromEntries(Object.entries(result).sort());
    }
    return result;
  }

  /**
   * Generates HTML for the Collection Options selection webview
   * @param connectionId - The ID of the connection to check for existing collections
   * @returns The HTML content for the webview
   */
  private getCollectionOptionsHtml(connectionId: string): string {
    // Check if there are existing collections to determine if clone option should be shown
    const collections = this.collections[connectionId] || [];
    const hasCollections = collections.length > 0;

    // Generate clone option HTML conditionally
    const cloneOptionHtml = hasCollections
      ? `
                        <div class="option-card" onclick="selectOption('cloneExisting')">
                            <span class="option-icon">📋</span>
                            <div class="option-title">Clone Existing Collection</div>
                            <div class="option-description">Create a new collection based on an existing collection's schema and configuration. Perfect for creating similar collections.</div>
                        </div>`
      : '';

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Create Collection</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif);
                        font-size: 14px;
                        line-height: 1.4;
                        color: var(--vscode-foreground, #2D2D2D);
                        background-color: var(--vscode-editor-background, #FFFFFF);
                        margin: 0;
                        padding: 0;
                    }
                    
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 24px;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 32px;
                    }
                    
                    .header h2 {
                        margin: 0 0 8px 0;
                        font-size: 20px;
                        font-weight: bold;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .header .subtitle {
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        font-size: 14px;
                    }
                    
                    .options-container {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    
                    .option-card {
                        border: 1px solid var(--vscode-panel-border, #CCCCCC);
                        border-radius: 8px;
                        padding: 20px;
                        background: var(--vscode-editor-background, #FFFFFF);
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .option-card:hover {
                        border-color: var(--vscode-focusBorder, #007ACC);
                        box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
                    }
                    
                    .option-icon {
                        font-size: 24px;
                        margin-bottom: 12px;
                        display: block;
                    }
                    
                    .option-title {
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 8px;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .option-description {
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        font-size: 13px;
                        line-height: 1.5;
                    }
                    
                    .button-group {
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                        margin-top: 24px;
                        padding-top: 16px;
                        border-top: 1px solid var(--vscode-panel-border, #CCCCCC);
                    }
                    
                    .cancel-button {
                        background: transparent;
                        border: 1px solid var(--vscode-button-secondaryBorder, #CCCCCC);
                        color: var(--vscode-button-secondaryForeground, #2D2D2D);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                        transition: all 0.2s ease;
                    }
                    
                    .cancel-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground, #F3F3F3);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Create Collection</h2>
                        <div class="subtitle">Choose how you want to create your new collection</div>
                    </div>
                    
                    <div class="options-container">
                        <div class="option-card" onclick="selectOption('fromScratch')">
                            <span class="option-icon">📝</span>
                            <div class="option-title">From Scratch</div>
                            <div class="option-description">Create a new collection by defining its structure, properties, and configuration from the ground up.</div>
                        </div>
                        ${cloneOptionHtml}
                        <div class="option-card" onclick="selectOption('importFromFile')">
                            <span class="option-icon">📁</span>
                            <div class="option-title">Import from File</div>
                            <div class="option-description">Import a collection schema from a JSON file. Useful for recreating collections or sharing configurations.</div>
                        </div>
                    </div>
                    
                    <div class="button-group">
                        <button type="button" class="cancel-button" onclick="cancel()">Cancel</button>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function selectOption(option) {
                        vscode.postMessage({
                            command: 'selectOption',
                            option: option
                        });
                    }
                    
                    function cancel() {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    }

          // Handle messages from the extension (e.g., error reporting)
          window.addEventListener('message', (event) => {
            const message = event.data;
            if (!message || !message.command) return;
            switch (message.command) {
              case 'error':
                // Display errors coming from the extension (e.g., import/creation failures)
                showError(message.message || 'An unknown error occurred');
                break;
              default:
                // No-op for other commands (reserved for future use)
                break;
            }
          });
                </script>
            </body>
            </html>
        `;
  }

  /**
   * Generates HTML for the Clone Collection webview
   * @param connectionId - The ID of the connection
   * @returns The HTML content for the webview
   */
  private async getCloneCollectionHtml(connectionId: string): Promise<string> {
    const collections = this.collections[connectionId] || [];
    const collectionsJson = JSON.stringify(collections.map((col) => col.label));

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Clone Collection</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif);
                        font-size: 14px;
                        line-height: 1.4;
                        color: var(--vscode-foreground, #2D2D2D);
                        background-color: var(--vscode-editor-background, #FFFFFF);
                        margin: 0;
                        padding: 0;
                    }
                    
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 24px;
                    }
                    
                    .header {
                        margin-bottom: 32px;
                    }
                    
                    .header h2 {
                        margin: 0 0 8px 0;
                        font-size: 18px;
                        font-weight: bold;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .header .subtitle {
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        font-size: 14px;
                    }
                    
                    .form-section {
                        margin-bottom: 24px;
                        border: 1px solid var(--vscode-panel-border, #CCCCCC);
                        border-radius: 4px;
                        background: var(--vscode-editor-background, #FFFFFF);
                        padding: 20px;
                    }
                    
                    .form-field {
                        margin-bottom: 16px;
                    }
                    
                    .form-field label {
                        display: block;
                        margin-bottom: 6px;
                        font-weight: 500;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .form-field input,
                    .form-field select {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid var(--vscode-input-border, #CCCCCC);
                        background: var(--vscode-input-background, #F3F3F3);
                        color: var(--vscode-input-foreground, #2D2D2D);
                        border-radius: 4px;
                        font-family: inherit;
                        font-size: 14px;
                    }
                    
                    .form-field input:focus,
                    .form-field select:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder, #007ACC);
                        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
                    }
                    
                    .hint {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground, #9E9E9E);
                        margin-top: 4px;
                        font-style: italic;
                    }
                    
                    .error {
                        display: none;
                        padding: 12px;
                        margin: 16px 0;
                        background: var(--vscode-inputValidation-errorBackground, #5A1D1D);
                        border: 1px solid var(--vscode-inputValidation-errorBorder, #FF5555);
                        border-radius: 4px;
                        color: var(--vscode-errorForeground, #F85149);
                        font-size: 13px;
                    }
                    
                    .schema-preview {
                        background: var(--vscode-textBlockQuote-background, #F6F8FA);
                        border: 1px solid var(--vscode-textBlockQuote-border, #D0D7DE);
                        border-radius: 4px;
                        padding: 16px;
                        font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                        font-size: 12px;
                        max-height: 300px;
                        overflow-y: auto;
                        white-space: pre;
                        color: var(--vscode-editor-foreground, #2D2D2D);
                    }
                    
                    .button-group {
                        display: flex;
                        justify-content: space-between;
                        gap: 12px;
                        margin-top: 24px;
                        padding-top: 16px;
                        border-top: 1px solid var(--vscode-panel-border, #CCCCCC);
                    }
                    
                    .back-button {
                        background: transparent;
                        border: 1px solid var(--vscode-button-secondaryBorder, #CCCCCC);
                        color: var(--vscode-button-secondaryForeground, #2D2D2D);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                    }
                    
                    .back-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground, #F3F3F3);
                    }
                    
                    .action-buttons {
                        display: flex;
                        gap: 12px;
                    }
                    
                    .cancel-button {
                        background: transparent;
                        border: 1px solid var(--vscode-button-secondaryBorder, #CCCCCC);
                        color: var(--vscode-button-secondaryForeground, #2D2D2D);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                    }
                    
                    .cancel-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground, #F3F3F3);
                    }
                    
                    .primary-button {
                        background: var(--vscode-button-background, #0E639C);
                        border: none;
                        color: var(--vscode-button-foreground, #FFFFFF);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    
                    .primary-button:hover:not(:disabled) {
                        background: var(--vscode-button-hoverBackground, #1177BB);
                    }
                    
                    .primary-button:disabled {
                        background: var(--vscode-button-secondaryBackground, #5F6A79);
                        cursor: not-allowed;
                        opacity: 0.6;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Clone Collection</h2>
                        <div class="subtitle">Create a new collection based on an existing one</div>
                    </div>
                    
                    <form id="cloneForm">
                        <div class="form-section">
                            <div class="form-field">
                                <label for="sourceCollection">Source Collection</label>
                                <select id="sourceCollection" required>
                                    <option value="">Select a collection to clone...</option>
                                </select>
                                <div class="hint">Choose the collection you want to clone</div>
                            </div>
                            
                            <div class="form-field">
                                <label for="newCollectionName">New Collection Name</label>
                                <input type="text" id="newCollectionName" required placeholder="e.g., Articles_v2, Products_Test">
                                <div class="hint">Enter a name for the new collection</div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h3>Schema Preview</h3>
                            <div id="schemaPreview" class="schema-preview">Select a source collection to see its schema...</div>
                        </div>
                        
                        <div class="error" id="formError" role="alert"></div>
                        
                        <div class="button-group">
                            <button type="button" class="back-button" onclick="goBack()">Back</button>
                            <div class="action-buttons">
                                <button type="button" class="cancel-button" onclick="cancel()">Cancel</button>
                                <button type="submit" class="primary-button" id="cloneButton" disabled>Clone Collection</button>
                            </div>
                        </div>
                    </form>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    const existingCollections = ${collectionsJson};
                    let sourceSchema = null;
                    
                    function showError(message) {
                        const errorElement = document.getElementById('formError');
                        errorElement.textContent = message;
                        errorElement.style.display = 'block';
                    }
                    
                    function hideError() {
                        const errorElement = document.getElementById('formError');
                        errorElement.style.display = 'none';
                    }
                    
                    function goBack() {
                        vscode.postMessage({
                            command: 'back'
                        });
                    }
                    
                    function cancel() {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    }
                    
                    // Populate source collections dropdown
                    const sourceSelect = document.getElementById('sourceCollection');
                    existingCollections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection;
                        option.textContent = collection;
                        sourceSelect.appendChild(option);
                    });
                    
                    // Handle source collection selection
                    document.getElementById('sourceCollection').addEventListener('change', async (e) => {
                        const selectedCollection = e.target.value;
                        const cloneButton = document.getElementById('cloneButton');
                        const schemaPreview = document.getElementById('schemaPreview');
                        
                        if (selectedCollection) {
                            // Request schema from the extension
                            vscode.postMessage({
                                command: 'getSchema',
                                collectionName: selectedCollection
                            });
                            
                            schemaPreview.textContent = 'Loading schema...';
                            cloneButton.disabled = false;
                        } else {
                            sourceSchema = null;
                            schemaPreview.textContent = 'Select a source collection to see its schema...';
                            cloneButton.disabled = true;
                        }
                    });
                    
                    // Handle form submission
                    document.getElementById('cloneForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        
                        const sourceCollection = document.getElementById('sourceCollection').value;
                        const newCollectionName = document.getElementById('newCollectionName').value.trim();
                        
                        if (!sourceCollection) {
                            showError('Please select a source collection');
                            return;
                        }
                        
                        if (!newCollectionName) {
                            showError('Please enter a name for the new collection');
                            return;
                        }
                        
                        if (existingCollections.includes(newCollectionName)) {
                            showError('A collection with this name already exists');
                            return;
                        }
                        
                        if (!sourceSchema) {
                            showError('Schema not loaded. Please select a source collection again.');
                            return;
                        }
                        
                        // Send clone request
                        vscode.postMessage({
                            command: 'clone',
                            sourceCollection: sourceCollection,
                            newCollectionName: newCollectionName,
                            schema: sourceSchema
                        });
                    });
                    
                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'schema':
                                sourceSchema = message.schema;
                                document.getElementById('schemaPreview').textContent = JSON.stringify(message.schema, null, 2);
                                break;
                            case 'error':
                                showError(message.message);
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
  }

  /**
   * Generates HTML for the Import Collection webview
   * @returns The HTML content for the webview
   */
  private getImportCollectionHtml(): string {
    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Import Collection</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif);
                        font-size: 14px;
                        line-height: 1.4;
                        color: var(--vscode-foreground, #2D2D2D);
                        background-color: var(--vscode-editor-background, #FFFFFF);
                        margin: 0;
                        padding: 0;
                    }
                    
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 24px;
                    }
                    
                    .header {
                        margin-bottom: 32px;
                    }
                    
                    .header h2 {
                        margin: 0 0 8px 0;
                        font-size: 18px;
                        font-weight: bold;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .header .subtitle {
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                        font-size: 14px;
                    }
                    
                    .form-section {
                        margin-bottom: 24px;
                        border: 1px solid var(--vscode-panel-border, #CCCCCC);
                        border-radius: 4px;
                        background: var(--vscode-editor-background, #FFFFFF);
                        padding: 20px;
                    }
                    
                    .file-drop-area {
                        border: 2px dashed var(--vscode-panel-border, #CCCCCC);
                        border-radius: 8px;
                        padding: 40px;
                        text-align: center;
                        background: var(--vscode-textBlockQuote-background, #F6F8FA);
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .file-drop-area:hover,
                    .file-drop-area.dragover {
                        border-color: var(--vscode-focusBorder, #007ACC);
                        background: rgba(0, 122, 204, 0.05);
                    }
                    
                    .file-drop-area .icon {
                        font-size: 48px;
                        margin-bottom: 16px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                    }
                    
                    .file-drop-area .text {
                        font-size: 16px;
                        margin-bottom: 8px;
                        color: var(--vscode-foreground, #2D2D2D);
                    }
                    
                    .file-drop-area .subtext {
                        font-size: 13px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                    }
                    
                    .file-input {
                        display: none;
                    }
                    
                    .file-info {
                        display: none;
                        margin-top: 16px;
                        padding: 12px;
                        background: var(--vscode-editor-background, #FFFFFF);
                        border: 1px solid var(--vscode-panel-border, #CCCCCC);
                        border-radius: 4px;
                    }
                    
                    .file-name {
                        font-weight: 500;
                        color: var(--vscode-foreground, #2D2D2D);
                        margin-bottom: 4px;
                    }
                    
                    .file-size {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground, #6A6A6A);
                    }
                    
                    .schema-preview {
                        background: var(--vscode-textBlockQuote-background, #F6F8FA);
                        border: 1px solid var(--vscode-textBlockQuote-border, #D0D7DE);
                        border-radius: 4px;
                        padding: 16px;
                        font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                        font-size: 12px;
                        max-height: 300px;
                        overflow-y: auto;
                        white-space: pre;
                        color: var(--vscode-editor-foreground, #2D2D2D);
                        margin-top: 16px;
                    }
                    
                    .error {
                        display: none;
                        padding: 12px;
                        margin: 16px 0;
                        background: var(--vscode-inputValidation-errorBackground, #5A1D1D);
                        border: 1px solid var(--vscode-inputValidation-errorBorder, #FF5555);
                        border-radius: 4px;
                        color: var(--vscode-errorForeground, #F85149);
                        font-size: 13px;
                    }
                    
                    .button-group {
                        display: flex;
                        justify-content: space-between;
                        gap: 12px;
                        margin-top: 24px;
                        padding-top: 16px;
                        border-top: 1px solid var(--vscode-panel-border, #CCCCCC);
                    }
                    
                    .back-button {
                        background: transparent;
                        border: 1px solid var(--vscode-button-secondaryBorder, #CCCCCC);
                        color: var(--vscode-button-secondaryForeground, #2D2D2D);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                    }
                    
                    .back-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground, #F3F3F3);
                    }
                    
                    .action-buttons {
                        display: flex;
                        gap: 12px;
                    }
                    
                    .cancel-button {
                        background: transparent;
                        border: 1px solid var(--vscode-button-secondaryBorder, #CCCCCC);
                        color: var(--vscode-button-secondaryForeground, #2D2D2D);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                    }
                    
                    .cancel-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground, #F3F3F3);
                    }
                    
                    .primary-button {
                        background: var(--vscode-button-background, #0E639C);
                        border: none;
                        color: var(--vscode-button-foreground, #FFFFFF);
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 13px;
                        font-weight: 500;
                    }
                    
                    .primary-button:hover:not(:disabled) {
                        background: var(--vscode-button-hoverBackground, #1177BB);
                    }
                    
                    .primary-button:disabled {
                        background: var(--vscode-button-secondaryBackground, #5F6A79);
                        cursor: not-allowed;
                        opacity: 0.6;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Import Collection</h2>
                        <div class="subtitle">Import a collection schema from a JSON file</div>
                    </div>
                    
                    <div class="form-section">
                        <div class="file-drop-area" onclick="selectFile()" ondrop="handleDrop(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
                            <div class="icon">📁</div>
                            <div class="text">Drop a JSON file here or click to browse</div>
                            <div class="subtext">Supported formats: .json</div>
                        </div>
                        
                        <input type="file" id="fileInput" class="file-input" accept=".json" onchange="handleFileSelect(event)">
                        
                        <div class="file-info" id="fileInfo">
                            <div class="file-name" id="fileName"></div>
                            <div class="file-size" id="fileSize"></div>
                        </div>
                        
                        <div id="schemaPreview" class="schema-preview" style="display: none;"></div>
                    </div>
                    
                    <div class="error" id="formError" role="alert"></div>
                    
                    <div class="button-group">
                        <button type="button" class="back-button" onclick="goBack()">Back</button>
                        <div class="action-buttons">
                            <button type="button" class="cancel-button" onclick="cancel()">Cancel</button>
                            <button type="button" class="primary-button" id="editBeforeButton" disabled onclick="editBeforeImport()">Edit Before</button>
                            <button type="button" class="primary-button" id="createButton" disabled onclick="createCollection()">Create</button>
                        </div>
                    </div>
                </div>
                
        <script>
          const vscode = acquireVsCodeApi();
          let selectedSchema = null;
          let creating = false;
                    
                    function selectFile() {
                        document.getElementById('fileInput').click();
                    }
                    
                    function handleFileSelect(event) {
                        const file = event.target.files[0];
                        if (file) {
                            processFile(file);
                        }
                    }
                    
                    function handleDrop(event) {
                        event.preventDefault();
                        const dropArea = event.currentTarget;
                        dropArea.classList.remove('dragover');
                        
                        const files = event.dataTransfer.files;
                        if (files.length > 0) {
                            processFile(files[0]);
                        }
                    }
                    
                    function handleDragOver(event) {
                        event.preventDefault();
                        event.currentTarget.classList.add('dragover');
                    }
                    
                    function handleDragLeave(event) {
                        event.currentTarget.classList.remove('dragover');
                    }
                    
                    function processFile(file) {
                        if (!file.name.endsWith('.json')) {
                            showError('Please select a JSON file');
                            return;
                        }
                        
                        // Show file info
                        const fileInfo = document.getElementById('fileInfo');
                        const fileName = document.getElementById('fileName');
                        const fileSize = document.getElementById('fileSize');
                        
                        fileName.textContent = file.name;
                        fileSize.textContent = formatFileSize(file.size);
                        fileInfo.style.display = 'block';
                        
                        // Read file content
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            try {
                                const content = e.target.result;
                                selectedSchema = JSON.parse(content);
                                
                                // Validate schema structure
                                if (!selectedSchema.class) {
                                    throw new Error('Invalid schema: missing "class" property');
                                }
                                
                                // Show schema preview
                                const schemaPreview = document.getElementById('schemaPreview');
                                schemaPreview.textContent = JSON.stringify(selectedSchema, null, 2);
                                schemaPreview.style.display = 'block';
                                
                                // Enable buttons
                                document.getElementById('editBeforeButton').disabled = false;
                                document.getElementById('createButton').disabled = false;
                                hideError();
                                
                            } catch (error) {
                                showError('Invalid JSON file: ' + error.message);
                                selectedSchema = null;
                                document.getElementById('editBeforeButton').disabled = true;
                                document.getElementById('createButton').disabled = true;
                                document.getElementById('schemaPreview').style.display = 'none';
                            }
                        };
                        
                        reader.onerror = function() {
                            showError('Error reading file');
                        };
                        
                        reader.readAsText(file);
                    }
                    
                    function formatFileSize(bytes) {
                        if (bytes === 0) return '0 Bytes';
                        
                        const k = 1024;
                        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    }
                    
          function createCollection() {
            if (creating) return;
            if (!selectedSchema) {
                            showError('Please select a valid JSON file');
                            return;
                        }
            // Set busy state to prevent duplicate submissions
            const createBtn = document.getElementById('createButton');
            const editBtn = document.getElementById('editBeforeButton');
            creating = true;
            if (createBtn) {
              createBtn.disabled = true;
              createBtn.textContent = 'Creating…';
            }
            if (editBtn) {
              editBtn.disabled = true;
            }

                        vscode.postMessage({
                            command: 'import',
                            schema: selectedSchema
                        });
                    }
                    
                    function editBeforeImport() {
                        if (!selectedSchema) {
                            showError('Please select a valid JSON file');
                            return;
                        }
                        
                        vscode.postMessage({
                            command: 'editBefore',
                            schema: selectedSchema
                        });
                    }
                    
                    function importCollection() {
                        // This function is kept for backward compatibility, but redirects to createCollection
                        createCollection();
                    }
                    
                    function showError(message) {
                        const errorElement = document.getElementById('formError');
                        errorElement.textContent = message;
                        errorElement.style.display = 'block';
                    }
                    
                    function hideError() {
                        const errorElement = document.getElementById('formError');
                        errorElement.style.display = 'none';
                    }
                    
                    function goBack() {
                        vscode.postMessage({
                            command: 'back'
                        });
                    }
                    
          function cancel() {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    }

          // Receive messages from extension (e.g., error feedback)
          window.addEventListener('message', (event) => {
            const message = event.data || {};
            if (message.command === 'error') {
              showError(message.message || 'An unknown error occurred');
              // reset busy state so user can retry
              const createBtn = document.getElementById('createButton');
              const editBtn = document.getElementById('editBeforeButton');
              creating = false;
              if (createBtn) {
                createBtn.disabled = false;
                createBtn.textContent = 'Create';
              }
              if (editBtn) {
                editBtn.disabled = false;
              }
            }
          });
                </script>
            </body>
            </html>
        `;
  }

  /**
   * Sets up message handlers for the Add Collection webview
   * @param panel - The webview panel
   * @param connectionId - The connection ID
   * @param showOptionsOnBack - Whether to show options on back (for multi-step flow)
   * @deprecated Use AddCollectionPanel instead
   */
  private setupAddCollectionMessageHandlers(
    panel: vscode.WebviewPanel,
    connectionId: string,
    showOptionsOnBack: boolean = false
  ): void {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'create':
            try {
              await this.createCollection(connectionId, message.schema);
              panel.dispose();
              vscode.window.showInformationMessage(
                `Collection "${message.schema.class}" created successfully`
              );
              await this.fetchData(connectionId);
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: error instanceof Error ? error.message : String(error),
              });
            }
            break;
          case 'cancel':
            panel.dispose();
            break;
          case 'back':
            if (showOptionsOnBack) {
              panel.webview.html = this.getCollectionOptionsHtml(connectionId);
            } else {
              panel.dispose();
            }
            break;
          case 'getVectorizers':
            try {
              const client = this.connectionManager.getClient(connectionId);
              const vectorizers = await this.getAvailableVectorizers(connectionId);

              panel.webview.postMessage({
                command: 'vectorizers',
                vectorizers: vectorizers,
              });

              try {
                if (client) {
                  const version = this.clusterMetadataCache[connectionId]?.version;
                  panel.webview.postMessage({
                    command: 'serverVersion',
                    version: version || 'unknown',
                  });
                }
              } catch (_) {
                // ignore version errors
              }
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: `Failed to fetch vectorizers: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
            break;
          case 'getCollections':
            try {
              const collections = this.collections[connectionId] || [];
              panel.webview.postMessage({
                command: 'collections',
                collections: collections.map((col) => col.label),
              });
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: `Failed to fetch collections: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Sets up message handlers for the Clone Collection webview
   */
  private setupCloneCollectionMessageHandlers(
    panel: vscode.WebviewPanel,
    connectionId: string
  ): void {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'getSchema':
            try {
              const collections = this.collections[connectionId] || [];
              const targetCollection = collections.find(
                (col: any) => col.label === message.collectionName
              );

              if (!targetCollection) {
                throw new Error(`Collection "${message.collectionName}" not found`);
              }

              // Convert the raw schema to API format for preview
              const convertedSchema = this.convertSchemaToApiFormat(targetCollection.schema);

              panel.webview.postMessage({
                command: 'schema',
                schema: convertedSchema,
              });
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: `Failed to fetch schema: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
            break;
          case 'clone':
            try {
              // Get the original schema from the collection, not from the message
              const collections = this.collections[connectionId] || [];
              const targetCollection = collections.find(
                (col: any) => col.label === message.sourceCollection
              );

              if (!targetCollection) {
                throw new Error(`Collection "${message.sourceCollection}" not found`);
              }

              // Convert the raw schema to API format first using the same logic as exportSchema
              const convertedSchema = this.convertSchemaToApiFormat(targetCollection.schema);

              // Create a new schema based on the converted schema with new name
              const clonedSchema = {
                ...convertedSchema,
                class: message.newCollectionName,
              };

              // Close the clone panel and open the new Add Collection panel with cloned schema
              panel.dispose();
              await this.addCollection(connectionId, clonedSchema);
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: error instanceof Error ? error.message : String(error),
              });
            }
            break;
          case 'back':
            panel.webview.html = this.getCollectionOptionsHtml(connectionId);
            break;
          case 'cancel':
            panel.dispose();
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Sets up message handlers for the Import Collection webview
   */
  private setupImportCollectionMessageHandlers(
    panel: vscode.WebviewPanel,
    connectionId: string
  ): void {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'import':
            try {
              await this.createCollection(connectionId, message.schema);
              panel.dispose();
              vscode.window.showInformationMessage(
                `Collection "${message.schema.class}" imported successfully`
              );
              await this.fetchData(connectionId);
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: error instanceof Error ? error.message : String(error),
              });
            }
            break;
          case 'editBefore':
            try {
              // Close the import panel and open the new Add Collection panel with imported schema
              panel.dispose();
              await this.addCollection(connectionId, message.schema);
            } catch (error) {
              panel.webview.postMessage({
                command: 'error',
                message: error instanceof Error ? error.message : String(error),
              });
            }
            break;
          case 'back':
            panel.webview.html = this.getCollectionOptionsHtml(connectionId);
            break;
          case 'cancel':
            panel.dispose();
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }
}
