import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Manages the Add Collection webview panel
 */
export class AddCollectionPanel {
  public static currentPanel: AddCollectionPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _initialSchema: any | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly onCreateCallback: (schema: any) => Promise<void>,
    private readonly onMessageCallback?: (
      message: any,
      postMessage: (msg: any) => void
    ) => Promise<void>,
    initialSchema?: any
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._initialSchema = initialSchema;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
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
   * Creates or shows the Add Collection panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    onCreateCallback: (schema: any) => Promise<void>,
    onMessageCallback?: (message: any, postMessage: (msg: any) => void) => Promise<void>,
    initialSchema?: any
  ): AddCollectionPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (AddCollectionPanel.currentPanel) {
      AddCollectionPanel.currentPanel._panel.reveal(column);
      if (initialSchema) {
        AddCollectionPanel.currentPanel.postMessage({
          command: 'initialSchema',
          schema: initialSchema,
        });
      }
      return AddCollectionPanel.currentPanel;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'weaviateAddCollection',
      'Add Collection',
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        // And restrict the webview to only loading content from our extension's dist directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview-add-collection')],
      }
    );

    AddCollectionPanel.currentPanel = new AddCollectionPanel(
      panel,
      extensionUri,
      onCreateCallback,
      onMessageCallback,
      initialSchema
    );

    // Note: initial schema will also be sent when the webview signals it's ready

    return AddCollectionPanel.currentPanel;
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
    AddCollectionPanel.currentPanel = undefined;

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
        // Webview is ready to receive data; send initial schema if provided
        if (this._initialSchema) {
          this.postMessage({
            command: 'initialSchema',
            schema: this._initialSchema,
          });
        }
        break;
      case 'create':
        try {
          await this.onCreateCallback(message.schema);
          this.dispose();
          vscode.window.showInformationMessage(
            `Collection "${message.schema.class}" created successfully`
          );
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
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-add-collection');

    // Read the generated HTML file
    const htmlPath = vscode.Uri.joinPath(distPath, 'index.html');
    let html = '';

    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read HTML file:', error);
      return `<!DOCTYPE html>
        <html>
        <body>
          <h1>Error loading Add Collection panel</h1>
          <p>The webview bundle has not been built. Please run: npm run build:add-collection</p>
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-{{nonce}}' ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource}; connect-src ${cspSource};">`
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
