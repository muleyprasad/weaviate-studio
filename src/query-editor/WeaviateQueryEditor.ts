import * as vscode from 'vscode';
import * as fs from 'fs';
import { URL } from 'url';
import * as path from 'path';
import { ConnectionManager } from '../services/ConnectionManager';
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
            // Clear any existing client
            this._weaviateClient = null;
            
            // Use the connection manager we initialized in the constructor
            if (!this._connectionManager) {
                console.log('ConnectionManager not initialized, attempting to get it again');
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
                console.log('Executing GraphQL query with client:', client.basePath || client.host || 'unknown host');
                
                if (client.graphql && typeof client.graphql.raw === 'function') {
                    // Try newer API style first (most common)
                    console.log('Using graphql.raw() method');
                    result = await client.graphql.raw({ query });
                } else if (client.graphql && client.graphql.get) {
                    // Try another common API pattern
                    console.log('Using graphql.get().do() method');
                    const graphqlQuery = client.graphql.get();
                    // Set the query text on the graphql query builder
                    if (typeof graphqlQuery.withRawQuery === 'function') {
                        graphqlQuery.withRawQuery(query);
                    } else {
                        // Some versions may have a different method name
                        graphqlQuery.raw(query);
                    }
                    result = await graphqlQuery.do();
                } else if (client.query && typeof client.query.raw === 'function') {
                    // Last resort - query interface
                    console.log('Using query.raw() method');
                    result = await client.query.raw(query);
                } else {
                    // If no known method works, throw an informative error
                    throw new Error('Could not find compatible GraphQL query method on Weaviate client');
                }
                
                console.log('Query result:', JSON.stringify(result, null, 2));
                
            } catch (apiError: any) {
                console.error('API call failed:', apiError);
                throw new Error(`GraphQL query failed: ${apiError.message}`);
            }
            
            // Make sure we're sending meaningful data to the webview
            if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
                throw new Error('Query returned empty result');
            }
            
            this._panel.webview.postMessage({
                type: 'queryResult',
                data: result,
                collection: this._options.collectionName
            });
        } catch (error: any) {
            console.error('Error executing query:', error);
            this._panel.webview.postMessage({
                type: 'queryError',
                error: error.message
            });
        }
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const webviewHtmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.html');
        let htmlContent = await fs.promises.readFile(webviewHtmlPath.fsPath, 'utf-8');

        const nonce = getNonce(); 

        htmlContent = htmlContent.replace(/{{nonce}}/g, nonce);
        console.log('[WeaviateQueryEditor] webview.cspSource:', webview.cspSource);
        htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);
        const extensionRootFileUri = vscode.Uri.file(this.context.extensionUri.fsPath);
        const webviewExtensionRootUri = webview.asWebviewUri(extensionRootFileUri);

        // Generate URI for webview.bundle.js
        const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.bundle.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        console.log('[WeaviateQueryEditor] Generated scriptUri for webview.bundle.js:', scriptUri.toString());
        htmlContent = htmlContent.replace(/{{webviewBundleUri}}/g, scriptUri.toString());

        // Calculate baseHref for the <base> tag
        const webviewDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
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
            
            // After sending schema, automatically fetch sample data if collection is provided
            if (this._options.collectionName) {
                await this._fetchSampleData();
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch schema: ${error.message}`);
        }
    }
    
    /**
     * Fetch sample data from the selected collection
     * This is used to automatically display data when a collection is selected
     */
    private async _fetchSampleData() {
        if (!this._weaviateClient || !this._options.collectionName) {
            return;
        }
        const collection = this._options.collectionName;
        const client = this._weaviateClient;

        try {
            const sampleData = await client.data.getter().withClassName(collection).withLimit(10).do();
            this._panel.webview.postMessage({
                type: 'queryResult',
                data: sampleData,
                collection
            });
        } catch (error: any) {
            console.error(`Failed to fetch sample data for collection ${collection}: ${error.message}`);
            this._panel.webview.postMessage({
                type: 'queryError',
                error: error.message,
                collection
            });
        }
    }
    
    /**
     * Sanitizes query results to remove sensitive information before sending to webview
     * @param result The raw query result from Weaviate
     * @returns A sanitized result object safe to send to the webview
     */
    private _sanitizeResult(result: any): any {
        if (!result) {
            return {};
        }
        
        // Make a deep copy to avoid modifying the original
        let sanitized;
        try {
            sanitized = JSON.parse(JSON.stringify(result));
        } catch (e) {
            console.error('Error cloning result:', e);
            sanitized = { ...result };
        }
        
        // SECURITY: Recursively remove all instances of apiKey, API keys, auth tokens, etc.
        const sanitizeObject = (obj: any) => {
            if (!obj || typeof obj !== 'object') {
                return;
            }
            
            // Remove any sensitive fields directly at this level
            const sensitiveFields = ['apiKey', 'api_key', 'token', 'auth', 'authorization', 'password', 'client'];
            sensitiveFields.forEach(field => {
                if (Object.prototype.hasOwnProperty.call(obj, field)) {
                    if (field === 'client' && obj.client) {
                        // For 'client' object specifically, we might want to keep some info but remove sensitive parts
                        if (obj.client.apiKey) {
                            delete obj.client.apiKey;
                        }
                        if (obj.client.api_key) {
                            delete obj.client.api_key;
                        }
                        // Additional sensitive fields that could be in client
                        ['token', 'auth', 'authorization', 'password', 'key', 'secret'].forEach(subField => {
                            if (obj.client[subField]) {
                                delete obj.client[subField];
                            }
                        });
                    } else {
                        // For other sensitive fields, just delete them entirely
                        delete obj[field];
                    }
                }
            });
            
            // Recursively check all nested objects and arrays
            Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object') {
                    sanitizeObject(obj[key]);
                }
            });
        };
        
        // Apply the sanitization recursively
        sanitizeObject(sanitized);
        
        // If we have data.data (nested structure), extract just what we need
        if (sanitized && sanitized.data && sanitized.data.Get && this._options.collectionName) {
            const collectionData = sanitized.data.Get[this._options.collectionName];
            if (Array.isArray(collectionData)) {
                // Return just the array of results for cleaner display
                return { 
                    collection: this._options.collectionName,
                    results: collectionData 
                };
            }
        }
        
        return sanitized;
    }
    
    /**
     * Check if the result contains actual usable data
     * @param result Sanitized query result
     * @returns True if the result contains meaningful data
     */
    private _hasActualData(result: any): boolean {
        // Check for top-level results structure
        if (result && result.results && Array.isArray(result.results) && result.results.length > 0) {
            return true;
        }
        
        // Check for data in typical nested structures
        if (result && result.data && result.data.Get) {
            const collections = Object.keys(result.data.Get);
            for (const collection of collections) {
                const data = result.data.Get[collection];
                if (Array.isArray(data) && data.length > 0) {
                    return true;
                }
            }
        }
        
        // Check if we have empty result with just errors array
        if (result && result._errors && Array.isArray(result._errors) && result._errors.length === 0 
            && Object.keys(result).length === 1) {
            return false;
        }
        
        return false;
    }
    
    /**
     * Try a simpler fallback query when the main query fails
     * This uses a hardcoded minimal approach to ensure we at least get IDs
     */
    /**
     * Redacts any sensitive information that might be in query strings
     * This ensures we don't log API keys or other credentials that might be in queries
     * @param query The query string to sanitize
     * @returns A sanitized version of the query string
     */
    private _redactSensitiveQueryInfo(query: string): string {
        if (!query) {
            return '';
        }
        
        // Create a copy to avoid modifying the original
        let sanitizedQuery = query;
        
        // List of patterns to redact (using regex)
        const sensitivePatterns = [
            // API key patterns
            /apiKey\s*:\s*["']([^"']+)["']/gi,
            /api_key\s*:\s*["']([^"']+)["']/gi,
            /apiKey\s*=\s*["']([^"']+)["']/gi,
            /api_key\s*=\s*["']([^"']+)["']/gi,
            /api[-_]?key["']?\s*:\s*["']([^"']+)["']/gi,
            
            // Auth token patterns
            /authorization\s*:\s*["']([^"']+)["']/gi,
            /auth[-_]?token\s*:\s*["']([^"']+)["']/gi,
            /bearer\s+([^"'\s]+)/gi,
            
            // Password patterns
            /password\s*:\s*["']([^"']+)["']/gi,
            /password\s*=\s*["']([^"']+)["']/gi,
            
            // General key/secret patterns
            /key\s*:\s*["']([^"']{8,})["']/gi, // Only match keys at least 8 chars long to avoid false positives
            /secret\s*:\s*["']([^"']+)["']/gi,
        ];
        
        // Apply all redaction patterns
        for (const pattern of sensitivePatterns) {
            sanitizedQuery = sanitizedQuery.replace(pattern, (match, group) => {
                // Replace the sensitive part with [REDACTED]
                return match.replace(group, '[REDACTED]');
            });
        }
        
        return sanitizedQuery;
    }
    
    private async _tryFallbackQuery() {
        if (!this._weaviateClient || !this._options.collectionName) {
            return;
        }
        
        try {
            const client = this._weaviateClient as any;
            console.log('Attempting fallback query with minimal properties');
            
            // Extremely simple query that should work on any collection
            const fallbackQuery = `{
                Get {
                    ${this._options.collectionName}(limit: 3) {
                        _additional { id }
                    }
                }
            }`;
            
            let result;
            if (client.graphql && typeof client.graphql.raw === 'function') {
                result = await client.graphql.raw({ query: fallbackQuery });
            } else if (client.query && typeof client.query.raw === 'function') {
                result = await client.query.raw(fallbackQuery);
            } else {
                console.error('No compatible query method available for fallback query');
                return;
            }
            
            if (result) {
                // Add debug info to help troubleshoot but sanitize sensitive data
                const sanitizedResult = this._sanitizeResult(result);
                const enhancedResult = {
                    ...sanitizedResult,
                    _debug: {
                        timestamp: new Date().toISOString(),
                        isFallback: true,
                        queryExecuted: this._redactSensitiveQueryInfo(fallbackQuery),
                        message: 'This is a fallback query result with minimal properties after main query returned no data'
                    }
                };
                
                this._panel.webview.postMessage({
                    type: 'queryResult',
                    data: enhancedResult,
                    collection: this._options.collectionName
                });
            }
        } catch (error: any) {
            console.error('Fallback query failed:', error);
            this._panel.webview.postMessage({
                type: 'queryError',
                error: `Both main and fallback queries failed. This may indicate an empty collection or connection issue: ${error.message}`
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