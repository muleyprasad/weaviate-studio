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
     * Renders detailed schema view
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
                        padding: 0 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    h1 {
                        color: var(--vscode-textLink-foreground);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                    }
                    .property-item {
                        background-color: var(--vscode-editor-lineHighlightBackground);
                        border-radius: 4px;
                        padding: 12px;
                        margin-bottom: 12px;
                    }
                    .property-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                    }
                    .property-name {
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }
                    .property-type {
                        color: var(--vscode-typeHint-foreground);
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                    }
                    .property-description {
                        margin: 8px 0;
                        color: var(--vscode-descriptionForeground);
                    }
                    .property-details {
                        display: flex;
                        gap: 16px;
                        font-size: 0.9em;
                        color: var(--vscode-typeHint-foreground);
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                </style>
            </head>
            <body>
                <h1>Schema: ${this.escapeHtml(schema.class)}</h1>
                
                <div class="property-section">
                    <h3>Class Configuration</h3>
                    <pre><code>${this.syntaxHighlight({
                        class: schema.class,
                        description: schema.description,
                        vectorizer: schema.vectorizer,
                        moduleConfig: schema.moduleConfig
                    })}</code></pre>
                </div>

                <div class="property-section">
                    <h3>Properties (${schema.properties?.length || 0})</h3>
                    ${propertiesHtml}
                </div>

                <div class="property-section">
                    <h3>Raw Schema</h3>
                    <pre><code>${this.syntaxHighlight(schema)}</code></pre>
                </div>
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
}
