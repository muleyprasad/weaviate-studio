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
      _additional {
        id
      }
      # Add your properties here
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
        vector: [0.1, 0.2, 0.3, ...] # Replace with your vector
      }
      limit: ${limit}
    ) {
      _additional {
        id
        distance
      }
      # Add your properties here
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
        concepts: ["example", "search", "terms"]
      }
      limit: ${limit}
    ) {
      _additional {
        id
        distance
      }
      # Add your properties here
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
        query: "your search query"
        alpha: 0.5 # Balance between vector (0) and keyword (1) search
      }
      limit: ${limit}
    ) {
      _additional {
        id
        distance
      }
      # Add your properties here
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
            path: ["propertyName"]
            operator: Equal
            valueText: "value"
          }
          # Add more operands as needed
        ]
      }
      limit: ${limit}
    ) {
      _additional {
        id
      }
      # Add your properties here
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
      # Add aggregation fields as needed
      # Example for numeric property:
      # propertyName {
      #   count
      #   minimum
      #   maximum
      #   mean
      #   sum
      # }
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
    description: 'Simple query to retrieve data from a collection',
    template: '{collectionName}' // Will be replaced with actual collection name
  },
  {
    name: 'Vector Search (nearVector)',
    description: 'Search for similar objects using a vector',
    template: '{nearVectorQuery}'
  },
  {
    name: 'Semantic Search (nearText)',
    description: 'Search for similar objects using text concepts',
    template: '{nearTextQuery}'
  },
  {
    name: 'Hybrid Search',
    description: 'Combine vector and keyword search',
    template: '{hybridQuery}'
  },
  {
    name: 'Filter Query',
    description: 'Filter objects based on property values',
    template: '{filterQuery}'
  },
  {
    name: 'Aggregation Query',
    description: 'Calculate statistics across objects',
    template: '{aggregationQuery}'
  }
];

/**
 * Generate a sample query for a collection based on its schema
 * @param collectionName The name of the collection
 * @param properties Optional array of property names to include
 * @param limit Optional limit for the query (default: 10)
 * @returns GraphQL query string
 */
export function generateSampleQuery(
  collectionName: string,
  properties: string[] = [],
  limit: number = 10
): string {
  // If no properties provided, use placeholder comment
  const propertiesString = properties.length > 0
    ? properties.join('\n      ')
    : '# Add your properties here';

  return `{
  Get {
    ${collectionName} (limit: ${limit}) {
      ${propertiesString}
    }
  }
}`;
}

/**
 * Process a template by replacing placeholders with actual values
 * @param template The template string or template name
 * @param collectionName The name of the collection
 * @param limit Optional limit for queries (default: 10)
 * @returns Processed query string
 */
export function processTemplate(
  template: string,
  collectionName: string,
  limit: number = 10
): string {
  // Check if the template is a predefined template name
  const predefinedTemplate = queryTemplates.find(t => t.name === template);
  if (predefinedTemplate) {
    template = predefinedTemplate.template;
  }

  // Replace placeholders with actual values
  let query = template
    .replace('{collectionName}', generateBasicGetQuery(collectionName, limit))
    .replace('{nearVectorQuery}', generateNearVectorQuery(collectionName, limit))
    .replace('{nearTextQuery}', generateNearTextQuery(collectionName, limit))
    .replace('{hybridQuery}', generateHybridQuery(collectionName, limit))
    .replace('{filterQuery}', generateFilterQuery(collectionName, limit))
    .replace('{aggregationQuery}', generateAggregationQuery(collectionName));

  return query;
}
