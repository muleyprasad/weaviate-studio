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
    return this.connections.find(c => c.id === _id);
  }
}

// Jest module mocks
jest.mock('../../services/ConnectionManager', () => {
  return {
    ConnectionManager: {
      getInstance: (...args: any[]) => MockConnectionManager.getInstance(args[0], mockConnections)
    }
  };
});

jest.mock('../../views/ViewRenderer', () => {
  return {
    ViewRenderer: {
      getInstance: () => ({
        renderDetailedSchema: jest.fn(),
        renderRawConfig: jest.fn()
      })
    }
  };
});

const mockConnections = [
  { id: '1', name: 'Local', url: 'http://a', status: 'disconnected', lastUsed: 1 },
  { id: '2', name: 'Prod', url: 'http://b', status: 'connected', lastUsed: 2 }
];

// ---------------------------------------------------------------------

describe('WeaviateTreeDataProvider', () => {
  let provider: WeaviateTreeDataProvider;
  const mockCtx = {
    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
    subscriptions: []
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
    expect(itemTypes).toEqual(expect.arrayContaining(["serverInfo", "clusterNodes", "collectionsGroup"]));
  });

  it('collections group label reflects count', async () => {
    // inject 3 mock collections for Prod (id 2)
    (provider as any).collections['2'] = [ {label:'A'}, {label:'B'}, {label:'C'} ];
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
});