/**
 * Query templates for common Weaviate GraphQL operations
 */

export interface QueryTemplate {
  name: string;
  description: string;
  template: string;
}

/**
 * Generate a basic Get query for a collection
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateBasicGetQuery(collectionName: string, limit: number = 10): string {
  return `{
  Get {
    ${collectionName} (limit: ${limit}) {
      # Replace with actual properties from your schema
      # Example: title, description, createdAt
      _additional {
        id
        creationTimeUnix
        lastUpdateTimeUnix
      }
    }
  }
}`;
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
 * Generate a query with sorting
 * @param collectionName The name of the collection to query
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateSortQuery(collectionName: string, limit: number = 10): string {
  return `{
  Get {
    ${collectionName} (
      sort: [
        {
          path: ["propertyName"] # Replace with actual property name
          order: desc # Options: asc, desc
        }
        {
          path: ["secondarySort"]
          order: asc
        }
      ]
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
    name: 'Basic Get Query',
    description: 'Simple query to retrieve data from a collection with metadata',
    template: '{collectionName}' // Will be replaced with actual collection name
  },
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
    name: 'Sort Query',
    description: 'Sort objects by property values with multiple sort criteria',
    template: '{sortQuery}'
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
    
    // Add primitive properties first (up to 5)
    primitiveProps.slice(0, 5).forEach(prop => {
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
    
    // Add reference properties with proper nested structure (up to 3)
    referenceProps.slice(0, 3).forEach(prop => {
      const referencedClassName = prop.dataType[0];
      const referencedClass = schema?.classes?.find(c => c.class === referencedClassName);
      
      if (referencedClass && referencedClass.properties) {
        // Get up to 3 primitive properties from the referenced class
        const refPrimitiveProps = referencedClass.properties
          .filter(p => p.dataType.some(dt => primitiveTypes.includes(dt.toLowerCase())))
          .slice(0, 3);
          
        if (refPrimitiveProps.length > 0) {
          const nestedProps = refPrimitiveProps.map(p => `          ${p.name}`).join('\n');
          propertyStrings.push(`${prop.name} {
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
              // Get up to 3 non-reference properties from the referenced class
              const refProperties = referencedClass.properties
                .filter(p => primitiveTypes.includes(p.dataType[0].toLowerCase()))
                .slice(0, 3)
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
  // Check if the template is a predefined template name
  const predefinedTemplate = queryTemplates.find(t => t.name === template);
  if (predefinedTemplate) {
    template = predefinedTemplate.template;
  }

  // Replace placeholders with actual values
  let query = template
    // Use generateSampleQuery for the basic collection query to properly handle relationships
    .replace('{collectionName}', generateSampleQuery(collectionName, [], limit, schema))
    .replace('{nearVectorQuery}', generateNearVectorQuery(collectionName, limit))
    .replace('{nearTextQuery}', generateNearTextQuery(collectionName, limit))
    .replace('{hybridQuery}', generateHybridQuery(collectionName, limit))
    .replace('{filterQuery}', generateFilterQuery(collectionName, limit))
    .replace('{aggregationQuery}', generateAggregationQuery(collectionName))
    .replace('{relationshipQuery}', generateRelationshipQuery(collectionName, limit))
    .replace('{sortQuery}', generateSortQuery(collectionName, limit))
    .replace('{exploreQuery}', generateExploreQuery(collectionName));

  return query;
}
