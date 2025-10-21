import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';
import * as vscode from 'vscode';

// --- Mocks ------------------------------------------------------------

// Mock ConnectionManager with minimal behavior we need
class MockConnectionManager {
  private static instance: MockConnectionManager;
  private connections: any[];
  public onConnectionsChanged = (listener: () => void) => {
    /* no-op for these tests */
  };

  private constructor(connections: any[]) {
    this.connections = connections;
  }

  static getInstance(_ctx: vscode.ExtensionContext, seed?: any[]): MockConnectionManager {
    if (!MockConnectionManager.instance) {
      MockConnectionManager.instance = new MockConnectionManager(seed || []);
    }
    return MockConnectionManager.instance;
  }

  getConnections() {
    return [...this.connections].sort((a: any, b: any) => (b.lastUsed || 0) - (a.lastUsed || 0));
  }

  // additional stubs if needed later
  getConnection(_id: string) {
    return this.connections.find((c) => c.id === _id);
  }
}

// Jest module mocks
jest.mock('../../services/ConnectionManager', () => {
  return {
    ConnectionManager: {
      getInstance: (...args: any[]) => MockConnectionManager.getInstance(args[0], mockConnections),
    },
  };
});

jest.mock('../../views/ViewRenderer', () => {
  return {
    ViewRenderer: {
      getInstance: () => ({
        renderDetailedSchema: jest.fn(),
        renderRawConfig: jest.fn(),
      }),
    },
  };
});

const mockConnections = [
  { id: '1', name: 'Local', url: 'http://a', status: 'disconnected', lastUsed: 1 },
  { id: '2', name: 'Prod', url: 'http://b', status: 'connected', lastUsed: 2 },
];

// ---------------------------------------------------------------------

describe('WeaviateTreeDataProvider', () => {
  let provider: WeaviateTreeDataProvider;
  const mockCtx = {
    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
    subscriptions: [],
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    // Reset singleton between tests
    jest.resetModules();
    (MockConnectionManager as any).instance = undefined;
    provider = new (require('../WeaviateTreeDataProvider').WeaviateTreeDataProvider)(mockCtx);
  });

  it('returns connection nodes at root', async () => {
    const children = await provider.getChildren();
    expect(children).toHaveLength(mockConnections.length);
    const labels = children.map((c: any) => c.label);
    expect(labels).toContain('🔗 Local');
    expect(labels).toContain('🔗 Prod');
  });

  it('sorts connections by lastUsed desc', async () => {
    const children = await provider.getChildren();
    expect(children[0].label).toBe('🔗 Prod');
    expect(children[1].label).toBe('🔗 Local');
  });

  it('create TreeItem for connection has collapsibleState', async () => {
    const children = await provider.getChildren();
    const item: any = provider.getTreeItem(children[0]);
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
  });

  it('getStatusIcon returns correct icon for statuses', () => {
    const iconConnected: any = provider.getStatusIcon('connected');
    const iconDisconnected: any = provider.getStatusIcon('disconnected');
    expect(iconConnected.id).toBe('circle-filled');
    expect(iconConnected.color.id).toBe('testing.iconPassed');
    expect(iconDisconnected.id).toBe('circle-outline');
    expect(iconDisconnected.color).toBeUndefined();
  });

  it('child nodes under a connected connection include expected sections', async () => {
    const rootChildren = await provider.getChildren();
    const connected: any = rootChildren.find((c: any) => c.label.endsWith('Prod'));
    expect(connected).toBeDefined();
    const sections = await provider.getChildren(connected);
    const itemTypes = sections.map((s: any) => s.itemType);
    expect(itemTypes).toEqual(
      expect.arrayContaining(['serverInfo', 'clusterNodes', 'collectionsGroup'])
    );
  });

  it('collections group label reflects count', async () => {
    // inject 3 mock collections for Prod (id 2)
    (provider as any).collections['2'] = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
    const rootChildren = await provider.getChildren();
    const connected: any = rootChildren.find((c: any) => c.label.endsWith('Prod'));
    expect(connected).toBeDefined();
    const sections = await provider.getChildren(connected);
    const collectionsGroup: any = sections.find((s: any) => s.itemType === 'collectionsGroup');
    expect(collectionsGroup.label).toMatch(/Collections \(3\)/);
  });

  it('contextValue set correctly on connected connection', async () => {
    const rootChildren = await provider.getChildren();
    const connected: any = rootChildren.find((c: any) => c.label.endsWith('Prod'));
    expect(connected).toBeDefined();
    expect(connected.contextValue).toBe('weaviateConnectionActive');
  });

  describe('getChildren for properties', () => {
    it('should handle null, undefined, and valid descriptions for properties', async () => {
      // 1. Setup mock data
      const connectionId = '2'; // 'Prod' connection is 'connected'
      const collectionName = 'TestCollection';
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            { name: 'propWithDesc', dataType: ['string'], description: 'This is a description.' },
            { name: 'propWithNullDesc', dataType: ['int'], description: null },
            { name: 'propWithUndefinedDesc', dataType: ['boolean'] },
            { name: 'propToTrim', dataType: ['text'], description: '  needs trimming  ' },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      // 2. Define the parent element for which we want children
      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (4)',
      };

      // 3. Call getChildren
      const propertyItems = await provider.getChildren(propertiesElement as any);

      // 4. Assertions
      expect(propertyItems).toHaveLength(4);

      const desc1 = propertyItems.find((p: any) => p.itemId === 'propWithDesc')?.description;
      const desc2 = propertyItems.find((p: any) => p.itemId === 'propWithNullDesc')?.description;
      const desc3 = propertyItems.find(
        (p: any) => p.itemId === 'propWithUndefinedDesc'
      )?.description;
      const desc4 = propertyItems.find((p: any) => p.itemId === 'propToTrim')?.description;

      expect(desc1).toBe('This is a description.');
      expect(desc2).toBe('');
      expect(desc3).toBe('');
      expect(desc4).toBe('needs trimming');
    });
  });

  describe('deleteAllCollections', () => {
    let provider: WeaviateTreeDataProvider;

    beforeEach(() => {
      // Create a fresh provider instance for isolated testing
      const mockCtx = {
        globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
        subscriptions: [],
      } as unknown as vscode.ExtensionContext;

      provider = new WeaviateTreeDataProvider(mockCtx);
    });

    it('should call client.collections.deleteAll and clear collections state', async () => {
      const mockClient = {
        collections: {
          deleteAll: jest.fn(),
        },
      };

      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue({ id: '1', name: 'Test Connection' }),
        getClient: jest.fn().mockReturnValue(mockClient),
      };

      // Mock the connectionManager property
      (provider as any).connectionManager = mockConnectionManager;

      // Set up some collections to be deleted
      (provider as any).collections['1'] = [
        { label: 'Collection1' },
        { label: 'Collection2' },
        { label: 'Collection3' },
      ];

      // Mock the refresh method
      const refreshSpy = jest.spyOn(provider, 'refresh').mockImplementation(() => {});

      await provider.deleteAllCollections('1');

      expect(mockConnectionManager.getConnection).toHaveBeenCalledWith('1');
      expect(mockConnectionManager.getClient).toHaveBeenCalledWith('1');
      expect(mockClient.collections.deleteAll).toHaveBeenCalled();
      expect((provider as any).collections['1']).toEqual([]);
      expect(refreshSpy).toHaveBeenCalled();

      refreshSpy.mockRestore();
    });

    it('should throw error when connection not found', async () => {
      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue(null),
        getClient: jest.fn(),
      };

      (provider as any).connectionManager = mockConnectionManager;

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(provider.deleteAllCollections('invalid')).rejects.toThrow(
        'Failed to delete all collections: Connection not found'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when client not initialized', async () => {
      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue({ id: '1', name: 'Test Connection' }),
        getClient: jest.fn().mockReturnValue(null),
      };

      (provider as any).connectionManager = mockConnectionManager;

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(provider.deleteAllCollections('1')).rejects.toThrow(
        'Failed to delete all collections: Client not initialized'
      );

      consoleSpy.mockRestore();
    });

    it('should handle client API errors gracefully', async () => {
      const mockClient = {
        collections: {
          deleteAll: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      };

      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue({ id: '1', name: 'Test Connection' }),
        getClient: jest.fn().mockReturnValue(mockClient),
      };

      (provider as any).connectionManager = mockConnectionManager;

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(provider.deleteAllCollections('1')).rejects.toThrow(
        'Failed to delete all collections: API Error'
      );

      consoleSpy.mockRestore();
    });
  });
});
