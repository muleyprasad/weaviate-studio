import * as vscode from 'vscode';
import * as path from 'path';

interface QueryEditorOptions {
    connectionId?: string;
    collectionName?: string;
}

export class WeaviateQueryEditor {
    public static readonly viewType = 'weaviate.queryEditor';
    private static currentPanel: WeaviateQueryEditor | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _options: QueryEditorOptions;

    public static createOrShow(extensionUri: vscode.Uri, options: QueryEditorOptions = {}) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (WeaviateQueryEditor.currentPanel) {
            WeaviateQueryEditor.currentPanel._panel.reveal(column);
            return;
        }

        const title = `Weaviate Query Editor${options.collectionName ? ` - ${options.collectionName}` : ''}`;
        const panel = vscode.window.createWebviewPanel(
            WeaviateQueryEditor.viewType,
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out/compiled')
                ]
            }
        );

        WeaviateQueryEditor.currentPanel = new WeaviateQueryEditor(panel, extensionUri, options);
    }

    private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri, options: QueryEditorOptions) {
        this._options = options;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._update();
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to the script and styles
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'queryEditor.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'queryEditor.css')
        );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${this._panel.title}</title>
            <link href="${styleUri}" rel="stylesheet" />
            <link href="${codiconsUri}" rel="stylesheet" />
            <style>
                :root {
                    --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', 'Ubuntu', 'Droid Sans', sans-serif;
                    --vscode-editor-background: #1e1e1e;
                    --vscode-editor-foreground: #d4d4d4;
                    --vscode-editor-selectionBackground: #264f78;
                    --vscode-button-background: #0e639c;
                    --vscode-button-foreground: #ffffff;
                    --vscode-button-hoverBackground: #1177bb;
                    --vscode-input-background: #3c3c3c;
                    --vscode-input-foreground: #cccccc;
                    --vscode-panel-background: #1e1e1e;
                    --vscode-panel-border: #454545;
                }

                body {
                    margin: 0;
                    padding: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .toolbar {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .toolbar-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .editor-container {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }


                .editor-pane, .results-pane {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .editor-pane {
                    border-right: 1px solid var(--vscode-panel-border);
                }

                .pane-header {
                    padding: 8px 12px;
                    font-weight: 600;
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .monaco-editor-container, .results-content {
                    flex: 1;
                    overflow: auto;
                    padding: 12px;
                }

                .tab-bar {
                    display: flex;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    user-select: none;
                }

                .tab.active {
                    border-bottom-color: var(--vscode-button-background);
                }

                .tab-content {
                    display: none;
                    height: 100%;
                }

                .tab-content.active {
                    display: block;
                }

                /* Add more styles as needed */
            </style>
        </head>
        <body>
            <div class="toolbar">
                <div class="toolbar-group">
                    <vscode-button id="run-query" appearance="primary">
                        <span class="codicon codicon-play"></span> Run Query
                    </vscode-button>
                    
                    <vscode-dropdown id="distance-metric">
                        <vscode-option value="cosine">Cosine</vscode-option>
                        <vscode-option value="l2">L2</vscode-option>
                        <vscode-option value="dot">Dot</vscode-option>
                    </vscode-dropdown>

                    <vscode-text-field id="limit" type="number" value="10" style="width: 80px;">
                        <span slot="start">Limit</span>
                    </vscode-text-field>

                    <vscode-text-field id="certainty" type="number" value="0.8" step="0.1" min="0" max="1" style="width: 100px;">
                        <span slot="start">Certainty</span>
                    </vscode-text-field>
                </div>

                <div class="toolbar-group">
                    <vscode-button id="explain-plan" appearance="secondary" title="Explain Query Plan">
                        <span class="codicon codicon-graph"></span> Explain Plan
                    </vscode-button>
                </div>
            </div>

            <div class="editor-container">
                <div class="editor-pane">
                    <div class="pane-header">Query</div>
                    <div id="editor" class="monaco-editor-container"></div>
                </div>
                
                <div class="results-pane">
                    <div class="tab-bar">
                        <div class="tab active" data-tab="table">Table</div>
                        <div class="tab" data-tab="json">JSON</div>
                        <div class="tab" data-tab="vector">3D Vector</div>
                    </div>
                    
                    <div class="results-content">
                        <div id="table-tab" class="tab-content active">
                            <!-- Table results will be rendered here -->
                        </div>
                        <div id="json-tab" class="tab-content">
                            <!-- JSON results will be rendered here -->
                        </div>
                        <div id="vector-tab" class="tab-content">
                            <!-- 3D Vector visualization will be rendered here -->
                            <div style="padding: 20px; text-align: center;">
                                <p>3D Vector Visualization</p>
                                <p><small>Vector visualization will be implemented here</small></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public dispose() {
        WeaviateQueryEditor.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
