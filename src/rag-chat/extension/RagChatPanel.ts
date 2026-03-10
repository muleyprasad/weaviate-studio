/**
 * RagChatPanel - Main webview panel controller for RAG Chat
 * Manages the VS Code webview panel lifecycle and message passing
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import type { WeaviateClient } from 'weaviate-client';
import { RagChatAPI } from './RagChatAPI';
import type { RagChatExtensionMessage, RagChatWebviewMessage } from '../types';
import type { FilterCondition, FilterMatchMode } from '../../data-explorer/types';
import {
  clampLimit,
  RequestTracker,
  mergeSettledResults,
  validateRagQueryInput,
  safeJsonStringify,
} from './utils';

/**
 * Manages the RAG Chat webview panel
 */
export class RagChatPanel {
  private static panels: Map<string, RagChatPanel> = new Map();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _connectionId: string;
  private _initialCollectionName: string | undefined;
  private _inheritedFilters: FilterCondition[] | undefined;
  private _inheritedFilterMatchMode: FilterMatchMode | undefined;
  private _api: RagChatAPI | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _requestTracker = new RequestTracker();

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    private readonly _connectionName: string,
    private readonly getClient: () => WeaviateClient | undefined,
    initialCollectionName?: string,
    inheritedFilters?: FilterCondition[],
    inheritedFilterMatchMode?: FilterMatchMode
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;
    this._initialCollectionName = initialCollectionName;
    // Bug 1 fix: assign before _update() so window.initialData is correct on first render
    this._inheritedFilters = inheritedFilters;
    this._inheritedFilterMatchMode = inheritedFilterMatchMode;

    // Initialize API with client
    const client = this.getClient();
    if (client) {
      this._api = new RagChatAPI(client);
    }

    // Set the webview's initial HTML content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message: RagChatWebviewMessage) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // Update API when panel becomes active
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          const client = this.getClient();
          if (client && !this._api) {
            this._api = new RagChatAPI(client);
          }
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Creates or shows the RAG Chat panel for a connection.
   * If forceNew is true, disposes any existing panel and creates a new one.
   * If an initialCollectionName is provided it is pre-selected in the UI.
   * When the panel already exists (and forceNew is false), the new collection
   * is added to the selection via the 'addCollection' message so it appears as a pill.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    connectionName: string,
    getClient: () => WeaviateClient | undefined,
    initialCollectionName?: string,
    forceNew: boolean = false,
    inheritedFilters?: FilterCondition[],
    inheritedFilterMatchMode?: FilterMatchMode
  ): RagChatPanel {
    const panelKey = connectionId;
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    // Check if panel already exists for this connection
    const existingPanel = RagChatPanel.panels.get(panelKey);
    if (existingPanel && !forceNew) {
      existingPanel._panel.reveal(column);
      // Update inherited filters so queries use the latest filter context
      existingPanel._inheritedFilters = inheritedFilters;
      existingPanel._inheritedFilterMatchMode = inheritedFilterMatchMode;
      // If opened from a specific collection, tell the webview to add it
      if (initialCollectionName) {
        existingPanel.postMessage({
          command: 'addCollection',
          collectionNames: [initialCollectionName],
        });
      }
      return existingPanel;
    }

    // Dispose existing panel if forceNew is requested
    if (existingPanel) {
      existingPanel.dispose();
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel('weaviateRagChat', 'Generative Search', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'dist'),
        vscode.Uri.joinPath(extensionUri, 'out'),
      ],
    });
    const iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'comment-discussion.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'comment-discussion-dark.svg'),
    };
    panel.iconPath = iconPath;

    const ragChatPanel = new RagChatPanel(
      panel,
      extensionUri,
      connectionId,
      connectionName,
      getClient,
      initialCollectionName,
      inheritedFilters,
      inheritedFilterMatchMode
    );

    RagChatPanel.panels.set(panelKey, ragChatPanel);

    return ragChatPanel;
  }

  /**
   * Sends a message to the webview
   * @param message The message to send
   */
  public postMessage(message: RagChatExtensionMessage): void {
    this._panel.webview.postMessage(message);
  }

  /**
   * Disposes the panel, cleaning up all resources
   */
  public dispose(): void {
    const panelKey = this._connectionId;
    RagChatPanel.panels.delete(panelKey);

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
   * @returns The unique connection identifier
   */
  public getConnectionId(): string {
    return this._connectionId;
  }

  /**
   * Closes all panels for a specific connection
   * @param connectionId The connection identifier to close panels for
   */
  public static closeForConnection(connectionId: string): void {
    const panel = RagChatPanel.panels.get(connectionId);
    if (panel) {
      panel.dispose();
    }
  }

  /**
   * Handles messages from the webview
   */
  private async _handleMessage(message: RagChatWebviewMessage): Promise<void> {
    // Ensure API is available
    if (!this._api) {
      const client = this.getClient();
      if (client) {
        this._api = new RagChatAPI(client);
      } else {
        this.postMessage({
          command: 'ragError',
          error: 'Not connected to Weaviate. Please check your connection.',
          requestId: message.requestId,
        });
        return;
      }
    }

    try {
      switch (message.command) {
        case 'initialize':
          await this._handleInitialize();
          break;

        case 'getCollections':
          await this._handleGetCollections(message.requestId);
          break;

        case 'executeRagQuery':
          await this._handleExecuteRagQuery(message);
          break;

        case 'openInDataExplorer':
          // Open Data Explorer for the collection that produced the context object
          // Pass targetUuid so the Data Explorer deep-links to the specific object
          if (message.collectionName) {
            await vscode.commands.executeCommand('weaviate.openDataExplorer', {
              connectionId: this._connectionId,
              collectionName: message.collectionName,
              targetUuid: message.uuid,
            });
          }
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('RagChatPanel error:', error);
      this.postMessage({
        command: 'ragError',
        error: errorMessage,
        requestId: message.requestId,
      });
    }
  }

  /**
   * Handles initialization - sends collections list to webview
   */
  private async _handleInitialize(): Promise<void> {
    try {
      const collections = await this._api!.getCollections();
      this.postMessage({
        command: 'init',
        collectionNames: collections,
      });
    } catch (error) {
      console.error('RagChatPanel: Failed to load collections:', error);
      this.postMessage({
        command: 'init',
        collectionNames: [],
        error: error instanceof Error ? error.message : 'Failed to load collections.',
      });
    }
  }

  /**
   * Handles getCollections request
   */
  private async _handleGetCollections(requestId?: string): Promise<void> {
    const collections = await this._api!.getCollections();
    this.postMessage({
      command: 'collectionsLoaded',
      collectionNames: collections,
      requestId,
    });
  }

  /**
   * Handles executeRagQuery request — supports multiple collections.
   * Runs RAG queries in parallel via Promise.allSettled and merges
   * the results with source attribution. Tracks the current requestId
   * so stale responses from cancelled/cleared queries are ignored.
   */
  private async _handleExecuteRagQuery(message: RagChatWebviewMessage): Promise<void> {
    const collectionNames = message.collectionNames ?? [];
    const validationError = validateRagQueryInput(collectionNames, message.question);
    if (validationError === 'no_collections') {
      this.postMessage({
        command: 'ragError',
        error: 'No collection selected.',
        requestId: message.requestId,
      });
      return;
    }
    if (validationError === 'empty_question') {
      this.postMessage({
        command: 'ragError',
        error: 'Question cannot be empty.',
        requestId: message.requestId,
      });
      return;
    }

    // Clamp limit to [1, 100]
    const limit = clampLimit(message.limit);

    // Track active requests to ignore stale responses
    this._requestTracker.track(message.requestId);

    const startTime = Date.now();

    try {
      // Parallel retrieval using Promise.allSettled — each collection query
      // is independent, so we can execute them concurrently for better latency.
      const settled = await Promise.allSettled(
        collectionNames.map(async (name) => {
          const result = await this._api!.executeRagQuery({
            collectionName: name,
            question: message.question!,
            limit,
            timeout: message.timeout,
            where: this._inheritedFilters,
            matchMode: this._inheritedFilterMatchMode,
          });
          return { collectionName: name, ...result };
        })
      );

      // Check if this request is still active
      if (this._requestTracker.isStale(message.requestId)) {
        return;
      }

      const durationMs = Date.now() - startTime;

      // Merge results — extracts answers, stamps collectionName on context objects
      const { answer, contextObjects, allFailed } = mergeSettledResults(settled, collectionNames);

      this.postMessage({
        command: 'ragResponse',
        answer,
        contextObjects,
        question: message.question,
        requestId: message.requestId,
        durationMs,
        hasError: allFailed,
      });

      this._requestTracker.complete(message.requestId);
    } catch (error) {
      // Only send error if this request is still active
      if (!this._requestTracker.isStale(message.requestId)) {
        const errorMessage = error instanceof Error ? error.message : 'RAG query failed.';
        this.postMessage({
          command: 'ragError',
          error: errorMessage,
          requestId: message.requestId,
        });
        this._requestTracker.complete(message.requestId);
      }
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
    const htmlPath = path.join(distPath.fsPath, 'rag-chat.html');

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
          <title>Generative Search</title>
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
            <h1>Generative Search Not Built</h1>
            <p>The Generative Search webview bundle has not been built yet.</p>
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
      throw new Error(
        `CSP nonce replacement incomplete: ${remainingPlaceholders} placeholders remain unreplaced.`
      );
    }
    if (noncePlaceholderCount === 0) {
      throw new Error(
        'CSP nonce replacement: No {{nonce}} placeholders found in HTML. Expected at least 2.'
      );
    }

    // Inject initial data — include initialCollectionName so the
    // webview can pre-select the collection the user right-clicked on.
    // Also inject inherited filters from Data Explorer if present.
    // Bug 2 fix: escape <, >, & so a malicious connection name can't break out of the <script> tag.
    const initScript = `
      <script nonce="${nonce}">
        window.initialData = ${safeJsonStringify({
          connectionId: this._connectionId,
          connectionName: this._connectionName,
          initialCollectionName: this._initialCollectionName ?? null,
          inheritedFilters: this._inheritedFilters ?? null,
          inheritedFilterMatchMode: this._inheritedFilterMatchMode ?? null,
        })};
      </script>
    `;
    html = html.replace('</head>', `${initScript}</head>`);

    return html;
  }

  /**
   * Generates a cryptographically secure nonce for CSP
   */
  private _getNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }
}
