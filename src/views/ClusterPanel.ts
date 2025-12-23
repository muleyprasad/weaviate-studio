import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Manages the Cluster Panel webview
 */
export class ClusterPanel {
  public static currentPanel: ClusterPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _connectionId: string;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    private readonly onMessageCallback?: (
      message: any,
      postMessage: (msg: any) => void
    ) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;

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
   * Creates or shows the Cluster panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    nodeStatusData: any,
    connectionName: string,
    onMessageCallback?: (message: any, postMessage: (msg: any) => void) => Promise<void>,
    openClusterViewOnConnect?: boolean
  ): ClusterPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it and update data.
    if (ClusterPanel.currentPanel) {
      ClusterPanel.currentPanel._panel.reveal(column);
      // Send update command to the webview with new data
      ClusterPanel.currentPanel.postMessage({
        command: 'updateData',
        nodeStatusData,
        openClusterViewOnConnect,
      });
      return ClusterPanel.currentPanel;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'weaviateCluster',
      `Cluster Info: ${connectionName}`,
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's directory.
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'out'),
        ],

        // Retain content when hidden
        retainContextWhenHidden: true,
      }
    );

    ClusterPanel.currentPanel = new ClusterPanel(
      panel,
      extensionUri,
      connectionId,
      onMessageCallback
    );

    // Send initial data
    ClusterPanel.currentPanel.postMessage({
      command: 'init',
      nodeStatusData,
      openClusterViewOnConnect,
    });

    return ClusterPanel.currentPanel;
  }

  /**
   * Sends a message to the webview
   */
  public postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  /**
   * Disposes the panel
   */
  public dispose(): void {
    ClusterPanel.currentPanel = undefined;

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Handles messages from the webview
   */
  private async _handleMessage(message: any): Promise<void> {
    if (this.onMessageCallback) {
      await this.onMessageCallback(message, this.postMessage.bind(this));
    }

    switch (message.command) {
      case 'error':
        vscode.window.showErrorMessage(message.text);
        break;
      case 'info':
        vscode.window.showInformationMessage(message.text);
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
   * Generates the HTML content for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Path to dist/webview folder
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');

    // Try to read the built HTML file
    const htmlPath = path.join(distPath.fsPath, 'cluster.html');

    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      // If the file doesn't exist, show an error message
      return `<!DOCTYPE html>
        <html>
        <body>
          <h1>Error loading Cluster panel</h1>
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
