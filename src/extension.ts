import * as vscode from 'vscode';
import { WeaviateTreeDataProvider } from './WeaviateTreeDataProvider';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('"Weaviate Manager" extension is now active');

	// Create and register the TreeDataProvider
	const weaviateTreeDataProvider = new WeaviateTreeDataProvider(context);
	const treeView = vscode.window.createTreeView('weaviateConnectionsView', {
		treeDataProvider: weaviateTreeDataProvider,
		showCollapseAll: false,
		canSelectMany: false
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
	
	context.subscriptions.push(treeView);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('weaviate.refreshConnections', () => {
			weaviateTreeDataProvider.refresh();
			vscode.window.showInformationMessage('Weaviate connections refreshed');
		}),

		vscode.commands.registerCommand('weaviate.addConnection', async () => {
			// Show input box for connection name
			const name = await vscode.window.showInputBox({
				placeHolder: 'Connection name (e.g., demo-cluster)',
				prompt: 'Enter a name for the Weaviate connection',
				validateInput: (value) => {
					return value.trim().length === 0 ? 'Name cannot be empty' : null;
				}
			});

			if (!name) { return; } // User cancelled

			// Show input box for connection URL
			const url = await vscode.window.showInputBox({
				placeHolder: 'Weaviate URL (e.g., http://localhost:8080)',
				prompt: 'Enter the URL of the Weaviate instance',
				validateInput: (value) => {
					try {
						new URL(value);
						return null;
					} catch (e) {
						return 'Please enter a valid URL';
					}
				}
			});

			if (!url) { return; } // User cancelled

			// Show input box for API key (optional)
			const apiKey = await vscode.window.showInputBox({
				placeHolder: 'API Key (optional)',
				prompt: 'Enter the API key for authentication (leave empty if not required)',
				password: true
			});

			// Add the connection
			await weaviateTreeDataProvider.addConnection({ name, url, apiKey });
		}),

		vscode.commands.registerCommand('weaviate.connect', async (item) => {
			if (item?.connectionId) {
				await weaviateTreeDataProvider.connect(item.connectionId);
			}
		}),

		vscode.commands.registerCommand('weaviate.disconnect', (item) => {
			if (item?.connectionId) {
				weaviateTreeDataProvider.disconnect(item.connectionId);
			}
		}),

		vscode.commands.registerCommand('weaviate.editConnection', async (item) => {
			if (!item?.connectionId) { return; }

			// Get the current connection details
			const connection = weaviateTreeDataProvider.getConnectionById(item.connectionId);
			if (!connection) { return; }

			// Show input box for connection name (pre-filled)
			const name = await vscode.window.showInputBox({
				value: connection.name,
				placeHolder: 'Connection name (e.g., demo-cluster)',
				prompt: 'Edit the name for the Weaviate connection',
				validateInput: (value) => {
					return value.trim().length === 0 ? 'Name cannot be empty' : null;
				}
			});

			if (!name) { return; } // User cancelled

			// Show input box for connection URL (pre-filled)
			const url = await vscode.window.showInputBox({
				value: connection.url,
				placeHolder: 'Weaviate URL (e.g., http://localhost:8080)',
				prompt: 'Edit the URL of the Weaviate instance',
				validateInput: (value) => {
					try {
						new URL(value);
						return null;
					} catch (e) {
						return 'Please enter a valid URL';
					}
				}
			});

			if (!url) { return; } // User cancelled

			// Show input box for API key (optional, pre-filled if exists)
			const apiKey = await vscode.window.showInputBox({
				value: connection.apiKey || '',
				placeHolder: 'API Key (optional)',
				prompt: 'Edit the API key for authentication (leave empty if not required)',
				password: true
			});

			// Update the connection
			await weaviateTreeDataProvider.editConnection(item.connectionId, { name, url, apiKey });
		}),

		vscode.commands.registerCommand('weaviate.deleteConnection', async (item) => {
			if (!item?.connectionId) { return; }

			// Confirm deletion
			const connection = weaviateTreeDataProvider.getConnectionById(item.connectionId);
			if (!connection) { return; }

			const confirm = await vscode.window.showWarningMessage(
				`Are you sure you want to delete the connection '${connection.name}'?`,
				{ modal: true },
				'Yes',
				'No'
			);

			if (confirm === 'Yes') {
				weaviateTreeDataProvider.deleteConnection(item.connectionId);
			}
		}),

		vscode.commands.registerCommand('weaviate.addCollection', async (item) => {
			// This would open a schema designer or input form
			// For the mockup, we'll just show a message
			vscode.window.showInformationMessage(
				`Adding collection to ${item.label} (Schema Designer would open here)`
			);
		}),

		vscode.commands.registerCommand('weaviate.viewSchema', (item) => {
			if (item?.connectionId && item?.label) {
				weaviateTreeDataProvider.viewSchema(item.connectionId, item.label);
			}
		}),

		vscode.commands.registerCommand('weaviate.queryCollection', (item) => {
			if (item?.connectionId && item?.label) {
				weaviateTreeDataProvider.queryCollection(item.connectionId, item.label);
			}
		}),

		vscode.commands.registerCommand('weaviate.deleteCollection', async (item) => {
			if (!item?.connectionId || !item?.label) { return; }

			// Confirm deletion
			const confirm = await vscode.window.showWarningMessage(
				`Are you sure you want to delete the collection '${item.label}'?`,
				{ modal: true },
				'Yes',
				'No'
			);

			if (confirm === 'Yes') {
				await weaviateTreeDataProvider.deleteCollection(item.connectionId, item.label);
			}
		})
	);

	// Register the filter box command
	context.subscriptions.push(
		vscode.commands.registerCommand('weaviate.showFilterBox', () => {
			filterBoxContainer.show();
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
