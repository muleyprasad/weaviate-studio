/**
 * Query templates for common Weaviate GraphQL operations
 */

export interface QueryTemplate {
  name: string;
  description: string;
  template: string;
}

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

  return `{
  Get {
    ${collectionName} (
      nearVector: {
        vector: [0.1, 0.2, 0.3] # Replace with your actual vector (must match vectorizer dimensions)
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
        vector: [0.1, 0.2, 0.3] # Optional: provide custom vector
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
  const { maxProperties = 5, includeVectors = false } = config;

  if (!classSchema?.properties) {
    return ['      # Add your properties here'];
  }

  const properties = classSchema.properties;
  const primitiveTypes = ['text', 'string', 'int', 'number', 'boolean', 'date'];

  // Get primitive properties first
  const primitives = properties
    .filter((p) => primitiveTypes.includes(p.dataType?.[0]?.toLowerCase() || ''))
    .slice(0, maxProperties);

  const result: string[] = [];

  primitives.forEach((prop) => {
    result.push(`      ${prop.name}`);
  });

  // Add geo coordinates if available and space allows
  if (result.length < maxProperties) {
    const geoProps = properties
      .filter((p) => p.dataType?.[0]?.toLowerCase() === 'geocoordinates')
      .slice(0, 1);

    geoProps.forEach((prop) => {
      result.push(`      ${prop.name} {
        latitude
        longitude
      }`);
    });
  }

  return result.length > 0 ? result : ['      # No properties found in schema'];
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

  // Sanitize by removing potential harmful content (basic implementation)
  let sanitizedQuery = query
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
  const hasTextProperties = classSchema.properties.some((p) =>
    ['text', 'string'].includes(p.dataType?.[0]?.toLowerCase() || '')
  );
  const hasGeoProperties = classSchema.properties.some(
    (p) => p.dataType?.[0]?.toLowerCase() === 'geocoordinates'
  );

  return {
    includeVectors: hasVector,
    includeMetadata: true,
    includeScores: hasVector,
    maxProperties: hasGeoProperties ? 4 : 5,
    certainty: 0.7,
    distance: 0.6,
    limit: 10,
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
  // Find the class definition from schema if available
  const classSchema = schema?.classes?.find((c) => c.class === collectionName);

  let propertyStrings: string[] = [];

  // If no specific properties provided, generate from schema
  if (properties.length === 0 && classSchema?.properties) {
    // Get all properties from schema, prioritizing simple types first
    const primitiveTypes = [
      'text',
      'string',
      'int',
      'number',
      'boolean',
      'date',
      'phoneNumber',
      'uuid',
      'blob',
    ];

    // Separate primitive and reference properties
    const primitiveProps = classSchema.properties.filter((p) =>
      p.dataType.some(
        (dt) => primitiveTypes.includes(dt.toLowerCase()) || dt.toLowerCase() === 'geocoordinates'
      )
    );
    const referenceProps = classSchema.properties.filter(
      (p) =>
        !p.dataType.some(
          (dt) => primitiveTypes.includes(dt.toLowerCase()) || dt.toLowerCase() === 'geocoordinates'
        )
    );

    // Add all primitive and geoCoordinate properties
    primitiveProps.forEach((prop) => {
      // Special handling for geoCoordinates - they need latitude and longitude sub-fields
      if (prop.dataType.some((dt) => dt.toLowerCase() === 'geocoordinates')) {
        propertyStrings.push(`${prop.name} {
        latitude
        longitude
      }`);
      } else {
        propertyStrings.push(prop.name);
      }
    });

    // Add all reference properties with proper nested structure
    referenceProps.forEach((prop) => {
      const referencedClassName = prop.dataType[0];
      const referencedClass = schema?.classes?.find((c) => c.class === referencedClassName);

      if (referencedClass && referencedClass.properties) {
        // Get all primitive properties from the referenced class
        const refPrimitiveProps = referencedClass.properties.filter((p) =>
          p.dataType.some((dt) => primitiveTypes.includes(dt.toLowerCase()))
        );

        if (refPrimitiveProps.length > 0) {
          const nestedProps = refPrimitiveProps.map((p) => `          ${p.name}`).join('\n');
          propertyStrings.push(`${prop.name} {
        # WARNING: This may return many linked objects. Consider using a separate query 
        # or adjust the main query limit to control total results.
        ... on ${referencedClassName} {
${nestedProps}
          _additional {
            id
          }
        }
      }`);
        } else {
          // No suitable properties found, use a basic structure
          propertyStrings.push(`${prop.name} {
        # WARNING: This may return many linked objects. Consider using a separate query.
        ... on ${referencedClassName} {
          _additional {
            id
          }
        }
      }`);
        }
      } else {
        // We couldn't find schema info for the referenced class
        // Use a generic structure with _additional.id
        propertyStrings.push(`${prop.name} {
        # WARNING: This may return many linked objects. Consider using a separate query.
        ... on ${referencedClassName} {
          _additional {
            id
          }
        }
      }`);
      }
    });
  } else {
    // Use provided properties or generate property strings with schema info
    const propsToUse = properties.length > 0 ? properties : ['# Add your properties here'];

    propertyStrings = propsToUse.map((propName) => {
      // If we have schema information, check if this is a relationship field
      if (classSchema?.properties) {
        const propSchema = classSchema.properties.find((p) => p.name === propName);

        // Check if this is a reference/cross-reference property
        if (propSchema && propSchema.dataType && propSchema.dataType.length > 0) {
          // Cross-references in Weaviate have dataType starting with the class name
          const referencedClassName = propSchema.dataType[0];

          // If it's not a primitive type, it's likely a reference
          const primitiveTypes = [
            'text',
            'string',
            'int',
            'number',
            'boolean',
            'date',
            'phoneNumber',
            'uuid',
            'blob',
          ];
          if (!primitiveTypes.includes(referencedClassName.toLowerCase())) {
            // Find the referenced class's schema
            const referencedClass = schema?.classes?.find((c) => c.class === referencedClassName);

            // If we found the referenced class, include a few of its properties
            if (referencedClass && referencedClass.properties) {
              // Get all non-reference primitive properties from the referenced class
              const refProperties = referencedClass.properties
                .filter((p) => primitiveTypes.includes(p.dataType[0].toLowerCase()))
                .map((p) => p.name);

              // If we have properties to include
              if (refProperties.length > 0) {
                const nestedProps = refProperties.map((p) => `          ${p}`).join('\n');
                return `${propName} {
        ... on ${referencedClassName} {
${nestedProps}
          _additional {
            id
          }
        }
      }`;
              } else {
                // No suitable properties found, use a placeholder
                return `${propName} {
        ... on ${referencedClassName} {
          _additional {
            id
          }
        }
      }`;
              }
            } else {
              // We couldn't find schema info for the referenced class, but we know it's a reference
              // Use a generic structure with _additional.id
              return `${propName} {
        ... on ${referencedClassName} {
          _additional {
            id
          }
        }
      }`;
            }
          } else {
            // This is a primitive type - check if it's geoCoordinates which needs special handling
            if (referencedClassName.toLowerCase() === 'geocoordinates') {
              return `${propName} {
        latitude
        longitude
      }`;
            }
          }
        } else if (propSchema) {
          // We found the property in schema but it has no dataType or it's a primitive
          // Check if it's geoCoordinates
          if (
            propSchema.dataType &&
            propSchema.dataType.some((dt) => dt.toLowerCase() === 'geocoordinates')
          ) {
            return `${propName} {
        latitude
        longitude
      }`;
          }
          return propName;
        } else {
          // Property not found in schema - could be a reference field with naming convention
          // Check if it looks like a reference field (camelCase ending with class name or common patterns)
          const referencePatterns = [
            /^[a-z]+[A-Z][a-zA-Z]*$/, // camelCase pattern
            /^(wrote|writes|has|belongs|contains|references)[A-Z]/i, // common relationship verbs
            /[A-Z][a-z]*$/, // ends with capitalized word (likely class name)
          ];

          const looksLikeReference = referencePatterns.some((pattern) => pattern.test(propName));

          if (looksLikeReference) {
            // Try to infer the referenced class name from the property name
            // Common patterns: wroteArticles -> Article, writesFor -> Publication, etc.
            let inferredClassName = '';

            if (propName.includes('Articles')) {
              inferredClassName = 'Article';
            } else if (propName.includes('For')) {
              inferredClassName = 'Publication'; // or Organization, etc.
            } else {
              // Extract the capitalized part at the end
              const match = propName.match(/[A-Z][a-z]*$/);
              inferredClassName = match ? match[0] : 'Unknown';
            }

            return `${propName} {
        ... on ${inferredClassName} {
          _additional {
            id
          }
        }
      }`;
          }
        }
      }

      // If we couldn't determine it's a relationship or don't have schema info,
      // just return the property name
      return propName;
    });
  }

  // Always include _additional.id for object identification
  if (!propertyStrings.some((p) => p.includes('_additional'))) {
    propertyStrings.unshift('_additional {\n        id\n      }');
  }

  return `{
  Get {
    ${collectionName} (limit: ${limit}) {
      ${propertyStrings.join('\n      ')}
    }
  }
}`;
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
  // Helpers to normalize various schema shapes (v1/v2)
  const coerceToArray = (v: any): string[] =>
    Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];

  const normalizeClassSchema = (input: any): ClassSchema | undefined => {
    if (!input) {
      return undefined;
    }
    const normalized: ClassSchema = {
      class: input.class ?? input.name,
      description: input.description,
      properties: Array.isArray(input.properties)
        ? input.properties.map((p: any) => ({
            name: p.name,
            dataType: coerceToArray(p.dataType),
            description: p.description,
            tokenization: p.tokenization,
            indexSearchable: p.indexSearchable,
            indexFilterable: p.indexFilterable,
            moduleConfig: p.moduleConfig,
            vectorizerConfig: p.vectorizerConfig,
          }))
        : [],
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
        ? generateDynamicGenerativeSearchQuery(collectionName, classSchema, effectiveLimit, config)
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
    );

  return query;
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

  const properties = classSchema.properties;

  // Categorize properties
  const primitiveProps: PropertySchema[] = [];
  const referenceProps: PropertySchema[] = [];
  const geoProps: PropertySchema[] = [];

  properties.forEach((prop) => {
    const dataType = prop.dataType?.[0]?.toLowerCase() || '';

    if (dataType === 'geocoordinates') {
      geoProps.push(prop);
    } else if (
      [
        'text',
        'string',
        'int',
        'number',
        'boolean',
        'date',
        'phonenumber',
        'uuid',
        'blob',
      ].includes(dataType)
    ) {
      primitiveProps.push(prop);
    } else {
      // It's likely a reference to another class
      referenceProps.push(prop);
    }
  });

  let propertyLines: string[] = [];

  // Add up to 5 primitive properties
  const selectedPrimitives = primitiveProps.slice(0, 5);
  selectedPrimitives.forEach((prop) => {
    propertyLines.push(`      ${prop.name}`);
  });

  // Add up to 2 geo coordinate properties
  const selectedGeoProps = geoProps.slice(0, 2);
  selectedGeoProps.forEach((prop) => {
    propertyLines.push(`      ${prop.name} {
        latitude
        longitude
      }`);
  });

  // Add up to 2 reference properties with nested selection
  const selectedReferenceProps = referenceProps.slice(0, 2);
  selectedReferenceProps.forEach((prop) => {
    const referencedClassName = prop.dataType?.[0] || 'Unknown';
    propertyLines.push(`      ${prop.name} {
        # WARNING: May return many linked objects. Consider separate queries if needed.
        ... on ${referencedClassName} {
          _additional {
            id
          }
        }
      }`);
  });

  // Always include _additional for metadata
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
        vector: ${vec} # Optional: provide custom vector
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
    classSchema?.properties?.find((p) =>
      ['text', 'string'].includes(p.dataType?.[0]?.toLowerCase() || '')
    )?.name || 'category';

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

  const properties = classSchema.properties;
  const primitiveTypes = [
    'text',
    'string',
    'int',
    'number',
    'boolean',
    'date',
    'phonenumber',
    'uuid',
  ];

  // Prioritize primitive types, then geo coordinates, then references
  const primitives = properties
    .filter((p) => primitiveTypes.includes(p.dataType?.[0]?.toLowerCase() || ''))
    .slice(0, Math.min(maxCount, 3));

  const geoProps = properties
    .filter((p) => p.dataType?.[0]?.toLowerCase() === 'geocoordinates')
    .slice(0, 1);

  const remainingSlots = maxCount - primitives.length - geoProps.length;
  const references = properties
    .filter(
      (p) =>
        !primitiveTypes.includes(p.dataType?.[0]?.toLowerCase() || '') &&
        p.dataType?.[0]?.toLowerCase() !== 'geocoordinates'
    )
    .slice(0, Math.max(0, remainingSlots));

  const result: string[] = [];

  primitives.forEach((prop) => {
    result.push(`      ${prop.name}`);
  });

  geoProps.forEach((prop) => {
    result.push(`      ${prop.name} {
        latitude
        longitude
      }`);
  });

  references.forEach((prop) => {
    const refClassName = prop.dataType?.[0] || 'Unknown';
    result.push(`      ${prop.name} {
        # WARNING: May return many objects. Consider separate queries if needed.
        ... on ${refClassName} {
          _additional { id }
        }
      }`);
  });

  // Fallback: if no properties were classified, include the first N properties as plain fields
  if (result.length === 0 && Array.isArray(properties) && properties.length > 0) {
    properties.slice(0, maxCount).forEach((prop) => {
      result.push(`      ${prop.name}`);
    });
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
    .filter((p) => ['text', 'string'].includes(p.dataType?.[0]?.toLowerCase() || ''))
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
  // Try to extract from vectorizer config
  if (classSchema?.moduleConfig) {
    const configs = Object.values(classSchema.moduleConfig);
    for (const config of configs) {
      if (typeof config === 'object' && config && 'model' in config) {
        // Common dimension sizes for popular models
        const model = String(config.model).toLowerCase();
        if (model.includes('openai') || model.includes('ada-002')) {
          return '1536';
        }
        if (model.includes('sentence-transformers') || model.includes('all-mpnet')) {
          return '768';
        }
        if (model.includes('cohere')) {
          return '4096';
        }
      }
    }
  }

  return 'match your vectorizer dimensions';
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
    const dataType = prop.dataType?.[0]?.toLowerCase() || '';
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
    const dataType = prop.dataType?.[0]?.toLowerCase() || '';

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
