/**
 * Weaviate Language Support for Monaco Editor
 * Provides autocompletion and language features for GraphQL + Weaviate
 */

/**
 * Default Weaviate schema structure
 */
const DEFAULT_WEAVIATE_TYPES = [
  { name: 'Get', kind: 'OBJECT' },
  { name: 'Aggregate', kind: 'OBJECT' },
  { name: 'Explore', kind: 'OBJECT' },
  { name: 'Things', kind: 'OBJECT' },
];

const DEFAULT_WEAVIATE_FIELDS = [
  { name: 'certainty', type: 'Float', args: [] },
  { name: 'limit', type: 'Int', args: [] },
  { name: 'offset', type: 'Int', args: [] },
  { name: 'where', type: 'WhereFilter', args: [] },
  { name: 'nearText', type: 'NearTextFilter', args: [] },
  { name: 'nearVector', type: 'NearVectorFilter', args: [] },
  { name: 'nearObject', type: 'NearObjectFilter', args: [] },
  { name: 'id', type: 'ID', args: [] },
  { name: '_additional', type: 'AdditionalProperties', args: [] },
];

const DEFAULT_WEAVIATE_DIRECTIVES = [
  { name: '@bounds', args: [{ name: 'min', type: 'Float' }, { name: 'max', type: 'Float' }] },
];

/**
 * Generate completion items based on document position and context
 */
export function provideCompletionItems(model, position, schema) {
  const document = model.getValue();
  const wordUntilPosition = getWordUntilPosition(document, position);
  const offset = model.getOffsetAt(position);
  const context = getCompletionContext(document, offset);

  // If we have a schema, use it for context-aware completions
  const weaviateSchema = schema || { types: DEFAULT_WEAVIATE_TYPES };

  const result = {
    suggestions: []
  };

  // Add basic GraphQL keywords
  if (context.isRoot) {
    result.suggestions.push(...createGraphQLRootKeywords());
  }

  // Add Weaviate-specific completions based on context
  if (context.inQuery) {
    // Add Weaviate operations (Get, Aggregate, etc.)
    if (context.afterOpenBrace && !context.afterField) {
      result.suggestions.push(...createWeaviateOperations(weaviateSchema));
    }
    
    // Add classes/collections after a Weaviate operation
    else if (context.afterField && isWeaviateOperation(context.lastField)) {
      result.suggestions.push(...createWeaviateClasses(weaviateSchema));
    }
    
    // Add properties after a class
    else if (context.afterField && context.path.length > 1) {
      result.suggestions.push(...createWeaviateProperties(weaviateSchema, context.path));
    }
    
    // Add common field arguments
    else if (context.inParentheses) {
      result.suggestions.push(...createWeaviateArguments());
    }
  }

  // Filter suggestions by the current word
  if (wordUntilPosition && wordUntilPosition.word) {
    const word = wordUntilPosition.word.toLowerCase();
    result.suggestions = result.suggestions.filter(item => 
      item.label.toLowerCase().startsWith(word)
    );
  }

  return { suggestions: result.suggestions };
}

/**
 * Get the word at the current position
 */
function getWordUntilPosition(text, position) {
  const lines = text.split('\n');
  if (position.lineNumber > lines.length) {
    return { word: '', startColumn: position.column };
  }
  
  const line = lines[position.lineNumber - 1];
  
  // Find the start of the current word
  let startColumn = position.column;
  while (startColumn > 1) {
    const char = line[startColumn - 2]; // -2 because column is 1-based and arrays are 0-based
    if (!/[a-zA-Z0-9_]/.test(char)) {
      break;
    }
    startColumn--;
  }
  
  const word = line.substring(startColumn - 1, position.column - 1);
  return { word, startColumn };
}

/**
 * Analyze the document to determine the context for autocompletion
 */
function getCompletionContext(document, offset) {
  const text = document.substring(0, offset);
  const lines = text.split('\n');
  
  // Basic context information
  const context = {
    isRoot: true,
    inQuery: false,
    afterOpenBrace: false,
    afterField: false,
    inParentheses: false,
    lastField: '',
    path: []
  };
  
  // Check if we're in a query block
  const queryMatch = text.match(/{/g);
  if (queryMatch) {
    context.inQuery = true;
    context.isRoot = false;
    
    // Count braces to determine current depth
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      // Check if we're right after an opening brace
      if (text.trim().endsWith('{')) {
        context.afterOpenBrace = true;
      }
      
      // Check if we're after a field name
      const fieldMatch = text.match(/\s*([A-Za-z0-9_]+)\s*{?\s*$/);
      if (fieldMatch) {
        context.afterField = true;
        context.lastField = fieldMatch[1];
      }
      
      // Check if we're in parentheses (arguments)
      const lastOpenParen = text.lastIndexOf('(');
      const lastCloseParen = text.lastIndexOf(')');
      if (lastOpenParen > lastCloseParen) {
        context.inParentheses = true;
      }
      
      // Build the current path by analyzing the structure
      const matches = text.match(/[A-Za-z0-9_]+\s*{/g);
      if (matches) {
        context.path = matches.map(m => m.replace(/\s*{/g, ''));
      }
    }
  }
  
  return context;
}

/**
 * Create completions for GraphQL root keywords
 */
function createGraphQLRootKeywords() {
  return [
    {
      label: 'query',
      kind: 9, // Monaco.languages.CompletionItemKind.Keyword
      detail: 'GraphQL Query Operation',
      insertText: 'query {\n  $0\n}',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Define a GraphQL query operation'
    },
    {
      label: '{',
      kind: 9, // Monaco.languages.CompletionItemKind.Keyword
      detail: 'GraphQL Query shorthand',
      insertText: '{\n  $0\n}',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Start a GraphQL query block'
    }
  ];
}

/**
 * Create completions for Weaviate operations
 */
function createWeaviateOperations(schema) {
  const operations = schema.types || DEFAULT_WEAVIATE_TYPES;
  
  return operations.map(type => ({
    label: type.name,
    kind: 9, // Monaco.languages.CompletionItemKind.Keyword
    detail: `Weaviate ${type.name} Operation`,
    insertText: `${type.name} {\n  $0\n}`,
    insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
    documentation: `Execute a Weaviate ${type.name} operation`
  }));
}

/**
 * Create completions for Weaviate classes
 */
function createWeaviateClasses(schema) {
  // If schema includes classes, use them; otherwise use default
  const classes = schema.classes || [{ class: 'Things' }];
  
  return classes.map(cls => ({
    label: cls.class || cls.name,
    kind: 7, // Monaco.languages.CompletionItemKind.Class
    detail: 'Weaviate Class',
    insertText: `${cls.class || cls.name} {\n  $0\n}`,
    insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
    documentation: `Query the ${cls.class || cls.name} class`
  }));
}

/**
 * Create completions for Weaviate properties
 */
function createWeaviateProperties(schema, path) {
  // Try to find the current class in the schema
  let className = null;
  if (path.length >= 2) {
    // The class name is usually the second item in the path after the operation (Get/Aggregate)
    className = path[1];
  }
  
  let properties = DEFAULT_WEAVIATE_FIELDS;
  
  // If we have schema and a class name, try to get properties from schema
  if (schema && schema.classes && className) {
    const classSchema = schema.classes.find(c => (c.class || c.name) === className);
    if (classSchema && classSchema.properties) {
      properties = classSchema.properties.map(prop => ({
        name: prop.name,
        type: prop.dataType || 'String',
        args: []
      }));
      
      // Always include default fields like _additional
      properties = [...properties, ...DEFAULT_WEAVIATE_FIELDS];
    }
  }
  
  return properties.map(prop => {
    let insertText = prop.name;
    
    // If it's an object type that needs expansion, add braces
    if (['Object', 'AdditionalProperties'].includes(prop.type)) {
      insertText = `${prop.name} {\n  $0\n}`;
    } 
    // If it has arguments, suggest with parentheses
    else if (prop.args && prop.args.length > 0) {
      insertText = `${prop.name}($0)`;
    }
    
    return {
      label: prop.name,
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: `Field: ${prop.type}`,
      insertText: insertText,
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: `${prop.name}: ${prop.type}`
    };
  });
}

/**
 * Create completions for Weaviate arguments
 */
function createWeaviateArguments() {
  return [
    {
      label: 'limit',
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: 'Maximum number of results',
      insertText: 'limit: $0',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Limit the number of returned results'
    },
    {
      label: 'offset',
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: 'Offset for pagination',
      insertText: 'offset: $0',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Skip the first N results'
    },
    {
      label: 'certainty',
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: 'Minimum match certainty (0.0-1.0)',
      insertText: 'certainty: $0',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Set the minimum certainty threshold for vector search results'
    },
    {
      label: 'nearText',
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: 'Semantic search parameters',
      insertText: 'nearText: { concepts: ["$0"] }',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Perform a semantic text search'
    },
    {
      label: 'nearVector',
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: 'Vector search parameters',
      insertText: 'nearVector: { vector: [$0] }',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Search using a vector'
    },
    {
      label: 'where',
      kind: 5, // Monaco.languages.CompletionItemKind.Field
      detail: 'Filter criteria',
      insertText: 'where: {\n  path: ["$1"],\n  operator: $2,\n  valueText: "$3"\n}',
      insertTextRules: 4, // Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      documentation: 'Filter results based on property values'
    }
  ];
}

/**
 * Check if the field is a Weaviate operation
 */
function isWeaviateOperation(field) {
  return ['Get', 'Aggregate', 'Explore'].includes(field);
}
