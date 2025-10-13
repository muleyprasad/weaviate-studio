import * as vscode from 'vscode';
import * as fs from 'fs';
import { URL } from 'url';
import { ConnectionManager } from '../../services/ConnectionManager';
import { WeaviateClient, CollectionConfig, PropertyConfig } from 'weaviate-client';
import type { WeaviateConnection } from '../../services/ConnectionManager';
import * as http from 'http';
import * as https from 'https';

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
  tabId?: string; // Optional unique identifier for this tab instance
}

interface QueryRunOptions {
  distanceMetric: string;
  limit: number;
  certainty: number;
}

// Helper function to get webview options
function getWebviewOptions(
  extensionUri: vscode.Uri
): vscode.WebviewPanelOptions & vscode.WebviewOptions {
  return {
    enableScripts: true,
    // Preserve the webview when it is hidden so switching tabs is instant and state persists
    retainContextWhenHidden: true,
    localResourceRoots: [
      vscode.Uri.joinPath(extensionUri, 'media'),
      vscode.Uri.joinPath(extensionUri, 'dist'),
    ],
  };
}

export class QueryEditorPanel {
  public static readonly viewType = 'weaviate.queryEditor';
  // Map to store all open panels by collection name
  private static readonly panels = new Map<string, QueryEditorPanel>();
  private static _outputChannel: vscode.OutputChannel | null = null;
  private _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _options: QueryEditorOptions;
  private _weaviateClient: any = null;
  // Use definite assignment assertion to fix TypeScript error
  private _context!: vscode.ExtensionContext;
  private _connectionManager: any;
  private _errorDetailsStore: Map<string, { text: string; ts: number }> = new Map();

  // Standard GraphQL introspection query
  private static readonly INTROSPECTION_QUERY = `
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          description
          locations
          args { ...InputValue }
        }
      }
    }
    fragment FullType on __Type {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        args { ...InputValue }
        type { ...TypeRef }
        isDeprecated
        deprecationReason
      }
      inputFields { ...InputValue }
      interfaces { ...TypeRef }
      enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
      }
      possibleTypes { ...TypeRef }
    }
    fragment InputValue on __InputValue {
      name
      description
      type { ...TypeRef }
      defaultValue
    }
    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  // Minimal schema types for webview compatibility
  private async _fetchSchema(): Promise<{
    classes: Array<{
      class: string;
      description?: string;
      properties: Array<{
        name: string;
        dataType: string[];
        description?: string;
      }>;
    }>;
  }> {
    if (!this._weaviateClient) {
      throw new Error('Not connected to Weaviate');
    }

    // Use Weaviate v3 collections API and adapt to legacy schema shape expected by webview
    const collections: CollectionConfig[] = await this._weaviateClient.collections.listAll();
    return {
      classes: (collections || []).map((collection: CollectionConfig) => ({
        class: collection.name || '',
        description: (collection as any).description,
        properties: (collection.properties || []).map((prop: PropertyConfig) => ({
          name: prop.name || '',
          dataType: Array.isArray((prop as any).dataType)
            ? ((prop as any).dataType as string[])
            : [((prop as any).dataType as any) || 'string'],
          description: (prop as any).description,
        })),
      })),
    };
  }

  private _getActiveConnection(): WeaviateConnection | null {
    const connectionId = this._options.connectionId;
    if (!connectionId) {
      // Try to infer from active connections
      const connections = this._connectionManager?.getConnections?.() || [];
      const active = connections.find((c: any) => c.status === 'connected');
      return active || null;
    }
    const conn = this._connectionManager?.getConnection?.(connectionId);
    return conn || null;
  }

  private _buildGraphQLEndpoint(): string {
    const conn = this._getActiveConnection();
    if (!conn) {
      throw new Error('No active connection for GraphQL request');
    }

    if (conn.type === 'cloud' && conn.cloudUrl) {
      const base = conn.cloudUrl.replace(/\/$/, '');
      return `${base}/v1/graphql`;
    }

    const protocol = conn.httpSecure ? 'https' : 'http';
    const host = conn.httpHost || 'localhost';
    const port = conn.httpPort || (conn.httpSecure ? 443 : 8080);
    return `${protocol}://${host}:${port}/v1/graphql`;
  }

  private async _performGraphQLHttp(query: string): Promise<any> {
    const urlStr = this._buildGraphQLEndpoint();
    const conn = this._getActiveConnection();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (conn?.apiKey) {
      headers['Authorization'] = `Bearer ${conn.apiKey}`;
    }

    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';

    const options: https.RequestOptions | http.RequestOptions = {
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers,
    };

    const body = JSON.stringify({ query });

    const responseBody: string = await new Promise((resolve, reject) => {
      const req = (isHttps ? https : http).request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          if ((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300) {
            resolve(text);
          } else {
            // Build a concise error message without dumping entire response bodies
            const summary = this._summarizeHttpError(res.statusCode, res.statusMessage, text);
            const err: any = new Error(summary);
            // Attach raw response text for optional diagnostics
            err.details = text;
            err.statusCode = res.statusCode;
            err.statusMessage = res.statusMessage;
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    let json: any;
    try {
      json = JSON.parse(responseBody);
    } catch {
      throw new Error('Invalid JSON response from GraphQL endpoint');
    }

    if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
      const msg = json.errors
        .map((e: any) => e.message)
        .filter(Boolean)
        .join('; ');
      const graphQLError: any = new Error(msg || 'GraphQL returned errors');
      // Preserve the full payload so the UI can show complete details on demand
      graphQLError.details = responseBody;
      graphQLError.graphqlErrors = json.errors;
      graphQLError.graphqlResponse = json;
      graphQLError.graphqlRequest = { query };
      throw graphQLError;
    }
    return json.data ?? json;
  }

  // Create a concise, user-friendly message from HTTP error responses
  private _summarizeHttpError(
    statusCode?: number,
    statusMessage?: string,
    bodyText?: string
  ): string {
    const code = statusCode ?? 'unknown';

    // Try to parse JSON bodies produced by Weaviate and similar services
    if (bodyText) {
      try {
        const parsed: any = JSON.parse(bodyText);

        // Prefer explicit GraphQL error arrays
        if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
          const messages = parsed.errors
            .map((e: any) => e?.message)
            .filter(Boolean)
            .slice(0, 3)
            .join('; ');
          return `GraphQL Error (Code: ${code}): ${messages || 'Unknown error'}`;
        }

        // Weaviate often returns { response: { code, message }, request: { ... } }
        const response = parsed?.response;
        if (response?.message) {
          const respCode = response?.code ?? code;
          return `GraphQL Error (Code: ${respCode}): ${response.message}`;
        }

        // Fallback to top-level message if present
        if (parsed?.message) {
          return `GraphQL Error (Code: ${code}): ${parsed.message}`;
        }
      } catch {
        // Ignore JSON parse errors and fall through to a generic summary
      }
    }

    // Generic concise message without attaching the full body
    const statusText = `${statusMessage ?? ''}`.trim();
    return statusText ? `HTTP ${code} ${statusText}` : `HTTP ${code}: Request failed`;
  }

  /**
   * Opens a new query editor instance for the specified collection
   * Creates a new tab for each request, allowing multiple tabs for the same collection
   */
  public static createOrShow(context: vscode.ExtensionContext, options: QueryEditorOptions = {}) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    const collectionName = options.collectionName || 'Default';
    const connectionId = options.connectionId || '';

    // Generate a unique tab ID if not provided to ensure separate instances
    const tabId = options.tabId || `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use connection ID, collection name, and tab ID as the key for true isolation
    const panelKey = `${connectionId}:${collectionName}:${tabId}`;

    // Check if we already have a panel for this collection
    if (QueryEditorPanel.panels.has(panelKey)) {
      // If yes, reveal the existing panel
      const existingPanel = QueryEditorPanel.panels.get(panelKey);
      existingPanel?._panel.reveal(column);
      return;
    }

    // Create a new panel with a unique title
    const title = `Query: ${collectionName}`;
    const panel = vscode.window.createWebviewPanel(
      QueryEditorPanel.viewType,
      title,
      column,
      getWebviewOptions(context.extensionUri)
    );

    // Create new editor instance and store in our map
    const newEditor = new QueryEditorPanel(panel, context, { ...options, tabId });
    QueryEditorPanel.panels.set(panelKey, newEditor);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    options: QueryEditorOptions
  ) {
    this._options = options;
    this._panel = panel;
    this._context = context;
    this._connectionManager = ConnectionManager.getInstance(context);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle webview state changes to preserve content when switching tabs
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          // Webview became visible, restore state if needed
          this._restoreWebviewState();
        }
      },
      null,
      this._disposables
    );

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
              data: { message: 'Select a collection from the Weaviate Explorer' },
            });
          }
          break;

        case 'runQuery':
          const query = message.query;
          const queryOptions: QueryRunOptions = {
            distanceMetric: message.distanceMetric || 'cosine',
            limit: message.limit || 10,
            certainty: message.certainty || 0.7,
          };
          this._executeQuery(query, queryOptions);
          break;

        case 'explainPlan':
          await this._explainQueryPlan(message.query);
          break;

        case 'saveState':
          // Save webview state for restoration
          this._saveWebviewState(message.state);
          break;

        case 'requestSampleQuery':
          const collectionName = message.collection || this._options.collectionName;
          if (collectionName) {
            this._sendSampleQuery(collectionName);
          } else {
            this._panel.webview.postMessage({
              type: 'queryError',
              error: 'No collection specified for sample query',
            });
          }
          break;

        case 'getSchema':
          try {
            const schema = await this._fetchSchema();
            this._panel.webview.postMessage({
              type: 'schemaResult',
              schema,
              collection: this._options.collectionName,
            });
          } catch (error: any) {
            this._panel.webview.postMessage({
              type: 'queryError',
              error: `Error fetching schema: ${error.message}`,
            });
          }
          break;

        case 'openOutput':
          // Reveal the output channel with error details if available
          QueryEditorPanel._getOutputChannel()?.show(true);
          break;

        case 'copyToClipboard':
          try {
            await vscode.env.clipboard.writeText(message.text || '');
          } catch (e) {
            console.warn('Failed to copy to clipboard:', e);
          }
          break;

        case 'requestErrorDetails': {
          const id = message.errorId as string | undefined;
          if (!id) {
            return;
          }
          const entry = this._errorDetailsStore.get(id);
          if (!entry) {
            this._panel.webview.postMessage({
              type: 'errorDetailsEnd',
              errorId: id,
              error: 'Error details not found',
            });
            return;
          }

          const text = entry.text;
          const CHUNK = 32_768; // 32 KB chunks to keep UI responsive
          let index = 0;
          for (let i = 0; i < text.length; i += CHUNK) {
            const chunk = text.slice(i, i + CHUNK);
            this._panel.webview.postMessage({
              type: 'errorDetailsChunk',
              errorId: id,
              index,
              chunk,
            });
            index++;
          }
          this._panel.webview.postMessage({
            type: 'errorDetailsEnd',
            errorId: id,
            total: index,
          });
          break;
        }
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
      const errAny: any = error;
      const errorMsg = errAny instanceof Error ? errAny.message : 'Unknown error occurred';
      this._sendErrorToWebview(errorMsg, errAny?.details || errAny?.stack);
    }
  }

  private async _performGraphQLQuery(query: string): Promise<any> {
    const client = this._weaviateClient as any;

    // Try client-provided GraphQL interfaces first (for older clients)
    if (client?.graphql) {
      try {
        let result: any;
        if (typeof client.graphql.raw === 'function') {
          if (client.graphql.raw.length >= 1) {
            // Signature raw({ query })
            result = await client.graphql.raw({ query });
          } else {
            // Signature raw().withQuery(query).do()
            result = await client.graphql.raw().withQuery(query).do();
          }
        } else if (typeof client.graphql.query === 'function') {
          result = await client.graphql.query(query);
        }

        if (result !== undefined) {
          if (this._isEmptyResult(result)) {
            throw new Error('Query returned empty or invalid result');
          }
          return result;
        }
      } catch (e: any) {
        // Fall back to HTTP if client method fails
        console.warn('Client GraphQL interface failed, falling back to HTTP:', e?.message || e);
      }
    }

    // Fallback to direct HTTP
    try {
      const result = await this._performGraphQLHttp(query);
      if (this._isEmptyResult(result)) {
        throw new Error('Query returned empty or invalid result');
      }
      return result;
    } catch (apiError: any) {
      const err: any = new Error(
        `GraphQL query failed: ${apiError?.message || 'Unknown API error'}`
      );
      if (apiError?.details) {
        err.details = apiError.details;
      }
      throw err;
    }
  }

  private _isEmptyResult(result: any): boolean {
    return (
      !result ||
      (typeof result === 'object' && Object.keys(result).length === 0) ||
      (Array.isArray(result) && result.length === 0)
    );
  }

  private _sendResultToWebview(result: any): void {
    this._panel.webview.postMessage({
      type: 'queryResult',
      data: result,
      collection: this._options.collectionName,
      timestamp: new Date().toISOString(),
    });
  }

  private _sendErrorToWebview(errorMessage: string, details?: string): void {
    // Ensure excessively large messages do not overwhelm the UI
    const MAX_LEN = 1200;
    let display = errorMessage || 'Unknown error';
    if (display.length > MAX_LEN) {
      display = display.slice(0, MAX_LEN) + '… [truncated]';
    }
    let errorId: string | undefined;
    if (details) {
      errorId = this._saveErrorDetails(details);
    }

    // Log full context to the Output channel
    const ts = new Date().toISOString();
    const channel = QueryEditorPanel._getOutputChannel();
    channel?.appendLine(`[${ts}] GraphQL query error`);
    channel?.appendLine(display);
    if (details && channel) {
      channel.appendLine('Details:');
      const MAX_OUTPUT = 200000; // 200k chars to keep channel usable
      const outText =
        details.length > MAX_OUTPUT
          ? details.slice(0, MAX_OUTPUT) + '\n… [details truncated]'
          : details;
      channel.appendLine(outText);
      channel.appendLine('');
    } else if (channel) {
      channel.appendLine('');
    }

    this._panel.webview.postMessage({
      type: 'queryError',
      error: display,
      // Do not inline huge details; provide an id to fetch on demand
      errorId,
      timestamp: ts,
    });
  }

  // Save error details and return a short-lived id for retrieval from the webview
  private _saveErrorDetails(text: string): string {
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = Date.now();
    this._errorDetailsStore.set(id, { text, ts });

    // Simple cleanup: keep most recent 10 entries
    if (this._errorDetailsStore.size > 10) {
      const entries = Array.from(this._errorDetailsStore.entries()).sort(
        (a, b) => a[1].ts - b[1].ts
      );
      while (entries.length > 10) {
        const [oldId] = entries.shift()!;
        this._errorDetailsStore.delete(oldId);
      }
    }
    return id;
  }

  private static _getOutputChannel(): vscode.OutputChannel | null {
    try {
      if (!QueryEditorPanel._outputChannel) {
        QueryEditorPanel._outputChannel = vscode.window.createOutputChannel('Weaviate Studio');
      }
      return QueryEditorPanel._outputChannel;
    } catch {
      return null;
    }
  }

  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const webviewHtmlPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'dist',
      'webview',
      'index.html'
    );
    let htmlContent = await fs.promises.readFile(webviewHtmlPath.fsPath, 'utf-8');

    const nonce = getNonce();

    htmlContent = htmlContent.replace(/{{nonce}}/g, nonce);
    htmlContent = htmlContent.replace(/{{cspSource}}/g, webview.cspSource);

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
      const schema = await this._fetchSchema();
      // Try to fetch real GraphQL introspection for schema-aware editor features
      let introspection: any | null = null;
      try {
        const resp = await this._performGraphQLHttp(QueryEditorPanel.INTROSPECTION_QUERY);
        if (resp && resp.__schema) {
          introspection = resp;
        } else if (resp && resp.data && resp.data.__schema) {
          // In case of nested data shape
          introspection = resp.data;
        }
      } catch (e) {
        console.warn(
          'GraphQL introspection failed or unsupported:',
          e instanceof Error ? e.message : e
        );
      }

      // Get any saved state for this panel
      const savedState = this._getSavedWebviewState();

      this._panel.webview.postMessage({
        type: 'initialData',
        schema,
        collection: this._options.collectionName,
        savedState: savedState,
        introspection,
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to fetch schema: ${error.message}`);
    }
  }

  /**
   * Restore webview state when the panel becomes visible again
   */
  private async _restoreWebviewState() {
    // Check if webview needs reinitialization (content was disposed)
    try {
      // Try to ping the webview to see if it's responsive
      this._panel.webview.postMessage({ type: 'ping' });

      // If we get here without error, webview is still alive
      // No need to restore state
    } catch (error) {
      // Webview content was disposed, reinitialize
      console.log('Webview content was disposed, reinitializing...');
      await this._initializeWebview();
    }
  }

  /**
   * Save current webview state for restoration
   */
  private _saveWebviewState(state: any) {
    const panelKey = this._getPanelKey();
    if (panelKey) {
      this.context.workspaceState.update(`webview_state_${panelKey}`, {
        ...state,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get saved webview state
   */
  private _getSavedWebviewState(): any {
    const panelKey = this._getPanelKey();
    if (panelKey) {
      const savedState = this.context.workspaceState.get(`webview_state_${panelKey}`);
      // Only return state if it's recent (within last hour)
      if (
        savedState &&
        (savedState as any).timestamp &&
        Date.now() - (savedState as any).timestamp < 3600000
      ) {
        return savedState;
      }
    }
    return null;
  }

  /**
   * Sends a sample query to the webview
   * @param collectionName Collection to generate query for
   */
  private async _sendSampleQuery(collectionName: string) {
    if (!this._weaviateClient) {
      this._panel.webview.postMessage({
        type: 'queryError',
        error: 'Not connected to Weaviate',
      });
      return;
    }

    // Build a proper schema-based query using the collection's actual properties
    let sampleQuery = '';

    try {
      // Fetch the schema to get actual properties for this collection
      const schema = await this._fetchSchema();

      // Use the enhanced generateSampleQuery function that properly handles reference types
      const { generateSampleQuery } = require('../webview/graphqlTemplates');
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
          sampleQuery,
        },
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        type: 'queryError',
        error: `Failed to send sample query: ${error.message || 'Unknown error'}`,
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
        // Try via client.graphql if available, otherwise fall back to HTTP
        const className = this._options.collectionName || 'Things';
        const explainQuery = `{
                    Get {
                        ${className}(limit: 1) {
                            _additional { explain }
                        }
                    }
                }`;

        if (client.graphql && typeof client.graphql.raw === 'function') {
          if (client.graphql.raw.length >= 1) {
            explainResult = await client.graphql.raw({ query: explainQuery });
          } else {
            explainResult = await client.graphql.raw().withQuery(explainQuery).do();
          }
        } else if (client.graphql && typeof client.graphql.query === 'function') {
          explainResult = await client.graphql.query(explainQuery);
        } else {
          // Direct HTTP fallback
          explainResult = await this._performGraphQLHttp(explainQuery);
        }
      } catch (explainError) {
        explainResult = {
          error: 'Explain functionality failed',
          message: explainError instanceof Error ? explainError.message : 'Unknown error',
        };
      }

      this._panel.webview.postMessage({
        type: 'explainResult',
        data: explainResult,
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        type: 'explainError',
        error: error.message,
      });
    }
  }

  private async _getSchemaForCompletion(): Promise<{ classes: any[]; types: any[] } | null> {
    try {
      if (!this._weaviateClient && this._options.client) {
        this._weaviateClient = this._options.client;
      }

      if (!this._weaviateClient) {
        const weaviateUrlConfig = vscode.workspace.getConfiguration('weaviate').get<string>('url');
        const weaviateUrl = weaviateUrlConfig || 'http://localhost:8080';

        let weaviateImport;
        try {
          weaviateImport = await import('weaviate-client');
        } catch (e) {
          vscode.window.showErrorMessage(
            'Weaviate Client not found. Please ensure it is installed in your project.'
          );
          return null;
        }

        const ClientFactory =
          (weaviateImport as any).default?.client || (weaviateImport as any).client;
        if (!ClientFactory) {
          vscode.window.showErrorMessage('Invalid Weaviate TS Client structure.');
          return null;
        }

        const url = new URL(weaviateUrl);
      }

      const schema = await this._fetchSchema();

      return {
        classes: schema.classes || [],
        types: [
          { name: 'Get', kind: 'OBJECT' },
          { name: 'Aggregate', kind: 'OBJECT' },
        ],
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
      QueryEditorPanel.panels.delete(panelKey);
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
    const tabId = this._options.tabId;
    if (!collectionName) {
      return undefined;
    }

    return `${connectionId}:${collectionName}:${tabId}`;
  }
}
