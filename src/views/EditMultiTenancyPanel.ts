import * as vscode from 'vscode';
import * as fs from 'fs';

/** Data the webview form sends back on save. */
export interface MultiTenancyUpdateData {
  autoTenantCreation: boolean;
  autoTenantActivation: boolean;
}

/** Current multi-tenancy config passed to the form on open. */
export interface MultiTenancyInitData {
  enabled: boolean;
  autoTenantCreation: boolean;
  autoTenantActivation: boolean;
  readOnly: boolean;
}

/**
 * Manages the "Edit Multi-Tenancy" webview panel — a small form to toggle
 * autoTenantCreation / autoTenantActivation on a single collection.
 *
 * One panel per (connection, collection); re-opening reveals the existing one.
 */
export class EditMultiTenancyPanel {
  private static readonly panels = new Map<string, EditMultiTenancyPanel>();
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _connectionId: string;
  private readonly _collectionName: string;
  private _init: MultiTenancyInitData;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    collectionName: string,
    init: MultiTenancyInitData,
    private readonly onSaveCallback: (data: MultiTenancyUpdateData) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;
    this._collectionName = collectionName;
    this._init = init;

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  private static _key(connectionId: string, collectionName: string): string {
    return `${connectionId}:${collectionName}`;
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    collectionName: string,
    init: MultiTenancyInitData,
    onSaveCallback: (data: MultiTenancyUpdateData) => Promise<void>
  ): EditMultiTenancyPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const key = EditMultiTenancyPanel._key(connectionId, collectionName);
    const existing = EditMultiTenancyPanel.panels.get(key);
    if (existing) {
      existing._init = init;
      existing._panel.reveal(column);
      existing.postMessage({ command: 'initData', ...existing._payload() });
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      'weaviateEditMultiTenancy',
      `Multi-Tenancy: ${collectionName}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist'),
        ],
      }
    );

    const instance = new EditMultiTenancyPanel(
      panel,
      extensionUri,
      connectionId,
      collectionName,
      init,
      onSaveCallback
    );
    EditMultiTenancyPanel.panels.set(key, instance);
    return instance;
  }

  public static closeFor(connectionId: string, collectionName: string): void {
    EditMultiTenancyPanel.panels
      .get(EditMultiTenancyPanel._key(connectionId, collectionName))
      ?.dispose();
  }

  public postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  private _payload() {
    return {
      connectionId: this._connectionId,
      collectionName: this._collectionName,
      enabled: this._init.enabled,
      autoTenantCreation: this._init.autoTenantCreation,
      autoTenantActivation: this._init.autoTenantActivation,
      readOnly: this._init.readOnly,
    };
  }

  private async _handleMessage(message: any): Promise<void> {
    switch (message?.command) {
      case 'ready':
        this.postMessage({ command: 'initData', ...this._payload() });
        break;
      case 'save':
        try {
          await this.onSaveCallback({
            autoTenantCreation: !!message.autoTenantCreation,
            autoTenantActivation: !!message.autoTenantActivation,
          });
          this._init = {
            ...this._init,
            autoTenantCreation: !!message.autoTenantCreation,
            autoTenantActivation: !!message.autoTenantActivation,
          };
          this.postMessage({ command: 'saved' });
          this.dispose();
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
        break;
    }
  }

  public dispose(): void {
    EditMultiTenancyPanel.panels.delete(
      EditMultiTenancyPanel._key(this._connectionId, this._collectionName)
    );
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
    const htmlPath = vscode.Uri.joinPath(distPath, 'editMultiTenancy.html');

    let html = '';
    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read HTML file:', error);
      return `<!DOCTYPE html><html><body>
        <h1>Error loading Edit Multi-Tenancy panel</h1>
        <p>The webview bundle has not been built. Please run: npm run build:webview</p>
        </body></html>`;
    }

    html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, assetPath) => {
      if (assetPath.startsWith('http') || assetPath.startsWith('//')) {
        return match;
      }
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, assetPath));
      return `${attr}="${assetUri}"`;
    });

    const cspSource = webview.cspSource;
    html = html.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-{{nonce}}' ${cspSource}; script-src 'nonce-{{nonce}}' ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource}; connect-src ${cspSource};">`
    );

    const nonce = this._getNonce();
    html = html.replace(/{{nonce}}/g, nonce);

    return html;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
