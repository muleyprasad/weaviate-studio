import * as vscode from 'vscode';
import { WeaviateTreeDataProvider } from './WeaviateTreeDataProvider/WeaviateTreeDataProvider';
import { QueryEditorPanel } from './query-editor/extension/QueryEditorPanel';
import { WeaviateConnection } from './services/ConnectionManager';
import { parseWeaviateFile, generateUniqueConnectionName } from './utils/weaviateFileHandler';
import { BackupPanel } from './views/BackupPanel';

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

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
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

      // If disconnected, show dialog asking to connect
      if (connection && connection.status !== 'connected') {
        const result = await vscode.window.showInformationMessage(
          `The connection "${connection.name}" is disconnected. Would you like to connect now?`,
          { modal: true },
          'Connect'
        );

        if (result === 'Connect') {
          await weaviateTreeDataProvider.connect(item.connectionId);
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
        vscode.window.showInformationMessage('Backups refreshed');
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh backups: ${error instanceof Error ? error.message : String(error)}`
        );
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
            await client.backup.create({
              backupId: backupData.backupId,
              backend: backupData.backend,
              waitForCompletion: false,
              includeCollections: backupData.includeCollections,
              excludeCollections: backupData.excludeCollections,
            });
          },
          async (message, postMessage) => {
            // Handle additional messages
            if (message.command === 'fetchBackups') {
              try {
                // Fetch all backups from all backends
                const backupModules = Object.keys(availableModules).filter((key) =>
                  key.startsWith('backup-')
                );

                const allBackups: any[] = [];

                for (const moduleName of backupModules) {
                  const backend = moduleName.replace('backup-', '') as any;
                  try {
                    const backupsResponse = await client.backup.list(backend);

                    if (backupsResponse && Array.isArray(backupsResponse)) {
                      const backupsWithBackend = backupsResponse.map((b: any) => ({
                        id: b.id,
                        backend: backend,
                        status: b.status,
                        error: b.error,
                      }));
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
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open backup panel: ${error instanceof Error ? error.message : String(error)}`
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
        vscode.window.showInformationMessage('Collections refreshed');
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
        vscode.window.showInformationMessage('Nodes refreshed');
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
        vscode.window.showInformationMessage('Metadata refreshed');
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
