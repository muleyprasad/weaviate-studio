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
    }
  };
}

const exported = {
  client: createClient,
  ApiKey: function(key: any) { return { key }; }
};

// Provide both CommonJS named export and ESModule default
// so that `import weaviate from 'weaviate-ts-client'` works inside the code under test.
(exported as any).default = exported;

module.exports = exported; 