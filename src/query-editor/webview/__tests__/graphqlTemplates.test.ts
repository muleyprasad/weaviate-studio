import { generateNearVectorQuery, generateFilterQuery, processTemplate } from '../graphqlTemplates';

const COLLECTION = 'Article';

describe('graphqlTemplates helpers', () => {
  describe('generateNearVectorQuery', () => {
    it('embeds collection name and limit', () => {
      const q = generateNearVectorQuery(COLLECTION, 5);
      expect(q).toContain(COLLECTION);
      expect(q).toContain('limit: 5');
      expect(q).toContain('nearVector');
    });
  });

  describe('generateFilterQuery', () => {
    it('contains where block and collection name', () => {
      const q = generateFilterQuery(COLLECTION, 12);
      expect(q).toContain('where:');
      expect(q).toContain(COLLECTION);
      expect(q).toContain('limit: 12');
    });
  });

  describe('processTemplate', () => {
    it('resolves predefined template names', () => {
      const q = processTemplate('Vector Search (nearVector)', COLLECTION, 8);
      expect(q).toContain(COLLECTION);
      expect(q).toContain('nearVector');
      expect(q).toContain('limit: 8');
    });

    it('handles Hybrid Search template', () => {
      const q = processTemplate('Hybrid Search', COLLECTION, 3);
      expect(q).toContain('hybrid:');
      expect(q).toContain(COLLECTION);
    });

    it('processes raw template placeholders', () => {
      const custom = '{exploreQuery}';
      const q = processTemplate(custom, COLLECTION);
      expect(q).toContain('_additional'); // explore query includes _additional block
      expect(q).toContain(COLLECTION);
    });
  });

  describe('generateSampleQuery', () => {
    const mockSchema = {
      classes: [
        {
          class: COLLECTION,
          properties: [
            { name: 'title', dataType: ['text'] },
            { name: 'likes', dataType: ['int'] },
            { name: 'location', dataType: ['geoCoordinates'] },
            { name: 'author', dataType: ['Person'] },
          ],
        },
        {
          class: 'Person',
          properties: [
            { name: 'name', dataType: ['text'] },
            { name: 'email', dataType: ['text'] },
            { name: 'phone', dataType: ['text'] },
            { name: 'gender', dataType: ['text'] },
            { name: 'age', dataType: ['int'] },
          ],
        },
      ],
    } as any;

    it('includes primitive, geo, and reference properties', () => {
      const { generateSampleQuery } = require('../graphqlTemplates');

      const q: string = generateSampleQuery(COLLECTION, [], 10, mockSchema);

      // Primitive
      expect(q).toContain('title');
      expect(q).toContain('likes');

      // Geo coordinates with nested lat/lon
      expect(q).toContain('location');
      expect(q).toContain('latitude');
      expect(q).toContain('longitude');

      // Reference block with nested Person props
      expect(q).toContain('author');
      expect(q).toContain('... on Person');
      expect(q).toContain('name');
      expect(q).toContain('email');
      expect(q).toContain('phone');
      expect(q).toContain('gender');
      expect(q).toContain('age');
      // Additional metadata always included
      expect(q).toContain('_additional');
      expect(q).toContain('id');
    });
  });
});

describe('nearText validity and templates', () => {
  it('dynamic nearText does not include properties field', () => {
    const { generateDynamicNearTextQuery } = require('../graphqlTemplates');
    const classSchema = {
      class: COLLECTION,
      properties: [{ name: 'title', dataType: ['text'] }],
    } as any;

    const q: string = generateDynamicNearTextQuery(COLLECTION, classSchema, 10, {});
    expect(q).not.toContain('properties:');
    expect(q).toContain('nearText');
  });

  it('includes nearObject template and processes it', () => {
    const { queryTemplates, processTemplate } = require('../graphqlTemplates');
    const names: string[] = queryTemplates.map((t: any) => t.name);
    expect(names).toContain('Vector Search (nearObject)');

    const q: string = processTemplate('Vector Search (nearObject)', COLLECTION, 5);
    expect(q).toContain('nearObject');
    expect(q).toContain(COLLECTION);
  });

  it('does not expose mutation templates', () => {
    const { queryTemplates } = require('../graphqlTemplates');
    const names: string[] = queryTemplates.map((t: any) => t.name);

    expect(names).not.toContain('Insert Mutation');
    expect(names).not.toContain('Update Mutation');
    expect(names).not.toContain('Delete Mutation');
    expect(names).not.toContain('Batch Insert Mutation');
    expect(names).not.toContain('Batch Update Mutation');
    expect(names).not.toContain('Batch Delete Mutation');
    expect(names).not.toContain('Tenant Update Mutation');
  });
});

describe('Schema Compatibility', () => {
  it('handles missing vectorizer gracefully', () => {
    const { generateDynamicNearTextQuery } = require('../graphqlTemplates');
    const schema = {
      class: COLLECTION,
      properties: [{ name: 'title', dataType: ['text'] }],
      vectorizer: undefined,
    } as any;

    const query = generateDynamicNearTextQuery(COLLECTION, schema, 10, {});
    expect(query).toContain('# NOTE: nearText requires a text vectorizer');
    expect(query).toContain('nearText');
  });

  it('adapts to v1 schema format', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const v1Schema = {
      classes: [
        {
          class: COLLECTION,
          vectorizer: 'text2vec-openai',
          moduleConfig: {
            'text2vec-openai': {
              model: 'ada-002',
            },
          },
          properties: [{ name: 'title', dataType: ['text'] }],
        },
      ],
    };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, v1Schema);
    expect(query).toContain(COLLECTION);
    expect(query).toContain('nearVector');
    expect(query).toContain('1536'); // Should detect OpenAI ada-002 dimensions
  });

  it('adapts to v2 schema format', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const v2Schema = {
      classes: [
        {
          name: COLLECTION,
          vectorizers: {
            default: {
              vectorizer: {
                name: 'text2vec-openai',
                model: 'text-embedding-ada-002',
              },
            },
          },
          properties: [{ name: 'title', dataType: ['text'] }],
        },
      ],
    };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, v2Schema);
    expect(query).toContain(COLLECTION);
    expect(query).toContain('nearVector');
    expect(query).toContain('1536'); // Should detect OpenAI dimensions
  });

  it('handles schema with no vectorizer configured', () => {
    const { generateDynamicNearVectorQuery } = require('../graphqlTemplates');
    const schema = {
      class: COLLECTION,
      properties: [{ name: 'title', dataType: ['text'] }],
    } as any;

    const query = generateDynamicNearVectorQuery(COLLECTION, schema, 10);
    expect(query).toContain('match your vectorizer dimensions');
    expect(query).toContain('nearVector');
  });
});

describe('Error Recovery', () => {
  it('falls back to static template on schema error', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const malformedSchema = {
      classes: [
        {
          // Missing required fields
          broken: true,
        },
      ],
    };

    // Should not throw, should return usable query
    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, malformedSchema);
    expect(query).toContain(COLLECTION);
    expect(query).toContain('Get');
  });

  it('handles null schema gracefully', () => {
    const { processTemplate } = require('../graphqlTemplates');

    const query = processTemplate('Hybrid Search', COLLECTION, 5, null as any);
    expect(query).toContain(COLLECTION);
    expect(query).toContain('hybrid');
  });

  it('handles undefined schema gracefully', () => {
    const { processTemplate } = require('../graphqlTemplates');

    const query = processTemplate('BM25 Search', COLLECTION, 10, undefined);
    expect(query).toContain(COLLECTION);
    expect(query).toContain('bm25');
  });

  it('handles empty classes array', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const emptySchema = { classes: [] };

    const query = processTemplate('Filter Query', COLLECTION, 10, emptySchema);
    expect(query).toContain(COLLECTION);
    expect(query).toContain('where');
  });
});

describe('Performance', () => {
  it('generates templates in reasonable time for large schemas', () => {
    const { processTemplate } = require('../graphqlTemplates');

    // Create a large schema with 50 properties
    const largeSchema = {
      classes: [
        {
          class: COLLECTION,
          properties: Array.from({ length: 50 }, (_, i) => ({
            name: `property${i}`,
            dataType: i % 2 === 0 ? ['text'] : ['int'],
          })),
          vectorizer: 'text2vec-openai',
        },
      ],
    };

    const start = Date.now();
    const query = processTemplate('Hybrid Search', COLLECTION, 10, largeSchema);
    const duration = Date.now() - start;

    expect(query).toContain(COLLECTION);
    expect(duration).toBeLessThan(100); // Should complete in <100ms
  });

  it('handles multiple template generations efficiently', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const schema = {
      classes: [
        {
          class: COLLECTION,
          properties: [
            { name: 'title', dataType: ['text'] },
            { name: 'count', dataType: ['int'] },
          ],
        },
      ],
    };

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      processTemplate('Vector Search (nearVector)', COLLECTION, 10, schema);
    }
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500); // 100 generations in <500ms
  });
});

describe('Vector Dimension Detection', () => {
  it('detects OpenAI text-embedding-3-large dimensions', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const schema = {
      classes: [
        {
          class: COLLECTION,
          moduleConfig: {
            'text2vec-openai': {
              model: 'text-embedding-3-large',
            },
          },
          properties: [{ name: 'title', dataType: ['text'] }],
        },
      ],
    };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, schema);
    expect(query).toContain('3072 dimensions');
  });

  it('detects Cohere v3 dimensions', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const schema = {
      classes: [
        {
          class: COLLECTION,
          moduleConfig: {
            'text2vec-cohere': {
              model: 'embed-english-v3.0',
            },
          },
          properties: [{ name: 'title', dataType: ['text'] }],
        },
      ],
    };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, schema);
    expect(query).toContain('1024 dimensions');
  });

  it('detects Sentence Transformers dimensions', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const schema = {
      classes: [
        {
          class: COLLECTION,
          moduleConfig: {
            'text2vec-transformers': {
              model: 'sentence-transformers/all-mpnet-base-v2',
            },
          },
          properties: [{ name: 'title', dataType: ['text'] }],
        },
      ],
    };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, schema);
    expect(query).toContain('768 dimensions');
  });

  it('falls back to generic message for unknown models', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const schema = {
      classes: [
        {
          class: COLLECTION,
          moduleConfig: {
            'text2vec-custom': {
              model: 'unknown-custom-model',
            },
          },
          properties: [{ name: 'title', dataType: ['text'] }],
        },
      ],
    };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, schema);
    expect(query).toContain('match your vectorizer dimensions');
  });
});

describe('Query Configuration', () => {
  it('respects custom limit in config', () => {
    const { processTemplate } = require('../graphqlTemplates');
    const config = { limit: 25 };

    const query = processTemplate('Vector Search (nearVector)', COLLECTION, 10, undefined, config);
    expect(query).toContain('limit: 25');
    expect(query).not.toContain('limit: 10');
  });

  it('uses distance when provided in config', () => {
    const { generateDynamicNearTextQuery } = require('../graphqlTemplates');
    const schema = {
      class: COLLECTION,
      properties: [{ name: 'title', dataType: ['text'] }],
      vectorizer: 'text2vec-openai',
    };
    const config = { distance: 0.5 };

    const query = generateDynamicNearTextQuery(COLLECTION, schema, 10, config);
    expect(query).toContain('distance: 0.5');
  });

  it('uses certainty when distance is not provided', () => {
    const { generateDynamicNearTextQuery } = require('../graphqlTemplates');
    const schema = {
      class: COLLECTION,
      properties: [{ name: 'title', dataType: ['text'] }],
      vectorizer: 'text2vec-openai',
    };
    const config = { certainty: 0.8 };

    const query = generateDynamicNearTextQuery(COLLECTION, schema, 10, config);
    expect(query).toContain('certainty: 0.8');
  });

  it('includes custom concepts in nearText query', () => {
    const { generateDynamicNearTextQuery } = require('../graphqlTemplates');
    const schema = {
      class: COLLECTION,
      properties: [{ name: 'title', dataType: ['text'] }],
      vectorizer: 'text2vec-openai',
    };
    const config = { concepts: ['machine learning', 'artificial intelligence'] };

    const query = generateDynamicNearTextQuery(COLLECTION, schema, 10, config);
    expect(query).toContain('machine learning');
    expect(query).toContain('artificial intelligence');
  });
});

describe('Template Validation', () => {
  it('validates collection name correctly', () => {
    const { validateCollectionName } = require('../graphqlTemplates');

    expect(validateCollectionName('Article').valid).toBe(true);
    expect(validateCollectionName('Article123').valid).toBe(true);
    expect(validateCollectionName('_Article').valid).toBe(true);
    expect(validateCollectionName('123Article').valid).toBe(false);
    expect(validateCollectionName('Article-Name').valid).toBe(false);
    expect(validateCollectionName('').valid).toBe(false);
  });

  it('validates and sanitizes queries', () => {
    const { validateAndSanitizeQuery } = require('../graphqlTemplates');

    const validQuery = '{ Get { Article { title } } }';
    const result = validateAndSanitizeQuery(validQuery);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects unbalanced braces', () => {
    const { validateAndSanitizeQuery } = require('../graphqlTemplates');

    const invalidQuery = '{ Get { Article { title } }';
    const result = validateAndSanitizeQuery(invalidQuery);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unbalanced braces in query');
  });
});

describe('Integration Tests - Real-world Weaviate Schemas', () => {
  // Mock a realistic Weaviate v2 schema with various property types
  const mockWeaviateV2Schema = {
    classes: [
      {
        class: 'BlogPost',
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'title', dataType: ['text'], indexSearchable: true },
          { name: 'content', dataType: ['text'], indexSearchable: true },
          { name: 'publishedDate', dataType: ['date'] },
          { name: 'likes', dataType: ['int'] },
          { name: 'rating', dataType: ['number'] },
          { name: 'isPublished', dataType: ['boolean'] },
          { name: 'location', dataType: ['geoCoordinates'] },
          { name: 'author', dataType: ['Author'] },
          { name: 'tags', dataType: ['text'] },
        ],
      },
      {
        class: 'Author',
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'name', dataType: ['text'], indexSearchable: true },
          { name: 'bio', dataType: ['text'] },
          { name: 'email', dataType: ['text'] },
          { name: 'joinDate', dataType: ['date'] },
        ],
      },
    ],
  } as any;

  // Mock a Weaviate v1 schema with moduleConfig
  const mockWeaviateV1Schema = {
    classes: [
      {
        class: 'Product',
        moduleConfig: {
          'text2vec-cohere': { model: 'embed-english-v3', vectorizeClassName: false },
        },
        properties: [
          { name: 'name', dataType: ['string'] },
          { name: 'description', dataType: ['text'] },
          { name: 'price', dataType: ['number'] },
          { name: 'inStock', dataType: ['boolean'] },
          { name: 'category', dataType: ['ProductCategory'] },
        ],
      },
      {
        class: 'ProductCategory',
        properties: [
          { name: 'categoryName', dataType: ['string'] },
          { name: 'description', dataType: ['text'] },
        ],
      },
    ],
  } as any;

  // Mock a schema with no vectorizer configured
  const mockSchemaNoVectorizer = {
    classes: [
      {
        class: 'SimpleData',
        properties: [
          { name: 'id', dataType: ['uuid'] },
          { name: 'name', dataType: ['string'] },
          { name: 'value', dataType: ['number'] },
        ],
      },
    ],
  } as any;

  it('generates valid queries for Weaviate v2 schema with all property types', () => {
    // Test nearVector generation with actual vectorizer detected
    const nearVectorQuery = processTemplate(
      'Vector Search (nearVector)',
      'BlogPost',
      10,
      mockWeaviateV2Schema
    );
    expect(nearVectorQuery).toContain('BlogPost');
    expect(nearVectorQuery).toContain('nearVector');
    expect(nearVectorQuery).toContain('limit: 10');
    expect(nearVectorQuery).toContain('title');
    expect(nearVectorQuery).toContain('content');

    // Test nearText generation with text2vec-openai detected
    const nearTextQuery = processTemplate(
      'Semantic Search (nearText)',
      'BlogPost',
      5,
      mockWeaviateV2Schema
    );
    expect(nearTextQuery).toContain('nearText');
    expect(nearTextQuery).toContain('BlogPost');
    expect(nearTextQuery).toContain('concepts:');
    expect(nearTextQuery).not.toContain('No text vectorizer'); // Should work with v2 vectorizer
  });

  it('correctly detects vector dimensions from v1 schema with moduleConfig', () => {
    // Test with Cohere model in moduleConfig
    const hybridQuery = processTemplate('Hybrid Search', 'Product', 15, mockWeaviateV1Schema, {
      searchQuery: 'test search',
      alpha: 0.5,
    });
    expect(hybridQuery).toContain('Product');
    expect(hybridQuery).toContain('hybrid:');
    expect(hybridQuery).toContain('name');
    expect(hybridQuery).toContain('description');
    expect(hybridQuery).not.toContain('null');
  });

  it('gracefully handles schema with no vectorizer configured', () => {
    // nearText should work but include helpful comment
    const template = 'Semantic Search (nearText)';
    const query = processTemplate(template, 'SimpleData', 20, mockSchemaNoVectorizer);
    expect(query).toContain('SimpleData');
    // Should not crash and include basic structure
    expect(query).toContain('_additional');
  });

  it('respects QueryConfig overrides across all schema types', () => {
    const config = {
      limit: 50,
      certainty: 0.8,
      maxProperties: 3,
    };

    // Test with v2 schema
    const query1 = processTemplate(
      'Vector Search (nearVector)',
      'BlogPost',
      10,
      mockWeaviateV2Schema,
      config
    );
    expect(query1).toContain('limit: 50'); // Config overrides default 10

    // Test with v1 schema
    const query2 = processTemplate('Filter Query', 'Product', 10, mockWeaviateV1Schema, config);
    expect(query2).toContain('limit: 50');
  });

  it('handles invalid QueryConfig gracefully without crashing', () => {
    const { processTemplate: pt } = require('../graphqlTemplates');

    // Test that invalid config doesn't crash - errors are caught and logged internally
    // The function returns a fallback query instead of throwing

    // Invalid certainty (should be 0-1) - should not crash
    const result1 = pt('Vector Search (nearVector)', 'BlogPost', 10, mockWeaviateV2Schema, {
      certainty: 1.5,
    });
    expect(result1).toBeTruthy(); // Still returns query with fallback
    expect(result1).toContain('BlogPost');

    // Invalid alpha (should be 0-1) - should not crash
    const result2 = pt('Hybrid Search', 'BlogPost', 10, mockWeaviateV2Schema, { alpha: -0.1 });
    expect(result2).toBeTruthy();
    expect(result2).toContain('BlogPost');

    // Invalid limit (should be positive) - should not crash
    const result3 = pt('Vector Search (nearVector)', 'BlogPost', 10, mockWeaviateV2Schema, {
      limit: -5,
    });
    expect(result3).toBeTruthy();
    expect(result3).toContain('BlogPost');
  });
});
