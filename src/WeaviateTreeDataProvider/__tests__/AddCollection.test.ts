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
  onConnectionsChanged: jest.fn()
};

jest.mock('../../services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: () => mockConnectionManager
  }
}));

// Mock ViewRenderer
jest.mock('../../views/ViewRenderer', () => ({
  ViewRenderer: {
    getInstance: () => ({
      renderDetailedSchema: jest.fn(() => '<html></html>')
    })
  }
}));

// Mock vscode
jest.mock('vscode', () => {
  const vsMock = require('../../test/mocks/vscode');
  vsMock.ViewColumn = { Active: 1 };
  return vsMock;
}, { virtual: true });

import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';

// Get the mocked vscode module
const vsMock = require('../../test/mocks/vscode');

describe('Add Collection', () => {
  let provider: WeaviateTreeDataProvider;
  let mockPanel: any;
  const mockCtx = {
    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
    subscriptions: []
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock webview panel
    mockPanel = {
      webview: {
        html: '',
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn()
      },
      dispose: jest.fn()
    };
    
    vsMock.window.createWebviewPanel.mockReturnValue(mockPanel);
    
    provider = new (require('../WeaviateTreeDataProvider').WeaviateTreeDataProvider)(mockCtx);
    
    // Mock fetchCollections to prevent real network calls
    jest.spyOn(provider, 'fetchCollections').mockResolvedValue();
    
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
      apiKey: ''
    });
  });

  describe('addCollection', () => {
    it('creates webview panel for connected connection', async () => {
      await provider.addCollection('conn1');

      expect(vsMock.window.createWebviewPanel).toHaveBeenCalledWith(
        'weaviateAddCollection',
        'Add Collection',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: []
        }
      );
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
        apiKey: ''
      });

      await expect(provider.addCollection('conn1')).rejects.toThrow('Connection must be active');
    });

    it('sets up message handler for webview', async () => {
      await provider.addCollection('conn1');

      expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        mockCtx.subscriptions
      );
    });

    it('generates HTML content for webview', async () => {
      await provider.addCollection('conn1');

      expect(mockPanel.webview.html).toContain('Create New Collection');
      expect(mockPanel.webview.html).toContain('Basic Settings');
      expect(mockPanel.webview.html).toContain('Properties');
    });
  });

  describe('message handling', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      await provider.addCollection('conn1');
      messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
    });

    it('handles cancel message by disposing panel', async () => {
      await messageHandler({ command: 'cancel' });

      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    it('handles getCollections message', async () => {
      // Mock collections data
      (provider as any).collections = {
        'conn1': [
          { label: 'Collection1' },
          { label: 'Collection2' }
        ]
      };

      await messageHandler({ command: 'getCollections' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'collections',
        collections: ['Collection1', 'Collection2']
      });
    });

    it('handles getVectorizers message', async () => {
      const mockClient = {
        misc: {
          metaGetter: () => ({
            do: () => Promise.resolve({
              modules: {
                'text2vec-openai': {},
                'text2vec-cohere': {}
              }
            })
          })
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      // Setup cluster metadata cache to match the mock
      (provider as any).clusterMetadataCache = {
        'conn1': {
          modules: {
            'text2vec-openai': {},
            'text2vec-cohere': {}
          }
        }
      };

      await messageHandler({ command: 'getVectorizers' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'vectorizers',
        vectorizers: ['none', 'text2vec-openai', 'text2vec-cohere']
      });
    });

    it('handles create message successfully', async () => {
      const mockCreateFromSchema = jest.fn() as any;
      mockCreateFromSchema.mockResolvedValue({});
      const mockListAll = jest.fn() as any;
      mockListAll.mockResolvedValue([]);
      const mockGetMeta = jest.fn() as any;
      mockGetMeta.mockResolvedValue({ version: 'mock', hostname: 'localhost', modules: {} });
      const mockClusterNodes = jest.fn() as any;
      mockClusterNodes.mockResolvedValue({});
      const mockClient = {
        collections: {
          createFromSchema: mockCreateFromSchema,
          listAll: mockListAll
        },
        getMeta: mockGetMeta,
        cluster: {
          nodes: mockClusterNodes
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = {
        class: 'TestCollection',
        description: 'Test description',
        vectorizer: 'text2vec-openai',
        properties: []
      };

      await messageHandler({ command: 'create', schema });

      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(vsMock.window.showInformationMessage).toHaveBeenCalledWith(
        'Collection "TestCollection" created successfully'
      );
    });

    it('handles create message with error', async () => {
      const mockCreateFromSchema = jest.fn() as any;
      mockCreateFromSchema.mockRejectedValue(new Error('Schema error'));
      const mockListAll = jest.fn() as any;
      mockListAll.mockResolvedValue([]);
      const mockGetMeta = jest.fn() as any;
      mockGetMeta.mockResolvedValue({ version: 'mock', hostname: 'localhost', modules: {} });
      const mockClusterNodes = jest.fn() as any;
      mockClusterNodes.mockResolvedValue({});
      const mockClient = {
        collections: {
          createFromSchema: mockCreateFromSchema,
          listAll: mockListAll
        },
        getMeta: mockGetMeta,
        cluster: {
          nodes: mockClusterNodes
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = { class: 'TestCollection' };

      await messageHandler({ command: 'create', schema });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: 'Schema error'
      });
    });

    it('when cloning, should open Add Collection prefilled without creating immediately', async () => {
      // Prepare: collections with schema
      (provider as any).collections = {
        'conn1': [
          {
            label: 'SourceCollection',
            schema: {
              class: 'SourceCollection',
              description: 'desc',
              properties: [
                { name: 'title', dataType: ['text'] }
              ]
            }
          }
        ]
      };

      // Re-render clone view and capture clone handlers
      // Simulate navigating to cloneExisting option by calling addCollectionWithOptions flow pieces directly
      // Create a fresh panel and handler for clone webview
      await (provider as any).addCollectionWithOptions('conn1');
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
        schema: (provider as any).collections['conn1'][0].schema
      });

      // Should not dispose panel nor call create immediately; instead should update HTML to Add form
      expect(mockPanel.dispose).not.toHaveBeenCalled();
      expect(mockPanel.webview.html).toContain('Create New Collection');
      expect(mockPanel.webview.html).toContain('id="collectionForm"');
      // Prefilled name must be present in the HTML JSON preview or input field
      expect(mockPanel.webview.html).toContain('ClonedCollection');
    });

    it('when cloning multi-tenant collection, should properly populate multi-tenancy settings', async () => {
      // Prepare: collections with multi-tenant schema
      (provider as any).collections = {
        'conn1': [
          {
            label: 'MultiTenantCollection',
            schema: {
              class: 'MultiTenantCollection',
              description: 'Multi-tenant collection',
              multiTenancy: {  // Using multiTenancy (not multiTenancyConfig) as shown in user's data
                enabled: true,
                autoTenantCreation: true,
                autoTenantActivation: true
              },
              properties: [
                { name: 'title', dataType: ['text'] }
              ]
            }
          }
        ]
      };

      // Navigate to clone view and trigger clone
      await (provider as any).addCollectionWithOptions('conn1');
      const optionsHandler = mockPanel.webview.onDidReceiveMessage.mock.calls.pop()?.[0];
      
      await optionsHandler({ command: 'selectOption', option: 'cloneExisting' });
      const cloneHandler = mockPanel.webview.onDidReceiveMessage.mock.calls.pop()?.[0];
      
      await cloneHandler({ command: 'getSchema', collectionName: 'MultiTenantCollection' });
      
      await cloneHandler({
        command: 'clone',
        sourceCollection: 'MultiTenantCollection',
        newCollectionName: 'ClonedMultiTenant',
        schema: (provider as any).collections['conn1'][0].schema
      });

      // Should populate Add Collection form with multi-tenancy settings
      expect(mockPanel.webview.html).toContain('Create New Collection');
      
      // Check that the initial schema data is properly embedded in the JavaScript
      // The multiTenancyConfig should be passed as initialSchema to the form
      const htmlContent = mockPanel.webview.html;
      expect(htmlContent).toContain('const initialSchema =');
      
      // Extract the initialSchema JSON from the HTML
      const initialSchemaMatch = htmlContent.match(/const initialSchema = ({.*?});/s);
      expect(initialSchemaMatch).toBeTruthy();
      
      if (initialSchemaMatch) {
        const initialSchemaStr = initialSchemaMatch[1];
        expect(initialSchemaStr).toContain('"multiTenancy"');
        expect(initialSchemaStr).toContain('"enabled":true');
        expect(initialSchemaStr).toContain('"autoTenantCreation":true');
        expect(initialSchemaStr).toContain('"autoTenantActivation":true');
      }
    });
  });

  describe('createCollection', () => {
    it('validates required collection name', async () => {
      const mockClient = { schema: { classCreator: jest.fn() } };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await expect(
        (provider as any).createCollection('conn1', { class: '' })
      ).rejects.toThrow('Collection name is required');
    });

    it('builds correct schema object', async () => {
      const mockCreateFromSchema = jest.fn() as any;
      mockCreateFromSchema.mockResolvedValue({});
      const mockClient = {
        collections: {
          createFromSchema: mockCreateFromSchema
        }
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
            description: 'Title field'
          }
        ]
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
            description: 'Title field'
          }
        ]
      });
    });

    it('handles vectorizer "none" correctly', async () => {
      const mockCreateFromSchema = jest.fn() as any;
      mockCreateFromSchema.mockResolvedValue({});
      const mockClient = {
        collections: {
          createFromSchema: mockCreateFromSchema
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await (provider as any).createCollection('conn1', {
        class: 'TestCollection',
        vectorizer: 'none'
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
            do: () => Promise.resolve({ modules: {} })
          })
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const vectorizers = await (provider as any).getAvailableVectorizers('conn1');

      expect(vectorizers).toContain('none');
      expect(vectorizers.length).toBeGreaterThan(0);
    });

    it('returns vectorizers based on available modules', async () => {
      const mockClient = {
        misc: {
          metaGetter: () => ({
            do: () => Promise.resolve({
              modules: {
                'text2vec-openai': {},
                'text2vec-cohere': {},
                'multi2vec-clip': {}
              }
            })
          })
        }
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
            do: () => Promise.reject(new Error('Network error'))
          })
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const vectorizers = await (provider as any).getAvailableVectorizers('conn1');

      // Should return defaults on error
      expect(vectorizers).toContain('none');
      expect(vectorizers).toContain('text2vec-openai');
    });
  });

  describe('HTML generation', () => {
    it('generates valid HTML structure', () => {
      const html = (provider as any).getAddCollectionHtml();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Add Collection</title>');
      expect(html).toContain('id="collectionForm"');
      expect(html).toContain('Basic Settings');
      expect(html).toContain('Properties');
      expect(html).toContain('Multi-Tenancy');
      expect(html).toContain('Schema Preview');
    });

    it('includes required JavaScript functions', () => {
      const html = (provider as any).getAddCollectionHtml();

      expect(html).toContain('function initForm()');
      expect(html).toContain('function addProperty()');
      expect(html).toContain('function createPropertyCard(');
      expect(html).toContain('function updateJsonPreview()');
      expect(html).toContain('function handleSubmit(');
    });

    it('includes proper CSS styling', () => {
      const html = (provider as any).getAddCollectionHtml();

      expect(html).toContain('.form-section');
      expect(html).toContain('.property-card');
      expect(html).toContain('.section-header');
      expect(html).toContain('var(--vscode-sideBar-background, #F7F7F7)');
      expect(html).toContain('var(--vscode-panel-border, #E0E0E0)');
    });
  });
}); 