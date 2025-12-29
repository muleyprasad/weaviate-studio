import * as vscode from 'vscode';
import * as fs from 'fs';
import type { AliasItem } from '../types';

/**
 * Manages the Alias webview panel
 */
export class AliasPanel {
  public static currentPanel: AliasPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _connectionId: string;
  private readonly _collections: string[];
  private _mode: 'create' | 'edit' | 'list';
  private _aliasToEdit?: AliasItem;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    collections: string[],
    mode: 'create' | 'edit' | 'list',
    aliasToEdit: AliasItem | undefined,
    private readonly onCreateCallback: (aliasData: any) => Promise<void>,
    private readonly onUpdateCallback: (aliasData: any) => Promise<void>,
    private readonly onDeleteCallback: (alias: string) => Promise<void>,
    private readonly onMessageCallback?: (
      message: any,
      postMessage: (msg: any) => void
    ) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;
    this._collections = collections;
    this._mode = mode;
    this._aliasToEdit = aliasToEdit;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  /**
   * Creates or shows the Alias panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    collections: string[],
    mode: 'create' | 'edit' | 'list',
    aliasToEdit: AliasItem | undefined,
    onCreateCallback: (aliasData: any) => Promise<void>,
    onUpdateCallback: (aliasData: any) => Promise<void>,
    onDeleteCallback: (alias: string) => Promise<void>,
    onMessageCallback?: (message: any, postMessage: (msg: any) => void) => Promise<void>
  ): AliasPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, update it with new data
    if (AliasPanel.currentPanel) {
      AliasPanel.currentPanel._panel.reveal(column);
      AliasPanel.currentPanel._mode = mode;
      AliasPanel.currentPanel._aliasToEdit = aliasToEdit;
      // Send mode change to webview
      AliasPanel.currentPanel.postMessage({
        command: 'setMode',
        mode,
        aliasToEdit,
      });
      return AliasPanel.currentPanel;
    }

    // Otherwise, create a new panel.
    const title =
      mode === 'create' ? 'Create Alias' : mode === 'edit' ? 'Edit Alias' : 'Manage Aliases';
    const panel = vscode.window.createWebviewPanel(
      'weaviateAlias',
      title,
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,

        // Retain context when hidden
        retainContextWhenHidden: true,

        // And restrict the webview to only loading content from our extension's directories.
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist'),
        ],
      }
    );

    AliasPanel.currentPanel = new AliasPanel(
      panel,
      extensionUri,
      connectionId,
      collections,
      mode,
      aliasToEdit,
      onCreateCallback,
      onUpdateCallback,
      onDeleteCallback,
      onMessageCallback
    );

    return AliasPanel.currentPanel;
  }

  /**
   * Posts a message to the webview
   */
  public postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  /**
   * Disposes the panel
   */
  public dispose(): void {
    AliasPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Handles messages from the webview
   */
  private async _handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'ready':
        // Webview is ready to receive data; send initial data
        this.postMessage({
          command: 'initData',
          connectionId: this._connectionId,
          collections: this._collections,
          mode: this._mode,
          aliasToEdit: this._aliasToEdit,
        });
        break;
      case 'createAlias':
        try {
          await this.onCreateCallback(message.aliasData);
          this.postMessage({
            command: 'aliasCreated',
            alias: message.aliasData.alias,
          });
        } catch (error) {
          this.postMessage({
            command: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      case 'updateAlias':
        try {
          await this.onUpdateCallback(message.aliasData);
          this.postMessage({
            command: 'aliasUpdated',
            alias: message.aliasData.alias,
          });
        } catch (error) {
          this.postMessage({
            command: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      case 'deleteAlias':
        try {
          await this.onDeleteCallback(message.alias);
          this.postMessage({
            command: 'aliasDeleted',
            alias: message.alias,
          });
        } catch (error) {
          this.postMessage({
            command: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      case 'cancel':
        this.dispose();
        break;
      default:
        // Delegate to the optional message callback
        if (this.onMessageCallback) {
          await this.onMessageCallback(message, (msg) => this.postMessage(msg));
        }
        break;
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
   * Gets the HTML content for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the dist folder path
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');

    // Read the generated HTML file
    const htmlPath = vscode.Uri.joinPath(distPath, 'alias.html');
    let html = '';

    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read HTML file:', error);
      return `<!DOCTYPE html>
        <html>
        <body>
          <h1>Error loading Alias panel</h1>
          <p>The webview bundle has not been built. Please run: npm run build:webview</p>
        </body>
        </html>`;
    }

    // Replace asset paths to use webview URIs
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

    // Replace nonce placeholder
    const nonce = this._getNonce();
    html = html.replace(/{{nonce}}/g, nonce);

    return html;
  }

  /**
   * Generates a nonce for CSP
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
