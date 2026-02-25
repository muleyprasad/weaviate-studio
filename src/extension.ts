import * as vscode from 'vscode';
import weaviate from 'weaviate-client';
import { WeaviateTreeDataProvider } from './WeaviateTreeDataProvider/WeaviateTreeDataProvider';
import { QueryEditorPanel } from './query-editor/extension/QueryEditorPanel';
import { WeaviateConnection } from './services/ConnectionManager';
import { parseWeaviateFile, generateUniqueConnectionName } from './utils/weaviateFileHandler';
import { BackupPanel } from './views/BackupPanel';
import { BackupRestorePanel } from './views/BackupRestorePanel';
import { ClusterPanel } from './views/ClusterPanel';
import { DataExplorerPanel } from './data-explorer/extension/DataExplorerPanel';
import { AliasPanel } from './views/AliasPanel';
import { RbacRolePanel } from './views/RbacRolePanel';
import { RbacUserPanel } from './views/RbacUserPanel';
import { RbacGroupPanel } from './views/RbacGroupPanel';
import type {
  BackupArgs,
  BackupConfigCreate,
  BackupItem,
  AliasItem,
  AliasCreateData,
  AliasUpdateData,
} from './types';

/**
 * Handles opening of .weaviate files
 */
async function handleWeaviateFile(
  document: vscode.TextDocument,
  weaviateTreeDataProvider: WeaviateTreeDataProvider
): Promise<void> {
  try {
    const content = document.getText();

    // Parse and validate the .weaviate file
    const parseResult = parseWeaviateFile(content);

    if (!parseResult.isValid) {
      const errorMessage =
        parseResult.error === 'Invalid JSON format'
          ? 'The .weaviate file contains invalid JSON format.'
          : 'The .weaviate file does not contain a valid Weaviate connection configuration.';
      vscode.window.showWarningMessage(errorMessage, { modal: true });
      return;
    }

    const connectionData = parseResult.connectionData!;

    // Check if connection with same name already exists
    const connectionManager = weaviateTreeDataProvider.getConnectionManager();
    const existingConnections = await connectionManager.getConnections();
    const existingConnection = existingConnections.find(
      (c) => c.name.toLowerCase() === connectionData.name.toLowerCase()
    );

    let selectedAction: string | undefined;

    if (existingConnection) {
      // Connection with same name exists - ask what to do
      selectedAction = await vscode.window.showWarningMessage(
        `A connection named "${connectionData.name}" already exists. What would you like to do?`,
        { modal: true },
        'Overwrite Existing',
        'Add as New Connection'
      );

      if (selectedAction === 'Cancel' || !selectedAction) {
        return;
      }

      if (selectedAction === 'Add as New Connection') {
        // Generate unique name
        const existingNames = existingConnections.map((c) => c.name);
        connectionData.name = generateUniqueConnectionName(connectionData.name, existingNames);
      }
    } else {
      // No existing connection - show options to add
      selectedAction = await vscode.window.showInformationMessage(
        `Found valid Weaviate connection "${connectionData.name}". What would you like to do?`,
        { modal: true },
        'Add and Connect',
        'Add Connection'
      );

      if (selectedAction === 'Cancel' || !selectedAction) {
        return;
      }
    }

    // Handle the selected action
    try {
      if (existingConnection && selectedAction === 'Overwrite Existing') {
        // Remove the existing connection first
        await connectionManager.deleteConnection(existingConnection.id);
      }

      // Add the new connection
      const newConnection = await connectionManager.addConnection(connectionData);

      // Refresh the tree view
      weaviateTreeDataProvider.refresh();

      if (selectedAction === 'Add and Connect') {
        // Auto-connect to the new connection
        await weaviateTreeDataProvider.connect(newConnection.id);
        vscode.window.showInformationMessage(
          `Connection "${newConnection.name}" added and connected successfully.`,
          { modal: true }
        );
      } else {
        vscode.window.showInformationMessage(
          `Connection "${newConnection.name}" added successfully.`,
          { modal: true }
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add connection: ${error instanceof Error ? error.message : String(error)}`,
        { modal: true }
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to process .weaviate file: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true }
    );
  }
}

/**
 * Converts the permissions form state from the RbacRole webview into Permission objects
 * using the weaviate-client permissions factory on the client.
 */
/** Returns true if at least one boolean action flag is set on a permission entry. */
function hasAnyAction(entry: any): boolean {
  return [
    'create',
    'read',
    'update',
    'delete',
    'manage',
    'assignAndRevoke',
    'create_collection',
    'read_config',
    'update_config',
    'delete_collection',
  ].some((k) => !!entry[k]);
}

function buildPermissionsFromFormState(_client: any, permState: any): any[] {
  const perms: any[] = [];
  if (!permState) {
    return perms;
  }

  for (const c of (permState.collections || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.collections({
        collection: c.collection || '*',
        create_collection: c.create_collection || false,
        read_config: c.read_config || false,
        update_config: c.update_config || false,
        delete_collection: c.delete_collection || false,
      })
    );
  }

  for (const d of (permState.data || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.data({
        collection: d.collection || '*',
        tenant: d.tenant || '*',
        create: d.create || false,
        read: d.read || false,
        update: d.update || false,
        delete: d.delete || false,
      })
    );
  }

  for (const b of (permState.backups || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.backup({
        collection: b.collection || '*',
        manage: b.manage || false,
      })
    );
  }

  for (const t of (permState.tenants || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.tenants({
        collection: t.collection || '*',
        tenant: t.tenant || '*',
        create: t.create || false,
        read: t.read || false,
        update: t.update || false,
        delete: t.delete || false,
      })
    );
  }

  for (const r of (permState.roles || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.roles({
        role: r.role || '*',
        create: r.create || false,
        read: r.read || false,
        update: r.update || false,
        delete: r.delete || false,
      })
    );
  }

  for (const u of (permState.users || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.users({
        user: u.user || '*',
        read: u.read || false,
        assignAndRevoke: u.assignAndRevoke || false,
      })
    );
  }

  for (const a of (permState.aliases || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.aliases({
        alias: a.alias || '*',
        collection: a.aliasCollection || '*',
        create: a.create || false,
        read: a.read || false,
        update: a.update || false,
        delete: a.delete || false,
      })
    );
  }

  for (const c of (permState.cluster || []).filter(hasAnyAction)) {
    perms.push(...weaviate.permissions.cluster({ read: c.read || false }));
  }

  for (const n of (permState.nodesMinimal || []).filter(hasAnyAction)) {
    perms.push(...weaviate.permissions.nodes.minimal({ read: n.read || false }));
  }

  for (const nv of (permState.nodesVerbose || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.nodes.verbose({
        collection: nv.collection || '*',
        read: nv.read || false,
      })
    );
  }

  for (const rp of (permState.replicate || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.replicate({
        collection: rp.collection || '*',
        shard: rp.shard || '*',
        create: rp.create || false,
        read: rp.read || false,
        update: rp.update || false,
        delete: rp.delete || false,
      })
    );
  }

  for (const g of (permState.groupsOidc || []).filter(hasAnyAction)) {
    perms.push(
      ...weaviate.permissions.groups.oidc({
        groupID: g.groupID || '*',
        read: g.read || false,
        assignAndRevoke: g.assignAndRevoke || false,
      })
    );
  }

  return perms;
}

/**
 * Collects all permissions from all categories of an existing Role object.
 * Used to determine which permissions to remove when editing a role.
 */
function collectAllPermissions(role: any): any[] {
  const all: any[] = [];
  const keys = [
    'aliasPermissions',
    'backupsPermissions',
    'clusterPermissions',
    'collectionsPermissions',
    'dataPermissions',
    'groupsPermissions',
    'nodesPermissions',
    'replicatePermissions',
    'rolesPermissions',
    'tenantsPermissions',
    'usersPermissions',
  ];
  for (const key of keys) {
    if (Array.isArray(role[key])) {
      all.push(...role[key]);
    }
  }
  return all;
}

/**
 * Produces a stable string key for a permission object so that two permission
 * objects that are semantically identical compare equal regardless of property
 * insertion order or action array order.
 */
function permKey(p: any): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(p)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v])
    )
  );
}

/**
 * Fetches the current role list and pushes it to all open user and group panels
 * for the given connection. Called after any role is created or deleted so open
 * panels reflect the change without needing to be reopened.
 */
async function pushRoleListToOpenPanels(client: any, connectionId: string): Promise<void> {
  const allRolesMap = await client.roles.listAll();
  const allRoles = Object.keys(allRolesMap).sort();
  RbacUserPanel.notifyRolesChanged(
    connectionId,
    allRoles.filter((r) => r !== 'root' && r !== 'read-only')
  );
  RbacGroupPanel.notifyRolesChanged(
    connectionId,
    allRoles.filter((r) => r !== 'root')
  );
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  // RBAC: Context commands
  context.subscriptions.push(
    vscode.commands.registerCommand('weaviate.rbac.addRole', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        RbacRolePanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          'add',
          undefined,
          [],
          async (roleData: any) => {
            const perms = buildPermissionsFromFormState(client, roleData.permissions);
            await client.roles.create(roleData.name, perms);
            await weaviateTreeDataProvider.refreshRbac(item.connectionId);
            await pushRoleListToOpenPanels(client, item.connectionId);
            vscode.window.showInformationMessage(`Role "${roleData.name}" created successfully`);
          }
        );
      } catch (error) {
        console.error('[RBAC] Failed to open Add Role panel:', error);
        vscode.window.showErrorMessage(
          `Failed to open Add Role: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.editRole', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or role information');
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        const roleName = item.itemId;
        const [existingRole, groupAssignments] = await Promise.all([
          client.roles.byName(roleName),
          client.roles.getGroupAssignments(roleName).catch(() => []),
        ]);
        if (!existingRole) {
          vscode.window.showErrorMessage(`Role "${roleName}" not found`);
          return;
        }
        RbacRolePanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          'edit',
          existingRole,
          groupAssignments,
          async (roleData: any) => {
            const newPerms = buildPermissionsFromFormState(client, roleData.permissions);
            // Fetch fresh role state each save — avoids stale-closure bugs on repeated saves
            const currentRole = await client.roles.byName(roleName);
            const oldPerms = currentRole ? collectAllPermissions(currentRole) : [];
            // Diff-based update: only touch permissions that actually changed.
            // This avoids the race window of "remove all then re-add" and prevents
            // an implicit delete when newPerms is empty (blocked by the webview too).
            const oldKeys = new Set(oldPerms.map(permKey));
            const newKeys = new Set(newPerms.map(permKey));
            const toRemove = oldPerms.filter((p) => !newKeys.has(permKey(p)));
            const toAdd = newPerms.filter((p) => !oldKeys.has(permKey(p)));
            if (toRemove.length > 0) {
              await client.roles.removePermissions(roleName, toRemove);
            }
            if (toAdd.length > 0) {
              await client.roles.addPermissions(roleName, toAdd);
            }
            await weaviateTreeDataProvider.refreshRbac(item.connectionId);
            vscode.window.showInformationMessage(`Role "${roleName}" updated successfully`);
          }
        );
      } catch (error) {
        console.error('[RBAC] Failed to open Edit Role panel:', error);
        vscode.window.showErrorMessage(
          `Failed to open Edit Role: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.deleteRole', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or role information');
        return;
      }

      const roleName = item.itemId;
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete role "${roleName}"? This action cannot be undone.`,
        { modal: true },
        'Delete'
      );

      if (confirmation !== 'Delete') {
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }

        await client.roles.delete(roleName);
        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
        await pushRoleListToOpenPanels(client, item.connectionId);
        vscode.window.showInformationMessage(`Role "${roleName}" deleted successfully`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to delete role: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.addUser', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        const allRolesMap = await client.roles.listAll();
        const availableRoles = Object.keys(allRolesMap)
          .filter((r) => r !== 'root' && r !== 'read-only')
          .sort();
        RbacUserPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          'add',
          undefined,
          availableRoles,
          [],
          async (userData: any) => {
            const newApiKey = await client.users.db.create(userData.userId);
            if (userData.rolesToAssign && userData.rolesToAssign.length > 0) {
              await client.users.db.assignRoles(userData.rolesToAssign, userData.userId);
            }
            await weaviateTreeDataProvider.refreshRbac(item.connectionId);
            const copyAction = await vscode.window.showWarningMessage(
              `User "${userData.userId}" created.\n\n⚠️ This is the ONLY time the API key will be shown:\n\n${newApiKey}\n\nCopy it now.`,
              { modal: true },
              'Copy to Clipboard'
            );
            if (copyAction === 'Copy to Clipboard') {
              await vscode.env.clipboard.writeText(newApiKey);
              vscode.window.showInformationMessage('API key copied to clipboard');
            }
          }
        );
      } catch (error) {
        console.error('[RBAC] Failed to open Add User panel:', error);
        vscode.window.showErrorMessage(
          `Failed to open Add User: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.editUser', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or user information');
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        const userId = item.itemId;
        const [existingUser, assignedRolesMap, allRolesMap] = await Promise.all([
          client.users.db.byName(userId),
          client.users.db.getAssignedRoles(userId),
          client.roles.listAll(),
        ]);
        const assignedRoles = Object.keys(assignedRolesMap);
        const availableRoles = Object.keys(allRolesMap)
          .filter((r) => r !== 'root' && r !== 'read-only')
          .sort();
        RbacUserPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          'edit',
          existingUser,
          availableRoles,
          assignedRoles,
          async (userData: any) => {
            if (userData.rolesToAssign && userData.rolesToAssign.length > 0) {
              await client.users.db.assignRoles(userData.rolesToAssign, userId);
            }
            if (userData.rolesToRevoke && userData.rolesToRevoke.length > 0) {
              await client.users.db.revokeRoles(userData.rolesToRevoke, userId);
            }
            await weaviateTreeDataProvider.refreshRbac(item.connectionId);
            vscode.window.showInformationMessage(`User "${userId}" updated successfully`);
          }
        );
      } catch (error) {
        console.error('[RBAC] Failed to open Edit User panel:', error);
        vscode.window.showErrorMessage(
          `Failed to open Edit User: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.deleteUser', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or user information');
        return;
      }

      const userId = item.itemId;
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete user "${userId}"? This action cannot be undone.`,
        { modal: true },
        'Delete'
      );

      if (confirmation !== 'Delete') {
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }

        const result = await client.users.db.delete(userId);

        // Check if deletion was successful
        if (result === false) {
          vscode.window.showErrorMessage(
            `Failed to delete user "${userId}". The operation was not successful.`
          );
          return;
        }

        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
        vscode.window.showInformationMessage(`User "${userId}" deleted successfully`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to delete user: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.activateUser', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or user information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }

        const userId = item.itemId;
        const activateResult = await client.users.db.activate(userId);
        if (activateResult === false) {
          vscode.window.showErrorMessage(
            `Failed to activate user "${userId}". The operation was not successful.`
          );
          return;
        }
        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
        vscode.window.showInformationMessage(`User "${userId}" activated successfully`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to activate user: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.deactivateUser', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or user information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }

        const userId = item.itemId;
        const deactivateResult = await client.users.db.deactivate(userId);
        if (deactivateResult === false) {
          vscode.window.showErrorMessage(
            `Failed to deactivate user "${userId}". The operation was not successful.`
          );
          return;
        }
        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
        vscode.window.showInformationMessage(`User "${userId}" deactivated successfully`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to deactivate user: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.rotateUserApiKey', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or user information');
        return;
      }

      const userId = item.itemId;
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to rotate the API key for user "${userId}"? The current API key will be invalidated.`,
        { modal: true },
        'Rotate'
      );

      if (confirmation !== 'Rotate') {
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }

        const newApiKey = await client.users.db.rotateKey(userId);

        // Show the new API key to the user with a warning
        const action = await vscode.window.showWarningMessage(
          `API key rotated successfully for user "${userId}".\n\n⚠️ This is the ONLY time this API key will be displayed:\n\n${newApiKey}\n\nMake sure to copy and save it securely.`,
          { modal: true },
          'Copy to Clipboard'
        );

        if (action === 'Copy to Clipboard') {
          await vscode.env.clipboard.writeText(newApiKey);
          vscode.window.showInformationMessage('API key copied to clipboard');
        }

        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to rotate API key: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.addGroup', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        const allRolesMap = await client.roles.listAll();
        const availableRoles = Object.keys(allRolesMap)
          .filter((r) => r !== 'root')
          .sort();
        RbacGroupPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          'add',
          undefined,
          availableRoles,
          [],
          async (groupData: any) => {
            if (groupData.rolesToAssign && groupData.rolesToAssign.length > 0) {
              await client.groups.oidc.assignRoles(groupData.groupId, groupData.rolesToAssign);
            }
            await weaviateTreeDataProvider.refreshRbac(item.connectionId);
            vscode.window.showInformationMessage(
              `Roles assigned to group "${groupData.groupId}" successfully`
            );
          }
        );
      } catch (error) {
        console.error('[RBAC] Failed to open Add Group panel:', error);
        vscode.window.showErrorMessage(
          `Failed to open Add Group: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.editGroup', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or group information');
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        const groupId = item.itemId;
        const [assignedRolesMap, allRolesMap] = await Promise.all([
          client.groups.oidc.getAssignedRoles(groupId),
          client.roles.listAll(),
        ]);
        const assignedRoles = Object.keys(assignedRolesMap);
        const availableRoles = Object.keys(allRolesMap)
          .filter((r) => r !== 'root')
          .sort();
        RbacGroupPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          'edit',
          groupId,
          availableRoles,
          assignedRoles,
          async (groupData: any) => {
            if (groupData.rolesToAssign && groupData.rolesToAssign.length > 0) {
              await client.groups.oidc.assignRoles(groupId, groupData.rolesToAssign);
            }
            if (groupData.rolesToRevoke && groupData.rolesToRevoke.length > 0) {
              await client.groups.oidc.revokeRoles(groupId, groupData.rolesToRevoke);
            }
            await weaviateTreeDataProvider.refreshRbac(item.connectionId);
            vscode.window.showInformationMessage(`Group "${groupId}" updated successfully`);
          }
        );
      } catch (error) {
        console.error('[RBAC] Failed to open Edit Group panel:', error);
        vscode.window.showErrorMessage(
          `Failed to open Edit Group: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.rbac.deleteGroup', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or group information');
        return;
      }
      const groupId = item.itemId;
      const confirmation = await vscode.window.showWarningMessage(
        `Delete group "${groupId}"?\n\nThis will revoke all role assignments for this group. The group itself is managed by your OIDC provider and will not be affected.`,
        { modal: true },
        'Delete Group'
      );
      if (confirmation !== 'Delete Group') {
        return;
      }
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = connectionManager.getClient(item.connectionId);
        if (!client) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }
        const assignedRolesMap = await client.groups.oidc.getAssignedRoles(groupId);
        const assignedRoles = Object.keys(assignedRolesMap);
        if (assignedRoles.length > 0) {
          await client.groups.oidc.revokeRoles(groupId, assignedRoles);
        }
        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
        vscode.window.showInformationMessage(
          `All roles removed from group "${groupId}" successfully`
        );
      } catch (error) {
        console.error('[RBAC] Failed to remove group roles:', error);
        vscode.window.showErrorMessage(
          `Failed to remove group roles: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('weaviate.refreshRbac', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshRbac(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh RBAC: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
  console.log('"Weaviate Studio" extension is now active');

  // Create and register the TreeDataProvider
  const weaviateTreeDataProvider = new WeaviateTreeDataProvider(context);
  const treeView = vscode.window.createTreeView('weaviateConnectionsView', {
    treeDataProvider: weaviateTreeDataProvider,
    showCollapseAll: true,
  });

  // Set the TreeView reference in the provider for programmatic control
  weaviateTreeDataProvider.setTreeView(treeView);

  // Handle selection of tree items
  treeView.onDidChangeSelection(async (e) => {
    if (e.selection && e.selection.length > 0) {
      const item = e.selection[0];

      // Note: Auto-connect logic removed - now handled on expansion via dialog
      // Handle connection selection – no longer auto connect on selection
      if (item.itemType === 'connection' && item.connectionId) {
        // Get connection status for future use if needed
        const connection = weaviateTreeDataProvider.getConnectionById(item.connectionId);

        // Removed auto-connection logic - user will be prompted on expansion instead
      }
    }
  });

  // Handle expansion of tree items
  treeView.onDidExpandElement(async (e) => {
    const item = e.element;

    // Handle connection expansion - show dialog if disconnected
    if (item.itemType === 'connection' && item.connectionId) {
      const connection = weaviateTreeDataProvider.getConnectionById(item.connectionId);
      const connectionManager = weaviateTreeDataProvider.getConnectionManager();

      // If disconnected, check autoConnect setting
      if (connection && connection.status !== 'connected') {
        // If autoConnect is enabled, connect automatically without showing dialog
        if (connection.autoConnect) {
          try {
            // Set status to connecting before starting connection
            await connectionManager.updateConnection(item.connectionId, { status: 'connecting' });
            // Force immediate update of local connections list
            await weaviateTreeDataProvider.forceRefresh();
            const success = await weaviateTreeDataProvider.connect(item.connectionId);

            if (!success) {
              await connectionManager.updateConnection(item.connectionId, {
                status: 'disconnected',
              });
              await weaviateTreeDataProvider.forceRefresh();
            }
          } catch (error) {
            // Reset status on error
            await connectionManager.updateConnection(item.connectionId, { status: 'disconnected' });
            await weaviateTreeDataProvider.forceRefresh();
            vscode.window.showErrorMessage(
              `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          // Show dialog asking to connect with option to enable auto-connect
          const result = await vscode.window.showInformationMessage(
            `The connection "${connection.name}" is disconnected. Would you like to connect now?`,
            { modal: true },
            'Connect',
            'Connect & Auto Connect for This Cluster'
          );

          if (result === 'Connect') {
            try {
              // Set status to connecting after user confirms
              await connectionManager.updateConnection(item.connectionId, { status: 'connecting' });
              // Force immediate update of local connections list
              await weaviateTreeDataProvider.forceRefresh();
              const success = await weaviateTreeDataProvider.connect(item.connectionId);

              if (!success) {
                await connectionManager.updateConnection(item.connectionId, {
                  status: 'disconnected',
                });
                await weaviateTreeDataProvider.forceRefresh();
              }
            } catch (error) {
              // Reset status on error
              await connectionManager.updateConnection(item.connectionId, {
                status: 'disconnected',
              });
              await weaviateTreeDataProvider.forceRefresh();
              vscode.window.showErrorMessage(
                `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          } else if (result === 'Connect & Auto Connect for This Cluster') {
            try {
              // Enable auto-connect for this connection
              await connectionManager.updateConnection(item.connectionId, {
                autoConnect: true,
                status: 'connecting',
              });
              // Force immediate update of local connections list
              await weaviateTreeDataProvider.forceRefresh();
              const success = await weaviateTreeDataProvider.connect(item.connectionId);

              if (success) {
                vscode.window.showInformationMessage(
                  `Auto Connect enabled for "${connection.name}". This cluster will now connect automatically when expanded.`
                );
              } else {
                await connectionManager.updateConnection(item.connectionId, {
                  status: 'disconnected',
                });
                await weaviateTreeDataProvider.forceRefresh();
              }
            } catch (error) {
              // Reset status on error (keep autoConnect enabled)
              await connectionManager.updateConnection(item.connectionId, {
                status: 'disconnected',
              });
              await weaviateTreeDataProvider.forceRefresh();
              vscode.window.showErrorMessage(
                `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }
      }
    }
  });

  // Add title to the tree view showing number of connections
  treeView.title = `Connections (${weaviateTreeDataProvider.getConnectionCount() || 0})`;

  // Update title whenever tree data changes
  weaviateTreeDataProvider.onDidChangeTreeData(() => {
    treeView.title = `Connections (${weaviateTreeDataProvider.getConnectionCount() || 0})`;
  });

  // Handle .weaviate file opening
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (document.fileName.endsWith('.weaviate')) {
        await handleWeaviateFile(document, weaviateTreeDataProvider);
      }
    })
  );

  // Handle already open .weaviate files when extension activates
  vscode.workspace.textDocuments.forEach(async (document) => {
    if (document.fileName.endsWith('.weaviate')) {
      await handleWeaviateFile(document, weaviateTreeDataProvider);
    }
  });

  // Register commands
  context.subscriptions.push(
    // Add connection command
    vscode.commands.registerCommand('weaviate.addConnection', async () => {
      try {
        await weaviateTreeDataProvider.addConnection();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to add connection: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Connect to a Weaviate instance
    vscode.commands.registerCommand('weaviate.connect', async (item: { connectionId: string }) => {
      if (item?.connectionId) {
        await weaviateTreeDataProvider.connect(item.connectionId);
      }
    }),

    // Disconnect from a Weaviate instance
    vscode.commands.registerCommand(
      'weaviate.disconnect',
      async (item: { connectionId: string }) => {
        if (item?.connectionId) {
          await weaviateTreeDataProvider.disconnect(item.connectionId);
        }
      }
    ),

    // Query Editor: Run/Stop/Clear from Command Palette
    vscode.commands.registerCommand('weaviate.queryEditor.run', () => {
      QueryEditorPanel.sendCommandToActive('cmdRun');
    }),
    vscode.commands.registerCommand('weaviate.queryEditor.stop', () => {
      QueryEditorPanel.sendCommandToActive('cmdStop');
    }),
    vscode.commands.registerCommand('weaviate.queryEditor.clear', () => {
      QueryEditorPanel.sendCommandToActive('cmdClear');
    }),

    // Open link command
    vscode.commands.registerCommand('weaviate-studio.openLink', (url: string) => {
      vscode.env.openExternal(vscode.Uri.parse(url));
    }),

    // Add connection link command
    vscode.commands.registerCommand(
      'weaviate.addConnectionLink',
      async (item: { connectionId: string }) => {
        if (!item?.connectionId) {
          return;
        }

        const name = await vscode.window.showInputBox({
          prompt: 'Enter a name for the link',
          placeHolder: 'e.g., Documentation, Dashboard, etc.',
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return 'Link name is required';
            }
            return null;
          },
        });

        if (!name) {
          return;
        }

        const url = await vscode.window.showInputBox({
          prompt: 'Enter the URL',
          placeHolder: 'https://example.com',
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return 'URL is required';
            }
            try {
              new URL(value);
              return null;
            } catch {
              return 'Please enter a valid URL';
            }
          },
        });

        if (!url) {
          return;
        }

        try {
          const connectionManager = weaviateTreeDataProvider.getConnectionManager();
          await connectionManager.addConnectionLink(item.connectionId, {
            name: name.trim(),
            url: url.trim(),
          });
          vscode.window.showInformationMessage(`Link "${name}" added successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to add link: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),

    // Edit connection link command
    vscode.commands.registerCommand(
      'weaviate.editConnectionLink',
      async (item: { connectionId: string; itemId: string }) => {
        if (!item?.connectionId || !item?.itemId) {
          return;
        }

        try {
          const connectionManager = weaviateTreeDataProvider.getConnectionManager();
          const links = connectionManager.getConnectionLinks(item.connectionId);
          const linkIndex = parseInt(item.itemId);

          if (linkIndex < 0 || linkIndex >= links.length) {
            vscode.window.showErrorMessage('Link not found');
            return;
          }

          const currentLink = links[linkIndex];

          const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for the link',
            placeHolder: 'e.g., Documentation, Dashboard, etc.',
            value: currentLink.name,
            validateInput: (value) => {
              if (!value || value.trim() === '') {
                return 'Link name is required';
              }
              return null;
            },
          });

          if (!name) {
            return;
          }

          const url = await vscode.window.showInputBox({
            prompt: 'Enter the URL',
            placeHolder: 'https://example.com',
            value: currentLink.url,
            validateInput: (value) => {
              if (!value || value.trim() === '') {
                return 'URL is required';
              }
              try {
                new URL(value);
                return null;
              } catch {
                return 'Please enter a valid URL';
              }
            },
          });

          if (!url) {
            return;
          }

          await connectionManager.updateConnectionLink(item.connectionId, linkIndex, {
            name: name.trim(),
            url: url.trim(),
          });
          vscode.window.showInformationMessage(`Link "${name}" updated successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to edit link: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),

    // Delete connection link command
    vscode.commands.registerCommand(
      'weaviate.deleteConnectionLink',
      async (item: { connectionId: string; itemId: string }) => {
        if (!item?.connectionId || !item?.itemId) {
          return;
        }

        try {
          const connectionManager = weaviateTreeDataProvider.getConnectionManager();
          const links = connectionManager.getConnectionLinks(item.connectionId);
          const linkIndex = parseInt(item.itemId);

          if (linkIndex < 0 || linkIndex >= links.length) {
            vscode.window.showErrorMessage('Link not found');
            return;
          }

          const currentLink = links[linkIndex];
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the link "${currentLink.name}"?`,
            { modal: true },
            'Delete'
          );

          if (confirm !== 'Delete') {
            return;
          }

          await connectionManager.removeConnectionLink(item.connectionId, linkIndex);
          vscode.window.showInformationMessage(`Link "${currentLink.name}" deleted successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to delete link: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),

    // Edit an existing connection
    vscode.commands.registerCommand(
      'weaviate.editConnection',
      async (item: { connectionId: string }) => {
        if (!item?.connectionId) {
          return;
        }

        try {
          await weaviateTreeDataProvider.editConnection(item.connectionId);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to edit connection: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),

    // Delete a connection
    vscode.commands.registerCommand(
      'weaviate.deleteConnection',
      async (item: { connectionId: string }) => {
        if (!item?.connectionId) {
          return;
        }

        const connection = weaviateTreeDataProvider.getConnectionById(item.connectionId);
        if (!connection) {
          vscode.window.showErrorMessage('Connection not found');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the connection "${connection.name}"?`,
          { modal: true },
          'Delete'
        );

        if (confirm !== 'Delete') {
          return;
        }

        try {
          const deletedConnectionName = await weaviateTreeDataProvider.deleteConnection(
            item.connectionId
          );
          vscode.window.showInformationMessage(`Connection "${deletedConnectionName}" deleted`);
        } catch (error) {
          vscode.window.showErrorMessage(
            error instanceof Error ? error.message : 'Failed to delete connection'
          );
        }
      }
    ),

    vscode.commands.registerCommand('weaviate.viewDetailedSchema', (item: any) => {
      weaviateTreeDataProvider.handleViewDetailedSchema(item);
    }),

    // Query a collection
    vscode.commands.registerCommand('weaviate.queryCollection', (arg1: any, arg2?: string) => {
      // Handle both call signatures:
      // 1. queryCollection(connectionId: string, collectionName: string)
      // 2. queryCollection({ connectionId: string, label: string })
      let connectionId: string;
      let collectionName: string;

      if (typeof arg1 === 'string' && arg2) {
        // First signature
        connectionId = arg1;
        collectionName = arg2;
      } else if (arg1?.connectionId && (arg1.label || arg1.collectionName)) {
        // Second signature (from tree view)
        connectionId = arg1.connectionId;
        collectionName = arg1.label || arg1.collectionName || '';
      } else {
        console.error('Invalid arguments for weaviate.queryCollection:', arg1, arg2);
        return;
      }

      // Open the query editor with the selected collection
      QueryEditorPanel.createOrShow(context, { connectionId, collectionName });
    }),

    // Open a new query tab (always creates a new tab)
    vscode.commands.registerCommand('weaviate.openNewQueryTab', (arg1: any, arg2?: string) => {
      // Handle both call signatures similar to queryCollection
      let connectionId: string;
      let collectionName: string;

      if (typeof arg1 === 'string' && arg2) {
        connectionId = arg1;
        collectionName = arg2;
      } else if (arg1?.connectionId && (arg1.label || arg1.collectionName)) {
        connectionId = arg1.connectionId;
        collectionName = arg1.label || arg1.collectionName || '';
      } else {
        console.error('Invalid arguments for weaviate.openNewQueryTab:', arg1, arg2);
        return;
      }

      // Always create a new tab by not providing a tabId (will auto-generate)
      QueryEditorPanel.createOrShow(context, { connectionId, collectionName });
    }),

    // Open Data Explorer for a collection
    vscode.commands.registerCommand('weaviate.openDataExplorer', (arg1: any, arg2?: string) => {
      // Handle both call signatures:
      // 1. openDataExplorer(connectionId: string, collectionName: string)
      // 2. openDataExplorer({ connectionId: string, label: string })
      let connectionId: string;
      let collectionName: string;

      if (typeof arg1 === 'string' && arg2) {
        connectionId = arg1;
        collectionName = arg2;
      } else if (arg1?.connectionId && (arg1.label || arg1.collectionName)) {
        connectionId = arg1.connectionId;
        collectionName = arg1.label || arg1.collectionName || '';
      } else {
        console.error('Invalid arguments for weaviate.openDataExplorer:', arg1, arg2);
        return;
      }

      const connectionManager = weaviateTreeDataProvider.getConnectionManager();
      const getClient = () => connectionManager.getClient(connectionId);

      DataExplorerPanel.createOrShow(context.extensionUri, connectionId, collectionName, getClient);
    }),

    // Refresh the tree view
    vscode.commands.registerCommand('weaviate.refresh', () => {
      weaviateTreeDataProvider.refresh();
    }),

    // Delete collection command
    vscode.commands.registerCommand(
      'weaviate.deleteCollection',
      async (item: { connectionId: string; collectionName: string }) => {
        if (!item?.connectionId || !item?.collectionName) {
          vscode.window.showErrorMessage('Missing connection ID or collection name');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the collection "${item.collectionName}"? This action cannot be undone.`,
          { modal: true },
          'Delete'
        );

        if (confirm !== 'Delete') {
          return;
        }

        try {
          await weaviateTreeDataProvider.deleteCollection(item.connectionId, item.collectionName);
          vscode.window.showInformationMessage(
            `Collection "${item.collectionName}" deleted successfully`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to delete collection: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),

    // Delete all collections command
    vscode.commands.registerCommand(
      'weaviate.deleteAllCollections',
      async (item: { connectionId: string }) => {
        if (!item?.connectionId) {
          vscode.window.showErrorMessage('Missing connection ID');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete ALL collections from this Weaviate instance? This action cannot be undone and will permanently remove all collections and their data.`,
          { modal: true },
          'Delete All Collections'
        );

        if (confirm !== 'Delete All Collections') {
          return;
        }

        try {
          await weaviateTreeDataProvider.deleteAllCollections(item.connectionId);
          vscode.window.showInformationMessage('All collections deleted successfully');
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to delete all collections: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    ),

    // Refresh connection info command
    vscode.commands.registerCommand('weaviate.refreshConnection', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection ID');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshConnectionInfo(item.connectionId);
        vscode.window.showInformationMessage('Connection info refreshed');
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh connection: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Refresh statistics command
    vscode.commands.registerCommand('weaviate.refreshStatistics', async (item) => {
      if (!item?.connectionId || !item?.collectionName) {
        vscode.window.showErrorMessage('Missing connection or collection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshStatistics(item.connectionId, item.collectionName);
        vscode.window.showInformationMessage('Statistics refreshed');
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh statistics: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Refresh backups command
    vscode.commands.registerCommand('weaviate.refreshBackups', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshBackups(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh backups: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Refresh aliases command
    vscode.commands.registerCommand('weaviate.refreshAliases', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshAliases(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh aliases: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // View cluster information command
    vscode.commands.registerCommand('weaviate.viewClusterInfo', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = await connectionManager.getClient(item.connectionId);

        if (!client) {
          vscode.window.showErrorMessage('Failed to get Weaviate client');
          return;
        }

        // Get node status data
        const nodeStatusData = await client.cluster.nodes({ output: 'verbose' });

        // Get connection to access openClusterViewOnConnect setting
        const connection = connectionManager.getConnection(item.connectionId);

        // Open cluster panel
        ClusterPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          nodeStatusData,
          connection?.name || 'Unknown',
          async (message, postMessage) => {
            if (message.command === 'refresh') {
              // Refresh node status data
              const updatedData = await client.cluster.nodes({ output: 'verbose' });
              const updatedConnection = connectionManager.getConnection(item.connectionId);
              postMessage({
                command: 'updateData',
                nodeStatusData: updatedData,
                openClusterViewOnConnect: updatedConnection?.openClusterViewOnConnect,
              });
            } else if (message.command === 'toggleAutoOpen') {
              // Update connection openClusterViewOnConnect setting
              try {
                const currentConnection = connectionManager.getConnection(item.connectionId);
                if (currentConnection) {
                  await connectionManager.updateConnection(item.connectionId, {
                    openClusterViewOnConnect: message.value,
                  });
                  vscode.window.showInformationMessage(
                    message.value
                      ? 'Cluster view will now open automatically on connect'
                      : 'Cluster view auto-open disabled'
                  );
                }
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to update setting: ${errorMessage}`);
              }
            } else if (message.command === 'updateShardStatus') {
              // Update shard status
              try {
                const collection = client.collections.get(message.collection);
                const shardNames = message.shardNames || [message.shardName]; // Support both array and single

                // updateShards accepts string or string[]
                await collection.config.updateShards(message.newStatus, shardNames);

                // Show success message
                const shardText =
                  shardNames.length === 1
                    ? `Shard ${shardNames[0]}`
                    : `${shardNames.length} shards`;
                vscode.window.showInformationMessage(
                  `${shardText} status updated to ${message.newStatus}`
                );

                // Refresh the data
                const updatedData = await client.cluster.nodes({ output: 'verbose' });
                postMessage({
                  command: 'updateData',
                  nodeStatusData: updatedData,
                });
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to update shard status: ${errorMessage}`);
              }
            }
          },
          connection?.openClusterViewOnConnect
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to get cluster information: ${errorMessage}`);
      }
    }),

    // Create backup command
    vscode.commands.registerCommand('weaviate.createBackup', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = await connectionManager.getClient(item.connectionId);

        if (!client) {
          vscode.window.showErrorMessage('Failed to get Weaviate client');
          return;
        }

        // Get collections
        const collections = await client.collections.listAll();
        const collectionNames = Object.keys(collections).map(
          (key: string) => (collections as any)[key].name
        );

        // Get available modules
        const meta = await client.getMeta();
        const availableModules = meta.modules || {};

        // Open backup panel
        const panel = BackupPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          collectionNames,
          availableModules,
          async (backupData) => {
            // Create backup with waitForCompletion: false
            const backupConfig: BackupArgs<BackupConfigCreate> = {
              backupId: backupData.backupId,
              backend: backupData.backend,
              waitForCompletion: false,
              includeCollections: backupData.includeCollections,
              excludeCollections: backupData.excludeCollections,
            };

            // Add optional config parameters if provided
            if (backupData.cpuPercentage !== undefined) {
              backupConfig.config = backupConfig.config || {};
              backupConfig.config.cpuPercentage = backupData.cpuPercentage;
            }
            if (backupData.chunkSize !== undefined) {
              backupConfig.config = backupConfig.config || {};
              backupConfig.config.chunkSize = backupData.chunkSize;
            }
            if (backupData.compressionLevel) {
              backupConfig.config = backupConfig.config || {};
              backupConfig.config.compressionLevel = backupData.compressionLevel;
            }

            await client.backup.create(backupConfig);
          },
          async (message, postMessage) => {
            // Handle additional messages
            if (message.command === 'fetchBackups') {
              try {
                // Fetch all backups from all backends
                const backupModules = Object.keys(availableModules).filter((key) =>
                  key.startsWith('backup-')
                );

                const allBackups: BackupItem[] = [];

                for (const moduleName of backupModules) {
                  const backend = moduleName.replace('backup-', '') as any;
                  try {
                    const backupsResponse = await client.backup.list(backend);

                    if (backupsResponse && Array.isArray(backupsResponse)) {
                      const backupsWithBackend = backupsResponse.map((b: any) => {
                        // Calculate duration if startedAt and completedAt are present
                        let duration = undefined;
                        if (b.startedAt && b.completedAt) {
                          try {
                            const start = new Date(b.startedAt).getTime();
                            const end = new Date(b.completedAt).getTime();
                            const diffMs = end - start;

                            if (diffMs >= 0 && !isNaN(diffMs)) {
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
                                parts.push(`${seconds % 60}s`);
                              }

                              duration = parts.length > 0 ? parts.join(' ') : '0s';
                            }
                          } catch (error) {
                            // Duration calculation failed, leave it undefined
                          }
                        }

                        return {
                          id: b.id,
                          backend: backend,
                          status: b.status,
                          error: b.error,
                          path: b.path,
                          collections: b.collections || [],
                          duration: duration,
                        };
                      });
                      allBackups.push(...backupsWithBackend);
                    }
                  } catch (err) {
                    console.error(`Failed to fetch backups from ${backend}:`, err);
                  }
                }

                postMessage({
                  command: 'backupsList',
                  backups: allBackups,
                });

                // Refresh the tree view backups
                await weaviateTreeDataProvider.refreshBackups(item.connectionId);
              } catch (error) {
                postMessage({
                  command: 'error',
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            } else if (message.command === 'cancelBackup') {
              try {
                const { backupId, backend } = message;
                const cancelStatus = await client.backup.cancel({
                  backupId: backupId,
                  backend: backend,
                });

                postMessage({
                  command: 'backupCancelled',
                  backupId: backupId,
                  status: cancelStatus,
                });

                // Refresh the tree view backups
                await weaviateTreeDataProvider.refreshBackups(item.connectionId);
              } catch (error) {
                postMessage({
                  command: 'error',
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            } else if (message.command === 'viewBackup') {
              try {
                const { backupId, backend } = message;

                // Get backup details from the backend
                const backupsResponse = await client.backup.list(backend);
                const backupDetails = backupsResponse?.find((b: any) => b.id === backupId);

                if (!backupDetails) {
                  postMessage({
                    command: 'error',
                    message: 'Backup not found',
                  });
                  return;
                }

                // Open BackupRestorePanel
                await BackupRestorePanel.createOrShow(
                  context.extensionUri,
                  item.connectionId,
                  backupId,
                  backend,
                  collectionNames,
                  { ...backupDetails, backend },
                  async (restoreData) => {
                    try {
                      const restoreConfig: any = {
                        backupId: restoreData.backupId,
                        backend: restoreData.backend,
                      };

                      if (restoreData.waitForCompletion !== undefined) {
                        restoreConfig.waitForCompletion = restoreData.waitForCompletion;
                      }
                      if (
                        restoreData.includeCollections &&
                        restoreData.includeCollections.length > 0
                      ) {
                        restoreConfig.includeCollections = restoreData.includeCollections;
                      }
                      if (
                        restoreData.excludeCollections &&
                        restoreData.excludeCollections.length > 0
                      ) {
                        restoreConfig.excludeCollections = restoreData.excludeCollections;
                      }
                      if (restoreData.cpuPercentage !== undefined) {
                        restoreConfig.cpuPercentage = restoreData.cpuPercentage;
                      }
                      if (restoreData.path) {
                        restoreConfig.path = restoreData.path;
                      }
                      if (restoreData.rolesOptions) {
                        restoreConfig.rolesOptions = restoreData.rolesOptions;
                      }
                      if (restoreData.usersOptions) {
                        restoreConfig.usersOptions = restoreData.usersOptions;
                      }

                      const result = await client.backup.restore(restoreConfig);

                      vscode.window.showInformationMessage(
                        `Backup restore initiated. Status: ${result.status}`
                      );

                      setTimeout(async () => {
                        await weaviateTreeDataProvider.refreshCollections(item.connectionId, true);
                      }, 2000);
                    } catch (error) {
                      throw error;
                    }
                  },
                  async (msg, postMsg) => {
                    if (msg.command === 'fetchRestoreStatus') {
                      try {
                        const restoreStatus = await client.backup.getRestoreStatus({
                          backend: msg.backend,
                          backupId: msg.backupId,
                        });

                        postMsg({
                          command: 'restoreStatus',
                          status: restoreStatus,
                        });

                        await weaviateTreeDataProvider.refreshCollections(item.connectionId, true);
                      } catch (error) {
                        postMsg({
                          command: 'error',
                          message: error instanceof Error ? error.message : String(error),
                        });
                      }
                    }
                  }
                );
              } catch (error) {
                postMessage({
                  command: 'error',
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open backup panel: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  /**
   * Creates common alias callbacks for create, update, delete and message handling
   */
  function createAliasCallbacks(
    client: any,
    treeProvider: WeaviateTreeDataProvider,
    connectionId: string
  ) {
    return {
      onCreate: async (aliasData: AliasCreateData) => {
        try {
          await client.alias.create({
            alias: aliasData.alias,
            collection: aliasData.collection,
          });
        } finally {
          await treeProvider.refreshAliases(connectionId, true);
        }
      },
      onUpdate: async (aliasData: AliasUpdateData) => {
        try {
          await client.alias.update({
            alias: aliasData.alias,
            newTargetCollection: aliasData.newTargetCollection,
          });
        } finally {
          await treeProvider.refreshAliases(connectionId, true);
        }
      },
      onDelete: async (alias: string) => {
        try {
          await client.alias.delete(alias);
        } finally {
          await treeProvider.refreshAliases(connectionId, true);
          // Close the panel for this alias
          AliasPanel.closeForAlias(connectionId, alias);
        }
      },
      onMessage: async (message: any, postMessage: any) => {
        if (message.command === 'fetchAliases') {
          try {
            const aliasesResponse = await client.alias.listAll();
            const aliases: AliasItem[] = aliasesResponse
              ? (aliasesResponse as any[]).map((aliasObj: any) => ({
                  alias: aliasObj.alias,
                  collection: aliasObj.collection,
                }))
              : [];

            postMessage({
              command: 'aliasesData',
              aliases,
            });

            await treeProvider.refreshAliases(connectionId);
          } catch (error) {
            postMessage({
              command: 'error',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      },
    };
  }

  context.subscriptions.push(
    // Manage aliases command (create new alias)
    vscode.commands.registerCommand('weaviate.manageAliases', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = await connectionManager.getClient(item.connectionId);

        if (!client) {
          vscode.window.showErrorMessage('Failed to get Weaviate client');
          return;
        }

        // Get collections
        const collections = await client.collections.listAll();
        const collectionNames = Object.keys(collections).map(
          (key: string) => (collections as any)[key].name
        );

        // Create alias callbacks
        const callbacks = createAliasCallbacks(client, weaviateTreeDataProvider, item.connectionId);

        // Open alias panel in create mode
        AliasPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          collectionNames,
          'create',
          undefined,
          callbacks.onCreate,
          callbacks.onUpdate,
          callbacks.onDelete,
          callbacks.onMessage
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to open alias management: ${errorMessage}`);
      }
    }),

    // Edit alias command
    vscode.commands.registerCommand('weaviate.editAlias', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing alias information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = await connectionManager.getClient(item.connectionId);

        if (!client) {
          vscode.window.showErrorMessage('Failed to get Weaviate client');
          return;
        }

        // Get collections
        const collections = await client.collections.listAll();
        const collectionNames = Object.keys(collections).map(
          (key: string) => (collections as any)[key].name
        );

        // Get alias details
        const aliasesResponse = await client.alias.listAll();
        const aliases: AliasItem[] = aliasesResponse
          ? (aliasesResponse as any[]).map((aliasObj: any) => ({
              alias: aliasObj.alias,
              collection: aliasObj.collection,
            }))
          : [];

        const aliasToEdit = aliases.find((a) => a.alias === item.itemId);

        // Create alias callbacks
        const callbacks = createAliasCallbacks(client, weaviateTreeDataProvider, item.connectionId);

        // Open alias panel in edit mode
        AliasPanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          collectionNames,
          'edit',
          aliasToEdit,
          callbacks.onCreate,
          callbacks.onUpdate,
          callbacks.onDelete,
          callbacks.onMessage
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to edit alias: ${errorMessage}`);
      }
    }),

    // Delete alias command
    vscode.commands.registerCommand('weaviate.deleteAlias', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing alias information');
        return;
      }

      try {
        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the alias "${item.itemId}"?`,
          { modal: true },
          'Delete'
        );

        if (confirmation !== 'Delete') {
          return;
        }

        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = await connectionManager.getClient(item.connectionId);

        if (!client) {
          vscode.window.showErrorMessage('Failed to get Weaviate client');
          return;
        }

        await client.alias.delete(item.itemId);

        // Close the alias panel for this alias if it's open
        AliasPanel.closeForAlias(item.connectionId, item.itemId);

        await weaviateTreeDataProvider.refreshAliases(item.connectionId, true);
        vscode.window.showInformationMessage(`Alias "${item.itemId}" deleted successfully`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to delete alias: ${errorMessage}`);
      }
    }),

    // Restore backup command
    vscode.commands.registerCommand('weaviate.restoreBackup', async (item) => {
      if (!item?.connectionId || !item?.itemId) {
        vscode.window.showErrorMessage('Missing connection or backup information');
        return;
      }

      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const client = await connectionManager.getClient(item.connectionId);

        if (!client) {
          vscode.window.showErrorMessage('Failed to get Weaviate client');
          return;
        }

        // Get backup details from cache
        const backupDetails = weaviateTreeDataProvider.getBackupDetails(
          item.connectionId,
          item.itemId
        );

        if (!backupDetails) {
          vscode.window.showErrorMessage('Backup details not found');
          return;
        }

        // Only allow restore for SUCCESS backups
        if (backupDetails.status !== 'SUCCESS') {
          vscode.window.showWarningMessage(
            `Cannot restore backup with status: ${backupDetails.status}. Only SUCCESS backups can be restored.`
          );
          return;
        }

        // Get collections
        const collections = await client.collections.listAll();
        const collectionNames = Object.keys(collections).map(
          (key: string) => (collections as any)[key].name
        );

        // Open restore panel
        const panel = BackupRestorePanel.createOrShow(
          context.extensionUri,
          item.connectionId,
          backupDetails.id,
          backupDetails.backend,
          collectionNames,
          backupDetails,
          async (restoreData) => {
            try {
              // Restore backup - build config object
              const restoreConfig: any = {
                backupId: restoreData.backupId,
                backend: restoreData.backend,
              };

              // Add waitForCompletion
              if (restoreData.waitForCompletion !== undefined) {
                restoreConfig.waitForCompletion = restoreData.waitForCompletion;
              }

              // Add optional parameters only if they have values
              if (restoreData.includeCollections && restoreData.includeCollections.length > 0) {
                restoreConfig.includeCollections = restoreData.includeCollections;
              }
              if (restoreData.excludeCollections && restoreData.excludeCollections.length > 0) {
                restoreConfig.excludeCollections = restoreData.excludeCollections;
              }
              if (restoreData.cpuPercentage !== undefined) {
                restoreConfig.cpuPercentage = restoreData.cpuPercentage;
              }
              if (restoreData.path) {
                restoreConfig.path = restoreData.path;
              }
              if (restoreData.rolesOptions) {
                restoreConfig.rolesOptions = restoreData.rolesOptions;
              }
              if (restoreData.usersOptions) {
                restoreConfig.usersOptions = restoreData.usersOptions;
              }
              console.log('calling backup.restore with config:', restoreConfig);
              const result = await client.backup.restore(restoreConfig);

              vscode.window.showInformationMessage(
                `Backup restore initiated. Status: ${result.status}`
              );

              // Refresh collections after restore
              setTimeout(async () => {
                await weaviateTreeDataProvider.refreshCollections(item.connectionId, true);
              }, 2000);
            } catch (error) {
              throw error; // Re-throw to be handled by the panel
            }
          },
          async (message, postMessage) => {
            // Handle additional messages
            if (message.command === 'fetchRestoreStatus') {
              try {
                const { backupId, backend } = message;

                const restoreStatus = await client.backup.getRestoreStatus({ backend, backupId });

                postMessage({
                  command: 'restoreStatus',
                  status: restoreStatus,
                });

                // Refresh collections after each status check
                await weaviateTreeDataProvider.refreshCollections(item.connectionId, true);
              } catch (error) {
                postMessage({
                  command: 'error',
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Refresh collections command
    vscode.commands.registerCommand('weaviate.refreshCollections', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshCollections(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh collections: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Refresh nodes command
    vscode.commands.registerCommand('weaviate.refreshNodes', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshNodes(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh nodes: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Refresh metadata command
    vscode.commands.registerCommand('weaviate.refreshMetadata', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.refreshMetadata(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh metadata: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Export schema command
    vscode.commands.registerCommand('weaviate.exportSchema', async (item) => {
      if (!item?.connectionId || !item?.label) {
        vscode.window.showErrorMessage('Missing connection or collection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.exportSchema(item.connectionId, item.label);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to export schema: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // Add collection command
    vscode.commands.registerCommand('weaviate.addCollection', async (item) => {
      if (!item?.connectionId) {
        vscode.window.showErrorMessage('Missing connection information');
        return;
      }

      try {
        await weaviateTreeDataProvider.addCollectionWithOptions(item.connectionId);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to add collection: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    // DEBUG COMMANDS - for troubleshooting connection name conflicts
    vscode.commands.registerCommand('weaviate.debug.listConnections', async () => {
      try {
        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const names = connectionManager.getConnectionNames();
        const connections = connectionManager.getConnections();

        const info = connections
          .map((c: any) => `- ${c.name} (ID: ${c.id}, Type: ${c.type}, Status: ${c.status})`)
          .join('\n');
        const message = `Current connections:\n${info || '(No connections found)'}`;

        await vscode.window.showInformationMessage(message, { modal: true });
        console.log('Debug - Connection list:', connections);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Debug failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    vscode.commands.registerCommand('weaviate.debug.checkNameConflict', async () => {
      try {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter connection name to check for conflicts',
          placeHolder: 'Connection name...',
        });

        if (!name) {
          return;
        }

        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        const result = connectionManager.checkNameConflict(name);

        if (result.exists) {
          const conflict = result.conflictingConnection!;
          vscode.window.showWarningMessage(
            `Name conflict found! Existing connection: "${conflict.name}" (ID: ${conflict.id}, Type: ${conflict.type})`
          );
        } else {
          vscode.window.showInformationMessage(`No name conflict found. "${name}" is available.`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Debug failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),

    vscode.commands.registerCommand('weaviate.debug.clearAllConnections', async () => {
      try {
        const confirm = await vscode.window.showWarningMessage(
          'This will DELETE ALL connections permanently. Are you sure?',
          { modal: true },
          'Yes, Clear All Connections'
        );

        if (confirm !== 'Yes, Clear All Connections') {
          return;
        }

        const secondConfirm = await vscode.window.showWarningMessage(
          'Last warning: This action cannot be undone. All connections will be lost!',
          { modal: true },
          'I understand, proceed'
        );

        if (secondConfirm !== 'I understand, proceed') {
          return;
        }

        const connectionManager = weaviateTreeDataProvider.getConnectionManager();
        await connectionManager.clearAllConnections();

        // Refresh the tree view to reflect changes
        weaviateTreeDataProvider.refresh();

        vscode.window.showInformationMessage('All connections have been cleared successfully.');
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to clear connections: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Register the tree view
  context.subscriptions.push(treeView);

  // Restore previous connections state
  weaviateTreeDataProvider.refresh();
}

// This method is called when your extension is deactivated
export function deactivate() {}
