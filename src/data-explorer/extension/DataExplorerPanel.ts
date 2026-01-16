import * as vscode from 'vscode';
import { WeaviateClient } from 'weaviate-client';
import { ConnectionManager } from '../../services/ConnectionManager';
import { DataExplorerAPI } from './DataExplorerAPI';
import type {
  WebviewMessage,
  ExtensionMessage,
  DataExplorerPreferences,
} from '../types';

// Helper function to generate a nonce
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

interface DataExplorerOptions {
  connectionId: string;
  collectionName: string;
}

function getWebviewOptions(
  extensionUri: vscode.Uri
): vscode.WebviewPanelOptions & vscode.WebviewOptions {
  return {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [
      vscode.Uri.joinPath(extensionUri, 'media'),
      vscode.Uri.joinPath(extensionUri, 'dist'),
    ],
  };
}

export class DataExplorerPanel {
  public static readonly viewType = 'weaviate.dataExplorer';
  private static readonly panels = new Map<string, DataExplorerPanel>();
  private static readonly PREFERENCES_KEY = 'dataExplorerPreferences';

  private _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _options: DataExplorerOptions;
  private _client: WeaviateClient | null = null;
  private _api: DataExplorerAPI | null = null;
  private _context: vscode.ExtensionContext;
  private _connectionManager: ConnectionManager;

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    connectionManager: ConnectionManager,
    options: DataExplorerOptions
  ) {
    this._panel = panel;
    this._context = context;
    this._connectionManager = connectionManager;
    this._options = options;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleWebviewMessage(message),
      null,
      this._disposables
    );

    // Initialize connection
    this._initializeConnection();
  }

  /**
   * Create or show a Data Explorer panel
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    connectionManager: ConnectionManager,
    options: DataExplorerOptions
  ): DataExplorerPanel {
    const panelKey = `${options.connectionId}-${options.collectionName}`;

    // If we already have a panel, show it
    if (DataExplorerPanel.panels.has(panelKey)) {
      const existingPanel = DataExplorerPanel.panels.get(panelKey)!;
      existingPanel._panel.reveal();
      return existingPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      DataExplorerPanel.viewType,
      `Data Explorer: ${options.collectionName}`,
      vscode.ViewColumn.One,
      getWebviewOptions(context.extensionUri)
    );

    const explorerPanel = new DataExplorerPanel(panel, context, connectionManager, options);
    DataExplorerPanel.panels.set(panelKey, explorerPanel);

    return explorerPanel;
  }

  /**
   * Initialize connection to Weaviate
   */
  private async _initializeConnection() {
    try {
      this._client = this._connectionManager.getClient(this._options.connectionId);

      if (!this._client) {
        throw new Error('Failed to get Weaviate client');
      }

      this._api = new DataExplorerAPI(this._client);

      // Send initialization success to webview
      this._postMessage({
        command: 'initialized',
        data: {
          connectionId: this._options.connectionId,
          collectionName: this._options.collectionName,
          preferences: this._getPreferences(this._options.collectionName),
        },
      });

      // Fetch initial data
      await this._handleFetchObjects({
        collectionName: this._options.collectionName,
        limit: 20,
        offset: 0,
      });

      // Fetch schema
      await this._handleGetSchema(this._options.collectionName);
    } catch (error) {
      this._postMessage({
        command: 'error',
        data: {
          message: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
  }

  /**
   * Handle messages from webview
   */
  private async _handleWebviewMessage(message: WebviewMessage) {
    try {
      switch (message.command) {
        case 'fetchObjects':
          await this._handleFetchObjects(message.data);
          break;

        case 'getSchema':
          await this._handleGetSchema(message.data.collectionName);
          break;

        case 'selectObject':
          await this._handleSelectObject(message.data);
          break;

        case 'error':
          vscode.window.showErrorMessage(message.data.message);
          break;

        default:
          console.warn('Unknown command:', message.command);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._postMessage({
        command: 'error',
        data: { message: errorMessage },
      });
      vscode.window.showErrorMessage(`Data Explorer: ${errorMessage}`);
    }
  }

  /**
   * Handle fetch objects request
   */
  private async _handleFetchObjects(params: any) {
    if (!this._api) {
      throw new Error('API not initialized');
    }

    const result = await this._api.fetchObjects(params);

    this._postMessage({
      command: 'objectsLoaded',
      data: result,
    });
  }

  /**
   * Handle get schema request
   */
  private async _handleGetSchema(collectionName: string) {
    if (!this._api) {
      throw new Error('API not initialized');
    }

    const schema = await this._api.getSchema(collectionName);

    this._postMessage({
      command: 'schemaLoaded',
      data: schema,
    });
  }

  /**
   * Handle select object request
   */
  private async _handleSelectObject(params: { collectionName: string; uuid: string }) {
    if (!this._api) {
      throw new Error('API not initialized');
    }

    const object = await this._api.getObjectByUuid(params.collectionName, params.uuid);

    this._postMessage({
      command: 'objectSelected',
      data: object,
    });
  }

  /**
   * Get preferences for a collection
   */
  private _getPreferences(collectionName: string): any {
    const allPreferences =
      this._context.globalState.get<DataExplorerPreferences>(DataExplorerPanel.PREFERENCES_KEY) || {};
    return allPreferences[collectionName] || {};
  }

  /**
   * Save preferences for a collection
   */
  private async _savePreferences(collectionName: string, preferences: any) {
    const allPreferences =
      this._context.globalState.get<DataExplorerPreferences>(DataExplorerPanel.PREFERENCES_KEY) || {};
    allPreferences[collectionName] = preferences;
    await this._context.globalState.update(DataExplorerPanel.PREFERENCES_KEY, allPreferences);
  }

  /**
   * Post message to webview
   */
  private _postMessage(message: ExtensionMessage) {
    this._panel.webview.postMessage(message);
  }

  /**
   * Update the webview content
   */
  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * Generate HTML for webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to main script run in the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'dataExplorer.bundle.js')
    );

    // Get the local path to css
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'media', 'dataExplorer.css')
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Data Explorer</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Dispose the panel
   */
  public dispose() {
    const panelKey = `${this._options.connectionId}-${this._options.collectionName}`;
    DataExplorerPanel.panels.delete(panelKey);

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
