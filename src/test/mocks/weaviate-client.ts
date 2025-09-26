function createClient() {
  return {
    misc: {
      metaGetter: () => ({ do: jest.fn().mockResolvedValue({ version: 'mock' }) })
    },
    graphql: {
      get: () => ({
        withFields: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({ data: {} })
      })
    },
    collections: {
      listAll: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockReturnValue({
        aggregate: {
          overAll: jest.fn().mockResolvedValue({ totalCount: 0 })
        }
      }),
      delete: jest.fn().mockResolvedValue({}),
      createFromSchema: jest.fn().mockResolvedValue({})
    },
    getMeta: jest.fn().mockResolvedValue({ 
      version: 'mock',
      hostname: 'localhost',
      modules: {}
    }),
    cluster: {
      nodes: jest.fn().mockResolvedValue({})
    },
    isReady: jest.fn().mockResolvedValue(true)
  };
}

const exported = {
  client: createClient,
  ApiKey: function(key: any) { return { key }; },
  connectToCustom: jest.fn().mockResolvedValue({
    misc: {
      metaGetter: () => ({ do: jest.fn().mockResolvedValue({ version: 'mock' }) })
    },
    graphql: {
      get: () => ({
        withFields: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({ data: {} })
      })
    },
    collections: {
      listAll: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockReturnValue({
        aggregate: {
          overAll: jest.fn().mockResolvedValue({ totalCount: 0 })
        }
      }),
      delete: jest.fn().mockResolvedValue({}),
      createFromSchema: jest.fn().mockResolvedValue({})
    },
    getMeta: jest.fn().mockResolvedValue({ 
      version: 'mock',
      hostname: 'localhost',
      modules: {}
    }),
    cluster: {
      nodes: jest.fn().mockResolvedValue({})
    },
    isReady: jest.fn().mockResolvedValue(true)
  }),
  connectToWeaviateCloud: jest.fn().mockResolvedValue({
    misc: {
      metaGetter: () => ({ do: jest.fn().mockResolvedValue({ version: 'mock' }) })
    },
    graphql: {
      get: () => ({
        withFields: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({ data: {} })
      })
    },
    collections: {
      listAll: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockReturnValue({
        aggregate: {
          overAll: jest.fn().mockResolvedValue({ totalCount: 0 })
        }
      }),
      delete: jest.fn().mockResolvedValue({}),
      createFromSchema: jest.fn().mockResolvedValue({})
    },
    getMeta: jest.fn().mockResolvedValue({ 
      version: 'mock',
      hostname: 'localhost',
      modules: {}
    }),
    cluster: {
      nodes: jest.fn().mockResolvedValue({})
    },
    isReady: jest.fn().mockResolvedValue(true)
  })
};

// Provide both CommonJS named export and ESModule default
// so that `import weaviate from 'weaviate-client'` works inside the code under test.
(exported as any).default = exported;

module.exports = exported; 