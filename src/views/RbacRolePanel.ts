import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * Manages the RBAC Role webview panel (Add / Edit)
 */
export class RbacRolePanel {
  private static readonly panels = new Map<string, RbacRolePanel>();
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _connectionId: string;
  private readonly _mode: 'add' | 'edit';
  private readonly _existingRole: any | undefined;
  private readonly _groupAssignments: any[];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    mode: 'add' | 'edit',
    existingRole: any | undefined,
    groupAssignments: any[],
    private readonly onSaveCallback: (roleData: any) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;
    this._mode = mode;
    this._existingRole = existingRole;
    this._groupAssignments = groupAssignments;

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message) => await this._handleMessage(message),
      null,
      this._disposables
    );
  }

  private static _getPanelKey(
    connectionId: string,
    mode: 'add' | 'edit',
    roleName?: string
  ): string {
    return mode === 'add' ? `${connectionId}:add-role` : `${connectionId}:edit-role:${roleName}`;
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    mode: 'add' | 'edit',
    existingRole: any | undefined,
    groupAssignments: any[],
    onSaveCallback: (roleData: any) => Promise<void>
  ): RbacRolePanel {
    const column = vscode.window.activeTextEditor?.viewColumn;
    const panelKey = RbacRolePanel._getPanelKey(connectionId, mode, existingRole?.name);

    const existingPanel = RbacRolePanel.panels.get(panelKey);
    if (existingPanel) {
      existingPanel._panel.reveal(column);
      return existingPanel;
    }

    const title = mode === 'add' ? 'Add Role' : `Edit Role: ${existingRole?.name ?? ''}`;
    const panel = vscode.window.createWebviewPanel(
      'weaviateRbacRole',
      title,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
      }
    );

    const rbacRolePanel = new RbacRolePanel(
      panel,
      extensionUri,
      connectionId,
      mode,
      existingRole,
      groupAssignments,
      onSaveCallback
    );
    RbacRolePanel.panels.set(panelKey, rbacRolePanel);
    return rbacRolePanel;
  }

  public postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  public dispose(): void {
    for (const [key, panel] of RbacRolePanel.panels.entries()) {
      if (panel === this) {
        RbacRolePanel.panels.delete(key);
        break;
      }
    }
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'ready':
        this.postMessage({
          command: 'initData',
          connectionId: this._connectionId,
          mode: this._mode,
          existingRole: this._existingRole,
          groupAssignments: this._groupAssignments,
        });
        break;
      case 'saveRole':
        try {
          await this.onSaveCallback(message.roleData);
          this.postMessage({ command: 'roleSaved' });
        } catch (error) {
          console.error('[RBAC] Failed to save role:', error);
          this.postMessage({
            command: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      case 'cancel':
        this.dispose();
        break;
    }
  }

  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
    const htmlPath = vscode.Uri.joinPath(distPath, 'rbac-role.html');
    let html = '';

    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read HTML file:', error);
      return `<!DOCTYPE html>
        <html>
        <body>
          <h1>Error loading Role panel</h1>
          <p>The webview bundle has not been built. Please run: npm run build:webview</p>
        </body>
        </html>`;
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
