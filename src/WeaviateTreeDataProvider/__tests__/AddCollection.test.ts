import { jest } from '@jest/globals';
import * as vscode from 'vscode';

// Mock ConnectionManager
const mockConnectionManager = {
  getConnection: jest.fn(),
  getClient: jest.fn(),
  addConnection: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getConnections: jest.fn(() => []),
  onConnectionsChanged: jest.fn(),
};

jest.mock('../../services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: () => mockConnectionManager,
  },
}));

// Mock ViewRenderer
jest.mock('../../views/ViewRenderer', () => ({
  ViewRenderer: {
    getInstance: () => ({
      renderDetailedSchema: jest.fn(() => '<html></html>'),
    }),
  },
}));

// Mock vscode
jest.mock(
  'vscode',
  () => {
    const vsMock = require('../../test/mocks/vscode');
    vsMock.ViewColumn = { Active: 1 };
    return vsMock;
  },
  { virtual: true }
);

// Mock AddCollectionPanel to avoid creating real webviews
let capturedOnCreate: ((schema: any) => Promise<void>) | undefined;
let capturedOnMessage:
  | ((message: any, postMessage: (msg: any) => void) => Promise<void>)
  | undefined;
let lastInitialSchema: any;
const panelMock = {
  postMessage: jest.fn(),
  dispose: jest.fn(),
};
const mockAddCollectionPanel = {
  createOrShow: jest.fn(
    (
      _extUri: any,
      onCreate: (schema: any) => Promise<void>,
      onMessage?: (message: any, postMessage: (msg: any) => void) => Promise<void>,
      _initialSchema?: any
    ) => {
      capturedOnCreate = onCreate;
      capturedOnMessage = onMessage;
      lastInitialSchema = _initialSchema;
      return panelMock;
    }
  ),
};

jest.mock('../../views/AddCollectionPanel', () => ({
  AddCollectionPanel: mockAddCollectionPanel,
}));

import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';

// Get the mocked vscode module
const vsMock = require('../../test/mocks/vscode');

describe('Add Collection', () => {
  let provider: WeaviateTreeDataProvider;
  let mockPanel: any;
  let postMessageSpy: jest.Mock;
  const mockCtx = {
    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
    subscriptions: [],
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock AddCollectionPanel between tests
    mockAddCollectionPanel.createOrShow.mockClear();
    panelMock.postMessage.mockClear();
    panelMock.dispose.mockClear();
    capturedOnCreate = undefined;
    capturedOnMessage = undefined;
    postMessageSpy = jest.fn();

    // Garante que getClient sempre retorna um mock completo e tipado como any
    mockConnectionManager.getClient.mockImplementation((): any => ({
      // @ts-expect-error
      alias: { listAll: jest.fn().mockResolvedValue([] as any) },
      // @ts-expect-error
      getMeta: jest.fn().mockResolvedValue({} as any),
      // @ts-expect-error
      cluster: { nodes: jest.fn().mockResolvedValue({ nodes: [] as any }) },
    }));

    provider = new (require('../WeaviateTreeDataProvider').WeaviateTreeDataProvider)(
      mockCtx as any
    );

    // Mock fetchCollectionsData to prevent real network calls
    jest.spyOn(provider, 'fetchCollectionsData').mockResolvedValue();

    // Mock connected connection
    mockConnectionManager.getConnection.mockReturnValue({
      id: 'conn1',
      name: 'Test Connection',
      status: 'connected',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      httpSecure: false,
      grpcHost: 'localhost',
      grpcPort: 50051,
      grpcSecure: false,
      apiKey: '',
    });
  });

  describe('addCollection', () => {
    it('creates AddCollectionPanel for connected connection', async () => {
      await provider.addCollection('conn1');
      expect(mockAddCollectionPanel.createOrShow).toHaveBeenCalled();
    });

    it('throws error for non-existent connection', async () => {
      mockConnectionManager.getConnection.mockReturnValue(null);

      await expect(provider.addCollection('invalid')).rejects.toThrow('Connection not found');
    });

    it('throws error for disconnected connection', async () => {
      mockConnectionManager.getConnection.mockReturnValue({
        id: 'conn1',
        status: 'disconnected',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        httpSecure: false,
        grpcHost: 'localhost',
        grpcPort: 50051,
        grpcSecure: false,
        apiKey: '',
      });

      await expect(provider.addCollection('conn1')).rejects.toThrow('Connection must be active');
    });

    // In the new React-based flow, HTML is served from a bundled webview. We validate
    // that the panel creation was triggered via AddCollectionPanel above.
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await provider.addCollection('conn1');
      expect(capturedOnMessage).toBeDefined();
    });

    it.skip('handles cancel message by disposing panel', async () => {
      // Cancel is handled within AddCollectionPanel, not by provider callback
    });

    it('handles getCollections message', async () => {
      // Mock collections data
      (provider as any).collections = {
        conn1: [{ label: 'Collection1' }, { label: 'Collection2' }] as any[],
      };

      await capturedOnMessage!({ command: 'getCollections' }, postMessageSpy);

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'collections',
        collections: ['Collection1', 'Collection2'],
      });
    });

    it('handles getVectorizers message', async () => {
      // Setup cluster metadata cache to drive available vectorizers
      (provider as any).clusterMetadataCache = {
        conn1: {
          version: '1.20.0',
          modules: {
            'text2vec-openai': {},
            'text2vec-cohere': {},
          },
        },
      };

      const mockClient: any = {
        getMeta: jest.fn().mockImplementation(() => Promise.resolve({} as any)),
        cluster: {
          nodes: jest.fn().mockImplementation(() => Promise.resolve({ nodes: [] } as any)),
        },
      };

      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await capturedOnMessage!({ command: 'getVectorizers' }, postMessageSpy);

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'vectorizers',
        vectorizers: ['none', 'text2vec-openai', 'text2vec-cohere'],
        modules: {
          'text2vec-openai': {},
          'text2vec-cohere': {},
        },
      });
      // Also should send server version
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'serverVersion',
        version: '1.20.0',
      });
    });

    it('handles create message successfully', async () => {
      const createSpy = jest
        .spyOn(provider as any, 'createCollection')
        .mockImplementation(async () => {
          /* no-op */
        });
      const fetchSpy = jest
        .spyOn(provider as any, 'fetchCollectionsData')
        .mockImplementation(async (_: any) => {
          /* no-op */
        });
      const schema = {
        class: 'TestCollection',
        description: 'Test description',
        vectorizer: 'text2vec-openai',
        properties: [],
      };

      // Simulate panel invoking provider's create callback
      await capturedOnCreate!(schema);

      expect(createSpy).toHaveBeenCalledWith('conn1', schema);
      expect(fetchSpy).toHaveBeenCalledWith('conn1');
    });

    it('handles create message with error', async () => {
      const createSpy = jest
        .spyOn(provider as any, 'createCollection')
        .mockImplementation(async () => {
          throw new Error('Schema error');
        });
      const fetchSpy = jest
        .spyOn(provider as any, 'fetchCollectionsData')
        .mockImplementation(async (_: any) => {
          /* no-op */
        });
      const schema = { class: 'TestCollection' };

      await expect(capturedOnCreate!(schema)).rejects.toThrow('Schema error');
      expect(createSpy).toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('when cloning, should open Add Collection prefilled without creating immediately', async () => {
      // Prepare: collections with schema
      (provider as any).collections = {
        conn1: [
          {
            label: 'SourceCollection',
            schema: {
              class: 'SourceCollection',
              description: 'desc',
              properties: [{ name: 'title', dataType: ['text'] }],
            },
          },
        ] as any[],
      };

      // Re-render clone view and capture clone handlers
      // Simulate navigating to cloneExisting option by calling addCollectionWithOptions flow pieces directly
      // Create a fresh panel and handler for clone webview
      await (provider as any).addCollectionWithOptions('conn1');
      // capture the last created panel from vscode mock
      mockPanel = vsMock.window.createWebviewPanel.mock.results.slice(-1)[0].value;
      const optionsHandler = mockPanel.webview.onDidReceiveMessage.mock.calls.pop()?.[0];

      // Select cloneExisting to load clone UI
      await optionsHandler({ command: 'selectOption', option: 'cloneExisting' });
      const cloneHandler = mockPanel.webview.onDidReceiveMessage.mock.calls.pop()?.[0];

      // First request schema
      await cloneHandler({ command: 'getSchema', collectionName: 'SourceCollection' });

      // Then trigger clone with new name
      await cloneHandler({
        command: 'clone',
        sourceCollection: 'SourceCollection',
        newCollectionName: 'ClonedCollection',
        schema: (provider as any).collections['conn1'][0].schema,
      });

      // Options panel is disposed and AddCollectionPanel is opened with initial schema passed
      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(mockAddCollectionPanel.createOrShow).toHaveBeenCalled();
      expect(lastInitialSchema).toBeDefined();
      expect(lastInitialSchema.class).toBe('ClonedCollection');
    });

    it('when cloning multi-tenant collection, should properly populate multi-tenancy settings', async () => {
      // Prepare: collections with multi-tenant schema
      (provider as any).collections = {
        conn1: [
          {
            label: 'MultiTenantCollection',
            schema: {
              class: 'MultiTenantCollection',
              description: 'Multi-tenant collection',
              multiTenancy: {
                // Using multiTenancy (not multiTenancyConfig) as shown in user's data
                enabled: true,
                autoTenantCreation: true,
                autoTenantActivation: true,
              },
              properties: [{ name: 'title', dataType: ['text'] }],
            },
          },
        ] as any[],
      };

      // Navigate to clone view and trigger clone
      await (provider as any).addCollectionWithOptions('conn1');
      mockPanel = vsMock.window.createWebviewPanel.mock.results.slice(-1)[0].value;
      const optionsHandler = mockPanel.webview.onDidReceiveMessage.mock.calls.pop()?.[0];

      await optionsHandler({ command: 'selectOption', option: 'cloneExisting' });
      const cloneHandler = mockPanel.webview.onDidReceiveMessage.mock.calls.pop()?.[0];

      await cloneHandler({ command: 'getSchema', collectionName: 'MultiTenantCollection' });

      await cloneHandler({
        command: 'clone',
        sourceCollection: 'MultiTenantCollection',
        newCollectionName: 'ClonedMultiTenant',
        schema: (provider as any).collections['conn1'][0].schema,
      });

      // Options panel is disposed and AddCollectionPanel is opened with correct initial multi-tenant schema
      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(mockAddCollectionPanel.createOrShow).toHaveBeenCalled();
      expect(lastInitialSchema).toBeDefined();
      expect(lastInitialSchema.class).toBe('ClonedMultiTenant');
      const mt =
        lastInitialSchema.multiTenancy || (lastInitialSchema as any).multiTenancyConfig || {};
      expect(mt.enabled).toBe(true);
    });
  });

  describe('createCollection', () => {
    it('validates required collection name', async () => {
      const mockClient: any = { schema: { classCreator: jest.fn() } };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await expect((provider as any).createCollection('conn1', { class: '' })).rejects.toThrow(
        'Collection name is required'
      );
    });

    it('builds correct schema object', async () => {
      const mockCreateFromSchema = jest.fn() as any;
      mockCreateFromSchema.mockImplementation(() => Promise.resolve({}));
      const mockClient = {
        collections: {
          createFromSchema: mockCreateFromSchema,
        },
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const inputSchema = {
        class: 'TestCollection',
        description: 'Test description',
        vectorizer: 'text2vec-openai',
        vectorIndexType: 'hnsw',
        properties: [
          {
            name: 'title',
            dataType: ['text'],
            description: 'Title field',
          },
        ],
      };

      await (provider as any).createCollection('conn1', inputSchema);

      expect(mockCreateFromSchema).toHaveBeenCalledWith({
        class: 'TestCollection',
        description: 'Test description',
        vectorizer: 'text2vec-openai',
        vectorIndexType: 'hnsw',
        properties: [
          {
            name: 'title',
            dataType: ['text'],
            description: 'Title field',
          },
        ],
      });
    });

    it('handles vectorizer "none" correctly', async () => {
      const mockCreateFromSchema = jest.fn() as any;
      mockCreateFromSchema.mockImplementation(() => Promise.resolve({}));
      const mockClient = {
        collections: {
          createFromSchema: mockCreateFromSchema,
        },
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await (provider as any).createCollection('conn1', {
        class: 'TestCollection',
        vectorizer: 'none',
      });

      const calledSchema = mockCreateFromSchema.mock.calls[0][0] as any;
      expect(calledSchema.vectorizer).toBeUndefined();
    });
  });

  describe('getAvailableVectorizers', () => {
    it('returns default vectorizers when no modules available', async () => {
      const mockClient = {
        misc: {
          metaGetter: () => ({
            do: () => Promise.resolve({ modules: {} }),
          }),
        },
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const vectorizers = await (provider as any).getAvailableVectorizers('conn1');

      expect(vectorizers).toContain('none');
      expect(vectorizers.length).toBeGreaterThan(0);
    });

    it('returns vectorizers based on available modules', async () => {
      const mockClient: any = {
        misc: {
          metaGetter: () => ({
            do: () =>
              Promise.resolve({
                modules: {
                  'text2vec-openai': {},
                  'text2vec-cohere': {},
                  'multi2vec-clip': {},
                },
              }),
          }),
          getMeta: jest.fn().mockImplementation(() => Promise.resolve({} as any)),
          cluster: {
            nodes: jest.fn().mockImplementation(() => Promise.resolve({ nodes: [] } as any)),
          },
        },
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const vectorizers = await (provider as any).getAvailableVectorizers('conn1');

      expect(vectorizers).toContain('none');
      expect(vectorizers).toContain('text2vec-openai');
      expect(vectorizers).toContain('text2vec-cohere');
      expect(vectorizers).toContain('multi2vec-clip');
    });

    it('handles client errors gracefully', async () => {
      const mockClient = {
        misc: {
          metaGetter: () => ({
            do: () => Promise.reject(new Error('Network error')),
          }),
        },
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const vectorizers = await (provider as any).getAvailableVectorizers('conn1');

      // Should return defaults on error
      expect(vectorizers).toContain('none');
      expect(vectorizers).toContain('text2vec-openai');
    });
  });

  describe('ready message handling', () => {
    beforeEach(async () => {
      await provider.addCollection('conn1');
      expect(capturedOnMessage).toBeDefined();
    });

    it('sends nodesNumber when webview is ready', async () => {
      // Setup cluster nodes cache
      (provider as any).clusterNodesCache = {
        conn1: [
          { name: 'node-1', status: 'HEALTHY' },
          { name: 'node-2', status: 'HEALTHY' },
          { name: 'node-3', status: 'HEALTHY' },
        ],
      };

      // Setup cluster metadata cache
      (provider as any).clusterMetadataCache = {
        conn1: {
          version: '1.20.0',
          modules: {
            'text2vec-openai': {},
            'text2vec-cohere': {},
          },
        },
      };

      await capturedOnMessage!({ command: 'ready' }, postMessageSpy);

      // Should receive nodesNumber message
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'nodesNumber',
        nodesNumber: 3,
      });

      // Should also receive availableModules message
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'availableModules',
        modules: {
          'text2vec-openai': {},
          'text2vec-cohere': {},
        },
      });
    });

    it('sends default nodesNumber of 1 when no nodes cached', async () => {
      // No cluster nodes cache
      (provider as any).clusterNodesCache = {};

      // Empty cluster metadata cache
      (provider as any).clusterMetadataCache = {
        conn1: {
          modules: {},
        },
      };

      await capturedOnMessage!({ command: 'ready' }, postMessageSpy);

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'nodesNumber',
        nodesNumber: 1,
      });
    });

    it('sends empty modules when no metadata cached', async () => {
      // Setup cluster nodes cache
      (provider as any).clusterNodesCache = {
        conn1: [{ name: 'node-1', status: 'HEALTHY' }],
      };

      // No cluster metadata cache
      (provider as any).clusterMetadataCache = {};

      await capturedOnMessage!({ command: 'ready' }, postMessageSpy);

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'availableModules',
        modules: {},
      });
    });

    it('handles ready message before getVectorizers', async () => {
      // Setup caches
      (provider as any).clusterNodesCache = {
        conn1: [
          { name: 'node-1', status: 'HEALTHY' },
          { name: 'node-2', status: 'HEALTHY' },
        ],
      };

      (provider as any).clusterMetadataCache = {
        conn1: {
          version: '1.20.0',
          modules: {
            'text2vec-openai': {},
          },
        },
      };

      // Clear previous calls
      postMessageSpy.mockClear();

      // First, ready message
      await capturedOnMessage!({ command: 'ready' }, postMessageSpy);

      // Should get nodesNumber and modules
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'nodesNumber',
        nodesNumber: 2,
      });
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'availableModules',
        modules: {
          'text2vec-openai': {},
        },
      });

      postMessageSpy.mockClear();

      // Then, getVectorizers message
      const mockClient: any = {
        getMeta: jest.fn().mockImplementation(() => Promise.resolve({} as any)),
        cluster: {
          nodes: jest.fn().mockImplementation(() => Promise.resolve({ nodes: [] } as any)),
        },
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await capturedOnMessage!({ command: 'getVectorizers' }, postMessageSpy);

      // Should get vectorizers, modules, and nodesNumber again
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'vectorizers',
        })
      );
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'nodesNumber',
        nodesNumber: 2,
      });
    });
  });

  // Legacy inline HTML-based flow has been replaced by a React webview; HTML generation tests removed.
});
