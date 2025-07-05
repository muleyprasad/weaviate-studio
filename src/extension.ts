import * as vscode from 'vscode';
import { WeaviateTreeDataProvider } from './WeaviateTreeDataProvider/WeaviateTreeDataProvider';
import { QueryEditorPanel } from './query-editor/extension/QueryEditorPanel';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('"Weaviate Manager" extension is now active');

    // Create and register the TreeDataProvider
    const weaviateTreeDataProvider = new WeaviateTreeDataProvider(context);
    const treeView = vscode.window.createTreeView('weaviateConnectionsView', {
        treeDataProvider: weaviateTreeDataProvider,
        showCollapseAll: true
    });

    // Handle selection of tree items
    treeView.onDidChangeSelection(async e => {
        if (e.selection && e.selection.length > 0) {
            const item = e.selection[0];
            
            // Handle connection selection – auto connect if not connected
            if (item.itemType === 'connection' && item.connectionId) {
                // Get connection status
                const connection = weaviateTreeDataProvider.getConnectionById(item.connectionId);
                
                // If disconnected, connect to it automatically
                if (connection && connection.status !== 'connected') {
                    console.log(`Auto-connecting to ${connection.name} (${item.connectionId})`);
                    await weaviateTreeDataProvider.connect(item.connectionId, true); // silent=true to avoid notification on success
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
        vscode.commands.registerCommand('weaviate.disconnect', async (item: { connectionId: string }) => {
            if (item?.connectionId) {
                await weaviateTreeDataProvider.disconnect(item.connectionId);
            }
        }),

        // Edit an existing connection
        vscode.commands.registerCommand('weaviate.editConnection', async (item: { connectionId: string }) => {
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
        }),

        // Delete a connection
        vscode.commands.registerCommand('weaviate.deleteConnection', async (item: { connectionId: string }) => {
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
                const deletedConnectionName = await weaviateTreeDataProvider.deleteConnection(item.connectionId);
                vscode.window.showInformationMessage(`Connection "${deletedConnectionName}" deleted`);
            } catch (error) {
                vscode.window.showErrorMessage(
                    error instanceof Error ? error.message : 'Failed to delete connection'
                );
            }
        }),

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
        vscode.commands.registerCommand('weaviate.deleteCollection', async (item: { connectionId: string; collectionName: string }) => {
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
                vscode.window.showInformationMessage(`Collection "${item.collectionName}" deleted successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to delete collection: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }),

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

        // Duplicate collection command
        vscode.commands.registerCommand('weaviate.duplicateCollection', async (item) => {
            if (!item?.connectionId || !item?.label) {
                vscode.window.showErrorMessage('Missing connection or collection information');
                return;
            }
            
            try {
                await weaviateTreeDataProvider.duplicateCollection(item.connectionId, item.label);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to duplicate collection: ${error instanceof Error ? error.message : String(error)}`
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
