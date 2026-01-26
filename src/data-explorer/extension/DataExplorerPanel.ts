/**
 * DataExplorerPanel - Main webview panel controller for the Data Explorer
 * Manages the VS Code webview panel lifecycle and message passing
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { WeaviateClient } from 'weaviate-client';
import { DataExplorerAPI } from './DataExplorerAPI';
import type {
  ExtensionMessage,
  WebviewMessage,
  WeaviateObject,
  CollectionConfig,
  AggregationParams,
  ExportParams,
} from '../types';

/**
 * Manages the Data Explorer webview panel
 */
export class DataExplorerPanel {
  public static currentPanel: DataExplorerPanel | undefined;
  private static panels: Map<string, DataExplorerPanel> = new Map();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _connectionId: string;
  private readonly _collectionName: string;
  private _api: DataExplorerAPI | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _exportAbortController: AbortController | undefined;
  private _messageQueue: WebviewMessage[] = [];
  private _isInitializing = false;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    collectionName: string,
    private readonly getClient: () => WeaviateClient | undefined
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;
    this._collectionName = collectionName;

    // Initialize API with client
    const client = this.getClient();
    if (client) {
      this._api = new DataExplorerAPI(client);
    } else {
      // Client not ready - send connecting state to webview
      this._isInitializing = true;
    }

    // Set the webview's initial HTML content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // Update API when panel becomes active (only if not already created)
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          const client = this.getClient();
          if (client && !this._api) {
            // Only create if doesn't exist
            this._api = new DataExplorerAPI(client);
            this._isInitializing = false;
            // Process queued messages
            this._processMessageQueue();
          }
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Creates or shows the Data Explorer panel for a collection
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    collectionName: string,
    getClient: () => WeaviateClient | undefined
  ): DataExplorerPanel {
    const panelKey = `${connectionId}:${collectionName}`;
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    // Check if panel already exists for this collection
    const existingPanel = DataExplorerPanel.panels.get(panelKey);
    if (existingPanel) {
      existingPanel._panel.reveal(column);
      return existingPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'weaviateDataExplorer',
      `Data Explorer: ${collectionName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'out'),
        ],
      }
    );

    const dataExplorerPanel = new DataExplorerPanel(
      panel,
      extensionUri,
      connectionId,
      collectionName,
      getClient
    );

    DataExplorerPanel.panels.set(panelKey, dataExplorerPanel);
    DataExplorerPanel.currentPanel = dataExplorerPanel;

    return dataExplorerPanel;
  }

  /**
   * Sends a message to the webview
   */
  public postMessage(message: ExtensionMessage): void {
    this._panel.webview.postMessage(message);
  }

  /**
   * Disposes the panel
   */
  public dispose(): void {
    const panelKey = `${this._connectionId}:${this._collectionName}`;
    DataExplorerPanel.panels.delete(panelKey);

    if (DataExplorerPanel.currentPanel === this) {
      DataExplorerPanel.currentPanel = undefined;
    }

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Gets the connection ID for this panel
   */
  public getConnectionId(): string {
    return this._connectionId;
  }

  /**
   * Gets the collection name for this panel
   */
  public getCollectionName(): string {
    return this._collectionName;
  }

  /**
   * Closes all panels for a specific connection
   */
  public static closeForConnection(connectionId: string): void {
    DataExplorerPanel.panels.forEach((panel, key) => {
      if (key.startsWith(`${connectionId}:`)) {
        panel.dispose();
      }
    });
  }

  /**
   * Handles messages from the webview
   */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    // If client not ready, try to initialize or queue the message
    if (!this._api) {
      const client = this.getClient();
      if (client) {
        // Client became available - initialize now
        this._api = new DataExplorerAPI(client);
        this._isInitializing = false;
        // Process any queued messages
        this._processMessageQueue();
      } else {
        // Still not ready - queue the message and notify user
        this._messageQueue.push(message);
        if (!this._isInitializing) {
          this._isInitializing = true;
          this.postMessage({
            command: 'connectionStatus',
            status: 'connecting',
            message: 'Connecting to Weaviate...',
          });
        }
        return;
      }
    }

    try {
      switch (message.command) {
        case 'initialize':
          await this._handleInitialize();
          break;

        case 'fetchObjects':
          await this._handleFetchObjects(message);
          break;

        case 'getSchema':
          await this._handleGetSchema();
          break;

        case 'getObjectDetail':
          // Validate uuid field
          if (!message.uuid || typeof message.uuid !== 'string') {
            this.postMessage({
              command: 'error',
              error: 'Invalid getObjectDetail message: missing or invalid uuid',
            });
            return;
          }
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(message.uuid)) {
            this.postMessage({
              command: 'error',
              error: 'Invalid UUID format',
            });
            return;
          }
          await this._handleGetObjectDetail(message.uuid);
          break;

        case 'refresh':
          await this._handleInitialize();
          break;

        // Phase 5: Aggregations and Export
        case 'getAggregations':
          await this._handleGetAggregations(message);
          break;

        case 'exportObjects':
          await this._handleExportObjects(message);
          break;

        case 'cancelExport':
          this._handleCancelExport(message);
          break;

        default:
          console.warn(`Unknown command received: ${message.command}`);
          this.postMessage({
            command: 'error',
            error: `Unknown command: ${message.command}`,
          });
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('DataExplorerPanel error:', error);
      this.postMessage({
        command: 'error',
        error: errorMessage,
      });
    }
  }

  /**
   * Handles initialization request
   */
  private async _handleInitialize(): Promise<void> {
    if (!this._api) {
      this.postMessage({
        command: 'error',
        error: 'Weaviate connection lost. Please reconnect.',
      });
      return;
    }

    // Get schema first
    const schema = await this._api.getCollectionSchema(this._collectionName);
    this.postMessage({
      command: 'schemaLoaded',
      schema,
      collectionName: this._collectionName,
      // No requestId for schema - it's not cancellable
    });

    // Get initial objects
    const result = await this._api.fetchObjects({
      collectionName: this._collectionName,
      limit: 20,
      offset: 0,
    });

    this.postMessage({
      command: 'objectsLoaded',
      objects: result.objects,
      total: result.total,
      unfilteredTotal: result.unfilteredTotal,
      // No requestId for initial load - it's not cancellable
    });
  }

  /**
   * Handles fetch objects request
   */
  private async _handleFetchObjects(message: WebviewMessage): Promise<void> {
    if (!this._api) {
      this.postMessage({
        command: 'error',
        error: 'Weaviate connection lost. Please reconnect.',
        requestId: message.requestId,
      });
      return;
    }

    try {
      const result = await this._api.fetchObjects({
        collectionName: this._collectionName,
        limit: message.limit || 20,
        offset: message.offset || 0,
        properties: message.properties,
        sortBy: message.sortBy,
        where: message.where, // Pass filter conditions to API
        matchMode: message.matchMode, // Pass AND/OR logic to API
        vectorSearch: message.vectorSearch, // Pass vector search params to API
      });

      this.postMessage({
        command: 'objectsLoaded',
        objects: result.objects,
        total: result.total,
        unfilteredTotal: result.unfilteredTotal,
        requestId: message.requestId, // Echo back request ID
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Vector search failed';
      console.error('DataExplorerPanel fetch error:', error);
      this.postMessage({
        command: 'error',
        error: errorMessage,
        requestId: message.requestId, // Echo back request ID for error too
      });
    }
  }

  /**
   * Handles get schema request
   */
  private async _handleGetSchema(): Promise<void> {
    if (!this._api) {
      this.postMessage({
        command: 'error',
        error: 'Weaviate connection lost. Please reconnect.',
      });
      return;
    }

    const schema = await this._api.getCollectionSchema(this._collectionName);
    this.postMessage({
      command: 'schemaLoaded',
      schema,
      collectionName: this._collectionName,
    });
  }

  /**
   * Handles get object detail request
   */
  private async _handleGetObjectDetail(uuid: string): Promise<void> {
    if (!this._api) {
      this.postMessage({
        command: 'error',
        error: 'Weaviate connection lost. Please reconnect.',
      });
      return;
    }

    const object = await this._api.getObjectByUuid(this._collectionName, uuid);
    this.postMessage({
      command: 'objectDetailLoaded',
      object,
    });
  }

  // =====================================================
  // Phase 5: Aggregation and Export Handlers
  // =====================================================

  /**
   * Handles get aggregations request
   */
  private async _handleGetAggregations(message: WebviewMessage): Promise<void> {
    if (!this._api) {
      this.postMessage({
        command: 'error',
        error: 'Weaviate connection lost. Please reconnect.',
        requestId: message.requestId,
      });
      return;
    }

    try {
      const params: AggregationParams = message.aggregationParams || {
        collectionName: this._collectionName,
      };

      // Ensure collection name is set
      params.collectionName = this._collectionName;

      const aggregations = await this._api.getAggregations(params);

      this.postMessage({
        command: 'aggregationsLoaded',
        aggregations,
        requestId: message.requestId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get aggregations';
      console.error('DataExplorerPanel aggregations error:', error);
      this.postMessage({
        command: 'error',
        error: errorMessage,
        requestId: message.requestId,
      });
    }
  }

  /**
   * Handles export objects request
   */
  private async _handleExportObjects(message: WebviewMessage): Promise<void> {
    if (!this._api) {
      this.postMessage({
        command: 'error',
        error: 'Weaviate connection lost. Please reconnect.',
        requestId: message.requestId,
      });
      return;
    }

    // Create abort controller for this export
    this._exportAbortController = new AbortController();

    try {
      const params: ExportParams = message.exportParams || {
        collectionName: this._collectionName,
        scope: 'currentPage',
        format: 'json',
        options: {
          includeMetadata: true,
          includeVectors: false,
          flattenNested: false,
          includeProperties: true,
        },
      };

      // Ensure collection name is set
      params.collectionName = this._collectionName;

      const exportResult = await this._api.exportObjects(
        params,
        this._exportAbortController.signal
      );

      // Show save dialog with proper default path
      const fileExtension = exportResult.format === 'json' ? 'json' : 'csv';
      const filters: Record<string, string[]> = {};
      if (exportResult.format === 'json') {
        filters['JSON Files'] = ['json'];
      } else {
        filters['CSV Files'] = ['csv'];
      }
      filters['All Files'] = ['*'];

      // Use workspace folder or home directory as default location
      const defaultFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(require('os').homedir());
      const defaultUri = vscode.Uri.joinPath(defaultFolder, exportResult.filename);

      const uri = await vscode.window.showSaveDialog({
        defaultUri,
        filters,
      });

      if (uri) {
        // Write file
        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportResult.data, 'utf-8'));

        // Show success message
        vscode.window.showInformationMessage(
          `Exported ${exportResult.objectCount} objects to ${path.basename(uri.fsPath)}`
        );

        // Send success back to webview
        this.postMessage({
          command: 'exportComplete',
          requestId: message.requestId,
        });
      } else {
        // User cancelled the save dialog
        this.postMessage({
          command: 'error',
          error: 'Export cancelled',
          requestId: message.requestId,
        });
      }
    } catch (error) {
      // Check if it was a cancellation
      if (error instanceof Error && error.message === 'Export cancelled') {
        this.postMessage({
          command: 'exportCancelled',
          requestId: message.requestId,
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Export failed';
        console.error('DataExplorerPanel export error:', error);
        this.postMessage({
          command: 'error',
          error: errorMessage,
          requestId: message.requestId,
        });
      }
    } finally {
      // Clean up abort controller
      this._exportAbortController = undefined;
    }
  }

  /**
   * Handles cancel export request
   */
  private _handleCancelExport(message: WebviewMessage): void {
    if (this._exportAbortController) {
      console.log('Cancelling export...');
      this._exportAbortController.abort();
      // The abort will be caught in _handleExportObjects and send exportCancelled message
    } else {
      // No active export
      this.postMessage({
        command: 'exportCancelled',
        requestId: message.requestId,
      });
    }
  }

  /**
   * Updates the webview HTML content
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * Generates the HTML content for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
    const htmlPath = path.join(distPath.fsPath, 'data-explorer.html');

    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch {
      // Fallback HTML if bundle is not built
      return `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Data Explorer</title>
          <style>
            body {
              font-family: var(--vscode-font-family);
              background-color: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .error-container {
              text-align: center;
              max-width: 500px;
            }
            h1 { color: var(--vscode-errorForeground); }
            p { color: var(--vscode-descriptionForeground); }
            code {
              background-color: var(--vscode-textCodeBlock-background);
              padding: 2px 6px;
              border-radius: 3px;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Data Explorer Not Built</h1>
            <p>The Data Explorer webview bundle has not been built yet.</p>
            <p>Please run: <code>npm run build:webview</code></p>
          </div>
        </body>
        </html>`;
    }

    // Replace asset paths with webview URIs
    html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, assetPath) => {
      if (assetPath.startsWith('http') || assetPath.startsWith('//')) {
        return match;
      }
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, assetPath));
      return `${attr}="${assetUri}"`;
    });

    // Add CSP
    const cspSource = webview.cspSource;
    html = html.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-{{nonce}}' ${cspSource}; script-src 'nonce-{{nonce}}' ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource}; connect-src ${cspSource};">`
    );

    // Replace nonce placeholder with validation
    const nonce = this._getNonce();
    const noncePlaceholderCount = (html.match(/{{nonce}}/g) || []).length;
    html = html.replace(/{{nonce}}/g, nonce);

    // Validate all placeholders were replaced
    const remainingPlaceholders = (html.match(/{{nonce}}/g) || []).length;
    if (remainingPlaceholders > 0) {
      console.error(
        `CSP nonce replacement incomplete: ${remainingPlaceholders} placeholders remain unreplaced`
      );
    }
    if (noncePlaceholderCount === 0) {
      console.warn(
        'CSP nonce replacement: No {{nonce}} placeholders found in HTML. Expected at least 2.'
      );
    }

    // Inject initial data
    const initScript = `
      <script nonce="${nonce}">
        window.initialData = ${JSON.stringify({
          collectionName: this._collectionName,
          connectionId: this._connectionId,
        })};
      </script>
    `;
    html = html.replace('</head>', `${initScript}</head>`);

    return html;
  }

  /**
   * Processes queued messages after client becomes available
   */
  private async _processMessageQueue(): Promise<void> {
    if (this._messageQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this._messageQueue.length} queued messages`);

    // Notify webview that connection is ready
    this.postMessage({
      command: 'connectionStatus',
      status: 'connected',
      message: 'Connected to Weaviate',
    });

    // Process all queued messages
    const queue = [...this._messageQueue];
    this._messageQueue = [];

    for (const message of queue) {
      try {
        await this._handleMessage(message);
      } catch (error) {
        console.error('Error processing queued message:', error);
        this.postMessage({
          command: 'error',
          error: error instanceof Error ? error.message : 'Failed to process queued message',
          requestId: message.requestId,
        });
      }
    }
  }

  /**
   * Generates a cryptographically secure nonce for CSP
   */
  private _getNonce(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
  }
}
