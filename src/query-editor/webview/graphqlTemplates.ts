/**
 * Query templates for common Weaviate GraphQL operations
 */

export interface QueryTemplate {
  name: string;
  description: string;
  template: string;
}

/**
 * Embedding model dimension mapping.
 * Maps model names to their vector dimensions.
 *
 * Last updated: Dec 2024
 * Supports 15+ models across 8 embedding providers.
 *
 * To maintain this mapping:
 * - Check vendor documentation when new models are released
 * - Run tests to verify dimensions match actual embeddings
 * - Update the PR #42 compatibility table in GRAPHQL_TEMPLATES.md
 */
export const EMBEDDING_MODEL_DIMENSIONS: Record<string, number> = {
  // OpenAI models
  'text-embedding-3-large': 3072,
  'text-embedding-3-small': 1536,
  'text-embedding-ada-002': 1536,
  'ada-002': 1536,

  // Cohere models
  'embed-english-v3': 1024,
  'embed-multilingual-v3': 1024,
  'cohere-legacy': 4096, // Legacy Cohere models default

  // Sentence Transformers models
  'all-mpnet-base-v2': 768,
  'all-minilm-l6-v2': 384,
  'all-minilm-l12-v2': 384,
  'sentence-transformers': 768, // Common default

  // HuggingFace / BERT models
  'bert-base': 768,
  'bert-large': 1024,

  // PaLM models
  'palm-gecko': 768,

  // Ollama models
  llama: 4096,
  mistral: 4096,

  // AWS Bedrock models
  'titan-embed': 1536,
};

/**
 * Generate a similarity search query using nearVector
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateNearVectorQuery(
  collectionName: string,
  limit: number = 10,
  returnProperties?: string[]
): string {
  const props =
    Array.isArray(returnProperties) && returnProperties.length > 0
      ? returnProperties.map((p) => `      ${p}`).join('\n')
      : '      # Add your properties here';

  // Use generic dimension message since we don't have schema context in static function
  const dimsText = 'match your vectorizer dimensions';

  return `{
  Get {
    ${collectionName} (
      nearVector: {
        vector: [0.1, 0.2, 0.3] # If you paste your own vector, ensure its length matches the embedding model's dimension (${dimsText})
        distance: 0.6 # Max distance threshold (prefer distance in v1.14+; use certainty prior to v1.14)
      }
      limit: ${limit}
    ) {
${props}
      _additional {
        id
        distance
        certainty
        vector # Include if you want to see the object's vector
      }
    }
  }
}`;
}

/**
 * Generate a similarity search query using nearText
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateNearTextQuery(
  collectionName: string,
  limit: number = 10,
  returnProperties?: string[]
): string {
  const props =
    Array.isArray(returnProperties) && returnProperties.length > 0
      ? returnProperties.map((p) => `      ${p}`).join('\n')
      : '      # Add your properties here';

  return `{
  # NOTE: nearText requires a text vectorizer module (text2vec-openai, text2vec-cohere, etc.)
  # If you get an "Unknown argument nearText" error, use nearVector instead or configure a text vectorizer
  
  Get {
    ${collectionName} (
      nearText: {
        concepts: ["search terms", "semantic concepts"]
        distance: 0.6 # Max distance threshold (prefer distance in v1.14+; use certainty prior to v1.14)
        moveAwayFrom: {
          concepts: ["unwanted terms"]
          force: 0.45
        }
        moveTo: {
          concepts: ["desired terms"]
          force: 0.85
        }
      }
      limit: ${limit}
    ) {
${props}
      _additional {
        id
        distance
        certainty
        explainScore
      }
    }
  }
}`;
}

export function generateNearObjectQuery(
  collectionName: string,
  id?: string,
  limit: number = 10
): string {
  const idParam = id ? `"${id}"` : '"your-object-id"';
  return `{
  Get {
    ${collectionName} (
      nearObject: {
        id: ${idParam}
      }
      limit: ${limit}
    ) {
      # Replace with actual properties from your schema
      _additional {
        id
        distance
        certainty
      }
    }
  }
}`;
}

/**
 * Generate a hybrid search query (BM25 + Vector)
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateHybridQuery(
  collectionName: string,
  limit: number = 10,
  returnProperties?: string[]
): string {
  const props =
    Array.isArray(returnProperties) && returnProperties.length > 0
      ? returnProperties.map((p) => `      ${p}`).join('\n')
      : '      # Add your properties here';

  return `{
  Get {
    ${collectionName} (
      hybrid: {
        query: "your search query here"
        alpha: 0.5 # Balance: 0=pure vector, 1=pure keyword search
        vector: [0.1, 0.2, 0.3] # Optional: provide custom vector (ensure its length matches your embedding model's dimension)
        properties: ["title", "description"] # Optional: limit search to specific properties
      }
      limit: ${limit}
    ) {
${props}
      _additional {
        id
        score
        explainScore
      }
    }
  }
}`;
}

/**
 * Generate a query with filters
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateFilterQuery(collectionName: string, limit: number = 10): string {
  return `{
  Get {
    ${collectionName} (
      where: {
        operator: And
        operands: [
          {
            path: ["propertyName"] # Replace with actual property name
            operator: Equal # Options: Equal, NotEqual, GreaterThan, LessThan, Like, etc.
            valueText: "example value" # Use valueText, valueInt, valueBoolean, etc.
          }
          {
            path: ["numericProperty"]
            operator: GreaterThan
            valueNumber: 100
          }
          {
            path: ["booleanProperty"]
            operator: Equal
            valueBoolean: true
          }
        ]
      }
      limit: ${limit}
    ) {
      # Replace with actual properties from your schema
      _additional {
        id
      }
    }
  }
}`;
}

/**
 * Generate an aggregation query
 * @param collectionName The name of the collection to query
 * @returns GraphQL query string
 */
export function generateAggregationQuery(collectionName: string): string {
  return `{
  Aggregate {
    ${collectionName} {
      meta {
        count
      }
      # For text properties:
      # textProperty {
      #   count
      #   topOccurrences(limit: 5) {
      #     value
      #     occurs
      #   }
      # }
      
      # For numeric properties:
      # numericProperty {
      #   count
      #   minimum
      #   maximum
      #   mean
      #   median
      #   mode
      #   sum
      # }
      
      # For date properties:
      # dateProperty {
      #   count
      #   minimum
      #   maximum
      # }
      
      # For boolean properties:
      # booleanProperty {
      #   count
      #   totalTrue
      #   totalFalse
      #   percentageTrue
      #   percentageFalse
      # }
    }
  }
}`;
}

/**
 * Generate a BM25 search query (keyword-based search)
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateBM25Query(
  collectionName: string,
  limit: number = 10,
  returnProperties?: string[]
): string {
  const props =
    Array.isArray(returnProperties) && returnProperties.length > 0
      ? returnProperties.map((p) => `      ${p}`).join('\n')
      : '      # Add your properties here';

  return `{
  Get {
    ${collectionName} (
      bm25: {
        query: "search keywords here"
        properties: ["title", "description"] # Optional: limit search to specific properties
      }
      limit: ${limit}
    ) {
${props}
      _additional {
        id
        score
      }
    }
  }
}`;
}

/**
 * Generate a generative search query (AI-powered search with generated responses)
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 5)
 * @returns GraphQL query string
 */
export function generateGenerativeSearchQuery(
  collectionName: string,
  limit: number = 5,
  returnProperties?: string[]
): string {
  const props =
    Array.isArray(returnProperties) && returnProperties.length > 0
      ? returnProperties.map((p) => `      ${p}`).join('\n')
      : '      # Add your properties here';

  return `{
  Get {
    ${collectionName} (
      nearText: {
        concepts: ["search terms"]
        distance: 0.6 # Max distance threshold (prefer distance in v1.14+; use certainty prior to v1.14)
      }
      limit: ${limit}
    ) {
${props}
      _additional {
        id
        generate(
          groupedResult: {
            task: "Summarize these results in 2-3 sentences"
            properties: ["title", "description"]
          }
        ) {
          groupedResult
          error
        }
      }
    }
  }
}`;
}

/**
 * Generate a query with grouping (groupBy)
 * @param collectionName The name of the collection to query
 * @param groupByPath The property path to group by
 * @param limit Optional limit for groups (default: 10)
 * @returns GraphQL query string
 */
export function generateGroupByQuery(
  collectionName: string,
  groupByPath: string = 'category',
  limit: number = 10
): string {
  return `{
  Aggregate {
    ${collectionName} (
      groupBy: ["${groupByPath}"]
      limit: ${limit}
    ) {
      groupedBy {
        value
        path
      }
      meta {
        count
      }
      # Add aggregations for grouped results
      # title {
      #   count
      #   topOccurrences(limit: 3) {
      #     value
      #     occurs
      #   }
      # }
    }
  }
}`;
}

/**
 * Generate a tenant-specific query for multi-tenant collections
 * @param collectionName The name of the collection to query
 * @param tenantName The name of the tenant
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateTenantQuery(
  collectionName: string,
  tenantName: string,
  limit: number = 10
): string {
  return `{
  Get {
    ${collectionName} (
      tenant: "${tenantName}"
      limit: ${limit}
    ) {
      # Replace with actual properties from your schema
      _additional {
        id
        creationTimeUnix
        tenant
      }
    }
  }
}`;
}

/**
 * Generate an explore query that returns metadata, vectors, and optional generation
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateExploreQuery(collectionName: string, limit: number = 10): string {
  return `{
  Get {
    ${collectionName} (limit: ${limit}) {
      # Add your properties here
      _additional {
        id
        creationTimeUnix
        lastUpdateTimeUnix
        vector
      }
    }
  }
}`;
}

/**
 * Generate a query with advanced configuration options
 * @param collectionName The name of the collection
 * @param config Configuration options for the query
 * @param classSchema Optional schema for better property handling
 * @returns GraphQL query string
 */
export function generateAdvancedQuery(
  collectionName: string,
  config: QueryConfig = {},
  classSchema?: ClassSchema
): string {
  const {
    includeVectors = false,
    includeMetadata = true,
    includeScores = false,
    maxProperties = 5,
    tenantName,
    limit = 10,
    offset,
  } = config;

  const properties =
    Array.isArray(config?.returnProperties) && config.returnProperties.length > 0
      ? config.returnProperties.map((p) => `      ${p}`)
      : generateAdvancedProperties(classSchema, config);

  const additionalFields = generateAdditionalFields(config);

  const tenantParam = tenantName ? `tenant: "${tenantName}"` : '';
  const sortClause = config?.sortBy?.path
    ? `sort: [{ path: ["${config.sortBy.path}"], order: ${config.sortBy.order ?? 'asc'} }]`
    : '';

  return `{
  Get {
    ${collectionName} (
      ${tenantParam}
      ${sortClause ? `\n      ${sortClause}` : ''}
      limit: ${limit}${typeof offset === 'number' ? `\n      offset: ${offset}` : ''}
    ) {
${properties.join('\n')}
${additionalFields.length > 0 ? `      _additional {\n${additionalFields.map((f) => `        ${f}`).join('\n')}\n      }` : ''}
    }
  }
}`;
}

/**
 * Generate properties for advanced queries based on schema and config
 */
function generateAdvancedProperties(classSchema?: ClassSchema, config: QueryConfig = {}): string[] {
  const { maxProperties = 5 } = config;

  const selections = buildPropertySelections(classSchema, {
    maxCount: maxProperties,
    includeWarning: false,
    maxNestedProps: 3,
    indent: '      ',
  });

  return selections.length > 0 ? selections : ['      # No properties found in schema'];
}

/**
 * Generate additional fields based on configuration
 */
function generateAdditionalFields(config: QueryConfig = {}): string[] {
  const {
    includeVectors = false,
    includeMetadata = true,
    includeScores = false,
    generativePrompt,
  } = config;

  const fields: string[] = [];

  if (includeMetadata) {
    fields.push('id');
    fields.push('creationTimeUnix');
    fields.push('lastUpdateTimeUnix');
  }

  if (includeVectors) {
    fields.push('vector');
  }

  if (includeScores) {
    fields.push('score');
    fields.push('certainty');
    fields.push('distance');
    if (config.includeExplainScore !== false) {
      fields.push('explainScore');
    }
  }

  if (generativePrompt) {
    fields.push(`generate(
      singleResult: {
        prompt: "${generativePrompt.replace(/"/g, '\\"')}"
      }
    ) {
      singleResult
      error
    }`);
  }

  if (config.tenantName) {
    fields.push('tenant');
  }

  return fields;
}

/**
 * Validate collection name for GraphQL compatibility
 * @param collectionName The collection name to validate
 * @returns Validation result with error message if invalid
 */
export function validateCollectionName(collectionName: string): { valid: boolean; error?: string } {
  if (!collectionName || collectionName.trim().length === 0) {
    return { valid: false, error: 'Collection name cannot be empty' };
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(collectionName)) {
    return {
      valid: false,
      error:
        'Collection name must start with a letter or underscore and contain only alphanumeric characters and underscores',
    };
  }

  if (collectionName.length > 256) {
    return { valid: false, error: 'Collection name cannot exceed 256 characters' };
  }

  return { valid: true };
}

/**
 * Validate and sanitize a GraphQL query string
 * @param query The query string to validate
 * @returns Validation result with sanitized query
 */
export function validateAndSanitizeQuery(query: string): {
  valid: boolean;
  sanitizedQuery: string;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation - check for balanced braces
  const openBraces = (query.match(/{/g) || []).length;
  const closeBraces = (query.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push('Unbalanced braces in query');
  }

  // Check for basic GraphQL structure
  if (!query.trim().startsWith('{') && !query.trim().startsWith('mutation')) {
    errors.push('Query must start with "{" or "mutation"');
  }

  // Catch invalid inline fragments on Weaviate array/scalar types (e.g. `... on text[]`)
  const fragmentTypeRegex = /\.\.\.\s*on\s+([^\s{]+)/g;
  let fragmentMatch: RegExpExecArray | null;
  while ((fragmentMatch = fragmentTypeRegex.exec(query)) !== null) {
    const typeName = fragmentMatch[1];
    if (!isValidGraphQLTypeName(typeName)) {
      errors.push(
        `Invalid inline fragment type "${typeName}" (GraphQL type names cannot contain "[]" or other special characters)`
      );
    } else if (
      PRIMITIVE_BASE_TYPES.has(typeName.toLowerCase()) ||
      typeName.toLowerCase() === 'geocoordinates' ||
      typeName.toLowerCase() === 'phonenumber' ||
      typeName.toLowerCase() === 'blob'
    ) {
      errors.push(
        `Invalid inline fragment type "${typeName}" — scalar Weaviate types are selected as plain fields, not fragments`
      );
    }
  }

  // Empty selection sets (e.g. `prop { }`) are invalid GraphQL
  if (/\{\s*\}/.test(query.replace(/#[^\n]*/g, ''))) {
    errors.push('Empty selection set `{ }` found — nested fields require at least one selection');
  }

  // Soft guidance — do not block the editor from loading the sample
  if (/tenant:\s*"YOUR_TENANT_ID"/.test(query)) {
    warnings.push(
      'Placeholder tenant "YOUR_TENANT_ID" present — replace with a real tenant name before running'
    );
  }
  if (/vector:\s*\[0\.1,\s*0\.2,\s*0\.3\]/.test(query)) {
    warnings.push('Placeholder vector [0.1, 0.2, 0.3] present — replace with a real embedding');
  }

  // Sanitize by removing potential harmful content (basic implementation)
  const sanitizedQuery = query
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .trim();

  return {
    valid: errors.length === 0,
    sanitizedQuery,
    errors,
    warnings,
  };
}

/**
 * Get recommended query parameters based on collection schema
 * @param classSchema The class schema
 * @returns Recommended configuration options
 */
export function getRecommendedConfig(classSchema?: ClassSchema): Partial<QueryConfig> {
  if (!classSchema?.properties) {
    return {};
  }

  const hasVector =
    classSchema.vectorizer !== undefined || getNamedVectorNames(classSchema).length > 0;
  const hasTextProperties = classSchema.properties.some((p) => isTextDataType(p.dataType));
  const hasGeoProperties = classSchema.properties.some((p) => isGeoDataType(p.dataType));
  const namedVectors = getNamedVectorNames(classSchema);

  return {
    includeVectors: hasVector,
    includeMetadata: true,
    includeScores: hasVector,
    maxProperties: hasGeoProperties ? 4 : 5,
    certainty: 0.7,
    distance: 0.6,
    limit: 10,
    includeBlobs: false,
    includeHeaderComments: true,
    // Prefer text fields (including text[]) for BM25 / hybrid when available
    searchProperties: hasTextProperties
      ? classSchema.properties
          .filter((p) => isTextDataType(p.dataType))
          .map((p) => p.name)
          .slice(0, 5)
      : undefined,
    targetVectors:
      namedVectors.length > 1 || (namedVectors.length === 1 && namedVectors[0] !== 'default')
        ? namedVectors
        : undefined,
    tenantName: isMultiTenantCollection(classSchema) ? 'YOUR_TENANT_ID' : undefined,
  };
}

/**
 * Collection of predefined query templates
 */
export const queryTemplates: QueryTemplate[] = [
  {
    name: 'Vector Search (nearVector)',
    description: 'Search for similar objects using a vector with similarity scoring',
    template: '{nearVectorQuery}',
  },
  {
    name: 'Vector Search (nearObject)',
    description: 'Search for similar objects using a reference object ID',
    template: '{nearObjectQuery}',
  },
  {
    name: 'Semantic Search (nearText)',
    description: 'Search for similar objects using text concepts with move operations',
    template: '{nearTextQuery}',
  },
  {
    name: 'Hybrid Search',
    description: 'Combine vector and keyword search with configurable balance',
    template: '{hybridQuery}',
  },
  {
    name: 'BM25 Search',
    description: 'Perform keyword-based search using BM25 algorithm',
    template: '{bm25Query}',
  },
  {
    name: 'Generative Search',
    description: 'AI-powered search with generated summaries and responses',
    template: '{generativeSearchQuery}',
  },
  {
    name: 'Group By Query',
    description: 'Group results by property values with aggregations',
    template: '{groupByQuery}',
  },
  {
    name: 'Filter Query',
    description: 'Filter objects based on property values with multiple operators',
    template: '{filterQuery}',
  },
  {
    name: 'Aggregation Query',
    description: 'Calculate comprehensive statistics across objects by property type',
    template: '{aggregationQuery}',
  },
];

/**
 * Represents a Weaviate property schema
 */
export interface PropertySchema {
  name: string;
  dataType: string[];
  description?: string;
  tokenization?: string;
  indexSearchable?: boolean;
  indexFilterable?: boolean;
  moduleConfig?: Record<string, any>;
  vectorizerConfig?: Record<string, any>;
  nestedProperties?: PropertySchema[];
}

/**
 * Represents a Weaviate class schema
 */
export interface ClassSchema {
  class: string;
  description?: string;
  properties: PropertySchema[];
  vectorizer?: string;
  moduleConfig?: Record<string, any>;
  /** Named-vector map (v3/v4 client shape), e.g. { title: {...}, content: {...} } */
  vectorizers?: Record<string, any>;
  /** Explicit list of named vector keys when known */
  vectorNames?: string[];
  multiTenancy?: {
    enabled?: boolean;
    autoTenantCreation?: boolean;
    autoTenantActivation?: boolean;
  };
}

/**
 * Scalar Weaviate property types (array forms like text[] share the same base).
 * Cross-references use collection/class names and are NOT listed here.
 * phoneNumber and blob are compound/special and classified separately.
 */
export const PRIMITIVE_BASE_TYPES = new Set([
  'text',
  'string',
  'int',
  'number',
  'boolean',
  'date',
  'uuid',
]);

export type PropertyKind =
  | 'primitive'
  | 'geo'
  | 'phone'
  | 'blob'
  | 'object'
  | 'reference'
  | 'unknown';

/** Coerce Weaviate dataType (string | string[]) to a non-empty string array. */
export function coerceDataType(dataType: string | string[] | undefined | null): string[] {
  if (Array.isArray(dataType)) {
    return dataType.filter((dt): dt is string => typeof dt === 'string' && dt.length > 0);
  }
  if (typeof dataType === 'string' && dataType.length > 0) {
    return [dataType];
  }
  return [];
}

/** First declared dataType entry, preserving original casing (e.g. Person, text[]). */
export function getPrimaryDataType(dataType: string | string[] | undefined | null): string {
  return coerceDataType(dataType)[0] || '';
}

/** Base type without [] suffix, lowercased (text[] → text, Person → person). */
export function getBaseDataType(dataType: string | string[] | undefined | null): string {
  return getPrimaryDataType(dataType)
    .replace(/\[\]\s*$/, '')
    .toLowerCase();
}

export function isArrayDataType(dataType: string | string[] | undefined | null): boolean {
  return /\[\]\s*$/.test(getPrimaryDataType(dataType));
}

/** Valid GraphQL type / collection name (no brackets or other special chars). */
export function isValidGraphQLTypeName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

export function isPrimitiveDataType(dataType: string | string[] | undefined | null): boolean {
  return PRIMITIVE_BASE_TYPES.has(getBaseDataType(dataType));
}

export function isGeoDataType(dataType: string | string[] | undefined | null): boolean {
  return getBaseDataType(dataType) === 'geocoordinates';
}

export function isPhoneNumberDataType(dataType: string | string[] | undefined | null): boolean {
  return getBaseDataType(dataType) === 'phonenumber';
}

export function isBlobDataType(dataType: string | string[] | undefined | null): boolean {
  return getBaseDataType(dataType) === 'blob';
}

export function isObjectDataType(dataType: string | string[] | undefined | null): boolean {
  return getBaseDataType(dataType) === 'object';
}

export function isTextDataType(dataType: string | string[] | undefined | null): boolean {
  const base = getBaseDataType(dataType);
  return base === 'text' || base === 'string';
}

/** Named vector names from class schema (vectorNames, vectorizers keys). */
export function getNamedVectorNames(classSchema?: ClassSchema): string[] {
  if (!classSchema) {
    return [];
  }
  if (Array.isArray(classSchema.vectorNames) && classSchema.vectorNames.length > 0) {
    return classSchema.vectorNames.filter((n) => typeof n === 'string' && n.length > 0);
  }
  if (classSchema.vectorizers && typeof classSchema.vectorizers === 'object') {
    return Object.keys(classSchema.vectorizers);
  }
  return [];
}

export function isMultiTenantCollection(classSchema?: ClassSchema): boolean {
  return Boolean(classSchema?.multiTenancy?.enabled);
}

/**
 * Build GraphQL argument lines for Get { Collection(…) }.
 * Includes tenant when multi-tenancy is enabled or a tenant is configured.
 */
export function buildCollectionArgs(
  classSchema: ClassSchema | undefined,
  limit: number,
  config?: QueryConfig
): string {
  const lines: string[] = [];
  const tenantRequired = isMultiTenantCollection(classSchema) || Boolean(config?.tenantName);
  if (tenantRequired) {
    const tenant = config?.tenantName?.trim() || 'YOUR_TENANT_ID';
    lines.push(`tenant: "${tenant}"`);
  }
  if (typeof config?.offset === 'number' && config.offset > 0) {
    lines.push(`offset: ${config.offset}`);
  }
  lines.push(`limit: ${limit}`);
  return lines.join('\n      ');
}

/** Optional targetVectors line for nearVector / nearText / hybrid when named vectors exist. */
export function formatTargetVectorsArg(classSchema?: ClassSchema, config?: QueryConfig): string {
  let names: string[] = [];
  if (Array.isArray(config?.targetVectors) && config.targetVectors.length > 0) {
    names = config.targetVectors;
  } else if (config?.targetVector) {
    names = [config.targetVector];
  } else {
    names = getNamedVectorNames(classSchema);
  }
  if (names.length === 0) {
    return '';
  }
  // Single anonymous/default vector — omit targetVectors to stay compatible
  if (names.length === 1 && (names[0] === 'default' || names[0] === 'Default')) {
    return '';
  }
  return `targetVectors: [${names.map((n) => `"${n}"`).join(', ')}]`;
}

/** Header comments describing schema-aware choices. */
export function buildQueryHeaderComments(
  collectionName: string,
  classSchema?: ClassSchema,
  options?: { kind?: string; excludedBlobs?: string[]; indent?: string }
): string {
  const indent = options?.indent ?? '  ';
  const lines: string[] = [];
  lines.push(`# Schema-aware ${options?.kind || 'query'} for ${collectionName}`);
  if (isMultiTenantCollection(classSchema)) {
    lines.push('# Multi-tenancy is enabled - set tenant to a real tenant name before running');
  }
  const vectors = getNamedVectorNames(classSchema);
  if (vectors.length > 1 || (vectors.length === 1 && vectors[0] !== 'default')) {
    lines.push(`# Named vectors: ${vectors.join(', ')} - templates may set targetVectors`);
  }
  if (options?.excludedBlobs?.length) {
    lines.push(
      `# Excluded blob fields (large payloads): ${options.excludedBlobs.join(', ')} - add manually if needed`
    );
  }
  if (!hasTextVectorizerModule(classSchema) && options?.kind === 'nearText') {
    lines.push('# No text vectorizer detected - nearText may fail; prefer nearVector if so');
  }
  return lines.map((l) => `${indent}${l}`).join('\n') + '\n';
}

/**
 * True when dataType points at one or more other collections (cross-reference).
 * Multi-target refs declare multiple class names in dataType.
 */
export function isReferenceDataType(dataType: string | string[] | undefined | null): boolean {
  const types = coerceDataType(dataType);
  if (types.length === 0) {
    return false;
  }
  // All entries must look like collection names (not primitives/object/geo, and GraphQL-safe).
  return types.every((dt) => {
    const base = dt.replace(/\[\]\s*$/, '');
    if (!isValidGraphQLTypeName(base)) {
      return false;
    }
    const lower = base.toLowerCase();
    if (PRIMITIVE_BASE_TYPES.has(lower)) {
      return false;
    }
    if (
      lower === 'object' ||
      lower === 'geocoordinates' ||
      lower === 'phonenumber' ||
      lower === 'blob'
    ) {
      return false;
    }
    return true;
  });
}

/** Referenced collection names for a cross-ref property (strips [] if present). */
export function getReferencedClassNames(dataType: string | string[] | undefined | null): string[] {
  return coerceDataType(dataType)
    .map((dt) => dt.replace(/\[\]\s*$/, ''))
    .filter((name) => isValidGraphQLTypeName(name) && isReferenceDataType([name]));
}

export function classifyProperty(prop: PropertySchema): PropertyKind {
  const dataType = prop.dataType;
  if (isGeoDataType(dataType)) {
    return 'geo';
  }
  if (isPhoneNumberDataType(dataType)) {
    return 'phone';
  }
  if (isBlobDataType(dataType)) {
    return 'blob';
  }
  if (isPrimitiveDataType(dataType)) {
    return 'primitive';
  }
  if (isObjectDataType(dataType)) {
    return 'object';
  }
  if (isReferenceDataType(dataType)) {
    return 'reference';
  }
  // Unknown / malformed types: treat as plain scalar fields so we never emit
  // invalid inline fragments like `... on text[]`.
  return 'unknown';
}

/**
 * Format a property for a GraphQL selection set.
 * - primitives / unknown: bare field name (works for text, text[], int[], uuid, …)
 * - geo: latitude/longitude subselection
 * - phoneNumber: nested phone fields
 * - blob: plain field with optional size warning
 * - nested object/object[]: `... on Collection_prop_object { nested fields }`
 * - cross-references: `... on TargetClass { … }` (multi-target: one fragment each)
 */
export function formatPropertySelection(
  prop: PropertySchema,
  options: {
    collectionName: string;
    schema?: { classes?: ClassSchema[] };
    indent?: string;
    maxNestedProps?: number;
    includeWarning?: boolean;
    includeRefAdditional?: boolean;
  }
): string {
  const {
    collectionName,
    schema,
    indent = '',
    maxNestedProps = 5,
    includeWarning = true,
    includeRefAdditional = true,
  } = options;
  const kind = classifyProperty(prop);

  if (kind === 'geo') {
    return `${indent}${prop.name} {
${indent}  latitude
${indent}  longitude
${indent}}`;
  }

  if (kind === 'phone') {
    return `${indent}${prop.name} {
${indent}  input
${indent}  internationalFormatted
${indent}  nationalFormatted
${indent}  national
${indent}  countryCode
${indent}  defaultCountry
${indent}  valid
${indent}}`;
  }

  if (kind === 'blob') {
    const warn = includeWarning
      ? `${indent}# WARNING: ${prop.name} is a blob and may return large base64 data\n`
      : '';
    return `${warn}${indent}${prop.name}`;
  }

  if (kind === 'object') {
    const nestedTypeName = `${collectionName}_${prop.name}_object`;
    if (!isValidGraphQLTypeName(nestedTypeName)) {
      return `${indent}# ${prop.name}: nested object type name is not GraphQL-safe; add a manual sub-selection`;
    }
    const nested = (prop.nestedProperties || []).slice(0, maxNestedProps);
    if (nested.length === 0) {
      // Do not emit bare object or __typename — Weaviate nested types need real fields.
      return `${indent}# ${prop.name}: nested fields unavailable in schema - add a sub-selection manually`;
    }
    const nestedPropsStr = nested
      .map((np) => {
        const npKind = classifyProperty(np);
        if (npKind === 'geo') {
          return `${indent}  ${np.name} {\n${indent}    latitude\n${indent}    longitude\n${indent}  }`;
        }
        if (npKind === 'phone') {
          return `${indent}  ${np.name} {\n${indent}    input\n${indent}    internationalFormatted\n${indent}  }`;
        }
        if (npKind === 'blob') {
          return `${indent}  # skip nested blob ${np.name}`;
        }
        if (npKind === 'object' && np.nestedProperties?.length) {
          const deeper = np.nestedProperties
            .slice(0, 3)
            .map((d) => `${indent}    ${d.name}`)
            .join('\n');
          const deeperType = `${nestedTypeName}_${np.name}_object`;
          if (isValidGraphQLTypeName(deeperType)) {
            return `${indent}  ${np.name} {\n${indent}    ... on ${deeperType} {\n${deeper}\n${indent}    }\n${indent}  }`;
          }
        }
        return `${indent}  ${np.name}`;
      })
      .join('\n');
    const warning = includeWarning ? `${indent}  # Nested object field (object / object[]).\n` : '';
    return `${indent}${prop.name} {
${warning}${indent}  ... on ${nestedTypeName} {
${nestedPropsStr}
${indent}  }
${indent}}`;
  }

  if (kind === 'reference') {
    const classNames = getReferencedClassNames(prop.dataType);
    if (classNames.length === 0) {
      return `${indent}${prop.name}`;
    }
    const warning = includeWarning
      ? `${indent}  # WARNING: This may return many linked objects. Consider using a separate query.\n`
      : '';
    const fragments = classNames
      .map((className) => {
        const referencedClass = schema?.classes?.find(
          (c) => c.class === className || c.class?.toLowerCase() === className.toLowerCase()
        );
        let body: string;
        if (referencedClass?.properties?.length) {
          const refPrimitiveProps = referencedClass.properties
            .filter((p) => {
              const k = classifyProperty(p);
              return k === 'primitive' || k === 'unknown' || k === 'phone';
            })
            .slice(0, maxNestedProps);
          if (refPrimitiveProps.length > 0) {
            const lines = refPrimitiveProps.map((p) => {
              if (classifyProperty(p) === 'phone') {
                return `${indent}    ${p.name} {\n${indent}      input\n${indent}      internationalFormatted\n${indent}    }`;
              }
              return `${indent}    ${p.name}`;
            });
            if (includeRefAdditional) {
              lines.push(`${indent}    _additional {`, `${indent}      id`, `${indent}    }`);
            }
            body = lines.join('\n');
          } else if (includeRefAdditional) {
            body = `${indent}    _additional {\n${indent}      id\n${indent}    }`;
          } else {
            body = `${indent}    # no scalar fields available on ${className}`;
          }
        } else if (includeRefAdditional) {
          body = `${indent}    _additional {\n${indent}      id\n${indent}    }`;
        } else {
          body = `${indent}    # referenced class ${className} not in schema`;
        }
        return `${indent}  ... on ${className} {\n${body}\n${indent}  }`;
      })
      .join('\n');
    return `${indent}${prop.name} {
${warning}${fragments}
${indent}}`;
  }

  // primitive or unknown — always a plain field (covers text, text[], int[], uuid, …)
  return `${indent}${prop.name}`;
}

export interface PropertySelectionOptions {
  maxCount?: number;
  schema?: { classes?: ClassSchema[] };
  /** Include every non-blob property (sample "full" mode). Blobs still require includeBlobs. */
  includeAll?: boolean;
  maxNestedProps?: number;
  includeWarning?: boolean;
  indent?: string;
  /** Default false — blobs can return huge base64 payloads. */
  includeBlobs?: boolean;
  maxReferences?: number;
  maxObjects?: number;
  maxGeo?: number;
  maxPhones?: number;
}

/**
 * Build a selection list for display/query generators from a class schema.
 */
export function buildPropertySelections(
  classSchema: ClassSchema | undefined,
  options: PropertySelectionOptions = {}
): string[] {
  if (!classSchema?.properties?.length) {
    return [];
  }

  const {
    maxCount = 5,
    schema,
    includeAll = false,
    maxNestedProps = 5,
    includeWarning = true,
    indent = '      ',
    includeBlobs = false,
    maxReferences = 1,
    maxObjects = 2,
    maxGeo = 1,
    maxPhones = 1,
  } = options;

  const primitives: PropertySchema[] = [];
  const geo: PropertySchema[] = [];
  const phones: PropertySchema[] = [];
  const blobs: PropertySchema[] = [];
  const objects: PropertySchema[] = [];
  const references: PropertySchema[] = [];

  for (const prop of classSchema.properties) {
    switch (classifyProperty(prop)) {
      case 'geo':
        geo.push(prop);
        break;
      case 'phone':
        phones.push(prop);
        break;
      case 'blob':
        blobs.push(prop);
        break;
      case 'object':
        objects.push(prop);
        break;
      case 'reference':
        references.push(prop);
        break;
      case 'primitive':
      case 'unknown':
      default:
        primitives.push(prop);
        break;
    }
  }

  const format = (prop: PropertySchema) =>
    formatPropertySelection(prop, {
      collectionName: classSchema.class,
      schema,
      indent,
      maxNestedProps,
      includeWarning,
    });

  if (includeAll) {
    return [
      ...primitives.map(format),
      ...phones.map(format),
      ...geo.map(format),
      ...objects.map(format),
      ...references.map(format),
      ...(includeBlobs ? blobs.map(format) : []),
    ];
  }

  // Prefer scalars, then phones, geo, nested objects, then a small number of refs.
  const result: string[] = [];
  const take = (items: PropertySchema[], n: number) => {
    for (const prop of items) {
      if (result.length >= maxCount) {
        break;
      }
      if (n-- <= 0) {
        break;
      }
      result.push(format(prop));
    }
  };

  take(primitives, maxCount);
  take(phones, maxPhones);
  take(geo, maxGeo);
  take(objects, maxObjects);
  take(references, maxReferences);
  if (includeBlobs) {
    take(blobs, 1);
  }

  return result;
}

/** Blob property names excluded from a selection pass (for header comments). */
export function getExcludedBlobNames(classSchema?: ClassSchema, includeBlobs?: boolean): string[] {
  if (includeBlobs || !classSchema?.properties) {
    return [];
  }
  return classSchema.properties.filter((p) => classifyProperty(p) === 'blob').map((p) => p.name);
}

/**
 * Configuration options for query generation
 */
export interface QueryConfig {
  includeVectors?: boolean;
  includeMetadata?: boolean;
  includeScores?: boolean;
  includeExplainScore?: boolean;
  maxProperties?: number;
  tenantName?: string;
  groupByPath?: string;
  batchSize?: number;
  generativePrompt?: string;
  searchProperties?: string[];
  filterOperator?: 'And' | 'Or';
  certainty?: number;
  distance?: number;
  limit?: number;
  offset?: number;
  alpha?: number;
  searchQuery?: string;
  concepts?: string[];
  propertiesOverride?: string[];
  moveTo?: { concepts: string[]; force?: number };
  moveAwayFrom?: { concepts: string[]; force?: number };
  vector?: number[];
  sortBy?: { path: string; order?: 'asc' | 'desc' };
  returnProperties?: string[];
  /** Include blob fields in generated selections (default false). */
  includeBlobs?: boolean;
  /** Include every non-blob property instead of the capped safe default. */
  includeAllProperties?: boolean;
  /** Prefixed # comments explaining schema-aware choices (default true for samples). */
  includeHeaderComments?: boolean;
  /** Single named vector target. */
  targetVector?: string;
  /** Multi-target named vectors. */
  targetVectors?: string[];
  /** Full schema for expanding cross-reference selections. */
  fullSchema?: { classes?: ClassSchema[] };
}

/**
 * Generate a sample GraphQL Get query for a collection.
 *
 * Defaults favour safe, runnable queries:
 * - capped property set (not every field)
 * - blobs excluded
 * - at most one cross-reference
 * - tenant arg when multi-tenancy is enabled
 *
 * Pass `config.includeAllProperties` to expand to all non-blob fields.
 *
 * **Indentation contract**: each property line is already indented by six spaces.
 */
export function generateSampleQuery(
  collectionName: string,
  properties: string[] = [],
  limit: number = 10,
  schema?: { classes?: ClassSchema[] },
  config?: QueryConfig
): string {
  // Find the class definition from schema if available (case-insensitive)
  const classSchema =
    schema?.classes?.find((c) => c.class === collectionName) ||
    schema?.classes?.find((c) => c.class?.toLowerCase() === collectionName.toLowerCase());

  const fullSchema = config?.fullSchema || schema;
  const includeBlobs = config?.includeBlobs === true;
  const includeAll = config?.includeAllProperties === true;
  const maxProps = config?.maxProperties ?? (includeAll ? 50 : 12);
  const includeComments = config?.includeHeaderComments !== false;

  let propertyStrings: string[] = [];

  if (properties.length === 0 && classSchema?.properties?.length) {
    propertyStrings = buildPropertySelections(classSchema, {
      includeAll,
      maxCount: maxProps,
      schema: fullSchema,
      indent: '      ',
      maxNestedProps: 5,
      includeWarning: true,
      includeBlobs,
      maxReferences: includeAll ? 10 : 1,
      maxObjects: includeAll ? 10 : 2,
      maxGeo: includeAll ? 10 : 1,
      maxPhones: includeAll ? 10 : 1,
    });
  } else if (properties.length > 0) {
    propertyStrings = properties.map((propName) => {
      const propSchema = classSchema?.properties?.find((p) => p.name === propName);
      if (propSchema && classSchema) {
        return formatPropertySelection(propSchema, {
          collectionName: classSchema.class,
          schema: fullSchema,
          indent: '      ',
          maxNestedProps: 5,
          includeWarning: true,
        });
      }
      return `      ${propName}`;
    });
  } else {
    propertyStrings = ['      # Add your properties here'];
  }

  if (!propertyStrings.some((p) => p.includes('_additional'))) {
    propertyStrings.unshift('      _additional {\n        id\n      }');
  }

  const args = buildCollectionArgs(classSchema, limit, config);
  const excludedBlobs = getExcludedBlobNames(classSchema, includeBlobs);
  const header =
    includeComments && classSchema
      ? buildQueryHeaderComments(collectionName, classSchema, {
          kind: 'sample Get',
          excludedBlobs,
        })
      : '';

  return `{
${header}  Get {
    ${collectionName} (
      ${args}
    ) {
${propertyStrings.join('\n')}
    }
  }
}`;
}

/**
 * Generate a static fallback query when template processing fails
 * @param template The template string or template name
 * @param collectionName The name of the collection
 * @param limit Optional limit for queries (default: 10)
 * @returns Static fallback query string
 */
function generateStaticFallback(
  template: string,
  collectionName: string,
  limit: number = 10
): string {
  console.warn(`Using static fallback for template: ${template}`);

  // Check if template is a predefined template name
  const predefinedTemplate = queryTemplates.find((t) => t.name === template);
  const templateToUse = predefinedTemplate?.template || template;

  // Provide basic static templates for common placeholders
  const fallbackMap: Record<string, () => string> = {
    '{nearVectorQuery}': () => generateNearVectorQuery(collectionName, limit),
    '{nearObjectQuery}': () => generateNearObjectQuery(collectionName, undefined, limit),
    '{nearTextQuery}': () => generateNearTextQuery(collectionName, limit),
    '{hybridQuery}': () => generateHybridQuery(collectionName, limit),
    '{bm25Query}': () => generateBM25Query(collectionName, limit),
    '{generativeSearchQuery}': () => generateGenerativeSearchQuery(collectionName, limit),
    '{groupByQuery}': () => generateGroupByQuery(collectionName),
    '{filterQuery}': () => generateFilterQuery(collectionName, limit),
    '{aggregationQuery}': () => generateAggregationQuery(collectionName),
    '{exploreQuery}': () => generateExploreQuery(collectionName, limit),
    '{tenantQuery}': () => generateTenantQuery(collectionName, 'tenant-name', limit),
  };

  // Try to find a matching fallback
  for (const [placeholder, generator] of Object.entries(fallbackMap)) {
    if (templateToUse.includes(placeholder)) {
      try {
        return generator();
      } catch (error) {
        console.error(`Fallback generation failed for ${placeholder}:`, error);
      }
    }
  }

  // Ultimate fallback: simple Get query
  return `{
  Get {
    ${collectionName}(limit: ${limit}) {
      # Add your properties here
      _additional {
        id
      }
    }
  }
}`;
}

/**
 * Validate QueryConfig parameter values to ensure they're within valid ranges
 * @throws {Error} If any parameter is out of valid ranges with descriptive error message
 */
function validateQueryConfig(config: QueryConfig | undefined): void {
  if (!config) {
    return;
  }

  const errors: string[] = [];

  // Validate numeric ranges
  if (config.limit !== undefined) {
    if (!Number.isInteger(config.limit) || config.limit <= 0) {
      errors.push(`limit must be a positive integer, got ${config.limit}`);
    }
  }

  if (config.certainty !== undefined) {
    if (typeof config.certainty !== 'number' || config.certainty < 0 || config.certainty > 1) {
      errors.push(`certainty must be a number between 0 and 1, got ${config.certainty}`);
    }
  }

  // Validate alpha (hybrid search balance: 0=vector only, 1=keyword only)
  if (config.alpha !== undefined) {
    if (typeof config.alpha !== 'number' || config.alpha < 0 || config.alpha > 1) {
      errors.push(`alpha must be a number between 0 and 1, got ${config.alpha}`);
    }
  }

  // Validate offset
  if (config.offset !== undefined) {
    if (!Number.isInteger(config.offset) || config.offset < 0) {
      errors.push(`offset must be a non-negative integer, got ${config.offset}`);
    }
  }

  // Validate array parameters
  if (config.concepts !== undefined && !Array.isArray(config.concepts)) {
    errors.push(`concepts must be an array, got ${typeof config.concepts}`);
  }

  if (config.returnProperties !== undefined && !Array.isArray(config.returnProperties)) {
    errors.push(`returnProperties must be an array, got ${typeof config.returnProperties}`);
  }

  if (config.propertiesOverride !== undefined && !Array.isArray(config.propertiesOverride)) {
    errors.push(`propertiesOverride must be an array, got ${typeof config.propertiesOverride}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid QueryConfig: ${errors.join('; ')}`);
  }
}

/**
 * Process a template by replacing placeholders with actual values
 * @param template The template string or template name
 * @param collectionName The name of the collection
 * @param limit Optional limit for queries (default: 10)
 * @param schema Optional schema information for proper relationship handling
 * @returns Processed query string
 */
export function processTemplate(
  template: string,
  collectionName: string,
  limit: number = 10,
  schema?: { classes?: ClassSchema[] },
  config?: QueryConfig
): string {
  try {
    // Validate config parameters early to fail fast with clear errors
    validateQueryConfig(config);

    // Helpers to normalize various schema shapes (v1/v2)
    const normalizeProperty = (p: any): PropertySchema => ({
      name: p.name,
      dataType: coerceDataType(p.dataType),
      description: p.description,
      tokenization: p.tokenization,
      indexSearchable: p.indexSearchable,
      indexFilterable: p.indexFilterable,
      moduleConfig: p.moduleConfig,
      vectorizerConfig: p.vectorizerConfig,
      nestedProperties: Array.isArray(p.nestedProperties)
        ? p.nestedProperties.map(normalizeProperty)
        : undefined,
    });

    const extractVectorNames = (input: any): string[] | undefined => {
      if (Array.isArray(input?.vectorNames)) {
        return input.vectorNames;
      }
      const fromVectorizers =
        input?.vectorizers && typeof input.vectorizers === 'object'
          ? Object.keys(input.vectorizers)
          : [];
      const fromConfig =
        input?.vectorizerConfig && typeof input.vectorizerConfig === 'object'
          ? Object.keys(input.vectorizerConfig)
          : [];
      const names = fromVectorizers.length > 0 ? fromVectorizers : fromConfig;
      return names.length > 0 ? names : undefined;
    };

    const normalizeClassSchema = (input: any): ClassSchema | undefined => {
      if (!input) {
        return undefined;
      }
      const vectorizers = input.vectorizers ?? input.vectorizerConfig;
      const normalized: ClassSchema = {
        class: input.class ?? input.name,
        description: input.description,
        properties: Array.isArray(input.properties) ? input.properties.map(normalizeProperty) : [],
        vectorizer: input.vectorizer,
        moduleConfig: input.moduleConfig,
        vectorizers,
        vectorNames: extractVectorNames(input),
        multiTenancy: input.multiTenancy,
      };
      return normalized;
    };

    // Find the class/collection definition across possible schema shapes
    let classSchema: ClassSchema | undefined = undefined;
    const classesAny = (schema as any)?.classes || (schema as any)?.collections;
    const lc = (s: any) => (typeof s === 'string' ? s.toLowerCase() : '');
    let allClasses: ClassSchema[] = [];
    if (Array.isArray(classesAny)) {
      allClasses = classesAny
        .map((c: any) => normalizeClassSchema(c))
        .filter((c: ClassSchema | undefined): c is ClassSchema => Boolean(c));
      let raw = classesAny.find(
        (c: any) => lc(c.class) === lc(collectionName) || lc(c.name) === lc(collectionName)
      );
      if (!raw && classesAny.length === 1) {
        raw = classesAny[0];
      }
      classSchema = normalizeClassSchema(raw);
    } else if (
      lc((schema as any)?.name) === lc(collectionName) ||
      lc((schema as any)?.class) === lc(collectionName)
    ) {
      classSchema = normalizeClassSchema(schema);
      if (classSchema) {
        allClasses = [classSchema];
      }
    }

    // Check if the template is a predefined template name (queries only)
    const predefinedTemplate = queryTemplates.find((t) => t.name === template);
    if (predefinedTemplate) {
      template = predefinedTemplate.template;
    }

    // Determine effective limit (config overrides param)
    const effectiveLimit = config?.limit ?? limit;
    const effectiveConfig: QueryConfig = {
      ...config,
      fullSchema: config?.fullSchema || (allClasses.length ? { classes: allClasses } : schema),
    };

    // Replace placeholders with actual values using dynamic generation when possible
    let query = template
      .replace(
        '{nearVectorQuery}',
        classSchema
          ? generateDynamicNearVectorQuery(
              collectionName,
              classSchema,
              effectiveLimit,
              effectiveConfig
            )
          : generateNearVectorQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{nearObjectQuery}',
        generateNearObjectQuery(collectionName, undefined, effectiveLimit)
      )
      .replace(
        '{nearTextQuery}',
        classSchema
          ? generateDynamicNearTextQuery(
              collectionName,
              classSchema,
              effectiveLimit,
              effectiveConfig
            )
          : generateNearTextQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{hybridQuery}',
        classSchema
          ? generateDynamicHybridQuery(collectionName, classSchema, effectiveLimit, effectiveConfig)
          : generateHybridQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{bm25Query}',
        classSchema
          ? generateDynamicBM25Query(collectionName, classSchema, effectiveLimit, effectiveConfig)
          : generateBM25Query(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{generativeSearchQuery}',
        classSchema
          ? generateDynamicGenerativeSearchQuery(
              collectionName,
              classSchema,
              effectiveLimit,
              effectiveConfig
            )
          : generateGenerativeSearchQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{groupByQuery}',
        classSchema
          ? generateDynamicGroupByQuery(collectionName, classSchema, effectiveConfig)
          : generateGroupByQuery(collectionName)
      )
      .replace(
        '{filterQuery}',
        classSchema
          ? generateDynamicFilterQuery(collectionName, classSchema, effectiveLimit, effectiveConfig)
          : generateFilterQuery(collectionName, effectiveLimit)
      )
      .replace(
        '{aggregationQuery}',
        classSchema
          ? generateDynamicAggregationQuery(collectionName, classSchema, effectiveConfig)
          : generateAggregationQuery(collectionName)
      )
      .replace(
        '{tenantQuery}',
        classSchema
          ? generateDynamicTenantQuery(
              collectionName,
              classSchema,
              effectiveConfig?.tenantName ?? 'YOUR_TENANT_ID',
              effectiveLimit,
              effectiveConfig
            )
          : generateTenantQuery(
              collectionName,
              config?.tenantName ?? 'YOUR_TENANT_ID',
              effectiveLimit
            )
      )
      .replace('{exploreQuery}', generateExploreQuery(collectionName, effectiveLimit));

    return query;
  } catch (error) {
    console.error('Error processing template:', error);
    console.error('Template:', template);
    console.error('Collection:', collectionName);
    console.error('Schema:', schema);

    // Return static fallback to ensure users always get a usable query
    return generateStaticFallback(template, collectionName, limit);
  }
}

/**
 * Generate a dynamic sample query for a collection based on its schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string with properties based on actual schema
 */
export function generateDynamicSampleQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 10,
  config?: QueryConfig
): string {
  // Delegate to the shared sample generator for consistent safe defaults.
  // Always build a new schema object — never mutate config.fullSchema.
  const existingClasses = config?.fullSchema?.classes ?? [];
  const hasClass =
    !!classSchema &&
    existingClasses.some(
      (c) =>
        c.class === classSchema.class || c.class?.toLowerCase() === classSchema.class?.toLowerCase()
    );
  const schema =
    classSchema || existingClasses.length
      ? {
          classes: [...existingClasses, ...(classSchema && !hasClass ? [classSchema] : [])],
        }
      : undefined;

  return generateSampleQuery(collectionName, [], limit, schema, {
    ...config,
    maxProperties: config?.maxProperties ?? 8,
    includeHeaderComments: config?.includeHeaderComments !== false,
  });
}

/**
 * Generate a dynamic vector search query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateDynamicNearVectorQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 10,
  config?: QueryConfig
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3, config);
  const vec = Array.isArray(config?.vector) ? config!.vector : [0.1, 0.2, 0.3];
  const vectorStr = `[${vec.join(', ')}]`;
  const distanceVal = typeof config?.distance === 'number' ? config!.distance : undefined;
  const certaintyVal = typeof config?.certainty === 'number' ? config!.certainty : 0.7;
  const thresholdLine =
    typeof distanceVal === 'number'
      ? `distance: ${distanceVal} # Max distance threshold (prefer distance in v1.14+; use certainty prior to v1.14)`
      : `certainty: ${certaintyVal} # Minimum similarity threshold (0-1)`;

  const additionalFields: string[] = ['id', 'distance', 'certainty'];
  if (config?.includeVectors !== false) {
    additionalFields.push('vector');
  }

  const dimsLabel = getVectorDimensions(classSchema);
  const dimsText = /^\d+$/.test(dimsLabel)
    ? `${dimsLabel} dimensions`
    : 'match your vectorizer dimensions';

  const targetVectorsLine = formatTargetVectorsArg(classSchema, config);
  const collectionArgs = buildCollectionArgs(classSchema, limit, config);
  const header =
    config?.includeHeaderComments === false
      ? ''
      : buildQueryHeaderComments(collectionName, classSchema, { kind: 'nearVector' });

  return `{
${header}  Get {
    ${collectionName}(
      nearVector: {
        vector: ${vectorStr} # Replace with your actual vector (${dimsText})
        ${thresholdLine}
${targetVectorsLine ? `        ${targetVectorsLine}` : ''}
      }
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
${additionalFields.map((f) => `        ${f}`).join('\n')}
      }
    }
  }
}`;
}

/**
 * Generate a dynamic semantic search query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateDynamicNearTextQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 10,
  config?: QueryConfig
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3, config);

  const conceptsArr =
    Array.isArray(config?.concepts) && config!.concepts.length > 0
      ? `[${config!.concepts.map((c) => `"${String(c).replace(/"/g, '\\"')}"`).join(', ')}]`
      : `["search terms", "semantic concepts"]`;
  const distanceVal = typeof config?.distance === 'number' ? config!.distance : undefined;
  const certaintyVal = typeof config?.certainty === 'number' ? config!.certainty : 0.7;
  const thresholdLine =
    typeof distanceVal === 'number'
      ? `distance: ${distanceVal} # Max distance threshold (prefer distance in v1.14+; use certainty prior to v1.14)`
      : `certainty: ${certaintyVal} # Minimum similarity threshold (0-1)`;

  const moveAwayBlock =
    config?.moveAwayFrom?.concepts && config.moveAwayFrom.concepts.length > 0
      ? `        moveAwayFrom: {
          concepts: [${config.moveAwayFrom.concepts.map((c) => `"${String(c).replace(/"/g, '\\"')}"`).join(', ')}]
          ${typeof config.moveAwayFrom.force === 'number' ? `force: ${config.moveAwayFrom.force}` : ''}
        }`
      : `        moveAwayFrom: {
          concepts: ["unwanted terms"]
          force: 0.45
        }`;

  const moveToBlock =
    config?.moveTo?.concepts && config.moveTo.concepts.length > 0
      ? `        moveTo: {
          concepts: [${config.moveTo.concepts.map((c) => `"${String(c).replace(/"/g, '\\"')}"`).join(', ')}]
          ${typeof config.moveTo.force === 'number' ? `force: ${config.moveTo.force}` : ''}
        }`
      : `        moveTo: {
          concepts: ["desired terms"]
          force: 0.85
        }`;

  const includeExplain = config?.includeExplainScore === false ? '' : '        explainScore';
  const hasTextVec = hasTextVectorizerModule(classSchema);
  const targetVectorsLine = formatTargetVectorsArg(classSchema, config);
  const collectionArgs = buildCollectionArgs(classSchema, limit, config);
  const headerComment =
    config?.includeHeaderComments === false
      ? hasTextVec
        ? ''
        : `  # NOTE: nearText requires a text vectorizer module\n`
      : buildQueryHeaderComments(collectionName, classSchema, { kind: 'nearText' }) +
        (hasTextVec
          ? ''
          : `  # NOTE: nearText requires a text vectorizer module (text2vec-openai, text2vec-cohere, etc.)\n  # If you get an "Unknown argument nearText" error, use nearVector instead\n`);

  return `{
${headerComment}  Get {
    ${collectionName}(
      nearText: {
        concepts: ${conceptsArr}
        ${thresholdLine}
${moveAwayBlock}
${moveToBlock}
${targetVectorsLine ? `        ${targetVectorsLine}` : ''}
      }
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
        id
        distance
        certainty
${includeExplain}
      }
    }
  }
}`;
}

/**
 * Generate a dynamic filter query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateDynamicFilterQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 10,
  config?: QueryConfig
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3, config);
  const filterExamples = generateFilterExamples(classSchema);
  const operator = config?.filterOperator ?? 'And';
  const collectionArgs = buildCollectionArgs(classSchema, limit, config);

  return `{
  Get {
    ${collectionName}(
      where: {
        operator: ${operator}
        operands: [
${filterExamples.join(',\n')}
        ]
      }
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
        id
      }
    }
  }
}`;
}

/**
 * Generate a dynamic aggregation query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @returns GraphQL query string
 */
export function generateDynamicAggregationQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  config?: QueryConfig
): string {
  if (!classSchema?.properties) {
    return generateAggregationQuery(collectionName);
  }

  const aggregationFields = generateAggregationFields(classSchema);
  const tenantRequired = isMultiTenantCollection(classSchema) || Boolean(config?.tenantName);
  const aggregateArgs = tenantRequired
    ? `(\n      tenant: "${config?.tenantName?.trim() || 'YOUR_TENANT_ID'}"\n    )`
    : '';

  return `{
  Aggregate {
    ${collectionName}${aggregateArgs} {
      meta {
        count
      }
${aggregationFields.join('\n')}
    }
  }
}`;
}

/**
 * Generate a dynamic hybrid search query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateDynamicHybridQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 10,
  config?: QueryConfig
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3, config);
  const queryText =
    typeof config?.searchQuery === 'string' && config!.searchQuery.length > 0
      ? config!.searchQuery.replace(/"/g, '\\"')
      : 'your search query here';
  const alphaVal = typeof config?.alpha === 'number' ? config!.alpha : 0.5;

  const propsOverride =
    Array.isArray(config?.propertiesOverride) && config!.propertiesOverride.length > 0
      ? config!.propertiesOverride
      : Array.isArray(config?.searchProperties) && config!.searchProperties!.length > 0
        ? config!.searchProperties!
        : getTextProperties(classSchema).slice(0, 3);

  const vec = Array.isArray(config?.vector) ? `[${config!.vector.join(', ')}]` : `[0.1, 0.2, 0.3]`;
  const targetVectorsLine = formatTargetVectorsArg(classSchema, config);
  const collectionArgs = buildCollectionArgs(classSchema, limit, config);

  return `{
  Get {
    ${collectionName} (
      hybrid: {
        query: "${queryText}"
        alpha: ${alphaVal} # Balance: 0=pure vector, 1=pure keyword search
        vector: ${vec} # Optional: provide custom vector (ensure its length matches your embedding model's dimension)
        properties: [${propsOverride.map((p) => `"${p}"`).join(', ')}] # Optional: limit search to specific properties
${targetVectorsLine ? `        ${targetVectorsLine}` : ''}
      }
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
        id
        score
        explainScore
      }
    }
  }
}`;
}

/**
 * Generate a dynamic BM25 search query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateDynamicBM25Query(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 10,
  config?: QueryConfig
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3, config);
  const defaultTextProps = getTextProperties(classSchema);
  const queryText =
    typeof config?.searchQuery === 'string' && config!.searchQuery.length > 0
      ? config!.searchQuery.replace(/"/g, '\\"')
      : 'search keywords here';
  const propsOverride =
    Array.isArray(config?.propertiesOverride) && config!.propertiesOverride.length > 0
      ? config!.propertiesOverride
      : Array.isArray(config?.searchProperties) && config!.searchProperties!.length > 0
        ? config!.searchProperties!
        : defaultTextProps.slice(0, 3);
  const collectionArgs = buildCollectionArgs(classSchema, limit, config);

  return `{
  Get {
    ${collectionName} (
      bm25: {
        query: "${queryText}"
        properties: [${propsOverride.map((p) => `"${p}"`).join(', ')}] # Optional: limit search to specific properties
      }
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
        id
        score
      }
    }
  }
}`;
}

/**
 * Generate a dynamic generative search query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 5)
 * @returns GraphQL query string
 */
export function generateDynamicGenerativeSearchQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  limit: number = 5,
  config?: QueryConfig
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3, config);
  const conceptsArr =
    Array.isArray(config?.concepts) && config!.concepts.length > 0
      ? `[${config!.concepts.map((c) => `"${String(c).replace(/"/g, '\\"')}"`).join(', ')}]`
      : `["search terms"]`;
  const distanceVal = typeof config?.distance === 'number' ? config!.distance : undefined;
  const certaintyVal = typeof config?.certainty === 'number' ? config!.certainty : 0.7;
  const thresholdLine =
    typeof distanceVal === 'number'
      ? `distance: ${distanceVal} # Max distance threshold (prefer distance in v1.14+; use certainty prior to v1.14)`
      : `certainty: ${certaintyVal}`;
  const taskText =
    typeof config?.generativePrompt === 'string' && config!.generativePrompt.length > 0
      ? config!.generativePrompt.replace(/"/g, '\\"')
      : 'Summarize these results in 2-3 sentences';
  const propsForGen =
    Array.isArray(config?.propertiesOverride) && config!.propertiesOverride.length > 0
      ? config!.propertiesOverride.slice(0, 2)
      : getTextProperties(classSchema).slice(0, 2);
  const targetVectorsLine = formatTargetVectorsArg(classSchema, config);
  const collectionArgs = buildCollectionArgs(classSchema, limit, config);

  return `{
  Get {
    ${collectionName} (
      nearText: {
        concepts: ${conceptsArr}
        ${thresholdLine}
${targetVectorsLine ? `        ${targetVectorsLine}` : ''}
      }
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
        id
        generate(
          groupedResult: {
            task: "${taskText}"
            properties: [${propsForGen.map((p) => `"${p}"`).join(', ')}]
          }
        ) {
          groupedResult
          error
        }
      }
    }
  }
}`;
}

/**
 * Schema-aware multi-tenant Get query with property selection.
 */
export function generateDynamicTenantQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  tenantName: string = 'YOUR_TENANT_ID',
  limit: number = 10,
  config?: QueryConfig
): string {
  const cfg: QueryConfig = { ...config, tenantName };
  const properties = getTopPropertiesForDisplay(classSchema, 5, cfg);
  const collectionArgs = buildCollectionArgs(classSchema, limit, cfg);
  const header =
    config?.includeHeaderComments === false
      ? ''
      : buildQueryHeaderComments(collectionName, classSchema, { kind: 'tenant Get' });

  return `{
${header}  Get {
    ${collectionName} (
      ${collectionArgs}
    ) {
${properties.join('\n')}
      _additional {
        id
        tenant
      }
    }
  }
}`;
}

/**
 * Generate a dynamic groupBy query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @returns GraphQL query string
 */
export function generateDynamicGroupByQuery(
  collectionName: string,
  classSchema?: ClassSchema,
  config?: QueryConfig
): string {
  const groupByPath =
    config?.groupByPath ||
    classSchema?.properties?.find((p) => isTextDataType(p.dataType))?.name ||
    'category';
  // tenant → groupBy → limit (readable order; GraphQL arg order is not semantic)
  const tenantRequired = isMultiTenantCollection(classSchema) || Boolean(config?.tenantName);
  const argLines: string[] = [];
  if (tenantRequired) {
    argLines.push(`tenant: "${config?.tenantName?.trim() || 'YOUR_TENANT_ID'}"`);
  }
  argLines.push(`groupBy: ["${groupByPath}"]`);
  argLines.push('limit: 10');

  return `{
  Aggregate {
    ${collectionName} (
      ${argLines.join('\n      ')}
    ) {
      groupedBy {
        value
        path
      }
      meta {
        count
      }
      # Add aggregations for grouped results
      # ${getTextProperties(classSchema).slice(0, 1)[0] || 'property'} {
      #   count
      #   topOccurrences(limit: 3) {
      #     value
      #     occurs
      #   }
      # }
    }
  }
}`;
}

/**
 * Generate a dynamic relationship query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @param limit Optional limit for the query (default: 5)
 * @returns GraphQL query string
 */

/**
 * Generate a dynamic explore query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @returns GraphQL query string
 */

/**
 * Generate a dynamic insert mutation based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @returns GraphQL mutation string
 */

/**
 * Helper function to get top properties for display
 */
function getTopPropertiesForDisplay(
  classSchema?: ClassSchema,
  maxCount: number = 5,
  config?: QueryConfig
): string[] {
  if (!classSchema?.properties) {
    return ['      # Add your properties here'];
  }

  const result = buildPropertySelections(classSchema, {
    maxCount,
    schema: config?.fullSchema,
    includeWarning: true,
    maxNestedProps: 3,
    indent: '      ',
    includeBlobs: config?.includeBlobs === true,
    maxReferences: 1,
    maxObjects: 1,
  });

  // Fallback: if classification produced nothing, include bare field names (skip blobs)
  if (result.length === 0 && classSchema.properties.length > 0) {
    return classSchema.properties
      .filter((p) => classifyProperty(p) !== 'blob')
      .slice(0, maxCount)
      .map((prop) => `      ${prop.name}`);
  }

  return result.length > 0 ? result : ['      # No properties found in schema'];
}

/**
 * Helper function to get text properties from schema
 */
function getTextProperties(classSchema?: ClassSchema): string[] {
  if (!classSchema?.properties) {
    return [];
  }

  return classSchema.properties
    .filter((p) => isTextDataType(p.dataType))
    .map((p) => p.name)
    .slice(0, 3);
}

/**
 * Helper function to check if a collection has a text vectorizer module configured
 */
function hasTextVectorizerModule(classSchema?: ClassSchema): boolean {
  if (!classSchema) {
    return false;
  }

  const textVectorizerPatterns = [
    'text2vec',
    'text-2-vec',
    'text_to_vec',
    'transformers',
    'openai',
    'cohere',
    'huggingface',
    'contextionary',
    'gpt4all',
    'palm',
  ];

  const candidates: string[] = [];

  // Legacy v1-style class-level vectorizer string
  if (classSchema.vectorizer) {
    candidates.push(classSchema.vectorizer.toLowerCase());
  }

  // Legacy moduleConfig keys
  if (classSchema.moduleConfig) {
    Object.keys(classSchema.moduleConfig).forEach((k) => candidates.push(k.toLowerCase()));
  }

  // v2-style vectorizers object (e.g., { default: { vectorizer: { name: 'text2vec-transformers', ... } } })
  if (classSchema.vectorizers) {
    const v: any = classSchema.vectorizers;
    if (typeof v === 'object') {
      const defaultName = v?.default?.vectorizer?.name;
      if (typeof defaultName === 'string') {
        candidates.push(String(defaultName).toLowerCase());
      }
      // Consider keys as candidates too (e.g., 'text2vec-transformers')
      Object.keys(v).forEach((k) => candidates.push(k.toLowerCase()));
    }
  }

  // Property-level vectorizerConfig (v2 per-property)
  if (classSchema.properties && classSchema.properties.length > 0) {
    classSchema.properties.forEach((p: any) => {
      if (p?.vectorizerConfig && typeof p.vectorizerConfig === 'object') {
        Object.keys(p.vectorizerConfig).forEach((k) => candidates.push(k.toLowerCase()));
      }
      if (p?.moduleConfig && typeof p.moduleConfig === 'object') {
        Object.keys(p.moduleConfig).forEach((k) => candidates.push(k.toLowerCase()));
      }
    });
  }

  return candidates.some((c) => textVectorizerPatterns.some((pattern) => c.includes(pattern)));
}

/**
 * Helper function to check if any vectorizer is configured (v1 or v2 schema)
 */
function hasAnyVectorizerConfigured(classSchema?: ClassSchema): boolean {
  if (!classSchema) {
    return false;
  }

  if (classSchema.vectorizer) {
    return true;
  }

  if (classSchema.moduleConfig && Object.keys(classSchema.moduleConfig).length > 0) {
    return true;
  }

  if (classSchema.vectorizers && Object.keys(classSchema.vectorizers).length > 0) {
    return true;
  }

  if (
    classSchema.properties?.some((p: any) => {
      const hasPropVec =
        (p?.vectorizerConfig && Object.keys(p.vectorizerConfig).length > 0) ||
        (p?.moduleConfig && Object.keys(p.moduleConfig).length > 0);
      return !!hasPropVec;
    })
  ) {
    return true;
  }

  return false;
}

/**
 * Helper function to estimate vector dimensions from schema
 */
function getVectorDimensions(classSchema?: ClassSchema): string {
  if (!classSchema) {
    return 'match your vectorizer dimensions';
  }

  // Strategy 1: Try to extract from vectorizer config (v1 style)
  if (classSchema?.moduleConfig) {
    const configs = Object.values(classSchema.moduleConfig);
    for (const config of configs) {
      if (typeof config === 'object' && config && 'model' in config) {
        const dimension = inferDimensionFromModel(String(config.model));
        if (dimension) {
          return dimension;
        }
      }
      // Check for explicit vectorIndexConfig dimensions
      if (typeof config === 'object' && config && 'vectorIndexConfig' in config) {
        const vectorConfig = (config as any).vectorIndexConfig;
        if (vectorConfig?.dimensions) {
          return String(vectorConfig.dimensions);
        }
      }
    }
  }

  // Strategy 2: Check v2-style vectorizers config
  if (classSchema?.vectorizers) {
    const v = classSchema.vectorizers as any;
    if (typeof v === 'object') {
      // Check default vectorizer
      const defaultVectorizer = v?.default?.vectorizer;
      if (defaultVectorizer?.name) {
        const dimension = inferDimensionFromModel(String(defaultVectorizer.name));
        if (dimension) {
          return dimension;
        }
      }
      // Check for model in config
      if (defaultVectorizer?.model) {
        const dimension = inferDimensionFromModel(String(defaultVectorizer.model));
        if (dimension) {
          return dimension;
        }
      }
    }
  }

  // Strategy 3: Check legacy vectorizer field
  if (classSchema?.vectorizer) {
    const dimension = inferDimensionFromModel(String(classSchema.vectorizer));
    if (dimension) {
      return dimension;
    }
  }

  // Fallback: generic message
  return 'match your vectorizer dimensions';
}

/**
 * Infer vector dimensions from model name.
 *
 * Uses EMBEDDING_MODEL_DIMENSIONS constant for dimension lookups.
 * Implements substring matching for flexible model name matching.
 *
 * @param modelName The name of the embedding model
 * @returns The dimension size as a string, or null if not found
 */
function inferDimensionFromModel(modelName: string): string | null {
  const model = modelName.toLowerCase();

  // First, try exact match with known models (case-insensitive)
  for (const [key, dimension] of Object.entries(EMBEDDING_MODEL_DIMENSIONS)) {
    if (model === key.toLowerCase()) {
      return String(dimension);
    }
  }

  // Then, try substring matching for flexible matching
  // (handles partial model names and versions)
  for (const [key, dimension] of Object.entries(EMBEDDING_MODEL_DIMENSIONS)) {
    if (model.includes(key.toLowerCase())) {
      return String(dimension);
    }
  }

  return null;
}

/**
 * Helper function to generate filter examples based on schema
 */
function generateFilterExamples(classSchema?: ClassSchema): string[] {
  if (!classSchema?.properties) {
    return [
      '          {\n            path: ["propertyName"]\n            operator: Equal\n            valueText: "example value"\n          }',
    ];
  }

  const examples: string[] = [];
  const properties = classSchema.properties.slice(0, 3); // Limit to 3 examples

  properties.forEach((prop) => {
    // Use base type so text[] / int[] produce the correct filter operators
    const dataType = getBaseDataType(prop.dataType);
    let example = '';

    switch (dataType) {
      case 'text':
      case 'string':
        example = `          {
            path: ["${prop.name}"]
            operator: Like
            valueText: "*search term*"
          }`;
        break;
      case 'int':
      case 'number':
        example = `          {
            path: ["${prop.name}"]
            operator: GreaterThan
            valueNumber: 100
          }`;
        break;
      case 'boolean':
        example = `          {
            path: ["${prop.name}"]
            operator: Equal
            valueBoolean: true
          }`;
        break;
      case 'date':
        example = `          {
            path: ["${prop.name}"]
            operator: GreaterThan
            valueDate: "2023-01-01T00:00:00Z"
          }`;
        break;
      default:
        // Skip cross-refs / nested objects for simple filter examples
        if (classifyProperty(prop) !== 'primitive' && classifyProperty(prop) !== 'unknown') {
          return;
        }
        example = `          {
            path: ["${prop.name}"]
            operator: Equal
            valueText: "filter value"
          }`;
    }

    if (example) {
      examples.push(example);
    }
  });

  return examples.length > 0
    ? examples
    : [
        '          {\n            path: ["propertyName"]\n            operator: Equal\n            valueText: "example value"\n          }',
      ];
}

/**
 * Helper function to generate aggregation fields based on schema
 */
function generateAggregationFields(classSchema: ClassSchema): string[] {
  if (!classSchema.properties) {
    return [];
  }

  const fields: string[] = [];

  classSchema.properties.slice(0, 5).forEach((prop) => {
    // Base type so text[] / number[] get the correct aggregation metrics
    const dataType = getBaseDataType(prop.dataType);

    switch (dataType) {
      case 'text':
      case 'string':
        fields.push(`      ${prop.name} {
        count
        topOccurrences(limit: 5) {
          value
          occurs
        }
      }`);
        break;
      case 'int':
      case 'number':
        fields.push(`      ${prop.name} {
        count
        minimum
        maximum
        mean
        median
        sum
      }`);
        break;
      case 'boolean':
        fields.push(`      ${prop.name} {
        count
        totalTrue
        totalFalse
        percentageTrue
        percentageFalse
      }`);
        break;
      case 'date':
        fields.push(`      ${prop.name} {
        count
        minimum
        maximum
      }`);
        break;
    }
  });

  return fields;
}
