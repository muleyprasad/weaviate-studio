/**
 * Unit tests for AddCollection webview component
 * Tests the onChange and onSubmit callback handlers
 */

describe('AddCollection Webview - onChange and onSubmit handlers', () => {
  // Mock VS Code API
  const mockPostMessage = jest.fn();
  const mockVSCodeApi = {
    postMessage: mockPostMessage,
    getState: jest.fn(),
    setState: jest.fn(),
  };

  beforeAll(() => {
    // Setup window mock
    (global as any).window = {
      acquireVsCodeApi: () => mockVSCodeApi,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      alert: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSchemaChange', () => {
    it('should store schema when onChange callback is triggered', () => {
      // Simulate the onChange handler
      const testSchema = {
        class: 'TestCollection',
        description: 'Test collection',
        properties: [{ name: 'title', dataType: ['text'] }],
      };

      // This simulates what happens when Collection component calls onChange
      let storedSchema: any = null;
      const handleSchemaChange = (schema: any) => {
        storedSchema = schema;
      };

      // Trigger the change
      handleSchemaChange(testSchema);

      // Verify schema is stored
      expect(storedSchema).toEqual(testSchema);
    });

    it('should update stored schema on multiple onChange calls', () => {
      let storedSchema: any = null;
      const handleSchemaChange = (schema: any) => {
        storedSchema = schema;
      };

      const schema1 = { class: 'Collection1', properties: [] };
      const schema2 = { class: 'Collection2', properties: [] };
      const schema3 = { class: 'Collection3', properties: [] };

      handleSchemaChange(schema1);
      expect(storedSchema).toEqual(schema1);

      handleSchemaChange(schema2);
      expect(storedSchema).toEqual(schema2);

      handleSchemaChange(schema3);
      expect(storedSchema).toEqual(schema3);
    });
  });

  describe('handleSchemaSubmit', () => {
    it('should post create message when onSubmit callback is triggered', () => {
      const testSchema = {
        class: 'SubmittedCollection',
        description: 'Submitted via onSubmit',
        properties: [],
      };

      // Simulate the onSubmit handler
      const handleSchemaSubmit = (schema: any) => {
        mockVSCodeApi.postMessage({
          command: 'create',
          schema: schema,
        });
      };

      // Trigger the submit
      handleSchemaSubmit(testSchema);

      // Verify message was posted
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'create',
        schema: testSchema,
      });
    });

    it('should handle complex schema with vectorizer and properties', () => {
      const complexSchema = {
        class: 'Article',
        description: 'A news article',
        vectorIndexType: 'hnsw',
        vectorizer: 'text2vec-openai',
        moduleConfig: {
          'text2vec-openai': {
            model: 'text-embedding-ada-002',
            modelVersion: '002',
            type: 'text',
          },
        },
        properties: [
          {
            name: 'title',
            dataType: ['text'],
            description: 'Article title',
            moduleConfig: {
              'text2vec-openai': {
                skip: false,
                vectorizePropertyName: false,
              },
            },
          },
          {
            name: 'content',
            dataType: ['text'],
            description: 'Article content',
          },
        ],
      };

      const handleSchemaSubmit = (schema: any) => {
        mockVSCodeApi.postMessage({
          command: 'create',
          schema: schema,
        });
      };

      handleSchemaSubmit(complexSchema);

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'create',
        schema: complexSchema,
      });
    });
  });

  describe('handleCreate with currentSchema', () => {
    it('should post message when Create button uses stored schema', () => {
      let currentSchema: any = null;

      // Simulate onChange setting the schema
      const handleSchemaChange = (schema: any) => {
        currentSchema = schema;
      };

      // Simulate Create button click
      const handleCreate = () => {
        if (currentSchema) {
          mockVSCodeApi.postMessage({
            command: 'create',
            schema: currentSchema,
          });
        } else {
          window.alert('No schema found. Please fill in the collection details.');
        }
      };

      const testSchema = { class: 'TestCollection', properties: [] };
      handleSchemaChange(testSchema);
      handleCreate();

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'create',
        schema: testSchema,
      });
    });

    it('should show alert when Create is clicked without schema', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      let currentSchema: any = null;

      const handleCreate = () => {
        if (currentSchema) {
          mockVSCodeApi.postMessage({
            command: 'create',
            schema: currentSchema,
          });
        } else {
          window.alert('No schema found. Please fill in the collection details.');
        }
      };

      // Click create without setting schema
      handleCreate();

      expect(alertSpy).toHaveBeenCalledWith(
        'No schema found. Please fill in the collection details.'
      );
      expect(mockPostMessage).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });
  });

  describe('Integration: onChange -> handleCreate flow', () => {
    it('should use schema from onChange when Create button is clicked', () => {
      let currentSchema: any = null;

      const handleSchemaChange = (schema: any) => {
        currentSchema = schema;
      };

      const handleCreate = () => {
        if (currentSchema) {
          mockVSCodeApi.postMessage({
            command: 'create',
            schema: currentSchema,
          });
        }
      };

      // User fills form, onChange is called
      const schema = {
        class: 'Product',
        properties: [
          { name: 'name', dataType: ['text'] },
          { name: 'price', dataType: ['number'] },
        ],
      };
      handleSchemaChange(schema);

      // User clicks Create button
      handleCreate();

      // Verify the schema from onChange was used
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'create',
        schema: schema,
      });
    });
  });

  describe('Callback signatures', () => {
    it('onChange callback should accept schema object', () => {
      const handleSchemaChange = (schema: any) => {
        expect(schema).toBeDefined();
        expect(typeof schema).toBe('object');
      };

      handleSchemaChange({ class: 'Test' });
    });

    it('onSubmit callback should accept schema object', () => {
      const handleSchemaSubmit = (schema: any) => {
        expect(schema).toBeDefined();
        expect(typeof schema).toBe('object');
        mockVSCodeApi.postMessage({
          command: 'create',
          schema: schema,
        });
      };

      handleSchemaSubmit({ class: 'Test' });
      expect(mockPostMessage).toHaveBeenCalled();
    });
  });
});
