import * as vscode from 'vscode';
import { SchemaProperty, SchemaClass } from '../types';

/**
 * Service responsible for rendering views in webview panels
 */
export class ViewRenderer {
    private static instance: ViewRenderer;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get the singleton instance of ViewRenderer
     */
    public static getInstance(context: vscode.ExtensionContext): ViewRenderer {
        if (!ViewRenderer.instance) {
            ViewRenderer.instance = new ViewRenderer(context);
        }
        return ViewRenderer.instance;
    }

    /**
     * Renders property details view
     */
    public renderPropertyDetails(propertyName: string, property: SchemaProperty, collectionName: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Property: ${this.escapeHtml(propertyName)}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    h1 {
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                    }
                    .property-header {
                        background-color: var(--vscode-editor-lineHighlightBackground);
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                    }
                    .property-section {
                        margin-bottom: 20px;
                    }
                    .property-section h3 {
                        margin-bottom: 8px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .property-grid {
                        display: grid;
                        grid-template-columns: 150px 1fr;
                        gap: 10px;
                    }
                    .property-grid dt {
                        font-weight: bold;
                        color: var(--vscode-textPreformat-foreground);
                    }
                    .property-grid dd {
                        margin: 0;
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                    }
                </style>
            </head>
            <body>
                <h1>${this.escapeHtml(propertyName)}</h1>
                <div class="property-header">
                    <strong>Collection:</strong> ${this.escapeHtml(collectionName)} <br>
                    <strong>Type:</strong> ${property.dataType?.map(t => this.escapeHtml(t)).join(', ') || 'Unknown'}
                </div>

                <div class="property-section">
                    <h3>Details</h3>
                    <div class="property-grid">
                        <div><strong>Name:</strong></div>
                        <div>${this.escapeHtml(property.name)}</div>
                        
                        <div><strong>Data Type:</strong></div>
                        <div>${property.dataType?.map(t => this.escapeHtml(t)).join(', ') || 'Unknown'}</div>
                        
                        ${property.description ? `
                            <div><strong>Description:</strong></div>
                            <div>${this.escapeHtml(property.description)}</div>
                        ` : ''}
                        
                        <div><strong>Indexed:</strong></div>
                        <div>${property.indexInverted !== false ? 'Yes' : 'No'}</div>
                    </div>
                </div>

                ${property.moduleConfig ? `
                    <div class="property-section">
                        <h3>Module Configuration</h3>
                        <pre><code>${this.syntaxHighlight(property.moduleConfig)}</code></pre>
                    </div>
                ` : ''}

                <div class="property-section">
                    <h3>Raw Property Definition</h3>
                    <pre><code>${this.syntaxHighlight(property)}</code></pre>
                </div>
            </body>
            </html>
        `;
    }


    /**
     * Renders detailed schema view with multiple tabs
     */
    public renderDetailedSchema(schema: SchemaClass): string {
        const formatDataType = (dataType: string | string[] | undefined): string => {
            if (!dataType) {
                return 'Unknown';
            }
            if (Array.isArray(dataType)) {
                return dataType.join(' | ');
            }
            return dataType;
        };

        const propertiesHtml = schema.properties?.map(prop => `
            <div class="property-item">
                <div class="property-header">
                    <span class="property-name">${this.escapeHtml(prop.name)}</span>
                    <span class="property-type">${this.escapeHtml(formatDataType(prop.dataType))}</span>
                </div>
                ${prop.description ? `<div class="property-description">${this.escapeHtml(prop.description)}</div>` : ''}
                <div class="property-details">
                    <span class="property-detail">Indexed: ${prop.indexInverted !== false ? 'Yes' : 'No'}</span>
                    ${prop.moduleConfig ? `<span class="property-detail">Module: ${Object.keys(prop.moduleConfig).join(', ')}</span>` : ''}
                </div>
            </div>
        `).join('') || '<div>No properties found</div>';

        // Generate REST API equivalent for collection creation
        const apiEquivalent = {
            class: schema.class,
            description: schema.description,
            vectorizer: schema.vectorizer,
            moduleConfig: schema.moduleConfig,
            properties: schema.properties,
            vectorIndexType: (schema as any).vectorIndexType || 'hnsw',
            vectorIndexConfig: (schema as any).vectorIndexConfig,
            invertedIndexConfig: (schema as any).invertedIndexConfig,
            shardingConfig: (schema as any).shardingConfig,
            replicationConfig: (schema as any).replicationConfig,
            multiTenancyConfig: (schema as any).multiTenancyConfig
        };

        const curlCommand = `curl -X POST \\
  "http://localhost:8080/v1/schema" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(apiEquivalent, null, 2)}'`;

        // Generate creation script for the 5th tab
        const creationScript = `# Weaviate Collection Definition
# Generated on: ${new Date().toLocaleString()}
# Collection: ${schema.class}

# ========================================
# CREATE COLLECTION SCRIPT
# ========================================

import weaviate

client = weaviate.Client("http://localhost:8080")

# Collection definition
collection_config = ${JSON.stringify(apiEquivalent, null, 4)}

# Create the collection
client.schema.create_class(collection_config)

# ========================================
# EQUIVALENT REST API CALL
# ========================================

${curlCommand}`;

        const propertyDetails = schema.properties?.map(prop => `
Property: ${prop.name}
  Type: ${Array.isArray(prop.dataType) ? prop.dataType.join(' | ') : prop.dataType}
  Indexed: ${prop.indexInverted !== false ? 'Yes' : 'No'}
  ${prop.description ? `Description: ${prop.description}` : ''}
  ${prop.moduleConfig ? `Module Config: ${JSON.stringify(prop.moduleConfig, null, 2)}` : ''}
`).join('\n') || 'No properties defined';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Schema: ${this.escapeHtml(schema.class)}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0;
                        margin: 0;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    
                    .header {
                        font-family: "Inter", Arial, sans-serif;
                        font-size: 18px;
                        font-weight: bold;
                        color: #222b45;
                        background-color: #f5f6fa;
                        padding: 12px 20px;
                        margin: 0;
                        border: none;
                    }
                    
                    .header h1 {
                        margin: 0;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-family: "Inter", Arial, sans-serif;
                        font-size: 18px;
                        font-weight: bold;
                        color: #222b45;
                    }
                    
                    .collection-badge {
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 0.8em;
                        font-weight: normal;
                    }

                    .section-header {
                        font-family: var(--vscode-font-family);
                        font-size: 14px;
                        font-weight: 600;
                        color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
                        margin: 0;
                        padding: 8px 12px;
                        background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
                        border-bottom: 1px solid var(--vscode-panel-border);
                        border-left: 3px solid var(--vscode-button-background);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        text-transform: none;
                    }
                    
                    .section-header .buttons {
                        display: flex;
                        gap: 8px;
                    }

                    .button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 4px 8px;
                        font-size: 12px;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        border-radius: 2px;
                    }

                    .button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    .section-content {
                        padding: 8px 20px;
                        margin: 0;
                        background: none;
                    }
                    
                    .section-content pre {
                        margin: 0;
                    }

                    .section-content p {
                        margin: 0 0 8px 0;
                    }
                    
                    .sidebar {
                        padding: 16px;
                        background: none;
                    }
                    
                    .results {
                        padding: 12px;
                        margin: 0;
                        background: none;
                    }

                    .tabs {
                        display: flex;
                        background: none;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        overflow-x: auto;
                        margin: 0;
                    }
                    
                    .tab {
                        padding: 12px 16px;
                        cursor: pointer;
                        background: none;
                        color: var(--vscode-tab-inactiveForeground);
                        border: none;
                        border-right: 1px solid var(--vscode-panel-border);
                        transition: background-color 0.2s;
                        white-space: nowrap;
                        flex-shrink: 0;
                        font-size: 0.9em;
                    }
                    
                    .tab:hover {
                        background-color: var(--vscode-tab-hoverBackground);
                    }
                    
                    .tab.active {
                        background-color: var(--vscode-tab-activeBackground);
                        color: var(--vscode-tab-activeForeground);
                        border-bottom: 2px solid var(--vscode-textLink-foreground);
                    }
                    
                    .tab-content {
                        display: none;
                        padding: 0;
                        max-height: calc(100vh - 200px);
                        overflow-y: auto;
                    }
                    
                    .tab-content.active {
                        display: block;
                    }
                    
                    .property-item {
                        padding: 12px;
                        margin-bottom: 12px;
                        background: none;
                        border: none;
                    }
                    
                    .property-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        background: none;
                    }
                    
                    .property-name {
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }
                    
                    .property-type {
                        color: var(--vscode-typeHint-foreground);
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                        padding: 2px 6px;
                        border-radius: 4px;
                    }
                    
                    .property-description {
                        margin: 8px 0;
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                    }
                    
                    .property-details {
                        display: flex;
                        gap: 16px;
                        font-size: 0.9em;
                        color: var(--vscode-typeHint-foreground);
                    }
                    
                    .property-detail {
                        padding: 2px 6px;
                        border-radius: 3px;
                        background: none;
                    }
                    
                    pre {
                        background: none;
                        border: none;
                        padding: 15px;
                        border-radius: 0;
                        overflow-x: auto;
                        font-size: 0.9em;
                        line-height: 1.4;
                        margin: 10px 0;
                    }
                    
                    code {
                        font-family: var(--vscode-editor-font-family);
                        background: transparent;
                        color: var(--vscode-editor-foreground);
                    }
                    
                    .config-section {
                        padding: 20px;
                        margin: 0;
                        background: none;
                        border: none;
                    }
                    
                    .config-section h3 {
                        font-family: "Inter", Arial, sans-serif;
                        font-size: 16px;
                        font-weight: bold;
                        color: #222b45;
                        margin: 0 0 16px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .config-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 10px;
                        margin-top: 10px;
                    }
                    
                    .config-item {
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-size: 0.9em;
                        background: none;
                    }
                    
                    .config-label {
                        font-weight: bold;
                        color: var(--vscode-textPreformat-foreground);
                    }
                    
                    .config-value {
                        color: var(--vscode-foreground);
                        margin-left: 8px;
                    }
                    
                    .copy-button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 0.9em;
                        margin-top: 10px;
                        transition: background-color 0.2s;
                    }
                    
                    .copy-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin: 20px 0;
                    }
                    
                    .stat-card {
                        padding: 15px;
                        text-align: center;
                        margin: 0;
                        background: none;
                        border: none;
                    }
                    
                    .stat-number {
                        font-size: 1.5em;
                        font-weight: bold;
                        color: #222b45;
                        display: block;
                        font-family: "Inter", Arial, sans-serif;
                    }
                    
                    .stat-label {
                        font-size: 0.9em;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 5px;
                        font-family: "Inter", Arial, sans-serif;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>
                        Schema: ${this.escapeHtml(schema.class)}
                    </h1>
                </div>
                <div class="tabs">
                    <div class="tab active" onclick="switchTab('overview')">Overview</div>
                    <div class="tab" onclick="switchTab('properties')">Properties</div>
                    <div class="tab" onclick="switchTab('raw-json')">Raw JSON</div>
                    <div class="tab" onclick="switchTab('api-equivalent')">API Equivalent</div>
                    <div class="tab" onclick="switchTab('creation-scripts')">Creation Scripts</div>
                </div>
                <div id="overview" class="tab-content active">
                    <div class="section-header">Description</div>
                    <div class="section-content">${this.escapeHtml(schema.description || 'No description available')}</div>
                    
                    <div class="section-header">Vector Configuration</div>
                    <div class="section-content">
                        <div class="config-grid">
                            <div class="config-item">
                                <span class="config-label">Vectorizer:</span>
                                <span class="config-value">${this.escapeHtml(schema.vectorizer || 'None')}</span>
                            </div>
                            <div class="config-item">
                                <span class="config-label">Index Type:</span>
                                <span class="config-value">${this.escapeHtml((schema as any).vectorIndexType || 'HNSW')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section-header">Module Configuration</div>
                    <div class="section-content">
                        <pre><code>${this.formatJsonClean(schema.moduleConfig)}</code></pre>
                    </div>
                    
                    <div class="section-header">Scaling Configuration</div>
                    <div class="section-content">
                        <div class="config-section">
                            <h3>Sharding</h3>
                            <pre><code>${this.formatJsonClean((schema as any).shardingConfig)}</code></pre>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-number">${schema.properties?.length || 0}</span>
                            <span class="stat-label">Properties</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${schema.vectorizer ? '1' : '0'}</span>
                            <span class="stat-label">Vectorizer</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${schema.moduleConfig ? Object.keys(schema.moduleConfig).length : 0}</span>
                            <span class="stat-label">Modules</span>
                        </div>
                    </div>
                </div>

                <!-- Properties Tab -->
                <div id="properties" class="tab-content">
                    <h3>Properties (${schema.properties?.length || 0})</h3>
                    ${propertiesHtml}
                </div>

                <!-- Raw JSON Tab -->
                <div id="raw-json" class="tab-content">
                    <div class="section-header">
                        <span>Complete Schema Definition</span>
                        <div class="buttons">
                            <button class="button" onclick="copyToClipboard('rawSchema')">Copy JSON</button>
                        </div>
                    </div>
                    <div class="section-content">
                        <pre id="rawSchema"><code>${this.formatJsonClean(schema)}</code></pre>
                    </div>
                </div>

                <!-- API Equivalent Tab -->
                <div id="api-equivalent" class="tab-content">
                    <div class="section-header">
                        <span>REST API Equivalent</span>
                        <div class="buttons">
                            <button class="button" onclick="copyToClipboard('apiCommand')">Copy Command</button>
                        </div>
                    </div>
                    <div class="section-content">
                        <p>Use this cURL command to recreate this collection:</p>
                        <pre id="apiCommand"><code>${this.generateCurlCommand(schema)}</code></pre>
                    </div>
                </div>

                <!-- Creation Scripts Tab -->
                <div id="creation-scripts" class="tab-content">
                    <div class="section-header">
                        <span>Complete Creation Script</span>
                        <div class="buttons">
                            <button class="button" onclick="copyToClipboard('creationScript')">Copy Script</button>
                        </div>
                    </div>
                    <div class="section-content">
                        <pre id="creationScript"><code>${this.generatePythonScript(schema)}</code></pre>
                    </div>
                </div>

                <script>
                    function switchTab(tabName) {
                        // Hide all tab contents
                        const contents = document.querySelectorAll('.tab-content');
                        contents.forEach(content => content.classList.remove('active'));
                        
                        // Remove active class from all tabs
                        const tabs = document.querySelectorAll('.tab');
                        tabs.forEach(tab => tab.classList.remove('active'));
                        
                        // Show selected tab content
                        document.getElementById(tabName).classList.add('active');
                        
                        // Add active class to clicked tab
                        event.target.classList.add('active');
                    }
                    
                    function copyToClipboard(elementId) {
                        const element = document.getElementById(elementId);
                        const text = element.textContent;
                        
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(text).then(() => {
                                // Visual feedback
                                const button = event.target;
                                const originalText = button.textContent;
                                button.textContent = '✅ Copied!';
                                button.style.backgroundColor = 'var(--vscode-testing-iconPassed)';
                                
                                setTimeout(() => {
                                    button.textContent = originalText;
                                    button.style.backgroundColor = 'var(--vscode-button-background)';
                                }, 2000);
                            });
                        } else {
                            // Fallback for older browsers
                            const textarea = document.createElement('textarea');
                            textarea.value = text;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                            
                            // Visual feedback
                            const button = event.target;
                            const originalText = button.textContent;
                            button.textContent = '✅ Copied!';
                            setTimeout(() => {
                                button.textContent = originalText;
                            }, 2000);
                        }
                    }
                </script>
            </body>
            </html>
        `;
    }


    /**
     * Renders a JSON schema viewer
     */
    public renderJsonViewer(title: string, json: any): string {
        const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.escapeHtml(title)}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    h1 {
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                        max-height: 80vh;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                        white-space: pre-wrap;
                        word-break: break-all;
                    }
                </style>
            </head>
            <body>
                <h1>${this.escapeHtml(title)}</h1>
                <pre><code id="json-content">${this.syntaxHighlight(json)}</code></pre>
                
                <script>
                    // Apply syntax highlighting after load
                    document.addEventListener('DOMContentLoaded', () => {
                        const jsonElement = document.getElementById('json-content');
                        if (jsonElement) {
                            try {
                                const json = JSON.parse(jsonElement.textContent);
                                jsonElement.innerHTML = JSON.stringify(json, null, 2)
                                    .replace(/&/g, '&')
                                    .replace(/</g, '<')
                                    .replace(/>/g, '>')
                                    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
                                    (match) => {
                                        let cls = 'number';
                                        if (/^"/.test(match)) {
                                            if (/:$/.test(match)) {
                                                cls = 'key';
                                            } else {
                                                cls = 'string';
                                            }
                                        } else if (/true|false/.test(match)) {
                                            cls = 'boolean';
                                        } else if (/null/.test(match)) {
                                            cls = 'null';
                                        }
                                        return '<span class="' + cls + '">' + match + '</span>';
                                    });
                            } catch (e) {
                                // If not valid JSON, leave as is
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    /**
     * Helper to escape HTML special characters
     */
    private escapeHtml(unsafe: string): string {
        if (typeof unsafe !== 'string') {
            return String(unsafe);
        }
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Helper to format JSON with syntax highlighting
     */
    private syntaxHighlight(json: any): string {
        if (typeof json === 'string') {
            try {
                json = JSON.parse(json);
            } catch (e) {
                return this.escapeHtml(json);
            }
        }
        
        const jsonString = JSON.stringify(json, null, 2);
        return this.escapeHtml(jsonString);
    }

    /**
     * Helper to format JSON without gray highlighting
     */
    private formatJsonClean(json: any): string {
        if (typeof json === 'string') {
            try {
                json = JSON.parse(json);
            } catch (e) {
                return this.escapeHtml(json);
            }
        }
        
        const jsonString = JSON.stringify(json, null, 2);
        return this.escapeHtml(jsonString);
    }

    /**
     * Renders raw collection configuration view
     */
    public renderRawConfig(schema: SchemaClass, connectionId: string): string {
        // Get connection info for context
        const timestamp = new Date().toLocaleString();
        
        // Generate creation script
        const creationScript = `# Weaviate Collection Configuration
# Generated: ${timestamp}
# Collection: ${schema.class}

import weaviate

client = weaviate.Client("http://localhost:8080")

# Collection definition
collection_config = ${JSON.stringify(schema, null, 4)}

# Create the collection
client.schema.create_class(collection_config)

print(f"Collection '{schema.class}' created successfully!")`;

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Raw Config: ${this.escapeHtml(schema.class)}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0;
                        margin: 0;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .tab-container {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                    }
                    .tab-header {
                        display: flex;
                        background-color: var(--vscode-tab-border);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        overflow-x: auto;
                    }
                    .tab-button {
                        padding: 10px 20px;
                        background: var(--vscode-tab-inactiveBackground);
                        color: var(--vscode-tab-inactiveForeground);
                        border: none;
                        cursor: pointer;
                        white-space: nowrap;
                        border-right: 1px solid var(--vscode-panel-border);
                    }
                    .tab-button.active {
                        background: var(--vscode-tab-activeBackground);
                        color: var(--vscode-tab-activeForeground);
                    }
                    .tab-content {
                        flex: 1;
                        padding: 20px;
                        overflow-y: auto;
                        display: none;
                    }
                    .tab-content.active {
                        display: block;
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 15px;
                        border-radius: 4px;
                        overflow-x: auto;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                    .copy-btn {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-bottom: 10px;
                    }
                    .copy-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .context-info {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                        font-size: 0.9em;
                    }
                </style>
            </head>
            <body>
                <div class="tab-container">
                    <div class="tab-header">
                        <button class="tab-button active" onclick="showTab('creation')">Creation Script</button>
                        <button class="tab-button" onclick="showTab('details')">Property Details</button>
                        <button class="tab-button" onclick="showTab('json')">Complete JSON</button>
                    </div>
                    
                    <div id="creation" class="tab-content active">
                        <div class="context-info">
                            <strong>Collection:</strong> ${this.escapeHtml(schema.class)}<br>
                            <strong>Generated:</strong> ${timestamp}<br>
                            <strong>Properties:</strong> ${schema.properties?.length || 0}
                        </div>
                        
                        <button class="copy-btn" onclick="copyToClipboard('creationScript')">
                            📋 Copy Creation Script
                        </button>
                        <pre id="creationScript">${this.escapeHtml(creationScript)}</pre>
                    </div>
                    
                    <div id="details" class="tab-content">
                        <h3>Property Details</h3>
                        ${schema.properties?.map(prop => `
                            <div style="background: var(--vscode-editor-lineHighlightBackground); padding: 10px; margin: 10px 0; border-radius: 4px;">
                                <strong>${this.escapeHtml(prop.name)}</strong> (${prop.dataType?.join(' | ') || 'Unknown'})<br>
                                ${prop.description ? `<em>${this.escapeHtml(prop.description)}</em><br>` : ''}
                                <small>Indexed: ${prop.indexInverted !== false ? 'Yes' : 'No'}</small>
                            </div>
                        `).join('') || '<p>No properties defined</p>'}
                    </div>
                    
                    <div id="json" class="tab-content">
                        <button class="copy-btn" onclick="copyToClipboard('fullJson')">
                            📋 Copy JSON
                        </button>
                        <pre id="fullJson">${this.syntaxHighlight(schema)}</pre>
                    </div>
                </div>

                <script>
                    function showTab(tabName) {
                        // Hide all tab contents
                        const contents = document.querySelectorAll('.tab-content');
                        contents.forEach(content => content.classList.remove('active'));
                        
                        // Remove active from all buttons
                        const buttons = document.querySelectorAll('.tab-button');
                        buttons.forEach(button => button.classList.remove('active'));
                        
                        // Show selected tab
                        document.getElementById(tabName).classList.add('active');
                        
                        // Activate corresponding button
                        event.target.classList.add('active');
                    }
                    
                    function copyToClipboard(elementId) {
                        const element = document.getElementById(elementId);
                        const text = element.textContent;
                        navigator.clipboard.writeText(text).then(() => {
                            // Show brief success indication
                            const btn = event.target;
                            const originalText = btn.textContent;
                            btn.textContent = '✅ Copied!';
                            setTimeout(() => {
                                btn.textContent = originalText;
                            }, 2000);
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }

    /**
     * Renders collection performance metrics view
     */
    public renderCollectionMetrics(schema: SchemaClass, connectionId: string): string {
        const timestamp = new Date().toLocaleString();
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Metrics: ${this.escapeHtml(schema.class)}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .metric-card {
                        background: var(--vscode-editor-lineHighlightBackground);
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 4px;
                        border-left: 4px solid var(--vscode-textLink-foreground);
                    }
                    .metric-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 15px;
                        margin: 20px 0;
                    }
                    .metric-value {
                        font-size: 1.5em;
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }
                    .metric-label {
                        font-size: 0.9em;
                        color: var(--vscode-descriptionForeground);
                    }
                    h1, h2 {
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 5px;
                    }
                    .refresh-btn {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-bottom: 20px;
                    }
                    .refresh-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <h1>Performance Metrics: ${this.escapeHtml(schema.class)}</h1>
                
                <button class="refresh-btn" onclick="window.location.reload()">
                    🔄 Refresh Metrics
                </button>
                
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value">${schema.properties?.length || 0}</div>
                        <div class="metric-label">Properties Defined</div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-value">${schema.vectorizer || 'None'}</div>
                        <div class="metric-label">Vectorizer</div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-value">${(schema as any).vectorIndexType || 'HNSW'}</div>
                        <div class="metric-label">Vector Index Type</div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-value">${Object.keys(schema.moduleConfig || {}).length}</div>
                        <div class="metric-label">Active Modules</div>
                    </div>
                </div>

                <h2>Index Configuration</h2>
                <div class="metric-card">
                    <strong>Vector Index:</strong> ${(schema as any).vectorIndexType || 'HNSW'}<br>
                    <strong>Inverted Index:</strong> ${(schema as any).invertedIndexConfig ? 'Custom' : 'Default'}<br>
                    <strong>Indexed Properties:</strong> ${schema.properties?.filter(p => p.indexInverted !== false).length || 0}
                </div>

                <h2>Schema Configuration</h2>
                <div class="metric-card">
                    <strong>Multi-tenancy:</strong> ${(schema as any).multiTenancyConfig?.enabled ? 'Enabled' : 'Disabled'}<br>
                    <strong>Replication Factor:</strong> ${(schema as any).replicationConfig?.factor || 1}<br>
                    <strong>Sharding:</strong> ${(schema as any).shardingConfig ? 'Custom' : 'Default'}
                </div>

                <h2>Modules & Vectorization</h2>
                <div class="metric-card">
                    ${schema.moduleConfig ? Object.entries(schema.moduleConfig).map(([module, config]) => 
                        `<strong>${module}:</strong> Configured<br>`
                    ).join('') : 'No modules configured'}
                </div>

                <div style="margin-top: 30px; padding: 10px; background: var(--vscode-textCodeBlock-background); border-radius: 4px; font-size: 0.8em;">
                    <strong>Last Updated:</strong> ${timestamp}<br>
                    <strong>Connection:</strong> ${connectionId}
                </div>
            </body>
            </html>
        `;
    }

    private generateCurlCommand(schema: any): string {
        const apiEquivalent = this.convertToApiFormat(schema);
        return `curl \\
    -X POST \\
    -H "Content-Type: application/json" \\
    -d '${JSON.stringify(apiEquivalent, null, 2)}' \\
    http://localhost:8080/v1/schema`;
    }

    private generatePythonScript(schema: any): string {
        const apiEquivalent = this.convertToApiFormat(schema);
        return `import weaviate

client = weaviate.Client("http://localhost:8080")

schema = ${JSON.stringify(apiEquivalent, null, 2)}

client.schema.create_class(schema)`;
    }

    private convertToApiFormat(schema: any): any {
        // Remove internal fields and format for API
        const apiSchema = { ...schema };
        delete apiSchema.id;
        delete apiSchema._additional;
        return apiSchema;
    }
}
