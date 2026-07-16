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
} {
  const errors: string[] = [];

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
      typeName.toLowerCase() === 'geocoordinates'
    ) {
      errors.push(
        `Invalid inline fragment type "${typeName}" — scalar Weaviate types are selected as plain fields, not fragments`
      );
    }
  }

  // Sanitize by removing potential harmful content (basic implementation)
  const sanitizedQuery = query
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .trim();

  return {
    valid: errors.length === 0,
    sanitizedQuery,
    errors,
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

  const hasVector = classSchema.vectorizer !== undefined;
  const hasTextProperties = classSchema.properties.some((p) => isTextDataType(p.dataType));
  const hasGeoProperties = classSchema.properties.some((p) => isGeoDataType(p.dataType));

  return {
    includeVectors: hasVector,
    includeMetadata: true,
    includeScores: hasVector,
    maxProperties: hasGeoProperties ? 4 : 5,
    certainty: 0.7,
    distance: 0.6,
    limit: 10,
    // Prefer text fields (including text[]) for BM25 / hybrid when available
    searchProperties: hasTextProperties
      ? classSchema.properties
          .filter((p) => isTextDataType(p.dataType))
          .map((p) => p.name)
          .slice(0, 5)
      : undefined,
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
  vectorizers?: Record<string, any>;
}

/**
 * Scalar Weaviate property types (array forms like text[] share the same base).
 * Cross-references use collection/class names and are NOT listed here.
 */
export const PRIMITIVE_BASE_TYPES = new Set([
  'text',
  'string',
  'int',
  'number',
  'boolean',
  'date',
  'phonenumber',
  'uuid',
  'blob',
]);

export type PropertyKind = 'primitive' | 'geo' | 'object' | 'reference' | 'unknown';

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

export function isObjectDataType(dataType: string | string[] | undefined | null): boolean {
  return getBaseDataType(dataType) === 'object';
}

export function isTextDataType(dataType: string | string[] | undefined | null): boolean {
  const base = getBaseDataType(dataType);
  return base === 'text' || base === 'string';
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
    if (lower === 'object' || lower === 'geocoordinates') {
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
 * - primitives / unknown: bare field name (works for text, text[], int[], …)
 * - geo: latitude/longitude subselection
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

  if (kind === 'object') {
    const nestedTypeName = `${collectionName}_${prop.name}_object`;
    if (!isValidGraphQLTypeName(nestedTypeName)) {
      return `${indent}${prop.name}`;
    }
    const nested = (prop.nestedProperties || []).slice(0, maxNestedProps);
    if (nested.length === 0) {
      // Schema did not expose nested fields — still select the object safely.
      return `${indent}${prop.name} {
${indent}  # Nested fields unavailable in schema; add them manually if needed.
${indent}  __typename
${indent}}`;
    }
    const nestedPropsStr = nested
      .map((np) => {
        // Nested props may themselves be nested objects or geo; keep first level simple.
        const npKind = classifyProperty(np);
        if (npKind === 'geo') {
          return `${indent}  ${np.name} {\n${indent}    latitude\n${indent}    longitude\n${indent}  }`;
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
        const referencedClass = schema?.classes?.find((c) => c.class === className);
        let body: string;
        if (referencedClass?.properties?.length) {
          const refPrimitiveProps = referencedClass.properties
            .filter((p) => classifyProperty(p) === 'primitive' || classifyProperty(p) === 'unknown')
            .slice(0, maxNestedProps);
          if (refPrimitiveProps.length > 0) {
            const lines = refPrimitiveProps.map((p) => `${indent}    ${p.name}`);
            if (includeRefAdditional) {
              lines.push(`${indent}    _additional {`, `${indent}      id`, `${indent}    }`);
            }
            body = lines.join('\n');
          } else if (includeRefAdditional) {
            body = `${indent}    _additional {\n${indent}      id\n${indent}    }`;
          } else {
            body = `${indent}    __typename`;
          }
        } else if (includeRefAdditional) {
          body = `${indent}    _additional {\n${indent}      id\n${indent}    }`;
        } else {
          body = `${indent}    __typename`;
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

/**
 * Build a selection list for display/query generators from a class schema.
 */
export function buildPropertySelections(
  classSchema: ClassSchema | undefined,
  options: {
    maxCount?: number;
    schema?: { classes?: ClassSchema[] };
    includeAll?: boolean;
    maxNestedProps?: number;
    includeWarning?: boolean;
    indent?: string;
  } = {}
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
  } = options;

  const primitives: PropertySchema[] = [];
  const geo: PropertySchema[] = [];
  const objects: PropertySchema[] = [];
  const references: PropertySchema[] = [];

  for (const prop of classSchema.properties) {
    switch (classifyProperty(prop)) {
      case 'geo':
        geo.push(prop);
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
      ...geo.map(format),
      ...objects.map(format),
      ...references.map(format),
    ];
  }

  // Prefer scalars, then geo, nested objects, then a small number of refs.
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
  take(geo, Math.max(0, maxCount - result.length));
  take(objects, Math.min(2, Math.max(0, maxCount - result.length)));
  take(references, Math.min(2, Math.max(0, maxCount - result.length)));

  return result;
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
}

/**
 * Generate a sample query for a collection based on its schema
 * @param collectionName The name of the collection
 * @param properties Optional array of property names to include
 * @param limit Optional limit for the query (default: 10)
 * @param schema Optional schema information for proper relationship handling
 * @returns GraphQL query string
 */
export function generateSampleQuery(
  collectionName: string,
  properties: string[] = [],
  limit: number = 10,
  schema?: { classes?: ClassSchema[] }
): string {
  // Find the class definition from schema if available (case-insensitive)
  const classSchema =
    schema?.classes?.find((c) => c.class === collectionName) ||
    schema?.classes?.find((c) => c.class?.toLowerCase() === collectionName.toLowerCase());

  let propertyStrings: string[] = [];

  if (properties.length === 0 && classSchema?.properties?.length) {
    // Include all schema properties, classified correctly (text[] is scalar, not a ref).
    propertyStrings = buildPropertySelections(classSchema, {
      includeAll: true,
      schema,
      indent: '      ',
      maxNestedProps: 5,
      includeWarning: true,
    });
  } else if (properties.length > 0) {
    propertyStrings = properties.map((propName) => {
      const propSchema = classSchema?.properties?.find((p) => p.name === propName);
      if (propSchema && classSchema) {
        return formatPropertySelection(propSchema, {
          collectionName: classSchema.class,
          schema,
          indent: '      ',
          maxNestedProps: 5,
          includeWarning: true,
        });
      }
      // Unknown property name — emit as a plain field (never invent invalid fragments).
      return `      ${propName}`;
    });
  } else {
    propertyStrings = ['      # Add your properties here'];
  }

  // Always include _additional.id for object identification
  if (!propertyStrings.some((p) => p.includes('_additional'))) {
    propertyStrings.unshift('      _additional {\n        id\n      }');
  }

  // formatPropertySelection already indents; join without extra leading indent.
  return `{
  Get {
    ${collectionName} (limit: ${limit}) {
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

    const normalizeClassSchema = (input: any): ClassSchema | undefined => {
      if (!input) {
        return undefined;
      }
      const normalized: ClassSchema = {
        class: input.class ?? input.name,
        description: input.description,
        properties: Array.isArray(input.properties) ? input.properties.map(normalizeProperty) : [],
        vectorizer: input.vectorizer,
        moduleConfig: input.moduleConfig,
        vectorizers: input.vectorizers,
      };
      return normalized;
    };

    // Find the class/collection definition across possible schema shapes
    let classSchema: ClassSchema | undefined = undefined;
    const classesAny = (schema as any)?.classes || (schema as any)?.collections;
    const lc = (s: any) => (typeof s === 'string' ? s.toLowerCase() : '');
    if (Array.isArray(classesAny)) {
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
    }

    // Check if the template is a predefined template name (queries only)
    const predefinedTemplate = queryTemplates.find((t) => t.name === template);
    if (predefinedTemplate) {
      template = predefinedTemplate.template;
    }

    // Determine effective limit (config overrides param)
    const effectiveLimit = config?.limit ?? limit;

    // Replace placeholders with actual values using dynamic generation when possible
    let query = template
      .replace(
        '{nearVectorQuery}',
        classSchema
          ? generateDynamicNearVectorQuery(collectionName, classSchema, effectiveLimit, config)
          : generateNearVectorQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{nearObjectQuery}',
        generateNearObjectQuery(collectionName, undefined, effectiveLimit)
      )
      .replace(
        '{nearTextQuery}',
        classSchema
          ? generateDynamicNearTextQuery(collectionName, classSchema, effectiveLimit, config)
          : generateNearTextQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{hybridQuery}',
        classSchema
          ? generateDynamicHybridQuery(collectionName, classSchema, effectiveLimit, config)
          : generateHybridQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{bm25Query}',
        classSchema
          ? generateDynamicBM25Query(collectionName, classSchema, effectiveLimit, config)
          : generateBM25Query(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{generativeSearchQuery}',
        classSchema
          ? generateDynamicGenerativeSearchQuery(
              collectionName,
              classSchema,
              effectiveLimit,
              config
            )
          : generateGenerativeSearchQuery(collectionName, effectiveLimit, config?.returnProperties)
      )
      .replace(
        '{groupByQuery}',
        classSchema
          ? generateDynamicGroupByQuery(collectionName, classSchema)
          : generateGroupByQuery(collectionName)
      )
      .replace(
        '{filterQuery}',
        classSchema
          ? generateDynamicFilterQuery(collectionName, classSchema, effectiveLimit, config)
          : generateFilterQuery(collectionName, effectiveLimit)
      )
      .replace(
        '{aggregationQuery}',
        classSchema
          ? generateDynamicAggregationQuery(collectionName, classSchema)
          : generateAggregationQuery(collectionName)
      )
      .replace(
        '{tenantQuery}',
        generateTenantQuery(collectionName, config?.tenantName ?? 'tenant-name', effectiveLimit)
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
  limit: number = 10
): string {
  if (!classSchema || !classSchema.properties) {
    return `{
  Get {
    ${collectionName} (limit: ${limit}) {
      # Add your properties here - replace with actual properties from your schema
      _additional {
        id
        creationTimeUnix
        lastUpdateTimeUnix
      }
    }
  }
}`;
  }

  // Ensure class name is set for nested type names
  const schemaForBuild: ClassSchema = {
    ...classSchema,
    class: classSchema.class || collectionName,
  };

  const propertyLines = buildPropertySelections(schemaForBuild, {
    maxCount: 8,
    includeAll: false,
    maxNestedProps: 3,
    includeWarning: true,
    indent: '      ',
  });

  propertyLines.unshift(`      _additional {
        id
        creationTimeUnix
        lastUpdateTimeUnix
      }`);

  return `{
  Get {
    ${collectionName}(limit: ${limit}) {
${propertyLines.join('\n')}
    }
  }
}`;
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
  const properties = getTopPropertiesForDisplay(classSchema, 3);
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

  return `{
  Get {
    ${collectionName}(
      nearVector: {
        vector: ${vectorStr} # Replace with your actual vector (${dimsText})
        ${thresholdLine}
      }
      limit: ${limit}
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
  const properties = getTopPropertiesForDisplay(classSchema, 3);

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
  const headerComment = hasTextVec
    ? ''
    : `  # NOTE: nearText requires a text vectorizer module (text2vec-openai, text2vec-cohere, etc.)
  # If you get an "Unknown argument nearText" error, use nearVector instead or configure a text vectorizer

`;

  return `{
${headerComment}  Get {
    ${collectionName}(
      nearText: {
        concepts: ${conceptsArr}
        ${thresholdLine}
${moveAwayBlock}
${moveToBlock}
      }
      limit: ${limit}
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
  const properties = getTopPropertiesForDisplay(classSchema, 3);
  const filterExamples = generateFilterExamples(classSchema);
  const operator = config?.filterOperator ?? 'And';

  return `{
  Get {
    ${collectionName}(
      where: {
        operator: ${operator}
        operands: [
${filterExamples.join(',\n')}
        ]
      }
      limit: ${limit}
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
  classSchema?: ClassSchema
): string {
  if (!classSchema?.properties) {
    return generateAggregationQuery(collectionName);
  }

  const aggregationFields = generateAggregationFields(classSchema);

  return `{
  Aggregate {
    ${collectionName} {
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
  const properties = getTopPropertiesForDisplay(classSchema, 3);
  const queryText =
    typeof config?.searchQuery === 'string' && config!.searchQuery.length > 0
      ? config!.searchQuery.replace(/"/g, '\\"')
      : 'your search query here';
  const alphaVal = typeof config?.alpha === 'number' ? config!.alpha : 0.5;

  const propsOverride =
    Array.isArray(config?.propertiesOverride) && config!.propertiesOverride.length > 0
      ? config!.propertiesOverride
      : getTextProperties(classSchema).slice(0, 3);

  const vec = Array.isArray(config?.vector) ? `[${config!.vector.join(', ')}]` : `[0.1, 0.2, 0.3]`;

  return `{
  Get {
    ${collectionName} (
      hybrid: {
        query: "${queryText}"
        alpha: ${alphaVal} # Balance: 0=pure vector, 1=pure keyword search
        vector: ${vec} # Optional: provide custom vector (ensure its length matches your embedding model's dimension)
        properties: [${propsOverride.map((p) => `"${p}"`).join(', ')}] # Optional: limit search to specific properties
      }
      limit: ${limit}
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
  const properties = getTopPropertiesForDisplay(classSchema, 3);
  const defaultTextProps = getTextProperties(classSchema);
  const queryText =
    typeof config?.searchQuery === 'string' && config!.searchQuery.length > 0
      ? config!.searchQuery.replace(/"/g, '\\"')
      : 'search keywords here';
  const propsOverride =
    Array.isArray(config?.propertiesOverride) && config!.propertiesOverride.length > 0
      ? config!.propertiesOverride
      : defaultTextProps.slice(0, 3);

  return `{
  Get {
    ${collectionName} (
      bm25: {
        query: "${queryText}"
        properties: [${propsOverride.map((p) => `"${p}"`).join(', ')}] # Optional: limit search to specific properties
      }
      limit: ${limit}
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
  const properties = getTopPropertiesForDisplay(classSchema, 3);
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

  return `{
  Get {
    ${collectionName} (
      nearText: {
        concepts: ${conceptsArr}
        ${thresholdLine}
      }
      limit: ${limit}
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
 * Generate a dynamic groupBy query based on schema
 * @param collectionName The name of the collection
 * @param classSchema The class schema definition
 * @returns GraphQL query string
 */
export function generateDynamicGroupByQuery(
  collectionName: string,
  classSchema?: ClassSchema
): string {
  const groupByPath =
    classSchema?.properties?.find((p) => isTextDataType(p.dataType))?.name || 'category';

  return `{
  Aggregate {
    ${collectionName} (
      groupBy: ["${groupByPath}"]
      limit: 10
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
function getTopPropertiesForDisplay(classSchema?: ClassSchema, maxCount: number = 5): string[] {
  if (!classSchema?.properties) {
    return ['      # Add your properties here'];
  }

  const result = buildPropertySelections(classSchema, {
    maxCount,
    includeWarning: true,
    maxNestedProps: 3,
    indent: '      ',
  });

  // Fallback: if classification produced nothing, include bare field names
  if (result.length === 0 && classSchema.properties.length > 0) {
    return classSchema.properties.slice(0, maxCount).map((prop) => `      ${prop.name}`);
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
