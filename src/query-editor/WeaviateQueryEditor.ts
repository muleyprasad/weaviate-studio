import * as vscode from 'vscode';
import * as fs from 'fs';
import { URL } from 'url';
import { ConnectionManager } from '../services/ConnectionManager';
import { WeaviateClient } from 'weaviate-ts-client';

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

// Helper function to get webview options
function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'dist')
        ]
    };
}

export class WeaviateQueryEditor {
    public static readonly viewType = 'weaviate.queryEditor';
    // Map to store all open panels by collection name
    private static readonly panels = new Map<string, WeaviateQueryEditor>();
    private _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _options: QueryEditorOptions;
    private _weaviateClient: any = null;
    // Use definite assignment assertion to fix TypeScript error
    private _context!: vscode.ExtensionContext;
    private _connectionManager: any;
    
    /**
     * Opens a new query editor instance for the specified collection
     * Creates a new tab for each unique collection
     */
    public static createOrShow(context: vscode.ExtensionContext, options: QueryEditorOptions = {}) {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
        const collectionName = options.collectionName || 'Default';
        const connectionId = options.connectionId || '';
        // Use both connection ID and collection name as the key to handle same collection name across different connections
        const panelKey = `${connectionId}:${collectionName}`;
        
        // Check if we already have a panel for this collection
        if (WeaviateQueryEditor.panels.has(panelKey)) {
            // If yes, reveal the existing panel
            const existingPanel = WeaviateQueryEditor.panels.get(panelKey);
            existingPanel?._panel.reveal(column);
            return;
        }

        // Otherwise create a new panel for this collection
        const title = `Weaviate: ${collectionName}`;
        const panel = vscode.window.createWebviewPanel(
            WeaviateQueryEditor.viewType,
            title,
            column,
            getWebviewOptions(context.extensionUri)
        );

        // Create new editor instance and store in our map
        const newEditor = new WeaviateQueryEditor(panel, context, options);
        WeaviateQueryEditor.panels.set(panelKey, newEditor);
    }

    private constructor(panel: vscode.WebviewPanel, private readonly context: vscode.ExtensionContext, options: QueryEditorOptions) {
        this._options = options;
        this._panel = panel;
        this._connectionManager = ConnectionManager.getInstance(context);
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
                    } else {
                        // Send a message that no collection is selected
                        this._panel.webview.postMessage({
                            type: 'update',
                            title: 'No Collection Selected',
                            data: { message: 'Select a collection from the Weaviate Explorer' }
                        });
                    }
                    break;
                
                case 'runQuery':
                    try {
                        await this._executeQuery(message.query, message.options || {});
                    } catch (error: any) {
                        this._panel.webview.postMessage({
                            type: 'queryError',
                            error: `Error executing query: ${error.message}`
                        });
                    }
                    break;
                
                case 'explainPlan':
                    await this._explainQueryPlan(message.query);
                    break;
                
                case 'requestSampleQuery':
                    await this._sendSampleQuery(message.collection || this._options.collectionName);
                    break;
                    
                case 'getSchema':
                    try {
                        if (!this._weaviateClient) {
                            throw new Error('Not connected to Weaviate');
                        }
                        const schema = await this._weaviateClient.schema.getter().do();
                        this._panel.webview.postMessage({
                            type: 'schemaResult',
                            schema,
                            collection: this._options.collectionName
                        });
                    } catch (error: any) {
                        this._panel.webview.postMessage({
                            type: 'queryError',
                            error: `Error fetching schema: ${error.message}`
                        });
                    }
                    break;
            }
        });
    }

    private async _connectToWeaviate(): Promise<boolean> {
        try {
            // Clear any existing client
            this._weaviateClient = null;
            
            // Use the connection manager we initialized in the constructor
            if (!this._connectionManager) {
                try {
                    const extension = vscode.extensions.getExtension('muleyprasad.weaviate-studio');
                    if (extension) {
                        this._connectionManager = extension.exports?.connectionManager;
                    }
                } catch (e) {
                    console.error('Error getting ConnectionManager:', e);
                }
                
                if (!this._connectionManager) {
                    throw new Error('Could not get ConnectionManager');
                }
            }
            
            const connections = this._connectionManager.getConnections();
            const activeConnection = connections.find((c: any) => c.status === 'connected');
            if (this._options.connectionId) {
                this._weaviateClient = this._connectionManager.getClient(this._options.connectionId);
                if (!this._weaviateClient) {
                    await this._connectionManager.connect(this._options.connectionId);
                    this._weaviateClient = this._connectionManager.getClient(this._options.connectionId);
                }
            }

            if (!this._weaviateClient) {
                // We already have connections from above, no need to get them again
                if (activeConnection) {
                    this._weaviateClient = this._connectionManager.getClient(activeConnection.id);
                    this._options.connectionId = activeConnection.id;
                }
            }

            return !!this._weaviateClient;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
            return false;
        }
    }

    private async _executeQuery(query: string, options: QueryRunOptions): Promise<void> {
        // Early validation
        if (!this._weaviateClient) {
            const errorMsg = 'Not connected to Weaviate';
            vscode.window.showErrorMessage(errorMsg);
            this._sendErrorToWebview(errorMsg);
            return;
        }
    
        if (!query?.trim()) {
            const errorMsg = 'Query cannot be empty';
            this._sendErrorToWebview(errorMsg);
            return;
        }
    
        try {
            const result = await this._performGraphQLQuery(query);
            this._sendResultToWebview(result);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
            this._sendErrorToWebview(errorMsg);
        }
    }
    
    private async _performGraphQLQuery(query: string): Promise<any> {
        const client = this._weaviateClient as any;
        
        try {
            const result = await client.graphql.raw().withQuery(query).do();
            
            if (this._isEmptyResult(result)) {
                throw new Error('Query returned empty or invalid result');
            }
            
            return result;
        } catch (apiError: any) {
            throw new Error(`GraphQL query failed: ${apiError.message || 'Unknown API error'}`);
        }
    }
    
    private _isEmptyResult(result: any): boolean {
        return !result || 
               (typeof result === 'object' && Object.keys(result).length === 0) ||
               (Array.isArray(result) && result.length === 0);
    }
    
    private _sendResultToWebview(result: any): void {
        this._panel.webview.postMessage({
            type: 'queryResult',
            data: result,
            collection: this._options.collectionName,
            timestamp: new Date().toISOString()
        });
    }
    
    private _sendErrorToWebview(errorMessage: string): void {
        this._panel.webview.postMessage({
            type: 'queryError',
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const webviewHtmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.html');
        let htmlContent = await fs.promises.readFile(webviewHtmlPath.fsPath, 'utf-8');

        const nonce = getNonce(); 

        htmlContent = htmlContent.replace(/{{nonce}}/g, nonce);
        htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);
        const extensionRootFileUri = vscode.Uri.file(this.context.extensionUri.fsPath);
        const webviewExtensionRootUri = webview.asWebviewUri(extensionRootFileUri);

        // Generate URI for webview.bundle.js
        const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.bundle.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        htmlContent = htmlContent.replace(/{{webviewBundleUri}}/g, scriptUri.toString());

        // Calculate baseHref for the <base> tag
        const webviewDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
        const baseHrefUri = webview.asWebviewUri(webviewDistPath);
        let baseHrefString = baseHrefUri.toString();
        if (!baseHrefString.endsWith('/')) {
            baseHrefString += '/';
        }
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
    
    /**
     * Sends a sample query to the webview
     * @param collectionName Collection to generate query for
     */
    private async _sendSampleQuery(collectionName: string) {
        
        if (!this._weaviateClient) {
            this._panel.webview.postMessage({
                type: 'queryError',
                error: 'Not connected to Weaviate'
            });
            return;
        }

        // Build a proper schema-based query using the collection's actual properties
        let sampleQuery = '';
        
        try {
            // Fetch the schema to get actual properties for this collection
            const schema = await this._weaviateClient.schema.getter().do();
            
            // Use the enhanced generateSampleQuery function that properly handles reference types
            const { generateSampleQuery } = require('./enhanced/queryTemplates');
            sampleQuery = generateSampleQuery(collectionName, [], 10, schema);
            
        } catch (err) {
            
            // Fallback to basic query if schema query fails
            sampleQuery = `{
  Get {
    ${collectionName} (limit: 10) {
      _additional {
        id
      }
    }
  }
}`;
            
        }
        
        // Send sample query to webview
        try {
            this._panel.webview.postMessage({
                type: 'sampleQuery',
                data: {
                    sampleQuery
                }
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'queryError',
                error: `Failed to send sample query: ${error.message || 'Unknown error'}`
            });
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
                    vscode.window.showErrorMessage('Weaviate TS Client not found. Please ensure it is installed in your project.');
                    return null;
                }

                const ClientFactory = (weaviateImport as any).default?.client || (weaviateImport as any).client;
                if (!ClientFactory) {
                    vscode.window.showErrorMessage('Invalid Weaviate TS Client structure.');
                    return null;
                }

                const url = new URL(weaviateUrl);
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
            vscode.window.showErrorMessage(`Error fetching Weaviate schema: ${error.message}`);
            return null;
        }
    }

    public dispose() {
        // Find and remove this panel from the panels map
        const panelKey = this._getPanelKey();
        if (panelKey) {
            WeaviateQueryEditor.panels.delete(panelKey);
        }
        
        this._panel.dispose();
        
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    
    /**
     * Gets the unique key for this panel based on connection and collection
     */
    private _getPanelKey(): string | undefined {
        const connectionId = this._options.connectionId || '';
        const collectionName = this._options.collectionName;
        if (!collectionName) {
            return undefined;
        }
        
        return `${connectionId}:${collectionName}`;
    }
}