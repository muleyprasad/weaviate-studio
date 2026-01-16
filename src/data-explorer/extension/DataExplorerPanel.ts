import * as vscode from 'vscode';
import * as fs from 'fs';
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
  private static readonly CONNECTION_ERROR_MESSAGE =
    'Connection lost. Please reconnect from the Connections view.';

  private _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _options: DataExplorerOptions;
  private _client: WeaviateClient | null = null;
  private _api: DataExplorerAPI | null = null;
  private _context: vscode.ExtensionContext;
  private _connectionManager: ConnectionManager;
  private _isConnectionActive: boolean = false;
  private _connectionStateListener: vscode.Disposable | null = null;

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

    // Check initial connection state
    this._updateConnectionState();

    // Subscribe to connection changes
    // When a connection is disconnected in the tree view, this ensures all data explorer
    // panels using that connection are immediately notified
    if (this._connectionManager.onConnectionsChanged) {
      this._connectionStateListener = this._connectionManager.onConnectionsChanged(() => {
        this._updateConnectionState();
      });
      if (this._connectionStateListener) {
        this._disposables.push(this._connectionStateListener);
      }
    }

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
      this._client = this._connectionManager.getClient(this._options.connectionId) || null;

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

        case 'savePreferences':
          await this._savePreferences(message.data.collectionName, message.data.preferences);
          break;

        case 'vectorSearch':
          await this._handleVectorSearch(message.data);
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
   * Handle vector search request
   */
  private async _handleVectorSearch(params: any) {
    if (!this._api) {
      throw new Error('API not initialized');
    }

    const collectionName = this._options.collectionName;
    let objects: any[] = [];

    // Call appropriate API method based on search mode
    switch (params.mode) {
      case 'text':
        objects = await this._api.vectorSearchText({
          collectionName,
          searchText: params.searchText,
          limit: params.limit,
          distance: params.distance,
          certainty: params.certainty,
        });
        break;

      case 'object':
        objects = await this._api.vectorSearchObject({
          collectionName,
          referenceObjectId: params.referenceObjectId,
          limit: params.limit,
          distance: params.distance,
          certainty: params.certainty,
        });
        break;

      case 'vector':
        objects = await this._api.vectorSearchVector({
          collectionName,
          vector: params.vectorInput,
          limit: params.limit,
          distance: params.distance,
          certainty: params.certainty,
        });
        break;

      default:
        throw new Error(`Unknown vector search mode: ${params.mode}`);
    }

    // Transform objects to results with similarity scores
    const results = objects.map((obj: any) => ({
      object: obj,
      distance: obj.distance,
      certainty: obj.certainty,
      score: obj.score,
    }));

    this._postMessage({
      command: 'vectorSearchResults',
      data: { results },
    });
  }

  /**
   * Update connection state and notify webview if changed
   */
  private _updateConnectionState(): void {
    const connectionId = this._options.connectionId;
    if (!connectionId) {
      this._isConnectionActive = false;
      this._notifyConnectionStatus(false);
      return;
    }

    const connection = this._connectionManager.getConnection?.(connectionId);
    const wasConnected = this._isConnectionActive;
    const isNowConnected = connection?.status === 'connected';

    this._isConnectionActive = isNowConnected;

    // Only notify webview if state changed
    if (wasConnected !== isNowConnected) {
      this._notifyConnectionStatus(isNowConnected);
    }
  }

  /**
   * Notify webview of connection status
   */
  private _notifyConnectionStatus(isConnected: boolean): void {
    this._postMessage({
      command: 'error',
      data: {
        message: isConnected ? '' : DataExplorerPanel.CONNECTION_ERROR_MESSAGE,
      },
    });
  }

  /**
   * Get preferences for a collection
   */
  private _getPreferences(collectionName: string): Record<string, unknown> {
    const allPreferences =
      this._context.globalState.get<DataExplorerPreferences>(DataExplorerPanel.PREFERENCES_KEY) || {};
    return allPreferences[collectionName] || {};
  }

  /**
   * Save preferences for a collection
   */
  private async _savePreferences(collectionName: string, preferences: Record<string, unknown>): Promise<void> {
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
  private async _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = await this._getHtmlForWebview(webview);
  }

  /**
   * Generate HTML for webview by reading the built HTML file
   */
  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    // Read the built HTML file from webpack output
    const webviewHtmlPath = vscode.Uri.joinPath(
      this._context.extensionUri,
      'dist',
      'webview',
      'dataExplorer.html'
    );
    let htmlContent = await fs.promises.readFile(webviewHtmlPath.fsPath, 'utf-8');

    // Generate nonce for CSP
    const nonce = getNonce();
    htmlContent = htmlContent.replace(/{{nonce}}/g, nonce);
    htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);

    // Calculate baseHref for the <base> tag
    const webviewDistPath = vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview');
    const baseHrefUri = webview.asWebviewUri(webviewDistPath);
    let baseHrefString = baseHrefUri.toString();
    if (!baseHrefString.endsWith('/')) {
      baseHrefString += '/';
    }
    htmlContent = htmlContent.replace(/{{baseHref}}/g, baseHrefString);

    return htmlContent;
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
