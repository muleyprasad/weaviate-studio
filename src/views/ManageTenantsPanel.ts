import * as vscode from 'vscode';
import * as fs from 'fs';

/** A tenant entry shown in the panel. */
export interface TenantEntry {
  name: string;
  activityStatus: string;
  /** Object count from node status; `null` when unknown (tenant not loaded). */
  objectCount: number | null;
}

/** Init payload passed to the Manage Tenants webview. */
export interface ManageTenantsInitData {
  readOnly: boolean;
  serverVersion: string;
  offloadModuleAvailable: boolean;
  offloadSupported: boolean;
  offloadMinVersion: string;
  tenants: TenantEntry[];
}

/** Payload sent from the webview when applying a status change. */
export interface ApplyTenantStatusData {
  status: 'ACTIVE' | 'INACTIVE' | 'OFFLOADED';
  names: string[];
}

/**
 * Manages the "Manage Tenants" webview panel — bulk activation / deactivation /
 * offloading of tenants, selected either explicitly or by wildcard/regex pattern.
 *
 * One panel per (connection, collection); re-opening reveals the existing one.
 */
export class ManageTenantsPanel {
  private static readonly panels = new Map<string, ManageTenantsPanel>();
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _connectionId: string;
  private readonly _collectionName: string;
  private _init: ManageTenantsInitData;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    collectionName: string,
    init: ManageTenantsInitData,
    private readonly onApplyCallback: (data: ApplyTenantStatusData) => Promise<TenantEntry[]>,
    private readonly onDeleteCallback: (names: string[]) => Promise<TenantEntry[]>
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
    init: ManageTenantsInitData,
    onApplyCallback: (data: ApplyTenantStatusData) => Promise<TenantEntry[]>,
    onDeleteCallback: (names: string[]) => Promise<TenantEntry[]>
  ): ManageTenantsPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const key = ManageTenantsPanel._key(connectionId, collectionName);
    const existing = ManageTenantsPanel.panels.get(key);
    if (existing) {
      existing._init = init;
      existing._panel.reveal(column);
      existing.postMessage({ command: 'initData', ...existing._payload() });
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      'weaviateManageTenants',
      `Tenants: ${collectionName}`,
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

    const instance = new ManageTenantsPanel(
      panel,
      extensionUri,
      connectionId,
      collectionName,
      init,
      onApplyCallback,
      onDeleteCallback
    );
    ManageTenantsPanel.panels.set(key, instance);
    return instance;
  }

  public static closeFor(connectionId: string, collectionName: string): void {
    ManageTenantsPanel.panels.get(ManageTenantsPanel._key(connectionId, collectionName))?.dispose();
  }

  public postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  private _payload() {
    return {
      connectionId: this._connectionId,
      collectionName: this._collectionName,
      readOnly: this._init.readOnly,
      serverVersion: this._init.serverVersion,
      offloadModuleAvailable: this._init.offloadModuleAvailable,
      offloadSupported: this._init.offloadSupported,
      offloadMinVersion: this._init.offloadMinVersion,
      tenants: this._init.tenants,
    };
  }

  private async _handleMessage(message: any): Promise<void> {
    switch (message?.command) {
      case 'ready':
        this.postMessage({ command: 'initData', ...this._payload() });
        break;
      case 'apply':
        try {
          const names: string[] = Array.isArray(message.names) ? message.names : [];
          const status = message.status;
          if (status !== 'ACTIVE' && status !== 'INACTIVE' && status !== 'OFFLOADED') {
            throw new Error(`Unknown target status: ${status}`);
          }
          const tenants = await this.onApplyCallback({ status, names });
          // A null/undefined result means the operation was cancelled — keep state.
          if (tenants) {
            this._init = { ...this._init, tenants };
            this.postMessage({ command: 'tenantsUpdated', tenants });
          } else {
            this.postMessage({ command: 'tenantsUpdated', tenants: this._init.tenants });
          }
        } catch (error) {
          this.postMessage({
            command: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      case 'delete':
        try {
          const names: string[] = Array.isArray(message.names) ? message.names : [];
          const tenants = await this.onDeleteCallback(names);
          if (tenants) {
            this._init = { ...this._init, tenants };
            this.postMessage({ command: 'tenantsUpdated', tenants });
          } else {
            this.postMessage({ command: 'tenantsUpdated', tenants: this._init.tenants });
          }
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
    ManageTenantsPanel.panels.delete(
      ManageTenantsPanel._key(this._connectionId, this._collectionName)
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
    const htmlPath = vscode.Uri.joinPath(distPath, 'manageTenants.html');

    let html = '';
    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read HTML file:', error);
      return `<!DOCTYPE html><html><body>
        <h1>Error loading Manage Tenants panel</h1>
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
