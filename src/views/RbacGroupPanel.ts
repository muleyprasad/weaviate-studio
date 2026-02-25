import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * Manages the RBAC Group webview panel (Add / Edit)
 * Groups are OIDC-managed externally; this panel assigns/revokes roles for a group.
 */
export class RbacGroupPanel {
  private static readonly panels = new Map<string, RbacGroupPanel>();
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _connectionId: string;
  private readonly _mode: 'add' | 'edit';
  private readonly _existingGroup: string | undefined;
  private _availableRoles: string[];
  private readonly _assignedRoles: string[];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    connectionId: string,
    mode: 'add' | 'edit',
    existingGroup: string | undefined,
    availableRoles: string[],
    assignedRoles: string[],
    private readonly onSaveCallback: (groupData: any) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._connectionId = connectionId;
    this._mode = mode;
    this._existingGroup = existingGroup;
    this._availableRoles = availableRoles;
    this._assignedRoles = assignedRoles;

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
    groupId?: string
  ): string {
    return mode === 'add' ? `${connectionId}:add-group` : `${connectionId}:edit-group:${groupId}`;
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    connectionId: string,
    mode: 'add' | 'edit',
    existingGroup: string | undefined,
    availableRoles: string[],
    assignedRoles: string[],
    onSaveCallback: (groupData: any) => Promise<void>
  ): RbacGroupPanel {
    const column = vscode.window.activeTextEditor?.viewColumn;
    const panelKey = RbacGroupPanel._getPanelKey(connectionId, mode, existingGroup);

    const existingPanel = RbacGroupPanel.panels.get(panelKey);
    if (existingPanel) {
      existingPanel._panel.reveal(column);
      return existingPanel;
    }

    const title = mode === 'add' ? 'Add Group' : `Edit Group: ${existingGroup ?? ''}`;
    const panel = vscode.window.createWebviewPanel(
      'weaviateRbacGroup',
      title,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
      }
    );

    const rbacGroupPanel = new RbacGroupPanel(
      panel,
      extensionUri,
      connectionId,
      mode,
      existingGroup,
      availableRoles,
      assignedRoles,
      onSaveCallback
    );
    RbacGroupPanel.panels.set(panelKey, rbacGroupPanel);
    return rbacGroupPanel;
  }

  public postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  public updateAvailableRoles(roles: string[]): void {
    this._availableRoles = roles;
    this.postMessage({ command: 'rolesUpdated', availableRoles: roles });
  }

  public static notifyRolesChanged(connectionId: string, roles: string[]): void {
    for (const panel of RbacGroupPanel.panels.values()) {
      if (panel._connectionId === connectionId) {
        panel.updateAvailableRoles(roles);
      }
    }
  }

  public dispose(): void {
    for (const [key, panel] of RbacGroupPanel.panels.entries()) {
      if (panel === this) {
        RbacGroupPanel.panels.delete(key);
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
          existingGroup: this._existingGroup,
          availableRoles: this._availableRoles,
          assignedRoles: this._assignedRoles,
        });
        break;
      case 'saveGroup':
        try {
          await this.onSaveCallback(message.groupData);
          this.postMessage({ command: 'groupSaved' });
        } catch (error) {
          console.error('[RBAC] Failed to save group:', error);
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
    const htmlPath = vscode.Uri.joinPath(distPath, 'rbac-group.html');
    let html = '';

    try {
      html = fs.readFileSync(htmlPath.fsPath, 'utf8');
    } catch (error) {
      console.error('Failed to read HTML file:', error);
      return `<!DOCTYPE html>
        <html>
        <body>
          <h1>Error loading Group panel</h1>
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
