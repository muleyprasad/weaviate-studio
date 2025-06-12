import * as monaco from 'monaco-editor';
import { SchemaProvider, GraphQLSchema } from './schemaProvider';
import { queryTemplates, processTemplate } from './queryTemplates';
import { formatGraphQLQuery } from '../../webview/formatGraphQL';

// Import monaco-graphql inline mode (runs without web-workers)
import { initializeMode as initGraphQLMode } from 'monaco-graphql/esm/initializeMode';

let monacoGraphQLAPI: any = initGraphQLMode;

/**
 * Interface for template selector options
 */
export interface TemplateOption {
  element: HTMLElement;
  template: string;
  name: string;
  description: string;
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
  private templateSelectorContainer: HTMLElement | null = null;
  private templateOptions: TemplateOption[] = [];
  private currentCollectionName: string = 'Article';
  
  // Event callbacks
  private changeListeners: Array<(value: string) => void> = [];
  
  /**
   * Notify all change listeners with the new value
   * @param value The new editor value
   */
  private notifyChangeListeners(value: string): void {
    this.changeListeners.forEach(listener => listener(value));
  }

  /**
   * Create a new Monaco-based GraphQL query editor
   * @param container DOM element to mount the editor
   * @param initialValue Initial query text
   */
  constructor(container: HTMLElement, initialValue: string = '') {
    this.container = container;
    this.initializeEditor();
    this.createTemplateSelector();
  }

  /**
   * Initialize the Monaco editor with GraphQL language support
   */
  private initializeEditor() {
    if (!this.container) {
      console.error('Cannot initialize editor: container is null');
      return;
    }

    // Create Monaco editor instance
    this.editor = monaco.editor.create(this.container, {
      value: '',
      language: 'graphql',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      // Additional editor options
      renderLineHighlight: 'all',
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });
    
    // Set up change event listener
    if (this.editor) {
      this.disposables.push(
        this.editor.onDidChangeModelContent(() => {
          const value = this.editor?.getValue() || '';
          this.notifyChangeListeners(value);
        })
      );
    }

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

      // Register the schema with Monaco
      const modelUri = monaco.Uri.parse('inmemory://weaviate-graphql.graphql');
      const model = monaco.editor.getModel(modelUri) || 
                    monaco.editor.createModel('', 'graphql', modelUri);
      
      // Set the model before configuring GraphQL language support
      this.editor.setModel(model);
      
      // Initialize Monaco GraphQL mode with schema
      if (monacoGraphQLAPI) {
        console.log('Initializing Monaco GraphQL API with schema', schemaConfig.uri);
        
        // Ensure schema is valid before initializing
        if (!schemaConfig.introspectionJSON) {
          console.error('Schema introspection JSON is missing');
          return;
        }
        
        this.monacoGraphQLAPI = monacoGraphQLAPI({
          schemas: [
            {
              uri: schemaConfig.uri,
              fileMatch: ['*.graphql', '*.gql', modelUri.toString()],
              schema: schemaConfig.introspectionJSON
            }
          ],
          // run language service on UI thread
          worker: false
        });
        
        // Force language features to initialize
        monaco.editor.setModelLanguage(model, 'graphql');
        
        // Log success for debugging
        console.log('Monaco GraphQL language features initialized');
      } else {
        console.warn('Monaco GraphQL API not available, language features will be limited');
      }

      console.log('GraphQL language features configured with schema');
    } catch (error) {
      console.error('Error configuring GraphQL language support:', error);
    }
  }

  /**
   * Create template selector UI
   */
  private createTemplateSelector(): void {
    // Create container for template selector
    this.templateSelectorContainer = document.createElement('div');
    this.templateSelectorContainer.className = 'template-selector';
    this.templateSelectorContainer.style.cssText = 
      'margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px;';
    
    // Insert before the Monaco editor container
    if (this.container.parentNode) {
      this.container.parentNode.insertBefore(this.templateSelectorContainer, this.container);
    }
    
    // Add template options
    this.populateTemplateOptions();
  }

  /**
   * Populate template options from queryTemplates
   */
  private populateTemplateOptions(): void {
    if (!this.templateSelectorContainer) { return; }
    
    // Clear existing options
    this.templateSelectorContainer.innerHTML = '';
    this.templateOptions = [];

    // Add label
    const label = document.createElement('span');
    label.textContent = 'Templates: ';
    label.style.cssText = 'font-weight: bold; margin-right: 8px; align-self: center;';
    
    if (this.templateSelectorContainer) {
      this.templateSelectorContainer.appendChild(label);
    }
    
    // Add each template as a button
    queryTemplates.forEach(template => {
      const button = document.createElement('button');
      button.textContent = template.name;
      button.title = template.description;
      button.className = 'template-button';
      button.style.cssText = 
        'background-color: #2d2d30; color: #cccccc; border: 1px solid #3c3c3c; ' +
        'border-radius: 3px; padding: 4px 8px; cursor: pointer; font-size: 12px;';
      
      // Add hover effect
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#3e3e42';
      });
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#2d2d30';
      });
      
      // Add click handler to insert template
      button.addEventListener('click', () => {
        this.insertTemplate(template.name);
      });
      
      if (this.templateSelectorContainer) {
        this.templateSelectorContainer.appendChild(button);
      }
      
      // Store reference to option
      this.templateOptions.push({
        element: button,
        template: template.template,
        name: template.name,
        description: template.description
      });
    });
  }

  /**
   * Insert template into editor
   * @param templateName Name of the template to insert
   */
  public insertTemplate(templateName: string): void {
    if (!this.editor) { return; }
    
    // Find the template
    const templateOption = this.templateOptions.find(option => option.name === templateName);
    if (!templateOption) { return; }
    
    // Process the template with current collection name
    const processedTemplate = processTemplate(templateName, this.currentCollectionName);
    
    // Replace editor content with template
    // Editor won't be null here due to the early return check above
    this.editor?.setValue(processedTemplate);
    
    // Focus the editor
    this.editor?.focus();
  }

  /**
   * Set the current collection name for templates
   * @param collectionName Collection name to use in templates
   */
  public setCollectionName(collectionName: string): void {
    this.currentCollectionName = collectionName;
  }
  
  /**
   * Check and validate query parameters
   * Provides warnings for large limits and validates certainty values
   */
  public validateQueryParameters(): void {
    if (!this.editor) { return; }
    
    const model = this.editor.getModel();
    if (!model) { return; }
    
    const value = model.getValue();
    
    // Clear existing markers
    monaco.editor.setModelMarkers(model, 'query-validator', []);
    
    const markers: monaco.editor.IMarkerData[] = [];
    
    // Check for high limit values (>100)
    const limitRegex = /limit:\s*(\d+)/gi;
    let match: RegExpExecArray | null;
    
    while ((match = limitRegex.exec(value)) !== null) {
      const limit = parseInt(match[1], 10);
      if (limit > 100) {
        const startLineNumber = model.getPositionAt(match.index).lineNumber;
        const startColumn = model.getPositionAt(match.index).column;
        const endLineNumber = model.getPositionAt(match.index + match[0].length).lineNumber;
        const endColumn = model.getPositionAt(match.index + match[0].length).column;
        
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `High limit value (${limit}). Consider reducing for better performance.`,
          startLineNumber,
          startColumn,
          endLineNumber,
          endColumn
        });
      }
    }
    
    // Check for invalid certainty values (outside 0-1)
    const certaintyRegex = /certainty:\s*([0-9]*\.?[0-9]+)/gi;
    
    while ((match = certaintyRegex.exec(value)) !== null) {
      const certainty = parseFloat(match[1]);
      if (certainty < 0 || certainty > 1) {
        const startLineNumber = model.getPositionAt(match.index).lineNumber;
        const startColumn = model.getPositionAt(match.index).column;
        const endLineNumber = model.getPositionAt(match.index + match[0].length).lineNumber;
        const endColumn = model.getPositionAt(match.index + match[0].length).column;
        
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Invalid certainty value (${certainty}). Must be between 0 and 1.`,
          startLineNumber,
          startColumn,
          endLineNumber,
          endColumn
        });
      }
    }
    
    // Set markers on the model
    monaco.editor.setModelMarkers(model, 'query-validator', markers);
  }

  /**
   * Get the current query text from the editor
   * @returns The current query text as a string
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
   * Format the current query using Prettier
   */
  public async formatQuery(): Promise<void> {
    if (this.editor) {
      try {
        const currentValue = this.editor.getValue();
        const formattedValue = await formatGraphQLQuery(currentValue);
        
        // Only update if formatting actually changed something
        if (formattedValue !== currentValue) {
          // Replace the entire content with the formatted query
          this.editor.executeEdits('format', [{
            range: this.editor.getModel()!.getFullModelRange(),
            text: formattedValue,
            forceMoveMarkers: true
          }]);
          
          // Check if formatting introduced any issues
          this.validateQueryParameters();
        }
      } catch (error) {
        console.error('Error formatting GraphQL query:', error);
        
        // Fall back to Monaco's built-in formatter if our custom formatter fails
        const formatAction = this.editor.getAction('editor.action.formatDocument');
        if (formatAction) {
          formatAction.run();
        }
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
   * Register a listener for editor content changes
   * @param listener Function to call when content changes
   * @returns A function to remove the listener
   */
  public onDidChangeModelContent(listener: (value: string) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get the Monaco editor instance
   * @returns The Monaco editor instance or null if not initialized
   */
  public getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  /**
   * Dispose the editor and clean up resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.changeListeners = [];
    
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }
}
