import * as vscode from 'vscode';
import { WeaviateTreeDataProvider } from './WeaviateTreeDataProvider';
import { WeaviateQueryEditor } from './query-editor/WeaviateQueryEditor';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('"Weaviate Manager" extension is now active');

    // Create and register the TreeDataProvider
    const weaviateTreeDataProvider = new WeaviateTreeDataProvider(context);
    const treeView = vscode.window.createTreeView('weaviateConnectionsView', {
        treeDataProvider: weaviateTreeDataProvider,
        showCollapseAll: true
    });

    // Handle double-click on tree items
    treeView.onDidChangeSelection(async e => {
        if (e.selection && e.selection.length > 0) {
            const item = e.selection[0];
            if (item.itemType === 'collection' && item.connectionId) {
                // Open query editor with the selected collection
                vscode.commands.executeCommand('weaviate.queryCollection', item.connectionId, item.label);
            }
        }
    });

    // Create and show the filter input box (search bar)
    const filterBoxContainer = vscode.window.createInputBox();
    filterBoxContainer.placeholder = 'Filter (e.g., regex, vector distance >=...)';
    filterBoxContainer.onDidChangeValue((text) => {
        weaviateTreeDataProvider.setFilterText(text);
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
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the connection "${connection.name}"?`,
                { modal: true },
                'Delete'
            );

            if (confirm === 'Delete') {
                try {
                    await weaviateTreeDataProvider.deleteConnection(item.connectionId);
                    vscode.window.showInformationMessage(`Connection "${connection.name}" deleted`);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to delete connection: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
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
            WeaviateQueryEditor.createOrShow(context.extensionUri, { connectionId, collectionName });
        }),

        // Refresh the tree view
        vscode.commands.registerCommand('weaviate.refresh', () => {
            weaviateTreeDataProvider.refresh();
        })
    );

    // Register the tree view
    context.subscriptions.push(treeView);

    // Restore previous connections state
    weaviateTreeDataProvider.refresh();
}

// This method is called when your extension is deactivated
export function deactivate() {}
