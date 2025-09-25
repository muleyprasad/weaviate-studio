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

describe('Add Collection With Options', () => {
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
    
    // Mock connected connection
    mockConnectionManager.getConnection.mockReturnValue({
      id: 'conn1',
      name: 'Test Connection',
      status: 'connected'
    });
  });

  describe('addCollectionWithOptions', () => {
    it('creates webview panel for collection options', async () => {
      await provider.addCollectionWithOptions('conn1');

      expect(vsMock.window.createWebviewPanel).toHaveBeenCalledWith(
        'weaviateAddCollectionOptions',
        'Create Collection',
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

      await expect(provider.addCollectionWithOptions('invalid')).rejects.toThrow('Connection not found');
    });

    it('throws error for disconnected connection', async () => {
      mockConnectionManager.getConnection.mockReturnValue({
        id: 'conn1',
        status: 'disconnected'
      });

      await expect(provider.addCollectionWithOptions('conn1')).rejects.toThrow('Connection must be active');
    });

    it('generates HTML content for collection options', async () => {
      await provider.addCollectionWithOptions('conn1');

      expect(mockPanel.webview.html).toContain('Create Collection');
      expect(mockPanel.webview.html).toContain('From Scratch');
      expect(mockPanel.webview.html).toContain('Clone Existing Collection');
      expect(mockPanel.webview.html).toContain('Import from File');
    });

    it('sets up message handler for webview', async () => {
      await provider.addCollectionWithOptions('conn1');

      expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        mockCtx.subscriptions
      );
    });
  });

  describe('message handling - options selection', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      await provider.addCollectionWithOptions('conn1');
      messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
    });

    it('handles cancel message by disposing panel', async () => {
      await messageHandler({ command: 'cancel' });

      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    it('handles selectOption fromScratch', async () => {
      await messageHandler({ command: 'selectOption', option: 'fromScratch' });

      expect(mockPanel.webview.html).toContain('Basic Settings');
      expect(mockPanel.webview.html).toContain('Properties');
    });

    it('handles selectOption cloneExisting', async () => {
      // Mock collections data
      (provider as any).collections = {
        'conn1': [
          { label: 'Collection1', schema: { class: 'Collection1', properties: [] } },
          { label: 'Collection2', schema: { class: 'Collection2', properties: [] } }
        ]
      };

      await messageHandler({ command: 'selectOption', option: 'cloneExisting' });

      expect(mockPanel.webview.html).toContain('Clone Collection');
      expect(mockPanel.webview.html).toContain('Source Collection');
      expect(mockPanel.webview.html).toContain('Collection1');
      expect(mockPanel.webview.html).toContain('Collection2');
    });

    it('handles selectOption importFromFile', async () => {
      await messageHandler({ command: 'selectOption', option: 'importFromFile' });

      expect(mockPanel.webview.html).toContain('Import Collection');
      expect(mockPanel.webview.html).toContain('Drop a JSON file');
    });

    it('handles back command', async () => {
      // First switch to another view
      await messageHandler({ command: 'selectOption', option: 'fromScratch' });
      
      // Then go back
      await messageHandler({ command: 'back' });

      expect(mockPanel.webview.html).toContain('Choose how you want to create');
    });
  });

  describe('clone collection functionality', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      // Mock collections with schema
      (provider as any).collections = {
        'conn1': [
          { 
            label: 'SourceCollection',
            schema: { 
              class: 'SourceCollection',
              description: 'Test collection',
              vectorizer: 'text2vec-openai',
              properties: [
                { name: 'title', dataType: ['text'] }
              ]
            }
          }
        ]
      };

      await provider.addCollectionWithOptions('conn1');
      messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      
      // Switch to clone view
      await messageHandler({ command: 'selectOption', option: 'cloneExisting' });
      
      // Get the clone message handler
      messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[1][0];
    });

    it('handles getSchema message', async () => {
      await messageHandler({ command: 'getSchema', collectionName: 'SourceCollection' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'schema',
        schema: expect.objectContaining({
          class: 'SourceCollection',
          description: 'Test collection'
        })
      });
    });

    it('handles clone message successfully', async () => {
      const mockDo = jest.fn() as any;
      mockDo.mockResolvedValue(undefined);
      const mockClient = {
        collections: {
          createFromSchema: mockDo
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = {
        class: 'SourceCollection',
        description: 'Test collection',
        vectorizer: 'text2vec-openai',
        properties: [{ name: 'title', dataType: ['text'] }]
      };

      await messageHandler({
        command: 'clone',
        sourceCollection: 'SourceCollection',
        newCollectionName: 'ClonedCollection',
        schema: schema
      });

      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(vsMock.window.showInformationMessage).toHaveBeenCalledWith(
        'Collection "ClonedCollection" cloned successfully from "SourceCollection"'
      );
    });

    it('handles clone message with error', async () => {
      const mockDo = jest.fn() as any;
      mockDo.mockRejectedValue(new Error('Clone error'));
      const mockClient = {
        collections: {
          createFromSchema: mockDo
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = {
        class: 'SourceCollection',
        properties: []
      };

      await messageHandler({
        command: 'clone',
        sourceCollection: 'SourceCollection',
        newCollectionName: 'ClonedCollection',
        schema: schema
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: 'Clone error'
      });
    });
  });

  describe('import collection functionality', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      await provider.addCollectionWithOptions('conn1');
      messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      
      // Switch to import view
      await messageHandler({ command: 'selectOption', option: 'importFromFile' });
      
      // Get the import message handler
      messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[1][0];
    });

    it('handles import message successfully', async () => {
      const mockDo = jest.fn() as any;
      mockDo.mockResolvedValue(undefined);
      const mockClient = {
        collections: {
          createFromSchema: mockDo
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = {
        class: 'ImportedCollection',
        description: 'Imported from file',
        properties: [
          { name: 'content', dataType: ['text'] }
        ]
      };

      await messageHandler({
        command: 'import',
        schema: schema
      });

      expect(mockPanel.dispose).toHaveBeenCalled();
      expect(vsMock.window.showInformationMessage).toHaveBeenCalledWith(
        'Collection "ImportedCollection" imported successfully'
      );
    });

    it('handles import message with error', async () => {
      const mockDo = jest.fn() as any;
      mockDo.mockRejectedValue(new Error('Import error'));
      const mockClient = {
        collections: {
          createFromSchema: mockDo
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = {
        class: 'ImportedCollection',
        properties: []
      };

      await messageHandler({
        command: 'import',
        schema: schema
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: 'Import error'
      });
    });
  });

  describe('HTML generation', () => {
    it('generates valid collection options HTML structure', () => {
      const html = (provider as any).getCollectionOptionsHtml();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Create Collection</title>');
      expect(html).toContain('From Scratch');
      expect(html).toContain('Clone Existing Collection');
      expect(html).toContain('Import from File');
    });

    it('generates valid clone collection HTML structure', async () => {
      (provider as any).collections = {
        'conn1': [
          { label: 'TestCollection', schema: {} }
        ]
      };

      const html = await (provider as any).getCloneCollectionHtml('conn1');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Clone Collection</title>');
      expect(html).toContain('Source Collection');
      expect(html).toContain('New Collection Name');
      expect(html).toContain('TestCollection');
    });

    it('generates valid import collection HTML structure', () => {
      const html = (provider as any).getImportCollectionHtml();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Import Collection</title>');
      expect(html).toContain('Drop a JSON file');
      expect(html).toContain('file-drop-area');
    });

    it('includes required JavaScript functions in options HTML', () => {
      const html = (provider as any).getCollectionOptionsHtml();

      expect(html).toContain('function selectOption(option)');
      expect(html).toContain('function cancel()');
    });

    it('includes required JavaScript functions in clone HTML', async () => {
      const html = await (provider as any).getCloneCollectionHtml('conn1');

      expect(html).toContain('function goBack()');
      expect(html).toContain('function cancel()');
      expect(html).toContain('function showError(message)');
    });

    it('includes required JavaScript functions in import HTML', () => {
      const html = (provider as any).getImportCollectionHtml();

      expect(html).toContain('function selectFile()');
      expect(html).toContain('function handleFileSelect(event)');
      expect(html).toContain('function importCollection()');
    });
  });

  describe('createCollection integration', () => {
    it('successfully creates collection with schema object', async () => {
      const mockDo = jest.fn() as any;
      mockDo.mockResolvedValue(undefined);
      const mockClient = {
        collections: {
          createFromSchema: mockDo
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const schema = {
        class: 'TestCollection',
        description: 'Test description',
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'title', dataType: ['text'] }
        ]
      };

      await (provider as any).createCollection('conn1', schema);

      expect(mockDo).toHaveBeenCalledWith(schema);
    });

    it('validates required collection name', async () => {
      const mockClient = { collections: { createFromSchema: jest.fn() } };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      await expect(
        (provider as any).createCollection('conn1', { class: '' })
      ).rejects.toThrow('Collection name is required');
    });

    it('builds correct schema object for cloned collection', async () => {
      const mockDo = jest.fn() as any;
      mockDo.mockResolvedValue(undefined);
      const mockClient = {
        collections: {
          createFromSchema: mockDo
        }
      };
      mockConnectionManager.getClient.mockReturnValue(mockClient);

      const sourceSchema = {
        class: 'SourceCollection',
        description: 'Original collection',
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'title', dataType: ['text'] }
        ]
      };

      const expectedSchema = {
        class: 'ClonedCollection',
        description: 'Original collection',
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'title', dataType: ['text'] }
        ]
      };

      await (provider as any).createCollection('conn1', expectedSchema);

      expect(mockDo).toHaveBeenCalledWith(expectedSchema);
    });
  });
});