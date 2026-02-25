import * as vscode from 'vscode';
import { ConnectionManager, WeaviateConnection } from '../services/ConnectionManager';
import {
  WeaviateTreeItem,
  ConnectionConfig,
  CollectionsMap,
  CollectionWithSchema,
  WeaviateMetadata,
  BackupItem,
  AliasItem,
} from '../types';
import { ViewRenderer } from '../views/ViewRenderer';
import { AddCollectionPanel } from '../views/AddCollectionPanel';
import { QueryEditorPanel } from '../query-editor/extension/QueryEditorPanel';
import { AddCollectionPanel, WebviewToExtensionMessage } from '../views/AddCollectionPanel';
import { ClusterPanel } from '../views/ClusterPanel';
import { CollectionConfig, Node, ShardingConfig, VectorConfig } from 'weaviate-client';
import * as https from 'https';
import * as http from 'http';
import { WEAVIATE_INTEGRATION_HEADER } from '../constants';

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
  /** Fetches and caches users for a connection (no-op if already cached). Throws on API error. */
  private async _ensureUsersCached(connectionId: string, client: any): Promise<void> {
    if (this.rbacCache[connectionId]?.users) {
      return;
    }
    const users = await client.users.db.listAll({ includeLastUsedTime: true });
    this.rbacCache[connectionId] = {
      ...(this.rbacCache[connectionId] || {}),
      users: Array.isArray(users) ? users : Object.values(users),
    };
  }

  /** Returns cached users for a connection, fetching them first if needed. */
  public async getUsers(connectionId: string): Promise<any[]> {
    const client = this.connectionManager.getClient(connectionId);
    if (!client) {
      return [];
    }
    try {
      await this._ensureUsersCached(connectionId, client);
    } catch (e) {
      return [];
    }
    return this.rbacCache[connectionId]?.users || [];
  }
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

  /** Cache of RBAC data per connection */
  private rbacCache: Record<
    string,
    {
      roles: any[];
      users: any[];
      groups: any[];
    }
  > = {};

  /** Stores the rbacGroup tree item per connectionId for targeted refresh */
  private rbacGroupItems: Map<string, WeaviateTreeItem> = new Map();

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
   * Generates a safe unique ID from a string by encoding it to base64.
   * This avoids issues with special characters like hyphens in identifiers.
   * @param input - The string to encode
   * @returns A URL-safe base64 encoded string
   */
  private generateSafeId(input: string): string {
    return Buffer.from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
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

  /**
   * Forces an immediate refresh by updating connections from ConnectionManager
   * and firing the tree data change event. Bypasses the debounce mechanism.
   */
  async forceRefresh(): Promise<void> {
    this.connections = this.connectionManager.getConnections();
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

      // Fetch the REST API JSON for this collection
      const baseUrl = this.getWeaviateBaseUrl(item.connectionId);
      const headers = this.getWeaviateHeaders(item.connectionId);

      const response = await fetch(`${baseUrl}/v1/schema/${collectionName}`, {
        method: 'GET',
        headers: headers,
      });

      let restApiJson: any = null;
      if (response.ok) {
        restApiJson = await response.json();
      } else {
        console.warn('Failed to fetch REST API schema, will show SDK format only');
        vscode.window.showWarningMessage(
          `Could not load REST API schema for "${collectionName}" (HTTP ${response.status} ${response.statusText}). The view will show SDK format only. Check your API key or server status.`
        );
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

      // Format the schema as HTML, passing both SDK format and REST API JSON
      panel.webview.html = this.getDetailedSchemaHtml(collection.schema, restApiJson);
    } catch (error) {
      console.error('Error viewing detailed schema:', error);
      vscode.window.showErrorMessage(
        `Failed to view detailed schema: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generates HTML for displaying detailed schema in a webview
   * @param schema The schema to display (SDK format)
   * @param restApiJson The REST API JSON format (optional)
   */
  private getDetailedSchemaHtml(schema: CollectionConfig, restApiJson?: any): string {
    return this.viewRenderer.renderDetailedSchema(schema, restApiJson);
  }

  // #endregion Command Handlers

  // Helper to get connected status theme icon
  getStatusIcon(status: 'connected' | 'disconnected' | 'connecting'): vscode.ThemeIcon {
    if (status === 'connected') {
      // Green dot for connected
      return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
    } else if (status === 'connecting') {
      // Syncing icon for connecting
      return new vscode.ThemeIcon('sync~spin');
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
    if (element.itemType === 'properties') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('symbol-property');
      }
      element.tooltip = 'View collection properties';
    } else if (element.itemType === 'vectorConfig') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('arrow-both');
      }
      element.tooltip = 'Vector configuration and modules';
    } else if (element.itemType === 'invertedIndex') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('search');
      }
      element.tooltip = 'Index configuration';
    } else if (element.itemType === 'statistics') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('graph');
      }
      element.tooltip = 'Collection statistics';
    } else if (element.itemType === 'sharding') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('layout');
      }
      element.tooltip = 'Sharding and replication configuration';
    } else if (element.itemType === 'serverInfo') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('server');
      }
      element.tooltip = 'Server version and information';
    } else if (element.itemType === 'modules') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('extensions');
      }
      element.tooltip = 'Available Weaviate modules';
    } else if (element.itemType === 'collectionsGroup') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('database');
      }
      element.tooltip = 'Collections in this instance';
    } else if (element.itemType === 'backups') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('archive');
      }
      element.tooltip = 'Backups for this cluster';
    } else if (element.itemType === 'backupItem') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('file-zip');
      }
      element.tooltip = 'Backup details';
    } else if (element.itemType === 'aliases') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('link');
      }
      element.tooltip = 'Aliases for this cluster';
    } else if (element.itemType === 'aliasItem') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('symbol-reference');
      }
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
    } else if (element.itemType === 'objectTtlConfig') {
      if (!element.iconPath) {
        element.iconPath = new vscode.ThemeIcon('clock');
      }
      element.tooltip =
        'Object Time to Live (TTL): automatically expires and removes objects after a set duration';
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
    // RBAC: Role Details - Show permissions for a specific role
    if (element?.itemType === 'rbacRole' && element.connectionId && element.itemId) {
      const roles = this.rbacCache[element.connectionId]?.roles || [];
      const role = roles.find((r: any) => r.name === element.itemId);

      if (!role) {
        return [];
      }

      const permissionGroups: WeaviateTreeItem[] = [];

      // Helper to count non-empty permissions
      const getPermissionCount = (perms: any[]): number => perms?.length || 0;

      // Add each permission type as a collapsible group
      const permissionTypes = [
        { key: 'aliasPermissions', label: 'Alias Permissions', icon: 'symbol-namespace' },
        { key: 'backupsPermissions', label: 'Backups Permissions', icon: 'database' },
        { key: 'clusterPermissions', label: 'Cluster Permissions', icon: 'server' },
        { key: 'collectionsPermissions', label: 'Collections Permissions', icon: 'folder-library' },
        { key: 'dataPermissions', label: 'Data Permissions', icon: 'file' },
        { key: 'groupsPermissions', label: 'Groups Permissions', icon: 'organization' },
        { key: 'nodesPermissions', label: 'Nodes Permissions', icon: 'circuit-board' },
        { key: 'replicatePermissions', label: 'Replicate Permissions', icon: 'sync' },
        { key: 'rolesPermissions', label: 'Roles Permissions', icon: 'shield' },
        { key: 'tenantsPermissions', label: 'Tenants Permissions', icon: 'group-by-ref-type' },
        { key: 'usersPermissions', label: 'Users Permissions', icon: 'account' },
      ].sort((a, b) => a.label.localeCompare(b.label));

      for (const permType of permissionTypes) {
        const permissions = role[permType.key];
        const count = getPermissionCount(permissions);

        if (count > 0) {
          const safeId = this.generateSafeId(`${element.itemId}-${permType.key}`);
          const permItem = new WeaviateTreeItem(
            `${permType.label} (${count})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'rbacRolePermissionsGroup',
            element.connectionId,
            undefined,
            safeId,
            new vscode.ThemeIcon(permType.icon),
            'weaviateRbacRolePermissionsGroup',
            undefined
          );
          permItem.id = `${element.connectionId}:rolePerm:${safeId}`;
          permissionGroups.push(permItem);
        }
      }

      return permissionGroups;
    }

    // RBAC: Role Permission Details - Show fields of a specific permission
    if (element?.itemType === 'rbacRolePermission' && element.connectionId && element.itemId) {
      // Decode the safe ID to get role name, permission type, and index
      const decodedId = Buffer.from(
        element.itemId.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString();
      const parts = decodedId.split('-');
      const index = parseInt(parts.pop() || '0', 10);
      const permissionKey = parts.pop() || '';
      const roleName = parts.join('-');

      const roles = this.rbacCache[element.connectionId]?.roles || [];
      const role = roles.find((r: any) => r.name === roleName);

      if (!role || !role[permissionKey] || !role[permissionKey][index]) {
        return [];
      }

      const perm = role[permissionKey][index];
      const details: WeaviateTreeItem[] = [];

      // Add each field as a tree item
      const fieldMapping = [
        { key: 'collection', label: 'Collection', icon: 'folder-library' },
        { key: 'tenant', label: 'Tenant', icon: 'group-by-ref-type' },
        { key: 'role', label: 'Role', icon: 'shield' },
        { key: 'users', label: 'Users', icon: 'account' },
        { key: 'groupType', label: 'Group Type', icon: 'organization' },
        { key: 'groupID', label: 'Group ID', icon: 'tag' },
        { key: 'alias', label: 'Alias', icon: 'symbol-namespace' },
        { key: 'shard', label: 'Shard', icon: 'database' },
        { key: 'verbosity', label: 'Verbosity', icon: 'output' },
        { key: 'actions', label: 'Actions', icon: 'list-unordered' },
      ];

      fieldMapping.forEach((field) => {
        if (perm[field.key] !== undefined && perm[field.key] !== null) {
          const value = Array.isArray(perm[field.key])
            ? perm[field.key].join(', ')
            : String(perm[field.key]);
          const safeId = this.generateSafeId(`${roleName}-${permissionKey}-${index}-${field.key}`);

          details.push(
            new WeaviateTreeItem(
              `${field.label}: ${value}`,
              vscode.TreeItemCollapsibleState.None,
              'rbacRolePermissionDetail',
              element.connectionId,
              undefined,
              safeId,
              new vscode.ThemeIcon(field.icon),
              'weaviateRbacRolePermissionDetail',
              undefined
            )
          );
        }
      });

      return details;
    }

    // RBAC: Role Permission Group Details - Show individual permissions
    if (
      element?.itemType === 'rbacRolePermissionsGroup' &&
      element.connectionId &&
      element.itemId
    ) {
      // Decode the safe ID to get role name and permission type
      const decodedId = Buffer.from(
        element.itemId.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString();
      const lastDashIndex = decodedId.lastIndexOf('-');
      const roleName = decodedId.substring(0, lastDashIndex);
      const permissionKey = decodedId.substring(lastDashIndex + 1);

      const roles = this.rbacCache[element.connectionId]?.roles || [];
      const role = roles.find((r: any) => r.name === roleName);

      if (!role || !role[permissionKey]) {
        return [];
      }

      const permissions = role[permissionKey];
      return permissions.map((perm: any, index: number) => {
        const safeId = this.generateSafeId(`${roleName}-${permissionKey}-${index}`);

        // Create a concise label for the permission
        let label = `Permission ${index + 1}`;

        // Add key identifying info to the label
        const keyFields = [];
        if (perm.collection) {
          keyFields.push(perm.collection);
        }
        if (perm.tenant && perm.tenant !== perm.collection) {
          keyFields.push(perm.tenant);
        }
        if (perm.role) {
          keyFields.push(perm.role);
        }
        if (perm.users) {
          keyFields.push(perm.users);
        }
        if (perm.alias) {
          keyFields.push(perm.alias);
        }
        if (perm.groupID) {
          keyFields.push(perm.groupID);
        }

        if (keyFields.length > 0) {
          label = keyFields.join(' | ');
        }

        return new WeaviateTreeItem(
          label,
          vscode.TreeItemCollapsibleState.Collapsed,
          'rbacRolePermission',
          element.connectionId,
          undefined,
          safeId,
          new vscode.ThemeIcon('key'),
          'weaviateRbacRolePermission',
          perm.actions?.join(', ')
        );
      });
    }

    // RBAC: Roles
    if (element?.itemType === 'rbacRoles' && element.connectionId) {
      const client = this.connectionManager.getClient(element.connectionId);
      if (!client) {
        return [];
      }
      // Fetch and cache roles
      if (!this.rbacCache[element.connectionId]?.roles) {
        try {
          const roles = await client.roles.listAll();
          this.rbacCache[element.connectionId] = {
            ...(this.rbacCache[element.connectionId] || {}),
            roles: Array.isArray(roles) ? roles : Object.values(roles),
          };
        } catch (e) {
          return [
            new WeaviateTreeItem(
              'Error while getting roles',
              vscode.TreeItemCollapsibleState.None,
              'message',
              element.connectionId
            ),
          ];
        }
      }
      const roles = this.rbacCache[element.connectionId]?.roles || [];
      const BUILTIN_ROLES = new Set(['admin', 'root', 'read-only', 'viewer']);
      return roles
        .sort((a: any, b: any) => {
          const aBuiltin = BUILTIN_ROLES.has(a.name) ? 1 : 0;
          const bBuiltin = BUILTIN_ROLES.has(b.name) ? 1 : 0;
          if (aBuiltin !== bBuiltin) {
            return aBuiltin - bBuiltin;
          }
          return a.name.localeCompare(b.name);
        })
        .map((role: any) => {
          const isBuiltin = BUILTIN_ROLES.has(role.name);
          const item = new WeaviateTreeItem(
            role.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            'rbacRole',
            element.connectionId,
            undefined,
            role.name,
            new vscode.ThemeIcon(isBuiltin ? 'lock' : 'shield'),
            isBuiltin ? 'weaviateRbacRoleBuiltin' : 'weaviateRbacRole',
            undefined
          );
          item.id = `${element.connectionId}:role:${role.name}`;
          return item;
        });
    }

    // RBAC: User Details - Show details for a specific user
    if (element?.itemType === 'rbacUser' && element.connectionId && element.itemId) {
      const users = this.rbacCache[element.connectionId]?.users || [];
      const user = users.find((u: any) => u.id === element.itemId);

      if (!user) {
        return [];
      }

      const details: WeaviateTreeItem[] = [];

      // User Type
      details.push(
        new WeaviateTreeItem(
          `Type: ${user.userType}`,
          vscode.TreeItemCollapsibleState.None,
          'rbacUserDetail',
          element.connectionId,
          undefined,
          this.generateSafeId(`${user.id}-userType`),
          new vscode.ThemeIcon('tag'),
          'weaviateRbacUserDetail',
          undefined
        )
      );

      // Active Status
      details.push(
        new WeaviateTreeItem(
          `Status: ${user.active ? 'Active' : 'Inactive'}`,
          vscode.TreeItemCollapsibleState.None,
          'rbacUserDetail',
          element.connectionId,
          undefined,
          this.generateSafeId(`${user.id}-active`),
          new vscode.ThemeIcon(user.active ? 'pass' : 'circle-slash'),
          'weaviateRbacUserDetail',
          undefined
        )
      );

      // Created At (if available)
      if (user.createdAt) {
        details.push(
          new WeaviateTreeItem(
            `Created: ${new Date(user.createdAt).toLocaleString()}`,
            vscode.TreeItemCollapsibleState.None,
            'rbacUserDetail',
            element.connectionId,
            undefined,
            this.generateSafeId(`${user.id}-createdAt`),
            new vscode.ThemeIcon('calendar'),
            'weaviateRbacUserDetail',
            undefined
          )
        );
      }

      // Last Used At (if available)
      if (user.lastUsedAt) {
        details.push(
          new WeaviateTreeItem(
            `Last used: ${new Date(user.lastUsedAt).toLocaleString()}`,
            vscode.TreeItemCollapsibleState.None,
            'rbacUserDetail',
            element.connectionId,
            undefined,
            this.generateSafeId(`${user.id}-lastUsedAt`),
            new vscode.ThemeIcon('history'),
            'weaviateRbacUserDetail',
            undefined
          )
        );
      }

      // API Key First Letters (if available)
      if (user.apiKeyFirstLetters) {
        details.push(
          new WeaviateTreeItem(
            `API Key: ${user.apiKeyFirstLetters}...`,
            vscode.TreeItemCollapsibleState.None,
            'rbacUserDetail',
            element.connectionId,
            undefined,
            this.generateSafeId(`${user.id}-apiKey`),
            new vscode.ThemeIcon('key'),
            'weaviateRbacUserDetail',
            undefined
          )
        );
      }

      // Roles
      if (user.roleNames && user.roleNames.length > 0) {
        const userRolesItem = new WeaviateTreeItem(
          `Roles (${user.roleNames.length})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'rbacUserDetails',
          element.connectionId,
          undefined,
          user.id,
          new vscode.ThemeIcon('shield'),
          'weaviateRbacUserDetails',
          [...user.roleNames].sort((a: string, b: string) => a.localeCompare(b)).join(', ')
        );
        userRolesItem.id = `${element.connectionId}:userRoles:${user.id}`;
        details.push(userRolesItem);
      } else {
        details.push(
          new WeaviateTreeItem(
            'No roles assigned',
            vscode.TreeItemCollapsibleState.None,
            'rbacUserDetail',
            element.connectionId,
            undefined,
            this.generateSafeId(`${user.id}-noroles`),
            new vscode.ThemeIcon('shield'),
            'weaviateRbacUserDetail',
            undefined
          )
        );
      }

      return details;
    }

    // RBAC: User Details - Roles list
    if (element?.itemType === 'rbacUserDetails' && element.connectionId && element.itemId) {
      const userId = element.itemId;

      const users = this.rbacCache[element.connectionId]?.users || [];
      const user = users.find((u: any) => u.id === userId);

      if (!user || !user.roleNames) {
        return [];
      }

      return [...user.roleNames]
        .sort((a: string, b: string) => a.localeCompare(b))
        .map((roleName: string) => {
          return new WeaviateTreeItem(
            roleName,
            vscode.TreeItemCollapsibleState.None,
            'rbacUserDetail',
            element.connectionId,
            undefined,
            roleName,
            new vscode.ThemeIcon('shield'),
            'weaviateRbacRoleRef',
            undefined
          );
        });
    }

    // RBAC: Users
    if (element?.itemType === 'rbacUsers' && element.connectionId) {
      const client = this.connectionManager.getClient(element.connectionId);
      if (!client) {
        return [];
      }
      // Fetch and cache users
      try {
        await this._ensureUsersCached(element.connectionId, client);
      } catch (e) {
        return [
          new WeaviateTreeItem(
            'Error while getting users',
            vscode.TreeItemCollapsibleState.None,
            'message',
            element.connectionId
          ),
        ];
      }
      const users = this.rbacCache[element.connectionId]?.users || [];
      return users
        .sort((a: any, b: any) => a.id.localeCompare(b.id))
        .map((user) => {
          // Build contextValue based on active status and userType
          let contextValue = user.active ? 'weaviateRbacUserActive' : 'weaviateRbacUserInactive';
          if (user.userType === 'db_env_user') {
            contextValue += '_DbEnvUser';
          }

          // Choose icon based on userType
          let icon: vscode.ThemeIcon;
          if (user.userType === 'db_env_user') {
            // Special icon for db_env_user with color
            icon = new vscode.ThemeIcon(
              'lock',
              user.active
                ? new vscode.ThemeColor('charts.green')
                : new vscode.ThemeColor('charts.red')
            );
          } else {
            // Regular icon for other users
            icon = new vscode.ThemeIcon(
              user.active ? 'circle-filled' : 'error',
              user.active
                ? new vscode.ThemeColor('charts.green')
                : new vscode.ThemeColor('charts.red')
            );
          }

          const userItem = new WeaviateTreeItem(
            user.id,
            vscode.TreeItemCollapsibleState.Collapsed,
            'rbacUser',
            element.connectionId,
            undefined,
            user.id,
            icon,
            contextValue,
            user.active ? 'Active' : 'Inactive'
          );
          userItem.id = `${element.connectionId}:user:${user.id}`;
          return userItem;
        });
    }

    // RBAC: Groups
    // RBAC: Group Item - Show roles assigned to a group
    if (element?.itemType === 'rbacGroupItem' && element.connectionId && element.itemId) {
      const groupId = element.itemId;
      const client = this.connectionManager.getClient(element.connectionId);
      if (!client) {
        return [];
      }
      try {
        const assignedRolesMap = await client.groups.oidc.getAssignedRoles(groupId);
        const roleNames = Object.keys(assignedRolesMap || {});
        if (roleNames.length === 0) {
          return [
            new WeaviateTreeItem(
              'No roles assigned',
              vscode.TreeItemCollapsibleState.None,
              'rbacUserDetail',
              element.connectionId,
              undefined,
              `${groupId}-noroles`,
              new vscode.ThemeIcon('shield'),
              undefined,
              undefined
            ),
          ];
        }
        return roleNames
          .sort()
          .map(
            (roleName) =>
              new WeaviateTreeItem(
                roleName,
                vscode.TreeItemCollapsibleState.None,
                'rbacUserDetail',
                element.connectionId,
                undefined,
                roleName,
                new vscode.ThemeIcon('shield'),
                'weaviateRbacRoleRef',
                undefined
              )
          );
      } catch (e) {
        return [
          new WeaviateTreeItem(
            'Error loading roles',
            vscode.TreeItemCollapsibleState.None,
            'message',
            element.connectionId
          ),
        ];
      }
    }

    if (element?.itemType === 'rbacGroups' && element.connectionId) {
      const client = this.connectionManager.getClient(element.connectionId);
      if (!client) {
        return [];
      }
      // Fetch and cache groups
      if (!this.rbacCache[element.connectionId]?.groups) {
        try {
          const groups = await client.groups.oidc.getKnownGroupNames();
          this.rbacCache[element.connectionId] = {
            ...(this.rbacCache[element.connectionId] || {}),
            groups: Array.isArray(groups) ? groups : Object.values(groups),
          };
        } catch (e) {
          return [
            new WeaviateTreeItem(
              'Error while getting groups',
              vscode.TreeItemCollapsibleState.None,
              'message',
              element.connectionId
            ),
          ];
        }
      }
      const groups = this.rbacCache[element.connectionId]?.groups || [];
      return groups
        .sort((a: any, b: any) => a.localeCompare(b))
        .map((group: any) => {
          const item = new WeaviateTreeItem(
            group,
            vscode.TreeItemCollapsibleState.Collapsed,
            'rbacGroupItem',
            element.connectionId,
            undefined,
            group,
            new vscode.ThemeIcon('organization'),
            'weaviateRbacGroupItem',
            undefined
          );
          item.id = `${element.connectionId}:group:${group}`;
          return item;
        });
    }
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
          connection?.status === 'connecting'
            ? 'Connecting to cluster...'
            : connection?.status === 'connected'
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

      const backupsItem = new WeaviateTreeItem(
        backupsLabel,
        vscode.TreeItemCollapsibleState.Collapsed,
        'backups',
        element.connectionId,
        undefined,
        'backups',
        new vscode.ThemeIcon('archive'),
        'weaviateBackups'
      );
      backupsItem.id = `${element.connectionId}:backups`;
      items.push(backupsItem);

      // Add the Access Control (RBAC) item, expanded if any RBAC count > 0
      const connectionId = String(element.connectionId);
      let rbacExpanded = vscode.TreeItemCollapsibleState.Collapsed;
      let rbacCache = this.rbacCache[connectionId];
      // Always fetch RBAC data before rendering the RBAC tree item
      const client = this.connectionManager.getClient(connectionId);
      if (client) {
        const fetchRoles = async () => {
          if (!this.rbacCache[connectionId]?.roles) {
            try {
              const roles = await client.roles.listAll();
              this.rbacCache[connectionId] = {
                ...(this.rbacCache[connectionId] || {}),
                roles: Array.isArray(roles) ? roles : Object.values(roles),
              };
            } catch {}
          }
        };
        const fetchUsers = async () => {
          try {
            await this._ensureUsersCached(connectionId, client);
          } catch {}
        };
        const fetchGroups = async () => {
          if (!this.rbacCache[connectionId]?.groups) {
            try {
              const groups = await client.groups.oidc.getKnownGroupNames();
              this.rbacCache[connectionId] = {
                ...(this.rbacCache[connectionId] || {}),
                groups: Array.isArray(groups) ? groups : Object.values(groups),
              };
            } catch {}
          }
        };
        await Promise.all([fetchRoles(), fetchUsers(), fetchGroups()]);
        rbacCache = this.rbacCache[connectionId];
      }
      // If any count is present, expand
      const hasAny =
        (rbacCache?.roles?.length || 0) > 0 ||
        (rbacCache?.users?.length || 0) > 0 ||
        (rbacCache?.groups?.length || 0) > 0;
      if (hasAny) {
        rbacExpanded = vscode.TreeItemCollapsibleState.Expanded;
      }
      items.push(
        new WeaviateTreeItem(
          'Access Control (RBAC)',
          rbacExpanded,
          'rbacGroup',
          element.connectionId,
          undefined,
          'rbac',
          new vscode.ThemeIcon('shield'),
          'weaviateRbacGroup'
        )
      );

      return items;
    } else if (element.itemType === 'collectionsGroup' && element.connectionId) {
      // Collections group - show actual collections
      const collections = this.collections[element.connectionId] || [];

      if (collections.length === 0) {
        const emptyItem = new WeaviateTreeItem(
          'No collections found. Click to add',
          vscode.TreeItemCollapsibleState.None,
          'message',
          element.connectionId
        );
        // Make it clickable to add a new collection
        emptyItem.command = {
          command: 'weaviate.addCollection',
          title: 'Add Collection',
          arguments: [{ connectionId: element.connectionId }],
        };
        return [emptyItem];
      }

      return collections;
    } else if (element.itemType === 'rbacGroup' && element.connectionId) {
      // When expanding RBAC, always fetch and cache roles, users, and groups to ensure counts are up to date
      const connectionId = String(element.connectionId);
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        return [];
      }
      // Fetch all RBAC data in parallel
      const fetchRoles = async () => {
        if (!this.rbacCache[connectionId]?.roles) {
          try {
            const roles = await client.roles.listAll();
            this.rbacCache[connectionId] = {
              ...(this.rbacCache[connectionId] || {}),
              roles: Array.isArray(roles) ? roles : Object.values(roles),
            };
          } catch {}
        }
      };
      const fetchUsers = async () => {
        try {
          await this._ensureUsersCached(connectionId, client);
        } catch {}
      };
      const fetchGroups = async () => {
        if (!this.rbacCache[connectionId]?.groups) {
          try {
            const groups = await client.groups.oidc.getKnownGroupNames();
            this.rbacCache[connectionId] = {
              ...(this.rbacCache[connectionId] || {}),
              groups: Array.isArray(groups) ? groups : Object.values(groups),
            };
          } catch {}
        }
      };
      await Promise.all([fetchRoles(), fetchUsers(), fetchGroups()]);
      const rolesCount = this.rbacCache[connectionId]?.roles?.length;
      const usersCount = this.rbacCache[connectionId]?.users?.length;
      const groupsCount = this.rbacCache[connectionId]?.groups?.length;

      // Store the rbacGroup element for targeted refresh (preserves expansion state)
      this.rbacGroupItems.set(connectionId, element);

      const rolesItem = new WeaviateTreeItem(
        `Roles${typeof rolesCount === 'number' ? ` (${rolesCount})` : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'rbacRoles',
        connectionId,
        undefined,
        'rbacRoles',
        new vscode.ThemeIcon('person'),
        'weaviateRbacRoles'
      );
      rolesItem.id = `${connectionId}:rbacRoles`;

      const usersItem = new WeaviateTreeItem(
        `Users${typeof usersCount === 'number' ? ` (${usersCount})` : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'rbacUsers',
        connectionId,
        undefined,
        'rbacUsers',
        new vscode.ThemeIcon('account'),
        'weaviateRbacUsers'
      );
      usersItem.id = `${connectionId}:rbacUsers`;

      const groupsItem = new WeaviateTreeItem(
        `Groups${typeof groupsCount === 'number' ? ` (${groupsCount})` : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'rbacGroups',
        connectionId,
        undefined,
        'rbacGroups',
        new vscode.ThemeIcon('organization'),
        'weaviateRbacGroups'
      );
      groupsItem.id = `${connectionId}:rbacGroups`;

      return [rolesItem, usersItem, groupsItem];
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
          collection.objectTTL?.enabled === true ? 'Object TTL' : 'Object TTL (Disabled)',
          collection.objectTTL?.enabled === true
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          'objectTtlConfig',
          element.connectionId,
          element.label,
          'objectTtlConfig',
          new vscode.ThemeIcon('clock')
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
    } else if (
      element.itemType === 'objectTtlConfig' &&
      element.connectionId &&
      element.collectionName
    ) {
      // Object TTL configuration section
      const collection = this.collections[element.connectionId]?.find(
        (col) => col.label === element.collectionName
      );
      const objectTtlConfig = collection?.schema?.objectTTL;

      if (!objectTtlConfig) {
        return [
          new WeaviateTreeItem(
            'No TTL configuration found',
            vscode.TreeItemCollapsibleState.None,
            'message'
          ),
        ];
      }

      const ttlItems: WeaviateTreeItem[] = [];
      Object.entries(objectTtlConfig).forEach(([key, value]) => {
        ttlItems.push(
          new WeaviateTreeItem(
            `${key}: ${value}`,
            vscode.TreeItemCollapsibleState.None,
            'object',
            element.connectionId,
            element.collectionName,
            key,
            new vscode.ThemeIcon('clock'),
            'objectTtlConfig'
          )
        );
      });

      return ttlItems;
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
            console.warn(
              `[backup] Failed to list backups for backend "${backend}":`,
              error instanceof Error ? error.message : String(error)
            );
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
      const sortedAliases = this.sortAliases(allAliases);

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

        // Double-click opens the edit panel
        aliasTreeItem.command = {
          command: 'weaviate.editAlias',
          title: 'Edit Alias',
          arguments: [aliasTreeItem],
        };

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
      } else {
        // Connection failed - revert status to disconnected
        await this.connectionManager.updateConnection(connectionId, { status: 'disconnected' });
        this.connections = this.connectionManager.getConnections();
        this._onDidChangeTreeData.fire();
        return false;
      }
    } catch (error) {
      // Connection failed - revert status to disconnected
      await this.connectionManager.updateConnection(connectionId, { status: 'disconnected' });
      this.connections = this.connectionManager.getConnections();
      this._onDidChangeTreeData.fire();

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
        throw new Error(`Connection not found: ${connectionId}`);
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
        throw new Error(`Connection not found: ${connectionId}`);
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
          console.warn(
            `[backup] Failed to list backups for backend "${backend}":`,
            error instanceof Error ? error.message : String(error)
          );
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching backups:', error);
      vscode.window.showWarningMessage(
        `Could not load backups: ${errorMessage}. The backup list may be incomplete.`
      );
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
  /**
   * Utility method to add delays in async operations
   * @param ms - Milliseconds to delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async refreshAliases(connectionId: string, reveal: boolean = false): Promise<void> {
    try {
      // Fetch fresh data from server
      await this.fetchAliases(connectionId);
      // Trigger refresh - fire entire tree to ensure parent connection updates the label
      this.refresh();

      // Add a small delay to ensure the refresh completes
      await this.delay(100);

      // Reveal and expand the Aliases item if requested
      if (reveal && this.treeView) {
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
          await this.delay(100);
          await this.treeView?.reveal(aliasesTreeItem, {
            expand: true,
            select: false,
            focus: false,
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing aliases:', error);
      vscode.window.showErrorMessage(`Failed to refresh aliases: ${errorMessage}`);
    }
  }

  /**
   * Sorts aliases by alias name, then by collection name
   * @param aliases - Array of alias items to sort
   * @returns Sorted array of alias items
   */
  private sortAliases(aliases: AliasItem[]): AliasItem[] {
    return [...aliases].sort((a, b) => {
      const aliasCompare = a.alias.localeCompare(b.alias);
      if (aliasCompare !== 0) {
        return aliasCompare;
      }
      return a.collection.localeCompare(b.collection);
    });
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
      const sortedAliases = this.sortAliases(allAliases);

      // Store sorted aliases in cache
      this.aliasesCache[connectionId] = sortedAliases;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching aliases:', error);
      vscode.window.showErrorMessage(
        `Failed to fetch aliases: ${errorMessage}. The aliases list may be incomplete.`
      );
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
        throw new Error(`Connection not found: ${connectionId}`);
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

      // Update cluster panel with latest node/collection stats
      await this.fetchNodes(connectionId);
      await this.updateClusterPanelIfOpen(connectionId);
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
        throw new Error(`Connection not found: ${connectionId}`);
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

      // Update cluster panel with latest node/collection stats
      await this.fetchNodes(connectionId);
      await this.updateClusterPanelIfOpen(connectionId);
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
      await this.refreshRbac(connectionId).catch(() => {});

      this.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to refresh connection info: ${errorMessage}`);
    }
  }

  /**
   * Refreshes RBAC data (roles, users, groups) for a connection.
   * Fires on the stored rbacGroup item so the Roles/Users/Groups containers
   * get updated counts while preserving their expansion state (via stable IDs).
   * @param connectionId - The ID of the connection
   */
  async refreshRbac(connectionId: string): Promise<void> {
    try {
      delete this.rbacCache[connectionId];

      const rbacGroupItem = this.rbacGroupItems.get(connectionId);
      if (rbacGroupItem) {
        this._onDidChangeTreeData.fire(rbacGroupItem);
      } else {
        this.refresh();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`RBAC refresh completed with issues: ${errorMessage}`);
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
  /**
   * Builds the base URL for Weaviate REST API calls
   * @param connectionId - The ID of the connection
   * @returns The base URL string (e.g., "http://localhost:8080" or "https://instance.weaviate.cloud")
   */
  private getWeaviateBaseUrl(connectionId: string): string {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (connection.type === 'cloud' && connection.cloudUrl) {
      // Cloud URL is already complete
      return connection.cloudUrl.replace(/\/$/, ''); // Remove trailing slash
    } else if (connection.type === 'custom') {
      // Build URL from custom connection parts
      const protocol = connection.httpSecure ? 'https' : 'http';
      if (!connection.httpHost) {
        console.warn(
          `[connection] httpHost not set for connection "${connectionId}", falling back to "localhost"`
        );
      }
      if (!connection.httpPort) {
        console.warn(
          `[connection] httpPort not set for connection "${connectionId}", falling back to 8080`
        );
      }
      const host = connection.httpHost || 'localhost';
      const port = connection.httpPort || 8080;
      return `${protocol}://${host}:${port}`;
    }

    throw new Error('Invalid connection configuration');
  }

  /**
   * Builds headers for Weaviate REST API calls
   * @param connectionId - The ID of the connection
   * @returns Headers object with authorization if API key is present
   */
  private getWeaviateHeaders(connectionId: string): Record<string, string> {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Weaviate-Client-Integration': WEAVIATE_INTEGRATION_HEADER,
    };

    if (connection.apiKey) {
      headers['Authorization'] = `Bearer ${connection.apiKey}`;
    }

    return headers;
  }

  /**
   * Exports a collection schema to a file using Weaviate REST API
   * @param connectionId - The ID of the connection
   * @param collectionName - The name of the collection to export
   */
  async exportSchema(connectionId: string, collectionName: string): Promise<void> {
    try {
      // Validate connection before showing the save dialog so the user is not
      // asked to choose a file location only to be told the connection is invalid.
      const baseUrl = this.getWeaviateBaseUrl(connectionId);
      const headers = this.getWeaviateHeaders(connectionId);

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

      const response = await fetch(`${baseUrl}/v1/schema/${collectionName}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch schema: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const schema = await response.json();
      const schemaJson = JSON.stringify(schema, null, 2);
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
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (connection.status !== 'connected') {
      throw new Error('Connection must be active to add collections');
    }

    try {
      // Create the panel with callbacks
      const panel = AddCollectionPanel.createOrShow(
        this.context.extensionUri,
        async (schema: SchemaClass) => {
          // On create callback
          await this.createCollection(connectionId, schema);
          await this.fetchData(connectionId);
          // Update cluster panel with latest node/collection stats
          await this.fetchNodes(connectionId);
          await this.updateClusterPanelIfOpen(connectionId);
          // Shards start in lazy-loading state right after creation.
          // Schedule a follow-up refresh so the panel shows the loaded shard status.
          setTimeout(() => {
            this.updateClusterPanelIfOpen(connectionId).catch((error) => {
              console.error(
                'Error in delayed cluster panel refresh after collection creation:',
                error
              );
            });
          }, 5000);
        },
        async (
          message: WebviewToExtensionMessage,
          postMessage: (msg: Record<string, unknown>) => void
        ) => {
          // On message callback for handling webview requests
          switch (message.command) {
            case 'ready':
              // Send the number of nodes when webview is ready
              const nodesNumber = this.clusterNodesCache[connectionId]?.length || 1;
              postMessage({
                command: 'nodesNumber',
                nodesNumber: nodesNumber,
              });

              // Also send modules/vectorizers data
              const modules = this.clusterMetadataCache[connectionId]?.modules || {};
              postMessage({
                command: 'availableModules',
                modules: modules,
              });

              // Send whether there are existing collections (for conditional UI display)
              const hasCollections = (this.collections[connectionId] || []).length > 0;
              postMessage({
                command: 'hasCollections',
                hasCollections: hasCollections,
              });

              // Send server version
              const serverVersion = this.clusterMetadataCache[connectionId]?.version;
              postMessage({
                command: 'serverVersion',
                version: serverVersion || 'unknown',
              });
              break;
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
                const nodesNumberVectorizers = this.clusterNodesCache[connectionId]?.length || 1;
                postMessage({
                  command: 'nodesNumber',
                  nodesNumber: nodesNumberVectorizers,
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
            case 'getSchema':
              try {
                // Use direct REST API to get collection schema
                const baseUrl = this.getWeaviateBaseUrl(connectionId);
                const headers = this.getWeaviateHeaders(connectionId);
                const collectionName = message.collectionName;

                const response = await fetch(`${baseUrl}/v1/schema/${collectionName}`, {
                  method: 'GET',
                  headers: headers,
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(
                    `Failed to fetch schema: ${response.status} ${response.statusText} - ${errorText}`
                  );
                }

                const schema = await response.json();

                postMessage({
                  command: 'schema',
                  schema: schema,
                });
              } catch (error) {
                console.error('Error fetching collection schema:', error);
                postMessage({
                  command: 'error',
                  message: `Failed to fetch schema: ${error instanceof Error ? error.message : String(error)}`,
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
   * Updates the cluster panel if it's currently open
   * @param connectionId - The ID of the connection
   *
   * @remarks
   * Errors here are non-fatal: the collection operation has already succeeded.
   * A warning notification is shown so the user knows the panel may be stale
   * and can manually refresh it.
   */
  private async updateClusterPanelIfOpen(connectionId: string): Promise<void> {
    try {
      // Check if cluster panel is open
      if (!ClusterPanel.currentPanel) {
        return;
      }

      // Get the client
      const client = this.connectionManager.getClient(connectionId);
      if (!client) {
        return;
      }

      // Fetch updated node status data
      const nodeStatusData = await client.cluster.nodes({ output: 'verbose' });

      // Get connection for settings
      const connection = this.connectionManager.getConnection(connectionId);

      // Send update to the panel
      ClusterPanel.currentPanel.postMessage({
        command: 'updateData',
        nodeStatusData: nodeStatusData,
        openClusterViewOnConnect: connection?.openClusterViewOnConnect,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating cluster panel:', error);
      vscode.window.showWarningMessage(
        `Cluster panel could not be refreshed after the operation: ${errorMessage}. The panel may show stale data — please refresh manually.`
      );
    }
  }

  /**
   * Creates a new collection using the Weaviate REST API
   * @param connectionId - The ID of the connection
   * @param schema - The collection schema to create
   */
  private async createCollection(connectionId: string, schema: SchemaClass): Promise<void> {
    // Basic validation
    if (!schema.class) {
      throw new Error('Collection name is required');
    }

    // Use direct REST API to create collection
    const baseUrl = this.getWeaviateBaseUrl(connectionId);
    const headers = this.getWeaviateHeaders(connectionId);

    try {
      const response = await fetch(`${baseUrl}/v1/schema`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(schema),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `${response.status} ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error[0]?.message) {
            errorMessage = errorJson.error[0].message;
          }
        } catch {
          // Intentional fallback: the error body is not Weaviate error JSON
          // (e.g. an nginx 502 HTML page). Surface the raw text so the caller
          // still gets something meaningful. Not rethrowing is deliberate.
          console.warn('Could not parse error response as JSON, using raw text body');
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        }

        throw new Error(errorMessage);
      }

      console.log(`Collection "${schema.class}" created successfully`);
    } catch (error) {
      // fetch() throws TypeError for network-level failures (ECONNREFUSED, DNS
      // resolution failure, TLS error, request timeout). Wrap it with an
      // actionable message before rethrowing so callers can present a distinct
      // "cannot reach server" prompt rather than a generic schema error.
      if (error instanceof TypeError) {
        console.error('Network error creating collection:', error);
        throw new Error(
          `Cannot reach Weaviate server. Check your connection URL and network. (${error.message})`
        );
      }
      // API-level error (4xx/5xx) — message already contains the HTTP status
      // and Weaviate validation detail; rethrow as-is.
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
      throw new Error(`Connection not found: ${connectionId}`);
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
              'X-Weaviate-Client-Integration': WEAVIATE_INTEGRATION_HEADER,
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
}
