// Import Monaco editor
import * as monaco from 'monaco-editor';
import { provideCompletionItems } from './weaviate-language-support';

// Global variables
let editor;
let weaviateSchema = null;
let vscode = acquireVsCodeApi();

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Setup Monaco editor
    setupMonacoEditor();
    
    // Setup communication with extension host
    setupMessageHandling();
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Run Query button
    const runButton = document.getElementById('run-query');
    if (runButton) {
        runButton.addEventListener('click', () => {
            const query = editor.getValue();
            const distanceMetric = document.getElementById('distance-metric').value;
            const limit = document.getElementById('limit').value;
            const certainty = document.getElementById('certainty').value;
            
            // Show loading state
            const resultsContent = document.querySelector('.results-content');
            resultsContent.innerHTML = '<div class="loading">Running query...</div>';
            
            // Send the query to the extension host
            vscode.postMessage({
                command: 'runQuery',
                query,
                options: {
                    distanceMetric,
                    limit: parseInt(limit),
                    certainty: parseFloat(certainty)
                }
            });
        });
    }

    // Explain Plan button
    const explainButton = document.getElementById('explain-plan');
    if (explainButton) {
        explainButton.addEventListener('click', () => {
            const query = editor.getValue();
            // Send the explain plan request to the extension host
            vscode.postMessage({
                command: 'explainPlan',
                query
            });
        });
    }
});

/**
 * Setup Monaco Editor with GraphQL language support
 */
function setupMonacoEditor() {
    // Register GraphQL language
    monaco.languages.register({ id: 'graphql' });
    
    // Define GraphQL language tokenizer
    monaco.languages.setMonarchTokensProvider('graphql', {
        defaultToken: 'invalid',
        tokenPostfix: '.gql',

        keywords: [
            'query', 'mutation', 'subscription', 'fragment',
            'scalar', 'type', 'interface', 'union', 'enum', 'input',
            'implements', 'extend', 'directive',
            'on', 'true', 'false', 'null', 'schema'
        ],

        weaviateKeywords: [
            'Get', 'Aggregate', 'BM25', 'Explore', 'HybridGet',
            'COSINE', 'DOT', 'L2', 'HAMMING', 'MANHATTAN',
            'nearText', 'nearVector', 'nearObject', 'where', 'limit',
            'offset', 'group', 'sort', 'certainty'
        ],

        operators: [
            '!', '$', '(', ')', '...', ':', '=', '@', '[', ']', '{', '|', '}'
        ],

        // we include these common regular expressions
        symbols: /[!\$\(\):\=\[\]\{\|\}]+/,

        // Weaviate specific properties
        weaviateProperties: /certainty|limit|distance|withVector|autocut|hybrid/,

        tokenizer: {
            root: [
                // identifiers and keywords
                [/[a-z_$][\w$]*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@weaviateKeywords': 'keyword.weaviate',
                        '@default': 'identifier'
                    }
                }],
                [/[A-Z][\w\$]*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@weaviateKeywords': 'keyword.weaviate',
                        '@default': 'type.identifier'
                    }
                }],

                // whitespace
                { include: '@whitespace' },

                // strings
                [/"""/, { token: 'string.quote', bracket: '@open', next: '@string3' }],
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

                // numbers
                [/\d+/, 'number'],

                // operators
                [/@symbols/, {
                    cases: {
                        '@operators': 'operator',
                        '@default': 'symbol'
                    }
                }],

                // Custom for Weaviate-specific properties
                [/@weaviateProperties/, 'property.weaviate']
            ],

            string: [
                [/[^"\\]+/, 'string'],
                [/\\"/, 'string'],
                [/\\./,  'string.escape'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
            ],

            string3: [
                [/[^"""\\]+/, 'string'],
                [/\\"/, 'string'],
                [/\\./,  'string.escape'],
                [/"""/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
            ],

            whitespace: [
                [/[ \t\r\n]+/, 'white'],
                [/#.*$/, 'comment']
            ]
        }
    });
    
    // Setup language completion provider
    monaco.languages.registerCompletionItemProvider('graphql', {
        provideCompletionItems: (model, position) => {
            return provideCompletionItems(model, position, weaviateSchema);
        }
    });

    // Create Monaco Editor instance
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: `{
  Get {
    Things {
      title
      description
    }
  }
}`,
        language: 'graphql',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: {
            enabled: true
        },
        fontSize: 14,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'all',
        tabSize: 2
    });

    // Setup resize handling
    window.addEventListener('resize', () => {
        editor.layout();
    });
}

/**
 * Setup message handling for communication with extension host
 */
function setupMessageHandling() {
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'setSchema':
                // Store schema for autocompletion
                weaviateSchema = message.schema;
                break;
                
            case 'queryResults':
                // Update UI with query results
                updateResults(message.results);
                break;
                
            case 'explainPlanResult':
                // Display explanation in the JSON tab
                document.querySelector('.tab[data-tab="json"]').click();
                const jsonTab = document.getElementById('json-tab');
                jsonTab.innerHTML = '<pre>' + JSON.stringify(message.explanation, null, 2) + '</pre>';
                break;
                
            case 'error':
                // Display error in the JSON tab
                document.querySelector('.tab[data-tab="json"]').click();
                const errorTab = document.getElementById('json-tab');
                errorTab.innerHTML = `<div class="error">${message.error}</div>`;
                break;
        }
    });
    
    // Notify extension that webview is ready
    vscode.postMessage({
        command: 'webviewReady'
    });
}

/**
 * Update results in the UI
 */
function updateResults(results) {
    // Update table view
    const tableTab = document.getElementById('table-tab');
    if (results && results.data) {
        // Create a table from the results
        tableTab.innerHTML = generateTableFromResults(results);
    } else {
        tableTab.innerHTML = '<p>No results found or invalid response format.</p>';
    }
    
    // Update JSON view
    const jsonTab = document.getElementById('json-tab');
    jsonTab.innerHTML = '<pre>' + JSON.stringify(results, null, 2) + '</pre>';
}

/**
 * Generate an HTML table from query results
 */
function generateTableFromResults(results) {
    // Extract data from results
    let data = [];
    let columns = new Set();
    
    try {
        // Handle Weaviate's response structure
        const getResults = results.data.Get;
        if (getResults) {
            // Weaviate returns results under class names
            Object.keys(getResults).forEach(className => {
                const items = getResults[className];
                items.forEach(item => {
                    // Add all properties to columns set
                    Object.keys(item).forEach(key => columns.add(key));
                    data.push({...item, _className: className});
                });
            });
        }
    } catch (e) {
        return '<p>Error parsing results: ' + e.message + '</p>';
    }
    
    if (data.length === 0) {
        return '<p>No results found.</p>';
    }
    
    // Always include _className first if present
    let columnsList = Array.from(columns);
    if (columns.has('_className')) {
        columnsList = ['_className', ...columnsList.filter(c => c !== '_className')];
    }
    
    // Generate table HTML
    let tableHTML = '<table class="results-table"><thead><tr>';
    
    // Generate headers
    columnsList.forEach(column => {
        tableHTML += `<th>${formatColumnName(column)}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    // Generate rows
    data.forEach(item => {
        tableHTML += '<tr>';
        columnsList.forEach(column => {
            const value = item[column];
            tableHTML += `<td>${formatCellValue(value)}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    return tableHTML;
}

/**
 * Format column name for display
 */
function formatColumnName(name) {
    if (name.startsWith('_')) {
        return name.substring(1);
    }
    return name;
}

/**
 * Format cell value for display
 */
function formatCellValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    if (typeof value === 'object') {
        return '<span class="object-value" title="' + JSON.stringify(value) + '">{...}</span>';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
        return '<span class="array-value" title="' + JSON.stringify(value) + '">[...]</span>';
    }
    return String(value);
}
