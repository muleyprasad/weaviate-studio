/**
 * Tests for getChildren() branches in WeaviateTreeDataProvider.
 *
 * Covers uncovered branches:
 *  - vectorConfig (989–1067): with/without vectorizers
 *  - generativeConfig (1068–1103)
 *  - rerankerConfig (1104–1139)
 *  - collectionReplication (1140–1176)
 *  - serverInfo (1485–1575): with/without meta fields, no meta
 *  - modules (1576–1655): with modules, empty, no meta, no client
 *  - clusterNodes (1656–1723): with nodes, empty, no client
 *  - clusterNode detail (1724–1791)
 *  - aliases (2086–2126): with aliases, empty
 *  - backupItem (2127–2292): found / not found backup
 */

import * as vscode from 'vscode';
import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';
import { WeaviateTreeItem } from '../../types';

// ─── Mock client ────────────────────────────────────────────────────────────

const mockGetClient = jest.fn();
const mockGetConnection = jest.fn();

jest.mock('../../services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: () => ({
      getConnections: () => [{ id: 'c1', name: 'TestConn', status: 'connected', type: 'custom' }],
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

const mockCtx = {
  globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

function makeProvider() {
  return new WeaviateTreeDataProvider(mockCtx);
}

function item(
  itemType: WeaviateTreeItem['itemType'],
  connectionId = 'c1',
  collectionName?: string,
  itemId?: string
): WeaviateTreeItem {
  return new WeaviateTreeItem(
    'Test',
    vscode.TreeItemCollapsibleState.Collapsed,
    itemType,
    connectionId,
    collectionName,
    itemId
  );
}

// ─── vectorConfig ─────────────────────────────────────────────────────────────

describe("getChildren — 'vectorConfig'", () => {
  it('returns vectorConfigDetail items for each vectorizer', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: {
          vectorizers: {
            'text2vec-openai': { vectorizer: { name: 'text2vec-openai' } },
            'text2vec-cohere': { vectorizer: { name: 'text2vec-cohere' } },
          },
        },
      },
    ];

    const children = await provider.getChildren(item('vectorConfig', 'c1', 'Article'));
    expect(children.map((c: any) => c.itemType)).toEqual([
      'vectorConfigDetail',
      'vectorConfigDetail',
    ]);
  });

  it('returns "No vector configuration found" when vectorizers is empty', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: { vectorizers: {} },
      },
    ];

    const children = await provider.getChildren(item('vectorConfig', 'c1', 'Article'));
    expect(children[0].label).toMatch(/No vector configuration found/);
  });

  it('returns "No Vectors available" when collection not found', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [];

    const children = await provider.getChildren(item('vectorConfig', 'c1', 'Article'));
    expect(children[0].label).toMatch(/No Vectors available/);
  });
});

// ─── generativeConfig ─────────────────────────────────────────────────────────

describe("getChildren — 'generativeConfig'", () => {
  it('returns flattened generative config items', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: {
          generative: { 'generative-openai': { model: 'gpt-4', temperature: 0.7 } },
        },
      },
    ];

    const children = await provider.getChildren(item('generativeConfig', 'c1', 'Article'));
    expect(children.length).toBeGreaterThan(0);
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.includes('gpt-4'))).toBe(true);
  });

  it('returns "No generative configuration found" when generative is empty', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: { generative: {} },
      },
    ];

    const children = await provider.getChildren(item('generativeConfig', 'c1', 'Article'));
    expect(children[0].label).toMatch(/No generative configuration/);
  });
});

// ─── rerankerConfig ───────────────────────────────────────────────────────────

describe("getChildren — 'rerankerConfig'", () => {
  it('returns flattened reranker config items', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: {
          reranker: { 'reranker-cohere': { model: 'rerank-english-v2.0' } },
        },
      },
    ];

    const children = await provider.getChildren(item('rerankerConfig', 'c1', 'Article'));
    expect(children.length).toBeGreaterThan(0);
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.includes('rerank-english-v2.0'))).toBe(true);
  });

  it('returns "No reranker configuration found" when reranker is empty', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: { reranker: {} },
      },
    ];

    const children = await provider.getChildren(item('rerankerConfig', 'c1', 'Article'));
    expect(children[0].label).toMatch(/No reranker configuration/);
  });
});

// ─── collectionReplication ────────────────────────────────────────────────────

describe("getChildren — 'collectionReplication'", () => {
  it('returns flattened replication config items', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: {
          replication: { factor: 3, asyncEnabled: true },
        },
      },
    ];

    const children = await provider.getChildren(item('collectionReplication', 'c1', 'Article'));
    expect(children.length).toBeGreaterThan(0);
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.includes('factor') || l.includes('3'))).toBe(true);
  });

  it('returns "No replication configuration found" when replication is empty', async () => {
    const provider = makeProvider();
    (provider as any).collections['c1'] = [
      {
        label: 'Article',
        collectionName: 'Article',
        schema: { replication: {} },
      },
    ];

    const children = await provider.getChildren(item('collectionReplication', 'c1', 'Article'));
    expect(children[0].label).toMatch(/No replication configuration/);
  });
});

// ─── serverInfo ───────────────────────────────────────────────────────────────

describe("getChildren — 'serverInfo'", () => {
  it('returns version, hostname and modules items from metadata cache', async () => {
    const provider = makeProvider();
    (provider as any).clusterMetadataCache['c1'] = {
      version: '1.20.0',
      hostname: 'weaviate.local',
      grpcMaxMessageSize: 104857600,
      modules: { 'text2vec-openai': {} },
    };

    const children = await provider.getChildren(item('serverInfo', 'c1'));
    const labels = children.map((c: any) => c.label);

    expect(labels.some((l: string) => l.includes('1.20.0'))).toBe(true);
    expect(labels.some((l: string) => l.includes('weaviate.local'))).toBe(true);
    expect(labels.some((l: string) => l.includes('gRPC'))).toBe(true);
    // Modules group item
    expect(labels.some((l: string) => l.includes('Available Modules'))).toBe(true);
  });

  it('returns "Unable to fetch server information" when metadata not in cache', async () => {
    const provider = makeProvider();
    // No cache entry for 'c1'

    const children = await provider.getChildren(item('serverInfo', 'c1'));
    expect(children[0].label).toMatch(/Unable to fetch server information/);
  });

  it('omits version item when version is absent', async () => {
    const provider = makeProvider();
    (provider as any).clusterMetadataCache['c1'] = {
      hostname: 'weaviate.local',
      modules: {},
    };

    const children = await provider.getChildren(item('serverInfo', 'c1'));
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.startsWith('Version:'))).toBe(false);
  });
});

// ─── modules ─────────────────────────────────────────────────────────────────

describe("getChildren — 'modules'", () => {
  it('lists modules from metadata cache', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue({ /* any truthy client */ getMeta: jest.fn() });
    (provider as any).clusterMetadataCache['c1'] = {
      version: '1.20.0',
      modules: { 'text2vec-openai': {}, 'backup-s3': {} },
    };

    const children = await provider.getChildren(item('modules', 'c1'));
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.includes('text2vec-openai'))).toBe(true);
    expect(labels.some((l: string) => l.includes('backup-s3'))).toBe(true);
  });

  it('returns "No modules available" when modules list is empty', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue({ getMeta: jest.fn() });
    (provider as any).clusterMetadataCache['c1'] = { version: '1.20.0', modules: {} };

    const children = await provider.getChildren(item('modules', 'c1'));
    expect(children[0].label).toMatch(/No modules available/);
  });

  it('returns "Module information not available" when modules is undefined', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue({ getMeta: jest.fn() });
    (provider as any).clusterMetadataCache['c1'] = { version: '1.20.0' };

    const children = await provider.getChildren(item('modules', 'c1'));
    expect(children[0].label).toMatch(/Module information not available/);
  });

  it('returns "Client not available" when getClient returns null', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue(null);

    const children = await provider.getChildren(item('modules', 'c1'));
    expect(children[0].label).toMatch(/Client not available/);
  });
});

// ─── clusterNodes ─────────────────────────────────────────────────────────────

describe("getChildren — 'clusterNodes'", () => {
  it('lists nodes from clusterNodesCache', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue({ cluster: { nodes: jest.fn() } });
    (provider as any).clusterNodesCache['c1'] = [
      { name: 'node-1', status: 'HEALTHY', stats: { objectCount: 42, shardCount: 3 } },
      { name: 'node-2', status: 'UNHEALTHY', stats: { objectCount: 0, shardCount: 0 } },
    ];

    const children = await provider.getChildren(item('clusterNodes', 'c1'));
    expect(children).toHaveLength(2);
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.includes('node-1'))).toBe(true);
    expect(labels.some((l: string) => l.includes('🟩'))).toBe(true); // HEALTHY
    expect(labels.some((l: string) => l.includes('🟥'))).toBe(true); // UNHEALTHY
  });

  it('marks leader node with crown emoji', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue({});
    (provider as any).clusterNodesCache['c1'] = [
      { name: 'node-1', status: 'HEALTHY', stats: { objectCount: 10, shardCount: 2 } },
    ];
    (provider as any).clusterStatisticsCache['c1'] = {
      statistics: [{ leaderId: 'node-1' }],
    };

    const children = await provider.getChildren(item('clusterNodes', 'c1'));
    expect(children[0].label).toContain('👑');
  });

  it('returns "No cluster nodes available" when cache is empty', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue({});
    (provider as any).clusterNodesCache['c1'] = [];

    const children = await provider.getChildren(item('clusterNodes', 'c1'));
    expect(children[0].label).toMatch(/No cluster nodes available/);
  });

  it('returns "Client not available" when getClient returns null', async () => {
    const provider = makeProvider();
    mockGetClient.mockReturnValue(null);

    const children = await provider.getChildren(item('clusterNodes', 'c1'));
    expect(children[0].label).toMatch(/Client not available/);
  });
});

// ─── clusterNode (individual node expansion) ─────────────────────────────────

describe("getChildren — 'clusterNode'", () => {
  it('returns Statistics item and flattened node key items for a known node', async () => {
    const provider = makeProvider();
    (provider as any).clusterNodesCache['c1'] = [
      {
        name: 'node-1',
        status: 'HEALTHY',
        stats: { objectCount: 100, shardCount: 2 },
        shards: [],
      },
    ];

    const children = await provider.getChildren(item('clusterNode', 'c1', undefined, 'node-1'));
    const itemTypes = children.map((c: any) => c.itemType);
    // Statistics group item is always first
    expect(itemTypes).toContain('weaviateClusterNodeStatistics');
    // Flattened node fields render as 'object' items
    expect(itemTypes).toContain('object');
  });

  it('returns "No node details to show" when node not found in cache', async () => {
    const provider = makeProvider();
    (provider as any).clusterNodesCache['c1'] = [];

    const children = await provider.getChildren(item('clusterNode', 'c1', undefined, 'missing'));
    expect(children[0].label).toMatch(/No node details to show/);
  });
});

// ─── aliases ─────────────────────────────────────────────────────────────────

describe("getChildren — 'aliases'", () => {
  it('returns sorted alias items from cache', async () => {
    const provider = makeProvider();
    (provider as any).aliasesCache['c1'] = [
      { alias: 'zAlias', collection: 'ColZ' },
      { alias: 'aAlias', collection: 'ColA' },
    ];

    const children = await provider.getChildren(item('aliases', 'c1'));
    expect(children).toHaveLength(2);
    expect(children[0].label).toBe('aAlias');
    expect(children[1].label).toBe('zAlias');
  });

  it('returns "No aliases found" when cache is empty', async () => {
    const provider = makeProvider();
    (provider as any).aliasesCache['c1'] = [];

    const children = await provider.getChildren(item('aliases', 'c1'));
    expect(children[0].label).toMatch(/No aliases found/);
  });

  it('returns "No aliases found" when cache entry is missing', async () => {
    const provider = makeProvider();
    // No cache entry

    const children = await provider.getChildren(item('aliases', 'c1'));
    expect(children[0].label).toMatch(/No aliases found/);
  });

  it('adds tooltip and command to each alias item', async () => {
    const provider = makeProvider();
    (provider as any).aliasesCache['c1'] = [{ alias: 'myAlias', collection: 'Article' }];

    const children = await provider.getChildren(item('aliases', 'c1'));
    const aliasItem = children[0] as any;
    expect(aliasItem.tooltip).toContain('myAlias');
    expect(aliasItem.tooltip).toContain('Article');
    expect(aliasItem.command?.command).toBe('weaviate.editAlias');
  });
});

// ─── backupItem ───────────────────────────────────────────────────────────────

describe("getChildren — 'backupItem'", () => {
  const backupData = {
    id: 'bk-001',
    backend: 's3',
    status: 'SUCCESS',
    startedAt: '2025-01-01T10:00:00Z',
    completedAt: '2025-01-01T10:05:00Z',
    classes: ['Article', 'Author'],
  };

  it('returns detail items for a known backup', async () => {
    const provider = makeProvider();
    (provider as any).backupsCache['c1'] = [backupData];

    const children = await provider.getChildren(item('backupItem', 'c1', undefined, 'bk-001'));
    const labels = children.map((c: any) => c.label);
    expect(labels.some((l: string) => l.includes('s3'))).toBe(true); // Backend
    expect(labels.some((l: string) => l.includes('SUCCESS'))).toBe(true); // Status
  });

  it('returns "Backup details not available" when backup not found', async () => {
    const provider = makeProvider();
    (provider as any).backupsCache['c1'] = [];

    const children = await provider.getChildren(item('backupItem', 'c1', undefined, 'missing'));
    expect(children[0].label).toMatch(/Backup details not available/);
  });

  it('includes collections info item when classes array is present', async () => {
    const provider = makeProvider();
    (provider as any).backupsCache['c1'] = [backupData];

    const children = await provider.getChildren(item('backupItem', 'c1', undefined, 'bk-001'));
    const labels = children.map((c: any) => c.label);
    // Should have a collections count entry
    expect(
      labels.some(
        (l: string) => l.includes('Collection') || l.includes('class') || l.includes('Article')
      )
    ).toBe(true);
  });
});
