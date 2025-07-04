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
export function generateNearVectorQuery(collectionName: string, limit: number = 10): string {
  return `{
  Get {
    ${collectionName} (
      nearVector: {
        vector: [0.1, 0.2, 0.3] # Replace with your actual vector (must match vectorizer dimensions)
        certainty: 0.7 # Minimum similarity threshold (0-1)
      }
      limit: ${limit}
    ) {
      # Replace with actual properties from your schema
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
export function generateNearTextQuery(collectionName: string, limit: number = 10): string {
  return `{
  # NOTE: nearText requires a text vectorizer module (text2vec-openai, text2vec-cohere, etc.)
  # If you get an "Unknown argument nearText" error, use nearVector instead or configure a text vectorizer
  
  Get {
    ${collectionName} (
      nearText: {
        concepts: ["search terms", "semantic concepts"]
        certainty: 0.7 # Minimum similarity threshold (0-1)
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
      # Replace with actual properties from your schema
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

/**
 * Generate a hybrid search query (BM25 + Vector)
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateHybridQuery(collectionName: string, limit: number = 10): string {
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
      # Replace with actual properties from your schema
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
 * Generate a query to explore object relationships
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 5)
 * @returns GraphQL query string
 */
export function generateRelationshipQuery(collectionName: string, limit: number = 5): string {
  return `{
  Get {
    ${collectionName} (limit: ${limit}) {
      # Replace with actual properties from your schema
      
      # Example reference properties (replace with actual ones):
      # NOTE: Reference properties cannot be limited individually in Weaviate GraphQL.
      # To control results: 1) Use a smaller main query limit, 2) Use separate queries, 
      # or 3) Filter the main query to reduce linked objects.
      
      # hasAuthor {
      #   ... on Author {
      #     name
      #     email
      #     _additional { id }
      #   }
      # }
      
      # belongsToCategory {
      #   ... on Category {
      #     name
      #     description
      #     _additional { id }
      #   }
      # }
      
      _additional {
        id
      }
    }
  }
}`;
}



/**
 * Generate a query to check object existence and get metadata
 * @param collectionName The name of the collection to query
 * @returns GraphQL query string
 */
export function generateExploreQuery(collectionName: string): string {
  return `{
  Get {
    ${collectionName} (limit: 1) {
      _additional {
        id
        creationTimeUnix
        lastUpdateTimeUnix
        vector
        generate(
          singleResult: {
            prompt: "Summarize this object in one sentence: {title} {description}"
          }
        ) {
          singleResult
          error
        }
      }
    }
  }
}`;
}

/**
 * Collection of predefined query templates
 */
export const queryTemplates: QueryTemplate[] = [
  {
    name: 'Vector Search (nearVector)',
    description: 'Search for similar objects using a vector with similarity scoring',
    template: '{nearVectorQuery}'
  },
  {
    name: 'Semantic Search (nearText)',
    description: 'Search for similar objects using text concepts with move operations',
    template: '{nearTextQuery}'
  },
  {
    name: 'Hybrid Search',
    description: 'Combine vector and keyword search with configurable balance',
    template: '{hybridQuery}'
  },
  {
    name: 'Filter Query',
    description: 'Filter objects based on property values with multiple operators',
    template: '{filterQuery}'
  },
  {
    name: 'Aggregation Query',
    description: 'Calculate comprehensive statistics across objects by property type',
    template: '{aggregationQuery}'
  },
  {
    name: 'Relationship Query',
    description: 'Explore object relationships and cross-references',
    template: '{relationshipQuery}'
  },
  {
    name: 'Explore Query',
    description: 'Get object metadata, vectors, and AI-generated summaries',
    template: '{exploreQuery}'
  }
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
  const classSchema = schema?.classes?.find(c => c.class === collectionName);
  
  let propertyStrings: string[] = [];
  
  // If no specific properties provided, generate from schema
  if (properties.length === 0 && classSchema?.properties) {
    // Get all properties from schema, prioritizing simple types first
    const primitiveTypes = ['text', 'string', 'int', 'number', 'boolean', 'date', 'phoneNumber', 'uuid', 'blob'];
    
    // Separate primitive and reference properties
    const primitiveProps = classSchema.properties.filter(p => 
      p.dataType.some(dt => primitiveTypes.includes(dt.toLowerCase()) || dt.toLowerCase() === 'geocoordinates')
    );
    const referenceProps = classSchema.properties.filter(p => 
      !p.dataType.some(dt => primitiveTypes.includes(dt.toLowerCase()) || dt.toLowerCase() === 'geocoordinates')
    );
    
    // Add all primitive and geoCoordinate properties
    primitiveProps.forEach(prop => {
      // Special handling for geoCoordinates - they need latitude and longitude sub-fields
      if (prop.dataType.some(dt => dt.toLowerCase() === 'geocoordinates')) {
        propertyStrings.push(`${prop.name} {
        latitude
        longitude
      }`);
      } else {
        propertyStrings.push(prop.name);
      }
    });
    
    // Add all reference properties with proper nested structure
    referenceProps.forEach(prop => {
      const referencedClassName = prop.dataType[0];
      const referencedClass = schema?.classes?.find(c => c.class === referencedClassName);
      
      if (referencedClass && referencedClass.properties) {
        // Get all primitive properties from the referenced class
        const refPrimitiveProps = referencedClass.properties
          .filter(p => p.dataType.some(dt => primitiveTypes.includes(dt.toLowerCase())));
          
        if (refPrimitiveProps.length > 0) {
          const nestedProps = refPrimitiveProps.map(p => `          ${p.name}`).join('\n');
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
    
    propertyStrings = propsToUse.map(propName => {
      // If we have schema information, check if this is a relationship field
      if (classSchema?.properties) {
        const propSchema = classSchema.properties.find(p => p.name === propName);
        
        // Check if this is a reference/cross-reference property
        if (propSchema && propSchema.dataType && propSchema.dataType.length > 0) {
          // Cross-references in Weaviate have dataType starting with the class name
          const referencedClassName = propSchema.dataType[0];
          
          // If it's not a primitive type, it's likely a reference
          const primitiveTypes = ['text', 'string', 'int', 'number', 'boolean', 'date', 'phoneNumber', 'uuid', 'blob'];
          if (!primitiveTypes.includes(referencedClassName.toLowerCase())) {
            // Find the referenced class's schema
            const referencedClass = schema?.classes?.find(c => c.class === referencedClassName);
            
            // If we found the referenced class, include a few of its properties
            if (referencedClass && referencedClass.properties) {
              // Get all non-reference primitive properties from the referenced class
              const refProperties = referencedClass.properties
                .filter(p => primitiveTypes.includes(p.dataType[0].toLowerCase()))
                .map(p => p.name);
                
              // If we have properties to include
              if (refProperties.length > 0) {
                const nestedProps = refProperties.map(p => `          ${p}`).join('\n');
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
          if (propSchema.dataType && propSchema.dataType.some(dt => dt.toLowerCase() === 'geocoordinates')) {
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
            /^[a-z]+[A-Z][a-zA-Z]*$/,  // camelCase pattern
            /^(wrote|writes|has|belongs|contains|references)[A-Z]/i,  // common relationship verbs
            /[A-Z][a-z]*$/  // ends with capitalized word (likely class name)
          ];
          
          const looksLikeReference = referencePatterns.some(pattern => pattern.test(propName));
          
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
  if (!propertyStrings.some(p => p.includes('_additional'))) {
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
  schema?: { classes?: ClassSchema[] }
): string {
  // Find the class schema for the current collection
  const classSchema = schema?.classes?.find(c => c.class === collectionName);
  
  // Check if the template is a predefined template name
  const predefinedTemplate = queryTemplates.find(t => t.name === template);
  if (predefinedTemplate) {
    template = predefinedTemplate.template;
  }

  // Replace placeholders with actual values using dynamic generation when possible
  let query = template
    .replace('{nearVectorQuery}', classSchema ?
      generateDynamicNearVectorQuery(collectionName, classSchema, limit) :
      generateNearVectorQuery(collectionName, limit))
    .replace('{nearTextQuery}', classSchema ?
      generateDynamicNearTextQuery(collectionName, classSchema, limit) :
      generateNearTextQuery(collectionName, limit))
    .replace('{hybridQuery}', generateHybridQuery(collectionName, limit))
    .replace('{filterQuery}', classSchema ?
      generateDynamicFilterQuery(collectionName, classSchema, limit) :
      generateFilterQuery(collectionName, limit))
    .replace('{aggregationQuery}', classSchema ?
      generateDynamicAggregationQuery(collectionName, classSchema) :
      generateAggregationQuery(collectionName))
    .replace('{relationshipQuery}', generateRelationshipQuery(collectionName, limit))
    .replace('{exploreQuery}', generateExploreQuery(collectionName));

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
  
  properties.forEach(prop => {
    const dataType = prop.dataType?.[0]?.toLowerCase() || '';
    
    if (dataType === 'geocoordinates') {
      geoProps.push(prop);
    } else if (['text', 'string', 'int', 'number', 'boolean', 'date', 'phonenumber', 'uuid', 'blob'].includes(dataType)) {
      primitiveProps.push(prop);
    } else {
      // It's likely a reference to another class
      referenceProps.push(prop);
    }
  });

  let propertyLines: string[] = [];

  // Add up to 5 primitive properties
  const selectedPrimitives = primitiveProps.slice(0, 5);
  selectedPrimitives.forEach(prop => {
    propertyLines.push(`      ${prop.name}`);
  });

  // Add up to 2 geo coordinate properties
  const selectedGeoProps = geoProps.slice(0, 2);
  selectedGeoProps.forEach(prop => {
    propertyLines.push(`      ${prop.name} {
        latitude
        longitude
      }`);
  });

  // Add up to 2 reference properties with nested selection
  const selectedReferenceProps = referenceProps.slice(0, 2);
  selectedReferenceProps.forEach(prop => {
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
  limit: number = 10
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3);
  
  return `{
  Get {
    ${collectionName}(
      nearVector: {
        vector: [0.1, 0.2, 0.3] # Replace with your actual vector (${getVectorDimensions(classSchema)} dimensions)
        certainty: 0.7 # Minimum similarity threshold (0-1)
      }
      limit: ${limit}
    ) {
${properties.join('\n')}
      _additional {
        id
        distance
        certainty
        vector # Include the object's vector
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
  limit: number = 10
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3);
  const textProperties = getTextProperties(classSchema);
  
  // Check if the collection likely supports nearText based on vectorizer configuration
  const hasTextVectorizer = hasTextVectorizerModule(classSchema);
  
  if (!hasTextVectorizer) {
    // If no text vectorizer is detected, provide a nearVector alternative with instructions
    return `{
  # NOTE: This collection doesn't appear to have a text vectorizer configured.
  # nearText searches require a text vectorizer module (like text2vec-openai, text2vec-cohere, etc.)
  # Using nearVector instead - replace the vector with actual embeddings:
  
  Get {
    ${collectionName}(
      nearVector: {
        vector: [0.1, 0.2, 0.3] # Replace with actual vector embeddings (${getVectorDimensions(classSchema)} dimensions)
        certainty: 0.7 # Minimum similarity threshold (0-1)
      }
      limit: ${limit}
    ) {
${properties.join('\n')}
      _additional {
        id
        distance
        certainty
        vector # Include to see the object's vector
      }
    }
  }
}

# Alternative: If you want text-based search, configure a text vectorizer module for this collection
# Examples: text2vec-openai, text2vec-cohere, text2vec-transformers, etc.`;
  }
  
  return `{
  Get {
    ${collectionName}(
      nearText: {
        concepts: ["search terms", "semantic concepts"]
        certainty: 0.7 # Minimum similarity threshold (0-1)
        ${textProperties.length > 0 ? `properties: [${textProperties.map(p => `"${p}"`).join(', ')}] # Search in specific text fields` : ''}
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
${properties.join('\n')}
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
  limit: number = 10
): string {
  const properties = getTopPropertiesForDisplay(classSchema, 3);
  const filterExamples = generateFilterExamples(classSchema);
  
  return `{
  Get {
    ${collectionName}(
      where: {
        operator: And
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
 * Helper function to get top properties for display
 */
function getTopPropertiesForDisplay(classSchema?: ClassSchema, maxCount: number = 5): string[] {
  if (!classSchema?.properties) {
    return ['      # Add your properties here'];
  }

  const properties = classSchema.properties;
  const primitiveTypes = ['text', 'string', 'int', 'number', 'boolean', 'date', 'phonenumber', 'uuid'];
  
  // Prioritize primitive types, then geo coordinates, then references
  const primitives = properties.filter(p => 
    primitiveTypes.includes(p.dataType?.[0]?.toLowerCase() || '')
  ).slice(0, Math.min(maxCount, 3));
  
  const geoProps = properties.filter(p => 
    p.dataType?.[0]?.toLowerCase() === 'geocoordinates'
  ).slice(0, 1);
  
  const remainingSlots = maxCount - primitives.length - geoProps.length;
  const references = properties.filter(p => 
    !primitiveTypes.includes(p.dataType?.[0]?.toLowerCase() || '') && 
    p.dataType?.[0]?.toLowerCase() !== 'geocoordinates'
  ).slice(0, Math.max(0, remainingSlots));

  const result: string[] = [];
  
  primitives.forEach(prop => {
    result.push(`      ${prop.name}`);
  });
  
  geoProps.forEach(prop => {
    result.push(`      ${prop.name} {
        latitude
        longitude
      }`);
  });
  
  references.forEach(prop => {
    const refClassName = prop.dataType?.[0] || 'Unknown';
    result.push(`      ${prop.name} {
        # WARNING: May return many objects. Consider separate queries if needed.
        ... on ${refClassName} {
          _additional { id }
        }
      }`);
  });

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
    .filter(p => ['text', 'string'].includes(p.dataType?.[0]?.toLowerCase() || ''))
    .map(p => p.name)
    .slice(0, 3);
}

/**
 * Helper function to check if a collection has a text vectorizer module configured
 */
function hasTextVectorizerModule(classSchema?: ClassSchema): boolean {
  if (!classSchema) return false;
  
  // Check for explicit vectorizer configuration
  if (classSchema.vectorizer) {
    const vectorizer = classSchema.vectorizer.toLowerCase();
    // Common text vectorizer modules
    const textVectorizers = [
      'text2vec-openai',
      'text2vec-cohere', 
      'text2vec-huggingface',
      'text2vec-transformers',
      'text2vec-contextionary',
      'text2vec-gpt4all',
      'text2vec-palm'
    ];
    
    return textVectorizers.some(tv => vectorizer.includes(tv));
  }
  
  // Check module configuration for text vectorizer modules
  if (classSchema.moduleConfig) {
    const moduleKeys = Object.keys(classSchema.moduleConfig);
    const textVectorizerKeys = [
      'text2vec-openai',
      'text2vec-cohere',
      'text2vec-huggingface', 
      'text2vec-transformers',
      'text2vec-contextionary',
      'text2vec-gpt4all',
      'text2vec-palm'
    ];
    
    return moduleKeys.some(key => 
      textVectorizerKeys.some(tv => key.toLowerCase().includes(tv))
    );
  }
  
  return false; // Conservative default - assume no text vectorizer
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
        if (model.includes('openai') || model.includes('ada-002')) return '1536';
        if (model.includes('sentence-transformers') || model.includes('all-mpnet')) return '768';
        if (model.includes('cohere')) return '4096';
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
      '          {\n            path: ["propertyName"]\n            operator: Equal\n            valueText: "example value"\n          }'
    ];
  }

  const examples: string[] = [];
  const properties = classSchema.properties.slice(0, 3); // Limit to 3 examples
  
  properties.forEach(prop => {
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

  return examples.length > 0 ? examples : [
    '          {\n            path: ["propertyName"]\n            operator: Equal\n            valueText: "example value"\n          }'
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
  
  classSchema.properties.slice(0, 5).forEach(prop => {
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








