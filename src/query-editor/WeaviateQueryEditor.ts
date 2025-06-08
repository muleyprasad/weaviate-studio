import * as vscode from 'vscode';
import * as fs from 'fs';
import { URL } from 'url';
import * as path from 'path';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';

// Helper function to generate a nonce
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

interface QueryEditorOptions {
    connectionId?: string;
    collectionName?: string;
    client?: WeaviateClient;
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
    private _weaviateClient: WeaviateClient | undefined;
    private _weaviateSchema: any | undefined;

    public static createOrShow(extensionUri: vscode.Uri, options: QueryEditorOptions = {}) {
        const column = vscode.window.activeTextEditor?.viewColumn;

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
                    vscode.Uri.joinPath(extensionUri, 'dist')
                ]
            }
        );

        WeaviateQueryEditor.currentPanel = new WeaviateQueryEditor(panel, extensionUri, options);
    }

    private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri, options: QueryEditorOptions) {
        this._options = options;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._initializeWebview();
    }

    private async _initializeWebview() {
        this._panel.webview.html = await this._getHtmlForWebview(this._panel.webview);
        this._setupMessageHandlers();
    }

    private _setupMessageHandlers() {
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready':
                    if (this._options.collectionName) {
                        await this._sendInitialData();
                    }
                    break;
                
                case 'runQuery':
                    await this._executeQuery(message.query, message.options);
                    break;
                
                case 'explainPlan':
                    await this._explainQueryPlan(message.query);
                    break;
            }
        });
    }

    private async _connectToWeaviate(): Promise<boolean> {
        try {
            const ConnectionManager = require('../services/ConnectionManager').ConnectionManager;
            const connectionManager = ConnectionManager.getInstance(this.extensionUri);

            if (this._options.connectionId) {
                this._weaviateClient = connectionManager.getClient(this._options.connectionId);
                if (!this._weaviateClient) {
                    await connectionManager.connect(this._options.connectionId);
                    this._weaviateClient = connectionManager.getClient(this._options.connectionId);
                }
            }

            if (!this._weaviateClient) {
                const connections = connectionManager.getConnections();
                const activeConnection = connections.find((c: { status: string; id: string }) => c.status === 'connected');
                if (activeConnection) {
                    this._weaviateClient = connectionManager.getClient(activeConnection.id);
                    this._options.connectionId = activeConnection.id;
                }
            }

            return !!this._weaviateClient;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
            return false;
        }
    }

    private async _executeQuery(query: string, options: QueryRunOptions) {
        if (!this._weaviateClient) {
            vscode.window.showErrorMessage('Not connected to Weaviate');
            return;
        }

        try {
            // Handle different Weaviate client API versions using type-safe approach
            let result;
            const client = this._weaviateClient as any; // Use any to bypass type checking for compatibility
            
            try {
                if (client.graphql && typeof client.graphql.raw === 'function') {
                    // Try newer API style first (most common)
                    result = await client.graphql.raw({ query });
                } else if (client.graphql && client.graphql.get) {
                    // Try another common API pattern
                    const graphqlQuery = client.graphql.get();
                    result = await graphqlQuery.do();
                } else if (client.query && typeof client.query.raw === 'function') {
                    // Last resort - query interface
                    result = await client.query.raw(query);
                } else {
                    // If no known method works, throw an informative error
                    throw new Error('Could not find compatible GraphQL query method on Weaviate client');
                }
            } catch (apiError: any) {
                console.error('API call failed:', apiError);
                throw new Error(`GraphQL query failed: ${apiError.message}`);
            }
            
            this._panel.webview.postMessage({
                type: 'queryResult',
                data: result,
                collection: this._options.collectionName
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'queryError',
                error: error.message
            });
        }
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const webviewHtmlPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.html');
        let htmlContent = await fs.promises.readFile(webviewHtmlPath.fsPath, 'utf-8');

        const nonce = getNonce(); 

        htmlContent = htmlContent.replace(/{{nonce}}/g, nonce);
        console.log('[WeaviateQueryEditor] webview.cspSource:', webview.cspSource);
    htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);
        const extensionRootFileUri = vscode.Uri.file(this.extensionUri.fsPath);
        const webviewExtensionRootUri = webview.asWebviewUri(extensionRootFileUri);

        // Generate URI for webview.bundle.js
        const scriptPathOnDisk = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'webview.bundle.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        console.log('[WeaviateQueryEditor] Generated scriptUri for webview.bundle.js:', scriptUri.toString());
        htmlContent = htmlContent.replace(/{{webviewBundleUri}}/g, scriptUri.toString());

        // Calculate baseHref for the <base> tag
        const webviewDistPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
        const baseHrefUri = webview.asWebviewUri(webviewDistPath);
        let baseHrefString = baseHrefUri.toString();
        if (!baseHrefString.endsWith('/')) {
            baseHrefString += '/';
        }
        console.log('[WeaviateQueryEditor] Generated baseHref:', baseHrefString);
        htmlContent = htmlContent.replace(/{{baseHref}}/g, baseHrefString);

        return htmlContent;
    }
    private async _sendInitialData() {
        if (!this._weaviateClient) {
            const connected = await this._connectToWeaviate();
            if (!connected) {
                return;
            }
        }

        try {
            if (!this._weaviateClient) {
                throw new Error('Not connected to Weaviate');
            }
            const schema = await this._weaviateClient.schema.getter().do();
            this._panel.webview.postMessage({
                type: 'initialData',
                schema,
                collection: this._options.collectionName
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch schema: ${error.message}`);
        }
    }

    private async _explainQueryPlan(query: string) {
        if (!this._weaviateClient) {
            vscode.window.showErrorMessage('Not connected to Weaviate');
            return;
        }

        try {
            // Different Weaviate client versions have different API structures for explanations
            let explainResult;
            const client = this._weaviateClient as any; // Use any for API version compatibility
            
            try {
                // First try the standard approach if available
                if (client.graphql && client.graphql.get) {
                    // Use a standard GraphQL query with _additional.explain
                    const className = this._options.collectionName || 'Things';
                    const explainQuery = `{
                        Get {
                            ${className}(limit: 1) {
                                _additional { explain }
                            }
                        }
                    }`;
                    
                    if (typeof client.graphql.raw === 'function') {
                        explainResult = await client.graphql.raw({ query: explainQuery });
                    } else {
                        explainResult = { 
                            message: 'Explain query not supported by this version of Weaviate client',
                            clientInfo: {
                                hasGraphQL: !!client.graphql,
                                hasRaw: client.graphql ? !!client.graphql.raw : false,
                                methods: Object.keys(client.graphql || {}).join(', ')
                            }
                        };
                    }
                }
            } catch (explainError) {
                console.error('Explain operation failed:', explainError);
                explainResult = { 
                    error: 'Explain functionality failed', 
                    message: explainError instanceof Error ? explainError.message : 'Unknown error'
                };
            }
            this._panel.webview.postMessage({
                type: 'explainResult',
                data: explainResult
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'explainError',
                error: error.message
            });
        }
    }

    private async _getSchemaForCompletion(): Promise<{ classes: any[], types: any[] } | null> {
        try {
            if (!this._weaviateClient && this._options.client) {
                this._weaviateClient = this._options.client;
            }
            
            if (!this._weaviateClient) {
                const weaviateUrlConfig = vscode.workspace.getConfiguration('weaviate').get<string>('url');
                const weaviateUrl = weaviateUrlConfig || 'http://localhost:8080';
                
                let weaviateImport;
                try {
                    weaviateImport = await import('weaviate-ts-client');
                } catch (e) {
                    console.error('Failed to import weaviate-ts-client:', e);
                    vscode.window.showErrorMessage('Weaviate TS Client not found. Please ensure it is installed in your project.');
                    return null;
                }

                const ClientFactory = (weaviateImport as any).default?.client || (weaviateImport as any).client;
                if (!ClientFactory) {
                    console.error('Could not find client factory in weaviate-ts-client.');
                    vscode.window.showErrorMessage('Invalid Weaviate TS Client structure.');
                    return null;
                }

                const url = new URL(weaviateUrl);
                const protocol = url.protocol.slice(0, -1);
                const host = url.host;
                
                this._weaviateClient = ClientFactory({ 
                    scheme: protocol,
                    host: host,
                });

                if (!this._weaviateClient) {
                    console.error('Failed to initialize Weaviate client for schema completion.');
                    vscode.window.showErrorMessage('Failed to initialize Weaviate client. Check Weaviate server connection and configuration.');
                    return null;
                }
            }
            
            const schema = await this._weaviateClient.schema.getter().do();
            
            return {
                classes: schema.classes || [],
                types: [ 
                    { name: 'Get', kind: 'OBJECT' },
                    { name: 'Aggregate', kind: 'OBJECT' },
                ]
            };
        } catch (error: any) {
            console.error('Error fetching schema for completion:', error);
            vscode.window.showErrorMessage(`Error fetching Weaviate schema: ${error.message}`);
            return null;
        }
    }

    public dispose() {
        WeaviateQueryEditor.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}