import * as monaco from 'monaco-editor';
// Register GraphQL language features (completion, hover, diagnostics)
// via monaco-graphql when the language is activated
import 'monaco-graphql/esm/monaco.contribution.js';
import { SchemaProvider, GraphQLSchema } from './GraphQLSchemaProvider';
import { queryTemplates, processTemplate } from './graphqlTemplates';
import { formatGraphQLQuery } from '../../webview/formatGraphQL';

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
 * Enhanced Monaco editor for GraphQL with Weaviate-specific features
 */
export class GraphQLEditor {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private model: monaco.editor.ITextModel | null = null;
  private container: HTMLElement;
  private schemaConfig: GraphQLSchema | null = null;
  private disposables: monaco.IDisposable[] = [];
  private currentCollectionName: string = 'Article';
  private schemaConfigRetryHandle: number | null = null;
  private schemaConfigRetryCount: number = 0;
  private readonly MAX_SCHEMA_CONFIG_RETRIES = 10;

  // Event listener management
  private changeListeners: Array<(value: string) => void> = [];

  /**
   * Notify all change listeners when content changes
   */
  private notifyChangeListeners(value: string): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(value);
      } catch (error) {
        console.error('Error in change listener:', error);
      }
    });
  }

  constructor(container: HTMLElement, initialValue: string = '') {
    this.container = container;
    this.initializeEditor();

    if (initialValue) {
      this.setValue(initialValue);
    }
  }

  private initializeEditor() {
    // Determine VS Code theme with better detection
    const getVSCodeTheme = (): string => {
      try {
        // Check for VS Code theme classes on body or html
        const body = document.body;
        const html = document.documentElement;

        if (body.classList.contains('vscode-dark') || html.classList.contains('vscode-dark')) {
          return 'vs-dark';
        } else if (
          body.classList.contains('vscode-light') ||
          html.classList.contains('vscode-light')
        ) {
          return 'vs';
        } else if (
          body.classList.contains('vscode-high-contrast') ||
          html.classList.contains('vscode-high-contrast')
        ) {
          return 'hc-black';
        }

        // Check CSS variables with more comprehensive detection
        const styles = getComputedStyle(document.body);
        const bgColor =
          styles.getPropertyValue('--vscode-editor-background') ||
          styles.getPropertyValue('--vscode-panel-background') ||
          styles.backgroundColor;

        console.log('Monaco theme detection - background color:', bgColor);

        // Enhanced background color analysis
        if (bgColor) {
          // Handle hex colors
          if (bgColor.startsWith('#')) {
            const hex = bgColor.slice(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            const brightness = (r + g + b) / 3;
            return brightness < 128 ? 'vs-dark' : 'vs';
          }

          // Handle RGB colors
          if (bgColor.includes('rgb')) {
            const rgb = bgColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
              const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
              console.log('Monaco theme detection - brightness:', brightness);
              return brightness < 128 ? 'vs-dark' : 'vs';
            }
          }

          // Handle color keywords
          const darkColors = ['black', 'darkgray', 'darkgrey', 'dimgray', 'dimgrey'];
          const lightColors = ['white', 'lightgray', 'lightgrey', 'silver', 'gainsboro'];

          if (darkColors.some((color) => bgColor.toLowerCase().includes(color))) {
            return 'vs-dark';
          }
          if (lightColors.some((color) => bgColor.toLowerCase().includes(color))) {
            return 'vs';
          }
        }

        // Check media query for dark theme preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'vs-dark';
        }

        console.log('Monaco theme detection - defaulting to vs-dark');
        // Default to dark theme for VS Code
        return 'vs-dark';
      } catch (error) {
        console.error('Error detecting VS Code theme:', error);
        return 'vs-dark';
      }
    };

    // Create a GraphQL model with a stable URI so schema fileMatch can target it
    try {
      const modelUri = monaco.Uri.parse('weaviate://graphql/operation.graphql');
      this.model = monaco.editor.createModel('', 'graphql', modelUri);
    } catch (err) {
      console.error('Failed to create Monaco model for GraphQL:', err);
    }

    // Create Monaco editor with enhanced options and attach our model
    this.editor = monaco.editor.create(this.container, {
      value: '',
      // language is implied by the model; keep options for safety
      language: 'graphql',
      theme: getVSCodeTheme(),
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'line',
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      cursorStyle: 'line',
      fontSize: 14,
      fontFamily:
        'var(--vscode-editor-font-family, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace)',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      trimAutoWhitespace: true,
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: 'smart',
      accessibilitySupport: 'auto',
      autoIndent: 'full',
      contextmenu: true,
      dragAndDrop: true,
      links: true,
      mouseWheelZoom: false,
      multiCursorMergeOverlapping: true,
      multiCursorModifier: 'alt',
      overviewRulerBorder: true,
      overviewRulerLanes: 2,
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true,
      },
      quickSuggestionsDelay: 50,
      parameterHints: {
        enabled: true,
        cycle: true,
      },
      suggestOnTriggerCharacters: true,
      tabCompletion: 'off',
      wordBasedSuggestions: 'off',
      formatOnPaste: true,
      formatOnType: false,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoSurround: 'languageDefined',
      colorDecorators: true,
      comments: {
        insertSpace: true,
        ignoreEmptyLines: true,
      },
      copyWithSyntaxHighlighting: true,
      emptySelectionClipboard: true,
      find: {
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'always',
      },
      gotoLocation: {
        alternativeDefinitionCommand: 'editor.action.goToReferences',
        alternativeTypeDefinitionCommand: 'editor.action.goToReferences',
        alternativeDeclarationCommand: 'editor.action.goToReferences',
        alternativeImplementationCommand: 'editor.action.goToReferences',
        alternativeReferenceCommand: 'editor.action.goToReferences',
      },
      hover: {
        enabled: true,
        delay: 300,
        sticky: true,
      },
      matchBrackets: 'always',
      occurrencesHighlight: 'singleFile',
      renderControlCharacters: false,
      renderFinalNewline: 'on',
      renderWhitespace: 'none',
      rulers: [],
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        arrowSize: 11,
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        horizontalScrollbarSize: 12,
        verticalScrollbarSize: 12,
        verticalSliderSize: 12,
        horizontalSliderSize: 12,
      },
      smoothScrolling: true,
      snippetSuggestions: 'inline',
      suggest: {
        filterGraceful: true,
        insertMode: 'insert',
        localityBonus: true,
        selectionMode: 'always',
        shareSuggestSelections: true,
        showIcons: true,
        showStatusBar: true,
        // Show ghost-text preview of the currently selected suggestion
        preview: true,
        previewMode: 'subwordSmart',
        snippetsPreventQuickSuggestions: true,
      },
      unfoldOnClickAfterEndOfLine: false,
      useShadowDOM: false,
      model: this.model ?? undefined,
    });

    // Ensure Enter behaves naturally: accept when suggest is open, otherwise newline
    if (this.editor) {
      // Accept selected suggestion on Enter and hide the widget to prevent it from lingering
      this.editor.addCommand(
        monaco.KeyCode.Enter,
        () => {
          this.editor?.trigger('keyboard', 'acceptSelectedSuggestion', undefined);
          setTimeout(() => this.editor?.trigger('keyboard', 'hideSuggestWidget', undefined), 0);
        },
        'editorTextFocus && suggestWidgetVisible && !inSnippetMode'
      );

      this.editor.addCommand(
        monaco.KeyCode.Enter,
        () => {
          // Close the suggestion widget if open, then insert a newline
          // Using 'type' preserves Monaco's indentation logic and caret movement
          this.editor?.trigger('keyboard', 'hideSuggestWidget', undefined);
          this.editor?.trigger('keyboard', 'type', { text: '\n' });
        },
        'editorTextFocus && !inSnippetMode && !suggestWidgetVisible'
      );
      // Let Monaco handle TAB acceptance normally so providers can retrigger
      // No explicit removal API for commands; cleaned up on editor.dispose()
    }

    // Register change event listener
    if (this.editor) {
      const changeDisposable = this.editor.onDidChangeModelContent(() => {
        if (this.editor) {
          const value = this.editor.getValue();
          this.notifyChangeListeners(value);
        }
      });
      this.disposables.push(changeDisposable);
    }

    // Listen for theme changes
    this.setupThemeListener(getVSCodeTheme);

    console.log('Monaco GraphQL editor initialized');
  }

  /**
   * Setup theme change listener to automatically update Monaco theme
   */
  private setupThemeListener(getVSCodeTheme: () => string): void {
    try {
      // Watch for changes to VS Code theme classes
      const observer = new MutationObserver((mutations) => {
        let themeChanged = false;
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            (mutation.attributeName === 'class' ||
              mutation.attributeName === 'data-vscode-theme-kind')
          ) {
            themeChanged = true;
          }
        });

        if (themeChanged && this.editor) {
          const newTheme = getVSCodeTheme();
          console.log('VS Code theme changed, updating Monaco theme to:', newTheme);
          monaco.editor.setTheme(newTheme);
        }
      });

      // Observe changes to body and html classes
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-vscode-theme-kind'],
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-vscode-theme-kind'],
      });

      // Also listen for media query changes
      if (window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const themeChangeHandler = () => {
          if (this.editor) {
            const newTheme = getVSCodeTheme();
            console.log('System theme changed, updating Monaco theme to:', newTheme);
            monaco.editor.setTheme(newTheme);
          }
        };

        // Modern browsers
        if (darkModeQuery.addEventListener) {
          darkModeQuery.addEventListener('change', themeChangeHandler);
        } else {
          // Fallback for older browsers
          darkModeQuery.addListener(themeChangeHandler);
        }
      }

      // Store observer for cleanup
      this.disposables.push({
        dispose: () => {
          observer.disconnect();
        },
      });
    } catch (error) {
      console.error('Error setting up theme listener:', error);
    }
  }

  /**
   * Configure GraphQL language support with schema.
   *
   * RETRY LOGIC RATIONALE:
   * The monaco-graphql language service requires initialization that happens asynchronously.
   * When configureGraphQLLanguage is called shortly after editor creation, the GraphQL API
   * may not be ready yet. Rather than failing silently, we implement bounded retries to:
   *
   * 1. Wait for the GraphQL language service to initialize (max 10 attempts, 100ms apart)
   * 2. Provide clear progress logging for debugging connection issues
   * 3. Fail gracefully with a clear error message after max retries
   * 4. Ensure users still get a functional editor even if language features are unavailable
   *
   * This prevents browser hangs (bounded by MAX_SCHEMA_CONFIG_RETRIES) while maximizing
   * the chance that schema-aware features (autocomplete, diagnostics) become available.
   */
  public async configureGraphQLLanguage(schemaConfig: GraphQLSchema): Promise<void> {
    this.schemaConfig = schemaConfig;
    try {
      const api = (monaco.languages as any).graphql?.api;
      if (!api || typeof api.setSchemaConfig !== 'function') {
        // Retry limit check: prevent infinite retry loops
        if (this.schemaConfigRetryCount >= this.MAX_SCHEMA_CONFIG_RETRIES) {
          console.error(
            `Failed to configure GraphQL language service after ${this.MAX_SCHEMA_CONFIG_RETRIES} retries. Schema features may not work correctly.`
          );
          return;
        }

        if (this.schemaConfigRetryHandle) {
          window.clearTimeout(this.schemaConfigRetryHandle);
        }

        this.schemaConfigRetryCount++;
        console.warn(
          `GraphQL language service not ready; retrying schema configuration (attempt ${this.schemaConfigRetryCount}/${this.MAX_SCHEMA_CONFIG_RETRIES})...`
        );

        // Wait 100ms before retrying to give the language service time to initialize
        this.schemaConfigRetryHandle = window.setTimeout(() => {
          this.schemaConfigRetryHandle = null;
          if (this.schemaConfig) {
            this.configureGraphQLLanguage(this.schemaConfig);
          }
        }, 100);
        return;
      }

      // Language service ready: reset retry counter for future attempts
      this.schemaConfigRetryCount = 0;

      if (schemaConfig?.introspectionJSON) {
        // Associate the schema to the model via fileMatch and uri
        const uri = schemaConfig.uri || 'weaviate://graphql';
        const modelUri = this.model?.uri?.toString();
        const fileMatch = schemaConfig.fileMatch || [modelUri || '*', '**/*.graphql', '**/*.gql'];
        api.setSchemaConfig([
          {
            uri,
            fileMatch,
            introspectionJSON: schemaConfig.introspectionJSON,
          },
        ]);

        // Avoid multi-line placeholder selection and sticky suggest by not auto-filling leaf fields
        if (api.setCompletionSettings) {
          api.setCompletionSettings({ __experimental__fillLeafsOnComplete: false });
        }
      }
      console.log('GraphQL language features configured with schema');
    } catch (error) {
      console.error('Error configuring monaco-graphql:', error);
    }
  }

  /**
   * Insert template into editor
   * @param templateName Name of the template to insert
   */
  public insertTemplate(templateName: string): void {
    if (!this.editor) {
      return;
    }

    // Process the template with current collection name and schema information
    // Pass the schema config to enable proper relationship field handling
    const weaviateSchema = (this.schemaConfig?.schema as { classes?: any[] }) || undefined;

    const processedTemplate = processTemplate(
      templateName,
      this.currentCollectionName,
      10, // Use default limit
      weaviateSchema // Pass Weaviate schema to handle relationship fields
    );

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
    if (!this.editor) {
      return;
    }

    const model = this.editor.getModel();
    if (!model) {
      return;
    }

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
          endColumn,
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
          endColumn,
        });
      }
    }

    // Soft warn for distance thresholds (metric-dependent)
    const distanceRegex = /distance:\s*([0-9]*\.?[0-9]+)/gi;
    while ((match = distanceRegex.exec(value)) !== null) {
      const distance = parseFloat(match[1]);
      const startLineNumber = model.getPositionAt(match.index).lineNumber;
      const startColumn = model.getPositionAt(match.index).column;
      const endLineNumber = model.getPositionAt(match.index + match[0].length).lineNumber;
      const endColumn = model.getPositionAt(match.index + match[0].length).column;

      // Do not hard error; ranges depend on the distance metric (cosine, dot, euclidean).
      // Warn on obviously invalid negatives and unusually high thresholds.
      if (distance < 0 || distance > 10) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message:
            'Distance thresholds are metric-dependent (e.g., cosine typically ~0-2). Lower values are stricter. Verify the metric and tune accordingly.',
          startLineNumber,
          startColumn,
          endLineNumber,
          endColumn,
        });
      }
    }

    // Set markers on the model
    monaco.editor.setModelMarkers(model, 'query-validator', markers);
  }

  /**
   * Get the current query text from the editor
   */
  public getValue(): string {
    if (!this.editor) {
      return '';
    }
    return this.editor.getValue();
  }

  /**
   * Set the query text in the editor
   */
  public setValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value);
    }
  }

  /**
   * Format the current GraphQL query
   */
  public async formatQuery(): Promise<void> {
    if (!this.editor) {
      return;
    }

    try {
      const currentValue = this.editor.getValue();
      const formatted = await formatGraphQLQuery(currentValue);

      if (formatted && formatted !== currentValue) {
        // Get current selection and cursor position
        const selection = this.editor.getSelection();
        const position = this.editor.getPosition();

        // Update the value
        this.editor.setValue(formatted);

        // Try to restore cursor position
        if (position) {
          this.editor.setPosition(position);
        } else if (selection) {
          this.editor.setSelection(selection);
        }

        console.log('Query formatted successfully');
      }
    } catch (error) {
      console.error('Error formatting query:', error);
      // Don't throw - just log the error so the editor continues to work
    }
  }

  /**
   * Insert text at the current cursor position
   * @param text Text to insert
   */
  public insertTextAtCursor(template: string): void {
    if (!this.editor) {
      return;
    }

    const selection = this.editor.getSelection();
    const range = selection || new monaco.Range(1, 1, 1, 1);

    this.editor.executeEdits('insert-template', [
      {
        range: range,
        text: template,
        forceMoveMarkers: true,
      },
    ]);

    // Focus the editor
    this.editor.focus();
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

    // Apply theme-aware styling
    button.style.backgroundColor = 'var(--vscode-button-secondaryBackground, #3c3c3c)';
    button.style.color = 'var(--vscode-button-secondaryForeground, #cccccc)';
    button.style.border = '1px solid var(--vscode-widget-border, #555)';
    button.style.borderRadius = '4px';
    button.style.padding = '4px 8px';
    button.style.marginRight = '8px';
    button.style.cursor = 'pointer';

    return button;
  }

  /**
   * Register a listener for content changes
   */
  public onDidChangeModelContent(listener: (value: string) => void): () => void {
    this.changeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Manually update the Monaco editor theme to match VS Code
   */
  public updateTheme(): void {
    if (!this.editor) {
      return;
    }

    try {
      // Determine current VS Code theme
      const getVSCodeTheme = (): string => {
        const body = document.body;
        const html = document.documentElement;

        if (body.classList.contains('vscode-dark') || html.classList.contains('vscode-dark')) {
          return 'vs-dark';
        } else if (
          body.classList.contains('vscode-light') ||
          html.classList.contains('vscode-light')
        ) {
          return 'vs';
        } else if (
          body.classList.contains('vscode-high-contrast') ||
          html.classList.contains('vscode-high-contrast')
        ) {
          return 'hc-black';
        }

        // Check CSS variables
        const styles = getComputedStyle(document.body);
        const bgColor =
          styles.getPropertyValue('--vscode-editor-background') ||
          styles.getPropertyValue('--vscode-panel-background') ||
          styles.backgroundColor;

        if (bgColor && bgColor.includes('rgb')) {
          const rgb = bgColor.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
            return brightness < 128 ? 'vs-dark' : 'vs';
          }
        }

        return 'vs-dark'; // Default to dark
      };

      const newTheme = getVSCodeTheme();
      console.log('Updating Monaco theme to:', newTheme);
      monaco.editor.setTheme(newTheme);
    } catch (error) {
      console.error('Error updating Monaco theme:', error);
    }
  }

  /**
   * Get the underlying Monaco editor instance
   */
  public getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];

    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }

    this.changeListeners = [];
  }
}
