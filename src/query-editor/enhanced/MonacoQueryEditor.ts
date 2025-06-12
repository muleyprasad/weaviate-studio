import * as monaco from 'monaco-editor';
import { SchemaProvider, GraphQLSchema } from './schemaProvider';

// Use direct import for monaco-graphql
let monacoGraphQLAPI: any = null;
try {
  // Try to load the module dynamically to avoid import errors
  const monacoGraphQL = require('monaco-graphql');
  monacoGraphQLAPI = monacoGraphQL.initializeMode;
} catch (error) {
  console.error('Failed to load monaco-graphql:', error);
}

/**
 * Monaco-based GraphQL query editor with schema-aware features
 */
export class MonacoQueryEditor {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private container: HTMLElement;
  private schemaConfig: GraphQLSchema | null = null;
  private disposables: monaco.IDisposable[] = [];
  private monacoGraphQLAPI: any = null;

  /**
   * Create a new Monaco-based GraphQL query editor
   * @param container DOM element to mount the editor
   * @param initialValue Initial query text
   */
  constructor(container: HTMLElement, initialValue: string = '') {
    this.container = container;
    this.initializeEditor(initialValue);
  }

  /**
   * Initialize the Monaco editor with GraphQL support
   * @param initialValue Initial query text
   */
  private initializeEditor(initialValue: string): void {
    // Configure Monaco environment for web workers
    // This is crucial for GraphQL language features to work
    if (!window.MonacoEnvironment) {
      window.MonacoEnvironment = {
        getWorkerUrl: (moduleId, label) => {
          if (label === 'graphql') {
            return './graphql.worker.js';
          }
          return './editor.worker.js';
        }
      };
    }

    // Create Monaco editor instance
    this.editor = monaco.editor.create(this.container, {
      value: initialValue,
      language: 'graphql',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: {
        enabled: false
      },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      // Enable useful editor features
      formatOnPaste: true,
      formatOnType: true,
      suggestOnTriggerCharacters: true,
      wordWrap: 'on',
      wrappingIndent: 'same',
      // Enhance the editor's appearance
      renderLineHighlight: 'all',
      scrollbar: {
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12
      }
    });

    // Add keyboard shortcuts for common operations
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      if (this.editor) {
        this.editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
      }
    });

    // Format document shortcut
    this.editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      if (this.editor) {
        this.editor.getAction('editor.action.formatDocument')?.run();
      }
    });
  }

  /**
   * Configure GraphQL language support with schema
   * @param schemaConfig GraphQL schema configuration
   */
  public async configureGraphQLLanguage(schemaConfig: GraphQLSchema): Promise<void> {
    if (!this.editor) {
      console.error('Editor not initialized');
      return;
    }

    try {
      this.schemaConfig = schemaConfig;

      // Clean up previous disposables
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];

      // Initialize Monaco GraphQL mode with schema
      if (monacoGraphQLAPI) {
        this.monacoGraphQLAPI = monacoGraphQLAPI({
          schemas: [
            {
              uri: schemaConfig.uri,
              fileMatch: schemaConfig.fileMatch || ['*.graphql', '*.gql'],
              schema: schemaConfig.introspectionJSON
            }
          ]
        });
      } else {
        console.warn('Monaco GraphQL API not available, language features will be limited');
      }

      // Register the schema with Monaco
      const modelUri = monaco.Uri.parse('inmemory://weaviate-graphql.graphql');
      const model = monaco.editor.getModel(modelUri) || 
                    monaco.editor.createModel('', 'graphql', modelUri);
      
      this.editor.setModel(model);

      console.log('GraphQL language features configured with schema');
    } catch (error) {
      console.error('Error configuring GraphQL language support:', error);
    }
  }

  /**
   * Get the current query text from the editor
   * @returns Current query text
   */
  public getValue(): string {
    return this.editor?.getValue() || '';
  }

  /**
   * Set the query text in the editor
   * @param value Query text to set
   */
  public setValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value);
    }
  }

  /**
   * Format the current query
   */
  public formatQuery(): void {
    if (this.editor) {
      const formatAction = this.editor.getAction('editor.action.formatDocument');
      if (formatAction) {
        formatAction.run();
      }
    }
  }

  /**
   * Insert text at the current cursor position
   * @param template Text to insert at cursor
   */
  public insertTextAtCursor(template: string): void {
    if (this.editor) {
      const position = this.editor.getPosition();
      if (position) {
        this.editor.executeEdits('quick-insert', [{
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: template,
          forceMoveMarkers: true
        }]);
        this.editor.focus();
      }
    }
  }

  /**
   * @deprecated Use insertTextAtCursor with React components instead
   * Add a quick-insert button to insert a template at the cursor position
   * @param label Button label
   * @param template Template text to insert
   * @param description Optional tooltip description
   * @returns DOM element for the button
   */
  public createQuickInsertButton(
    label: string,
    template: string,
    description?: string
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.title = description || label;
    button.className = 'quick-insert-button';
    
    button.addEventListener('click', () => {
      this.insertTextAtCursor(template);
    });
    
    // Apply styling
    button.style.backgroundColor = '#3c3c3c';
    button.style.color = '#cccccc';
    button.style.border = '1px solid #555';
    button.style.borderRadius = '4px';
    button.style.padding = '4px 8px';
    button.style.marginRight = '8px';
    button.style.cursor = 'pointer';
    
    return button;
  }

  /**
   * Dispose the editor and clean up resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }
}
