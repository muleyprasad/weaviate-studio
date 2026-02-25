/**
 * Tests for data-fetch methods, utility helpers, getParent, and CRUD operations
 * in WeaviateTreeDataProvider.
 *
 * Covers uncovered lines including:
 *  - humanizeDuration (3656–3691)
 *  - flattenObject (3693–3725)
 *  - getWeaviateBaseUrl (3132–3160)
 *  - getWeaviateHeaders (3167–3183)
 *  - getParent (131–155)
 *  - fetchMetadata (2576–2594)
 *  - fetchNodes (2600–2618)
 *  - fetchCollectionsData (2624–2665)
 *  - fetchAliases (2900–2932)
 *  - deleteCollection (3001–3042)
 *  - deleteAllCollections (3049–3079)
 *  - refreshCollections (2938–2949)
 */

import * as vscode from 'vscode';
import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';
import { WeaviateTreeItem } from '../../types';

// ─── Mock client ────────────────────────────────────────────────────────────

const mockGetMeta = jest.fn();
const mockClusterNodes = jest.fn();
const mockListAll = jest.fn();
const mockAliasListAll = jest.fn();
const mockCollectionsDelete = jest.fn();
const mockCollectionsDeleteAll = jest.fn();

const mockClient = {
  getMeta: mockGetMeta,
  cluster: { nodes: mockClusterNodes },
  collections: {
    listAll: mockListAll,
    delete: mockCollectionsDelete,
    deleteAll: mockCollectionsDeleteAll,
  },
  alias: { listAll: mockAliasListAll },
};

// ─── Mock ConnectionManager ─────────────────────────────────────────────────

const mockGetConnection = jest.fn();
const mockGetClient = jest.fn().mockReturnValue(mockClient);

jest.mock('../../services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: () => ({
      getConnections: () => [
        {
          id: 'c1',
          name: 'TestConn',
          status: 'connected',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          httpSecure: false,
        },
      ],
      getConnection: mockGetConnection,
      getClient: mockGetClient,
      onConnectionsChanged: jest.fn(),
    }),
  },
}));

jest.mock('../../views/ViewRenderer', () => ({
  ViewRenderer: {
    getInstance: () => ({ renderDetailedSchema: jest.fn(), renderRawConfig: jest.fn() }),
  },
}));

// Minimal context
const mockCtx = {
  globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

function makeProvider() {
  return new WeaviateTreeDataProvider(mockCtx);
}

function makeItem(
  itemType: WeaviateTreeItem['itemType'],
  connectionId = 'c1',
  collectionName?: string,
  itemId?: string
): WeaviateTreeItem {
  return new WeaviateTreeItem(
    'Test',
    vscode.TreeItemCollapsibleState.None,
    itemType,
    connectionId,
    collectionName,
    itemId
  );
}

// ─── humanizeDuration ────────────────────────────────────────────────────────

describe('humanizeDuration', () => {
  let provider: WeaviateTreeDataProvider;
  beforeEach(() => {
    provider = makeProvider();
  });

  const dur = (start: string, end: string) => (provider as any).humanizeDuration(start, end);

  it('returns seconds for sub-minute duration', () => {
    expect(dur('2025-01-01T10:00:00.000Z', '2025-01-01T10:00:45.000Z')).toBe('45s');
  });

  it('returns minutes and seconds', () => {
    expect(dur('2025-01-01T10:00:00.000Z', '2025-01-01T10:05:30.000Z')).toBe('5m 30s');
  });

  it('returns hours and minutes (no seconds)', () => {
    expect(dur('2025-01-01T10:00:00.000Z', '2025-01-01T12:30:00.000Z')).toBe('2h 30m');
  });

  it('returns days and hours', () => {
    expect(dur('2025-01-01T00:00:00.000Z', '2025-01-03T06:00:00.000Z')).toBe('2d 6h');
  });

  it('returns "0s" for zero duration', () => {
    expect(dur('2025-01-01T10:00:00.000Z', '2025-01-01T10:00:00.000Z')).toBe('0s');
  });

  it('returns null for negative duration', () => {
    expect(dur('2025-01-01T10:00:01.000Z', '2025-01-01T10:00:00.000Z')).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(dur('not-a-date', 'also-not-a-date')).toBeNull();
  });
});

// ─── flattenObject ────────────────────────────────────────────────────────────

describe('flattenObject', () => {
  let provider: WeaviateTreeDataProvider;
  beforeEach(() => {
    provider = makeProvider();
  });

  const flat = (obj: any, keys: string[] = [], parent = '', sorted?: boolean) =>
    (provider as any).flattenObject(obj, keys, parent, sorted);

  it('flattens a simple one-level object', async () => {
    const result = await flat({ a: 1, b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('flattens nested objects recursively', async () => {
    const result = await flat({ x: { y: { z: 42 } } });
    expect(result).toEqual({ 'x y z': 42 });
  });

  it('excludes specified keys', async () => {
    const result = await flat({ a: 1, b: { c: 2 }, skip: 99 }, ['skip']);
    expect(result).not.toHaveProperty('skip');
    expect(result).toHaveProperty('a', 1);
  });

  it('uses parentKey prefix', async () => {
    const result = await flat({ b: 2 }, [], 'parent');
    expect(result).toHaveProperty('parent b', 2);
  });

  it('keeps arrays as values (does not recurse into them)', async () => {
    const result = await flat({ tags: ['a', 'b'] });
    expect(result).toEqual({ tags: ['a', 'b'] });
  });

  it('sorts keys when sorted=true', async () => {
    const result = await flat({ z: 3, a: 1, m: 2 }, [], '', true);
    expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
  });

  it('does not sort keys when sorted=false', async () => {
    const result = await flat({ z: 3, a: 1 }, [], '', false);
    expect(Object.keys(result)[0]).toBe('z');
  });
});

// ─── getWeaviateBaseUrl ───────────────────────────────────────────────────────

describe('getWeaviateBaseUrl', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  const baseUrl = (conn: any) => {
    mockGetConnection.mockReturnValue(conn);
    return (provider as any).getWeaviateBaseUrl('c1');
  };

  it('builds HTTP URL from custom connection', () => {
    expect(
      baseUrl({ type: 'custom', httpSecure: false, httpHost: 'localhost', httpPort: 8080 })
    ).toBe('http://localhost:8080');
  });

  it('builds HTTPS URL from custom connection with httpSecure', () => {
    expect(baseUrl({ type: 'custom', httpSecure: true, httpHost: 'my.host', httpPort: 443 })).toBe(
      'https://my.host:443'
    );
  });

  it('defaults to localhost:8080 when httpHost/httpPort missing', () => {
    expect(baseUrl({ type: 'custom', httpSecure: false })).toBe('http://localhost:8080');
  });

  it('returns cloud URL for cloud connection (strips trailing slash)', () => {
    expect(baseUrl({ type: 'cloud', cloudUrl: 'https://my-instance.weaviate.network/' })).toBe(
      'https://my-instance.weaviate.network'
    );
  });

  it('throws when connection not found', () => {
    mockGetConnection.mockReturnValue(undefined);
    expect(() => (provider as any).getWeaviateBaseUrl('missing')).toThrow('Connection not found');
  });

  it('throws for unsupported connection type without cloudUrl', () => {
    expect(() => baseUrl({ type: 'other' })).toThrow('Invalid connection configuration');
  });
});

// ─── getWeaviateHeaders ───────────────────────────────────────────────────────

describe('getWeaviateHeaders', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  const headers = (conn: any) => {
    mockGetConnection.mockReturnValue(conn);
    return (provider as any).getWeaviateHeaders('c1');
  };

  it('returns Content-Type and integration header', () => {
    const h = headers({ type: 'custom' });
    expect(h['Content-Type']).toBe('application/json');
    expect(h['X-Weaviate-Client-Integration']).toBeDefined();
  });

  it('does not include Authorization when apiKey absent', () => {
    const h = headers({ type: 'custom' });
    expect(h['Authorization']).toBeUndefined();
  });

  it('includes Authorization Bearer when apiKey present', () => {
    const h = headers({ type: 'custom', apiKey: 'sk-secret' });
    expect(h['Authorization']).toBe('Bearer sk-secret');
  });

  it('throws when connection not found', () => {
    mockGetConnection.mockReturnValue(undefined);
    expect(() => (provider as any).getWeaviateHeaders('missing')).toThrow('Connection not found');
  });
});

// ─── getParent ────────────────────────────────────────────────────────────────

describe('getParent', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  it('returns undefined for root connection items', () => {
    const item = makeItem('connection');
    expect(provider.getParent(item)).toBeUndefined();
  });

  it('returns the parent connection item for non-root items', () => {
    // connection 'c1' is in the provider's connections list via MockConnectionManager
    const item = makeItem('serverInfo', 'c1');
    const parent = provider.getParent(item) as WeaviateTreeItem;
    expect(parent).toBeDefined();
    expect(parent?.itemType).toBe('connection');
    expect(parent?.connectionId).toBe('c1');
  });

  it('returns undefined when connectionId is unknown', () => {
    const item = makeItem('serverInfo', 'unknown-id');
    expect(provider.getParent(item)).toBeUndefined();
  });
});

// ─── fetchMetadata ────────────────────────────────────────────────────────────

describe('fetchMetadata', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
  });

  it('populates clusterMetadataCache on success', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockGetMeta.mockResolvedValue({ version: '1.20.0', hostname: 'weaviate.local' });

    await provider.fetchMetadata('c1');

    expect((provider as any).clusterMetadataCache['c1']).toEqual({
      version: '1.20.0',
      hostname: 'weaviate.local',
    });
  });

  it('shows error message when client not found', async () => {
    mockGetClient.mockReturnValue(null);

    await provider.fetchMetadata('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch metadata')
    );
  });

  it('shows error message when getMeta throws', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockGetMeta.mockRejectedValue(new Error('Network error'));

    await provider.fetchMetadata('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch metadata')
    );
  });
});

// ─── fetchNodes ───────────────────────────────────────────────────────────────

describe('fetchNodes', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
  });

  it('populates clusterNodesCache on success', async () => {
    mockGetClient.mockReturnValue(mockClient);
    const nodes = [
      { name: 'node-1', status: 'HEALTHY', stats: { objectCount: 10, shardCount: 2 } },
    ];
    mockClusterNodes.mockResolvedValue(nodes);

    await provider.fetchNodes('c1');

    expect((provider as any).clusterNodesCache['c1']).toEqual(nodes);
  });

  it('shows error when client not found', async () => {
    mockGetClient.mockReturnValue(null);

    await provider.fetchNodes('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch cluster nodes')
    );
  });

  it('shows error when cluster.nodes throws', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockClusterNodes.mockRejectedValue(new Error('Timeout'));

    await provider.fetchNodes('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch cluster nodes')
    );
  });
});

// ─── fetchCollectionsData ─────────────────────────────────────────────────────

describe('fetchCollectionsData', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
  });

  it('populates and sorts collections alphabetically', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockListAll.mockResolvedValue([
      { name: 'Zebra', description: 'Z collection' },
      { name: 'Apple', description: 'A collection' },
    ]);

    await provider.fetchCollectionsData('c1');

    const cols = (provider as any).collections['c1'];
    expect(cols).toHaveLength(2);
    expect(cols[0].label).toBe('Apple');
    expect(cols[1].label).toBe('Zebra');
  });

  it('sets empty array when collections response is not an array', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockListAll.mockResolvedValue(null);

    await provider.fetchCollectionsData('c1');

    expect((provider as any).collections['c1']).toEqual([]);
  });

  it('shows error when client not found', async () => {
    mockGetClient.mockReturnValue(null);

    await provider.fetchCollectionsData('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch collections')
    );
  });

  it('shows error when listAll throws', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockListAll.mockRejectedValue(new Error('Connection refused'));

    await provider.fetchCollectionsData('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch collections')
    );
  });
});

// ─── fetchAliases ─────────────────────────────────────────────────────────────

describe('fetchAliases', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
  });

  it('populates aliasesCache sorted by alias name', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockAliasListAll.mockResolvedValue([
      { alias: 'zAlias', collection: 'Col1' },
      { alias: 'aAlias', collection: 'Col2' },
    ]);

    await (provider as any).fetchAliases('c1');

    const aliases = (provider as any).aliasesCache['c1'];
    expect(aliases[0].alias).toBe('aAlias');
    expect(aliases[1].alias).toBe('zAlias');
  });

  it('sets empty array when alias response is falsy', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockAliasListAll.mockResolvedValue(null);

    await (provider as any).fetchAliases('c1');

    expect((provider as any).aliasesCache['c1']).toEqual([]);
  });

  it('returns immediately when client not found', async () => {
    mockGetClient.mockReturnValue(null);

    await (provider as any).fetchAliases('c1');

    // No error shown, no cache entry set
    expect((provider as any).aliasesCache['c1']).toBeUndefined();
  });

  it('shows error and keeps existing cache on exception', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockAliasListAll.mockRejectedValue(new Error('Unauthorized'));
    // Pre-populate cache
    (provider as any).aliasesCache['c1'] = [{ alias: 'existing', collection: 'Col' }];

    await (provider as any).fetchAliases('c1');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch aliases')
    );
    // Original cache kept
    expect((provider as any).aliasesCache['c1'][0].alias).toBe('existing');
  });

  it('sets empty array when no prior cache and exception occurs', async () => {
    mockGetClient.mockReturnValue(mockClient);
    mockAliasListAll.mockRejectedValue(new Error('Network error'));

    await (provider as any).fetchAliases('c1');

    expect((provider as any).aliasesCache['c1']).toEqual([]);
  });
});

// ─── deleteCollection ─────────────────────────────────────────────────────────

describe('deleteCollection', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
    mockGetClient.mockReturnValue(mockClient);
    mockGetConnection.mockReturnValue({ id: 'c1', name: 'TestConn', status: 'connected' });
    mockCollectionsDelete.mockResolvedValue(undefined);
    mockClusterNodes.mockResolvedValue([]);
    // Seed collections with both label and collectionName (as used in filtering)
    (provider as any).collections['c1'] = [
      { label: 'Article', collectionName: 'Article' },
      { label: 'Author', collectionName: 'Author' },
    ];
  });

  it('removes collection from cache after deletion', async () => {
    await provider.deleteCollection('c1', 'Article');

    const remaining = (provider as any).collections['c1'];
    expect(remaining.find((c: any) => c.collectionName === 'Article')).toBeUndefined();
    expect(remaining.find((c: any) => c.collectionName === 'Author')).toBeDefined();
  });

  it('calls client.collections.delete with correct name', async () => {
    await provider.deleteCollection('c1', 'Article');
    expect(mockCollectionsDelete).toHaveBeenCalledWith('Article');
  });

  it('shows error message and throws on client failure', async () => {
    mockCollectionsDelete.mockRejectedValue(new Error('Permission denied'));

    await expect(provider.deleteCollection('c1', 'Article')).rejects.toThrow('Permission denied');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied')
    );
  });

  it('throws when connection not found', async () => {
    mockGetConnection.mockReturnValue(undefined);

    await expect(provider.deleteCollection('c1', 'Article')).rejects.toThrow(
      'Connection not found'
    );
  });
});

// ─── deleteAllCollections ─────────────────────────────────────────────────────

describe('deleteAllCollections', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
    mockGetClient.mockReturnValue(mockClient);
    mockGetConnection.mockReturnValue({ id: 'c1', name: 'TestConn', status: 'connected' });
    mockCollectionsDeleteAll.mockResolvedValue(undefined);
    mockClusterNodes.mockResolvedValue([]);
    (provider as any).collections['c1'] = [
      { label: 'Article', collectionName: 'Article' },
      { label: 'Author', collectionName: 'Author' },
    ];
  });

  it('clears collections cache after successful delete all', async () => {
    await provider.deleteAllCollections('c1');
    expect((provider as any).collections['c1']).toEqual([]);
  });

  it('calls client.collections.deleteAll', async () => {
    await provider.deleteAllCollections('c1');
    expect(mockCollectionsDeleteAll).toHaveBeenCalled();
  });

  it('throws on client failure', async () => {
    mockCollectionsDeleteAll.mockRejectedValue(new Error('Server error'));

    await expect(provider.deleteAllCollections('c1')).rejects.toThrow('Server error');
  });

  it('throws when connection not found', async () => {
    mockGetConnection.mockReturnValue(undefined);

    await expect(provider.deleteAllCollections('c1')).rejects.toThrow('Connection not found');
  });
});

// ─── refreshCollections ───────────────────────────────────────────────────────

describe('refreshCollections', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    provider = makeProvider();
    jest.clearAllMocks();
    mockGetClient.mockReturnValue(mockClient);
    mockListAll.mockResolvedValue([{ name: 'Article', description: '' }]);
  });

  it('shows info message when not silent', async () => {
    await provider.refreshCollections('c1', false);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('refreshed')
    );
  });

  it('does not show message when silent=true', async () => {
    await provider.refreshCollections('c1', true);
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
