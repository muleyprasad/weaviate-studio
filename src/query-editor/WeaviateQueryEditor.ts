import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import weaviate from 'weaviate-ts-client';

interface QueryEditorOptions {
    connectionId?: string;
    collectionName?: string;
}

interface QueryRunOptions {
    distanceMetric: string;
    limit: number;
    certainty: number;
}

export class WeaviateQueryEditor {
    public static readonly viewType = 'weaviate.queryEditor';
    private static currentPanel: WeaviateQueryEditor | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _options: QueryEditorOptions;
    private _weaviateClient: any | undefined;
    private _weaviateSchema: any | undefined;

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
        
        // Setup message handling
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'webviewReady':
                        // Initialize webview with schema data
                        await this._initializeWebview();
                        break;
                        
                    case 'runQuery':
                        // Execute query and return results
                        await this._executeQuery(message.query, message.options);
                        break;
                        
                    case 'explainPlan':
                        // Explain query plan
                        await this._explainQueryPlan(message.query);
                        break;
                }
            },
            null,
            this._disposables
        );
    }
    
    /**
     * Initialize webview with schema data
     */
    private async _initializeWebview() {
        try {
            // If we have a connection and client, fetch the schema
            if (this._options.connectionId && !this._weaviateSchema) {
                await this._connectToWeaviate();
                if (this._weaviateClient) {
                    const schema = await this._fetchWeaviateSchema();
                    this._weaviateSchema = schema;
                    
                    // Send schema to webview for autocompletion
                    this._panel.webview.postMessage({
                        command: 'setSchema',
                        schema: this._weaviateSchema
                    });
                }
            }
        } catch (error) {
            console.error('Error initializing webview:', error);
        }
    }
    
    /**
     * Connect to Weaviate instance
     */
    private async _connectToWeaviate() {
        try {
            // Get connection details from storage
            const connectionId = this._options.connectionId;
            if (!connectionId) {
                return;
            }
            
            // In a real implementation, you would fetch these from your connection storage
            // For now, just demonstrate the pattern
            const connections = await this._getStoredConnections();
            const connection = connections.find(conn => conn.id === connectionId);
            
            if (connection) {
                // Create Weaviate client
                this._weaviateClient = weaviate.client({
                    scheme: connection.scheme || 'https',
                    host: connection.host,
                    apiKey: connection.apiKey ? new weaviate.ApiKey(connection.apiKey) : undefined,
                });
            }
        } catch (error) {
            console.error('Error connecting to Weaviate:', error);
            this._weaviateClient = undefined;
        }
    }
    
    /**
     * Get stored connections from workspace state
     */
    private async _getStoredConnections(): Promise<any[]> {
        // In a real implementation, you would get these from persistent storage
        const connectionsJson = vscode.workspace.getConfiguration('weaviate').get('connections') as string;
        return connectionsJson ? JSON.parse(connectionsJson) : [];
    }
    
    /**
     * Fetch schema from Weaviate
     */
    private async _fetchWeaviateSchema() {
        try {
            if (!this._weaviateClient) {
                return null;
            }
            
            // Get schema from Weaviate
            const schema = await this._weaviateClient.schema.getter().do();
            
            // Format schema for autocompletion
            return {
                classes: schema.classes || [],
                types: [
                    { name: 'Get', kind: 'OBJECT' },
                    { name: 'Aggregate', kind: 'OBJECT' },
                    { name: 'Explore', kind: 'OBJECT' }
                ]
            };
        } catch (error) {
            console.error('Error fetching schema:', error);
            return null;
        }
    }
    
    /**
     * Execute GraphQL query against Weaviate
     */
    private async _executeQuery(query: string, options: QueryRunOptions) {
        try {
            if (!this._weaviateClient) {
                throw new Error('Not connected to Weaviate');
            }
            
            // Build the query
            const graphQLClient = this._weaviateClient.graphql;
            let graphQLQuery = graphQLClient.get();
            
            // Apply options
            if (options) {
                if (options.limit && options.limit > 0) {
                    graphQLQuery = graphQLQuery.withLimit(options.limit);
                }
                
                if (options.distanceMetric) {
                    // Convert string to enum
                    const metric = options.distanceMetric.toUpperCase();
                    if (['COSINE', 'DOT', 'L2', 'MANHATTAN', 'HAMMING'].includes(metric)) {
                        // In a real implementation, you'd apply this to nearVector/nearText queries
                    }
                }
            }
            
            // For demonstration, allow using the raw GraphQL
            const result = await this._weaviateClient.graphql.raw().withQuery(query).do();
            
            // Send results to webview
            this._panel.webview.postMessage({
                command: 'queryResults',
                results: result
            });
        } catch (error: any) {
            console.error('Error executing query:', error);
            this._panel.webview.postMessage({
                command: 'error',
                error: `Error executing query: ${error.message || 'Unknown error'}`
            });
        }
    }
    
    /**
     * Explain query plan for GraphQL query
     */
    private async _explainQueryPlan(query: string) {
        try {
            if (!this._weaviateClient) {
                throw new Error('Not connected to Weaviate');
            }
            
            // In a production implementation, you would call a Weaviate endpoint that explains the query plan
            // Since this is a prototype, we'll simulate it
            const explanation = {
                queryType: 'GraphQL',
                plan: {
                    operations: [
                        { type: 'Parse GraphQL', cost: 'low' },
                        { type: 'Validate Schema', cost: 'low' },
                        { type: 'Plan Execution', cost: 'medium' },
                        { type: 'Vector Search', cost: 'high', details: 'Using HNSW index' },
                        { type: 'Filter Results', cost: 'medium' },
                        { type: 'Format Response', cost: 'low' }
                    ],
                    estimatedTimeMs: 120,
                    estimatedObjectsScanned: 10000,
                    suggestions: [
                        'Consider adding a limit to reduce result size',
                        'Use a more specific class filter to improve performance',
                        'Add an index on frequently filtered properties'
                    ]
                },
                query: query
            };
            
            // Send explanation to webview
            this._panel.webview.postMessage({
                command: 'explainPlanResult',
                explanation: explanation
            });
        } catch (error: any) {
            console.error('Error explaining query plan:', error);
            this._panel.webview.postMessage({
                command: 'error',
                error: `Error explaining query plan: ${error.message || 'Unknown error'}`
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to scripts and styles
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'queryEditor.js')
        );
        const languageSupportUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'weaviate-language-support.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'queryEditor.css')
        );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );
        
        // Get Monaco Editor resources
        const monacoEditorUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'monaco-editor', 'min', 'vs')
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'">
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
            <!-- Monaco Editor -->
            <script src="${monacoEditorUri}/loader.js"></script>
            <script>
                // Configure Monaco loader
                require.config({ paths: { 'vs': '${monacoEditorUri.toString()}' } });
                window.MonacoEnvironment = {
                    getWorkerUrl: function (moduleId, label) {
                        return './monaco-editor-worker.js';
                    }
                };
            </script>
        </head>
        <body>
            <div class="toolbar">
                <div class="toolbar-group">
                    <button id="run-query" class="button primary">
                        <span class="codicon codicon-play"></span> Run Query
                    </button>
                    
                    <select id="distance-metric" class="dropdown">
                        <option value="cosine">Cosine</option>
                        <option value="l2">L2</option>
                        <option value="dot">Dot</option>
                    </select>

                    <div class="input-group">
                        <label for="limit">Limit</label>
                        <input id="limit" type="number" value="10" min="1" max="100">
                    </div>

                    <div class="input-group">
                        <label for="certainty">Certainty</label>
                        <input id="certainty" type="number" value="0.8" step="0.1" min="0" max="1">
                    </div>
                </div>

                <div class="toolbar-group">
                    <button id="explain-plan" class="button secondary" title="Explain Query Plan">
                        <span class="codicon codicon-graph"></span> Explain Plan
                    </button>
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

            <!-- Load scripts -->
            <script type="module" src="${languageSupportUri}"></script>
            <script type="module" src="${scriptUri}"></script>
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
