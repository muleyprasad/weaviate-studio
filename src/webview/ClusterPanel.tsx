import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './Cluster.css';

// Get VS Code API reference for messaging
let vscode: ReturnType<typeof window.acquireVsCodeApi>;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  document.body.innerHTML = `<div style="padding: 20px; color: var(--vscode-errorForeground, #f44);">
    <h3>Failed to initialize Cluster Panel</h3>
    <p>Please reload the panel or restart VS Code.</p>
  </div>`;
  throw error;
}

// ── Module-level init handshake ──────────────────────────────────────────────
// We send 'ready' and capture the 'init' reply here, BEFORE React mounts.
// This avoids React StrictMode double-effect races where the message lands on
// a discarded effect instance and its state setters have no effect.

let __initPayload: {
  nodeStatusData: any;
  openClusterViewOnConnect?: boolean;
  checksResult?: any;
} | null = null;
let __onInitPayload: ((payload: typeof __initPayload) => void) | null = null;

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.command === 'init') {
    __initPayload = event.data;
    __onInitPayload?.(event.data); // notify React if already mounted
  }
});

// Send ready immediately — extension will queue the init reply.
vscode.postMessage({ command: 'ready' });

// Types
interface Shard {
  asyncReplicationStatus: any[];
  class: string;
  compressed: boolean;
  loaded: boolean;
  name: string;
  numberOfReplicas: number;
  objectCount: number;
  replicationFactor: number;
  vectorIndexingStatus: string;
  vectorQueueLength: number;
}

interface Node {
  batchStats: {
    ratePerSecond: number;
  };
  gitHash: string;
  name: string;
  shards: Shard[];
  stats: {
    objectCount: number;
    shardCount: number;
  };
  status: string;
  version: string;
}

// Checks types (mirrored from multiTenancyCheck.ts — kept local to avoid bundling src/utils)
interface MtCollectionEntry {
  name: string;
  objectCount: number;
}

interface MtCandidateGroup {
  collections: MtCollectionEntry[];
  count: number;
  totalObjects: number;
}

interface ChecksResult {
  timestamp: string;
  multiTenancy: {
    groups: MtCandidateGroup[];
    hasIssues: boolean;
  };
}

// ─── ChecksView ───────────────────────────────────────────────────────────────

interface ChecksViewProps {
  checksResult: ChecksResult | null;
  isRunning: boolean;
  onRunChecks: () => void;
}

function ChecksView({ checksResult, isRunning, onRunChecks }: ChecksViewProps) {
  const groups = checksResult?.multiTenancy.groups ?? [];
  const timestamp = checksResult?.timestamp
    ? new Date(checksResult.timestamp).toLocaleString()
    : null;

  return (
    <div className="checks-view">
      <div className="checks-header">
        <div className="checks-meta">
          {timestamp && <span className="checks-timestamp">Last run: {timestamp}</span>}
        </div>
        <button
          className="run-checks-button"
          onClick={onRunChecks}
          disabled={isRunning}
          title="Run all checks"
        >
          {isRunning ? 'Running…' : 'Run Checks'}
        </button>
      </div>

      {!checksResult && !isRunning && (
        <div className="checks-empty">
          <p>
            No checks have been run yet. Click <strong>Run Checks</strong> to analyse your
            collections.
          </p>
        </div>
      )}

      {checksResult && (
        <div className="checks-results">
          <div className="checks-section">
            <h3 className="checks-section-title">Multi-Tenancy Candidates</h3>
            {groups.length === 0 ? (
              <div className="checks-ok">
                <span className="checks-ok-icon">✓</span>
                No collections share identical schemas. No action needed.
              </div>
            ) : (
              <>
                <p className="checks-section-desc">
                  The following groups of collections share identical schemas and could be
                  consolidated into a single multi-tenant collection.{' '}
                  <a
                    href="https://docs.weaviate.io/weaviate/manage-collections/multi-tenancy"
                    className="checks-link"
                    onClick={(e) => {
                      e.preventDefault();
                      vscode.postMessage({
                        command: 'openExternal',
                        url: 'https://docs.weaviate.io/weaviate/manage-collections/multi-tenancy',
                      });
                    }}
                  >
                    Learn more ↗
                  </a>
                </p>
                {groups.map((group, idx) => (
                  <div key={idx} className="checks-group">
                    <div className="checks-group-header">
                      <span className="checks-group-label">Group {idx + 1}</span>
                      <span className="checks-group-count">{group.count} collections</span>
                      {group.totalObjects > 0 && (
                        <span className="checks-group-total">
                          {group.totalObjects.toLocaleString()} total objects
                        </span>
                      )}
                    </div>
                    <ul className="checks-group-list">
                      {group.collections.map((col) => (
                        <li key={col.name} className="checks-group-item">
                          <span className="checks-col-name">{col.name}</span>
                          <span className="checks-col-count">
                            {col.objectCount.toLocaleString()} objects
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Truncated name with click-to-copy
function TruncatedName({ name, tag: Tag = 'span' }: { name: string; tag?: 'span' | 'h3' | 'h4' }) {
  const [copied, setCopied] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Tag className="truncated-name" title={copied ? '✓ Copied!' : name} onClick={handleClick}>
      {name}
    </Tag>
  );
}

// Checks warning banner shown on Node and Collection views
interface ChecksWarningBannerProps {
  checksResult: ChecksResult | null;
  onOpenChecks: () => void;
  onDismiss: () => void;
}

function ChecksWarningBanner({ checksResult, onOpenChecks, onDismiss }: ChecksWarningBannerProps) {
  const hasIssues = checksResult?.multiTenancy?.hasIssues;

  return (
    <div className={`checks-warning-banner ${hasIssues ? 'has-issues' : 'info'}`}>
      <div className="checks-warning-body">
        <span className="checks-warning-icon">{hasIssues ? '⚠️' : 'ℹ️'}</span>
        <span className="checks-warning-text">
          Your cluster has potential issues on your collections schema.{' '}
          <button className="checks-warning-link" onClick={onOpenChecks}>
            View Checks →
          </button>
        </span>
      </div>
      <button className="checks-warning-dismiss" onClick={onDismiss} title="Dismiss">
        ✕
      </button>
    </div>
  );
}

// Shard Component
interface ShardComponentProps {
  shard: Shard;
  nodeName: string;
  isSelected: boolean;
  onSelect: () => void;
}

function ShardComponent({ shard, nodeName, isSelected, onSelect }: ShardComponentProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const statusOptions: Array<'READY' | 'READONLY'> = ['READY', 'READONLY'];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleStatusChange = (newStatus: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMenu(false);
    vscode.postMessage({
      command: 'updateShardStatus',
      collection: shard.class,
      shardNames: [shard.name],
      newStatus: newStatus,
    });
  };

  const toggleMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <div className={`shard-item ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="shard-header">
        <div className="shard-title-group">
          <TruncatedName name={shard.class} tag="h4" />
          <span className="shard-name">{shard.name}</span>
        </div>
        <div className="shard-menu-container" ref={menuRef}>
          <button className="shard-menu-button" onClick={toggleMenu} title="Change shard status">
            ⋮
          </button>
          {showMenu && (
            <div className="shard-menu-dropdown">
              <div className="menu-header">Change Status</div>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  className={`menu-item ${shard.vectorIndexingStatus === status ? 'current' : ''}`}
                  onClick={(e) => handleStatusChange(status, e)}
                  disabled={shard.vectorIndexingStatus === status}
                >
                  {status}
                  {shard.vectorIndexingStatus === status && ' ✓'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="shard-details">
        <div className="shard-stat">
          <span className="label">Objects:</span>
          <span className="value">{shard.objectCount}</span>
        </div>
        <div className="shard-stat">
          <span className="label">Status:</span>
          <span className={`value status-${shard.vectorIndexingStatus.toLowerCase()}`}>
            {shard.vectorIndexingStatus}
          </span>
        </div>
        <div className="shard-stat">
          <span className="label">Loaded:</span>
          <span className="value">{shard.loaded ? '✓' : '✗'}</span>
        </div>
        <div className="shard-stat">
          <span className="label">Compressed:</span>
          <span className="value">{shard.compressed ? '✓' : '✗'}</span>
        </div>
        <div className="shard-stat">
          <span className="label">Replicas:</span>
          <span className="value">{shard.numberOfReplicas}</span>
        </div>
        <div className="shard-stat">
          <span className="label">Vector Queue:</span>
          <span className="value">{shard.vectorQueueLength}</span>
        </div>
      </div>
      {isSelected && (
        <div className="shard-full-data">
          <h5>Full Shard Data:</h5>
          <pre>{JSON.stringify(shard, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Paginated shard grid — renders a page of ShardComponents with prev/next controls.
const SHARDS_PAGE_SIZE = 50;

interface PaginatedShardGridProps {
  shards: Shard[];
  nodeName: string;
  selectedShardName: string | null;
  onShardSelect: (shardName: string) => void;
}

function PaginatedShardGrid({
  shards,
  nodeName,
  selectedShardName,
  onShardSelect,
}: PaginatedShardGridProps) {
  const [page, setPage] = useState(0);

  // Reset to first page whenever the shard list changes (node switch, filter, etc.)
  const shardsKey = shards.map((s) => s.name).join(',');
  useEffect(() => {
    setPage(0);
  }, [shardsKey]);

  const pageCount = Math.ceil(shards.length / SHARDS_PAGE_SIZE);
  const pageShards = shards.slice(page * SHARDS_PAGE_SIZE, (page + 1) * SHARDS_PAGE_SIZE);
  const start = page * SHARDS_PAGE_SIZE + 1;
  const end = Math.min((page + 1) * SHARDS_PAGE_SIZE, shards.length);

  return (
    <>
      {pageCount > 1 && (
        <div className="shards-pagination">
          <button
            className="shards-page-btn"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Prev
          </button>
          <span className="shards-page-info">
            {start}–{end} of {shards.length}
          </span>
          <button
            className="shards-page-btn"
            disabled={page === pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </button>
        </div>
      )}
      <div className="shards-grid">
        {pageShards.map((shard) => (
          <ShardComponent
            key={shard.name}
            shard={shard}
            nodeName={nodeName}
            isSelected={selectedShardName === shard.name}
            onSelect={() => onShardSelect(shard.name)}
          />
        ))}
      </div>
    </>
  );
}

// Node Component
interface NodeComponentProps {
  node: Node;
  isSelected: boolean;
  onSelect: () => void;
  selectedShardName: string | null;
  onShardSelect: (shardName: string) => void;
}

function NodeComponent({
  node,
  isSelected,
  onSelect,
  selectedShardName,
  onShardSelect,
}: NodeComponentProps) {
  // Ensure shards is always an array
  const shards = node.shards || [];

  // Calculate unique collections
  const uniqueCollections = new Set(shards.map((shard) => shard.class));
  const uniqueCollectionCount = uniqueCollections.size;

  // Group shards by status (excluding READY)
  const nonReadyShards = shards.filter((shard) => shard.vectorIndexingStatus !== 'READY');
  const statusGroups = nonReadyShards.reduce(
    (acc, shard) => {
      const status = shard.vectorIndexingStatus;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const queueGroups = nonReadyShards.reduce(
    (acc, shard) => {
      const status = shard.vectorIndexingStatus;
      acc[status] = (acc[status] || 0) + (shard.vectorQueueLength || 0);
      return acc;
    },
    {} as Record<string, number>
  );
  const nonReadyCount = nonReadyShards.length;
  const hasReadonly = statusGroups['READONLY'] > 0;

  const formatStatusBadge = (status: string, count: number) => {
    const queueLen = queueGroups[status] || 0;
    return queueLen > 0 ? `${count} ${status} (${queueLen} in queue)` : `${count} ${status}`;
  };

  const handleSetAllReadyToReady = () => {
    const readonlyShards = shards.filter((shard) => shard.vectorIndexingStatus === 'READONLY');

    // Group shards by collection
    const shardsByCollection = readonlyShards.reduce(
      (acc, shard) => {
        if (!acc[shard.class]) {
          acc[shard.class] = [];
        }
        acc[shard.class].push(shard.name);
        return acc;
      },
      {} as Record<string, string[]>
    );

    // Send one message per collection with all shard names
    Object.entries(shardsByCollection).forEach(([collection, shardNames]) => {
      vscode.postMessage({
        command: 'updateShardStatus',
        collection: collection,
        shardNames: shardNames,
        newStatus: 'READY',
      });
    });
  };

  return (
    <div className={`node-container ${isSelected ? 'selected' : ''}`}>
      <div className="node-header" onClick={onSelect}>
        <div className="node-title">
          <h3>{node.name}</h3>
          <span className={`node-status status-${node.status.toLowerCase()}`}>{node.status}</span>
          {nonReadyCount > 0 && (
            <span
              className={hasReadonly ? 'readonly-badge' : 'non-ready-badge'}
              title={Object.entries(statusGroups)
                .map(([status, count]) => formatStatusBadge(status, count))
                .join(', ')}
            >
              ⚠️{' '}
              {Object.entries(statusGroups)
                .map(([status, count]) => formatStatusBadge(status, count))
                .join(', ')}
            </span>
          )}
        </div>
        <div className="node-info">
          <span>Version: {node.version}</span>
          <span>Git: {node.gitHash}</span>
          <span>Collections: {uniqueCollectionCount}</span>
          <span>Objects: {node.stats.objectCount}</span>
          <span>Shards: {node.stats.shardCount}</span>
        </div>
      </div>

      {isSelected && (
        <>
          {hasReadonly && (
            <div className="readonly-alert">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <div className="alert-title">READONLY Shards Detected</div>
                <div className="alert-message">
                  This may indicate memory or disk pressure. Check system resources and consider
                  scaling.
                </div>
              </div>
              <button className="alert-button" onClick={handleSetAllReadyToReady}>
                Set All to READY
              </button>
            </div>
          )}
          <div className="node-stats">
            <div className="stat-card">
              <div className="stat-label">Batch Rate</div>
              <div className="stat-value">{node.batchStats.ratePerSecond}/s</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unique Collections</div>
              <div className="stat-value">{uniqueCollectionCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Objects</div>
              <div className="stat-value">{node.stats.objectCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Shards</div>
              <div className="stat-value">{node.stats.shardCount}</div>
            </div>
            {Object.entries(statusGroups).map(([status, count]) => (
              <div
                key={status}
                className={`stat-card ${status === 'READONLY' ? 'readonly' : 'warning'}`}
              >
                <div className="stat-label">{status} Shards</div>
                <div className="stat-value">{count}</div>
              </div>
            ))}
          </div>

          <div className="shards-container">
            <h4>Shards ({shards.length})</h4>
            <PaginatedShardGrid
              shards={[...shards].sort((a, b) => {
                const c = a.class.localeCompare(b.class);
                return c !== 0 ? c : a.name.localeCompare(b.name);
              })}
              nodeName={node.name}
              selectedShardName={selectedShardName}
              onShardSelect={onShardSelect}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Collection View Component
interface CollectionViewProps {
  nodeStatusData: Node[];
  selectedNodeName: string | null;
  selectedShardName: string | null;
  selectedCollectionName: string | null;
  onNodeSelect: (nodeName: string) => void;
  onShardSelect: (shardName: string) => void;
  onCollectionSelect: (collectionName: string) => void;
}

interface CollectionData {
  name: string;
  totalObjects: number;
  nodes: {
    nodeName: string;
    nodeStatus: string;
    shards: Shard[];
  }[];
}

function CollectionView({
  nodeStatusData,
  selectedNodeName,
  selectedShardName,
  selectedCollectionName,
  onNodeSelect,
  onShardSelect,
  onCollectionSelect,
}: CollectionViewProps) {
  // Memoize collection grouping to avoid recomputation on every render
  const collections = useMemo(() => {
    const collectionMap = new Map<string, CollectionData>();

    nodeStatusData.forEach((node) => {
      node.shards.forEach((shard) => {
        if (!collectionMap.has(shard.class)) {
          collectionMap.set(shard.class, {
            name: shard.class,
            totalObjects: 0,
            nodes: [],
          });
        }

        const collection = collectionMap.get(shard.class)!;
        collection.totalObjects += shard.objectCount;

        let nodeData = collection.nodes.find((n) => n.nodeName === node.name);
        if (!nodeData) {
          nodeData = {
            nodeName: node.name,
            nodeStatus: node.status,
            shards: [],
          };
          collection.nodes.push(nodeData);
        }

        nodeData.shards.push(shard);
      });
    });

    return Array.from(collectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [nodeStatusData]);

  const handleCollectionSelect = (collectionName: string) => {
    onCollectionSelect(collectionName === selectedCollectionName ? '' : collectionName);
    onNodeSelect(''); // Reset node selection
  };

  const handleNodeSelectInCollection = (nodeName: string) => {
    onNodeSelect(nodeName === selectedNodeName ? '' : nodeName);
    onShardSelect(''); // Reset shard selection
  };

  return (
    <div className="collections-list">
      {collections.map((collection) => {
        const isCollectionSelected = selectedCollectionName === collection.name;

        // Check for READONLY shards in this collection
        const readonlyShards = collection.nodes.flatMap((node) =>
          node.shards.filter((shard) => shard.vectorIndexingStatus === 'READONLY')
        );
        const hasReadonly = readonlyShards.length > 0;

        // Get all shards for status check
        const allShards = collection.nodes.flatMap((node) => node.shards);
        const allReady = allShards.every((shard) => shard.vectorIndexingStatus === 'READY');

        // Group shards by status (excluding READY)
        const nonReadyShards = allShards.filter((shard) => shard.vectorIndexingStatus !== 'READY');
        const statusGroups = nonReadyShards.reduce(
          (acc, shard) => {
            const status = shard.vectorIndexingStatus;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        const queueGroups = nonReadyShards.reduce(
          (acc, shard) => {
            const status = shard.vectorIndexingStatus;
            acc[status] = (acc[status] || 0) + (shard.vectorQueueLength || 0);
            return acc;
          },
          {} as Record<string, number>
        );
        const formatStatusBadge = (status: string, count: number) => {
          const queueLen = queueGroups[status] || 0;
          return queueLen > 0 ? `${count} ${status} (${queueLen} in queue)` : `${count} ${status}`;
        };
        const nonReadyCount = nonReadyShards.length;

        const handleSetAllReadyToReady = () => {
          const shardNames = readonlyShards.map((shard) => shard.name);
          vscode.postMessage({
            command: 'updateShardStatus',
            collection: collection.name,
            shardNames: shardNames,
            newStatus: 'READY',
          });
        };

        return (
          <div
            key={collection.name}
            className={`collection-container ${isCollectionSelected ? 'selected' : ''}`}
          >
            <div
              className="collection-header"
              onClick={() => handleCollectionSelect(collection.name)}
            >
              <div className="collection-title">
                <h3>{collection.name}</h3>
                {allReady ? (
                  <span className="node-status status-healthy">READY</span>
                ) : nonReadyCount > 0 ? (
                  <span
                    className={hasReadonly ? 'readonly-badge' : 'non-ready-badge'}
                    title={Object.entries(statusGroups)
                      .map(([status, count]) => formatStatusBadge(status, count))
                      .join(', ')}
                  >
                    ⚠️{' '}
                    {Object.entries(statusGroups)
                      .map(([status, count]) => formatStatusBadge(status, count))
                      .join(', ')}
                  </span>
                ) : null}
              </div>
              <div className="collection-info">
                <span>Total Objects: {collection.totalObjects}</span>
                <span>Nodes: {collection.nodes.length}</span>
                <span>
                  Shards: {collection.nodes.reduce((sum, node) => sum + node.shards.length, 0)}
                </span>
              </div>
            </div>

            {isCollectionSelected && (
              <>
                {hasReadonly && (
                  <div className="readonly-alert">
                    <div className="alert-icon">⚠️</div>
                    <div className="alert-content">
                      <div className="alert-title">READONLY Shards Detected</div>
                      <div className="alert-message">
                        This may indicate memory or disk pressure. Check system resources and
                        consider scaling.
                      </div>
                    </div>
                    <button className="alert-button" onClick={handleSetAllReadyToReady}>
                      Set All to READY
                    </button>
                  </div>
                )}
                <div className="collection-nodes">
                  {collection.nodes
                    .sort((a, b) => a.nodeName.localeCompare(b.nodeName))
                    .map((nodeData) => {
                      const isNodeSelected = selectedNodeName === nodeData.nodeName;
                      const nodeReadonlyShards = nodeData.shards.filter(
                        (shard) => shard.vectorIndexingStatus === 'READONLY'
                      );
                      const nodeHasReadonly = nodeReadonlyShards.length > 0;

                      return (
                        <div
                          key={nodeData.nodeName}
                          className={`collection-node ${isNodeSelected ? 'selected' : ''}`}
                        >
                          <div
                            className="collection-node-header"
                            onClick={() => handleNodeSelectInCollection(nodeData.nodeName)}
                          >
                            <div className="node-title">
                              <h4>{nodeData.nodeName}</h4>
                              <span
                                className={`node-status status-${nodeData.nodeStatus.toLowerCase()}`}
                              >
                                {nodeData.nodeStatus}
                              </span>
                              {nodeHasReadonly && (
                                <span
                                  className="readonly-badge"
                                  title={`${nodeReadonlyShards.length} READONLY shards`}
                                >
                                  ⚠️ {nodeReadonlyShards.length} READONLY
                                </span>
                              )}
                            </div>
                            <div className="node-info">
                              <span>
                                Objects:{' '}
                                {nodeData.shards.reduce((sum, shard) => sum + shard.objectCount, 0)}
                              </span>
                              <span>Shards: {nodeData.shards.length}</span>
                            </div>
                          </div>

                          {isNodeSelected && (
                            <div className="shards-container">
                              <PaginatedShardGrid
                                shards={[...nodeData.shards].sort((a, b) =>
                                  a.name.localeCompare(b.name)
                                )}
                                nodeName={nodeData.nodeName}
                                selectedShardName={selectedShardName}
                                onShardSelect={onShardSelect}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClusterPanelWebview() {
  const [nodeStatusData, setNodeStatusData] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [selectedShardName, setSelectedShardName] = useState<string | null>(null);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openClusterViewOnConnect, setOpenClusterViewOnConnect] = useState<boolean>(true);
  const [viewType, setViewType] = useState<'node' | 'collection' | 'checks'>('node');
  const [checksResult, setChecksResult] = useState<ChecksResult | null>(null);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [checksWarningDismissed, setChecksWarningDismissed] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<'off' | '5s' | '10s' | '30s'>(
    'off'
  );
  const [showAutoRefreshMenu, setShowAutoRefreshMenu] = useState(false);
  const autoRefreshMenuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const prevNodeStatusDataRef = useRef<Node[]>([]);

  const applyInitOrUpdate = useCallback((message: any) => {
    if (message.nodeStatusData == null) {
      // null means the extension has no cached data yet and is fetching in the background.
      // Keep isLoading=true so the spinner stays visible until updateData arrives.
      if (message.openClusterViewOnConnect !== undefined) {
        setOpenClusterViewOnConnect(message.openClusterViewOnConnect !== false);
      }
      return;
    }

    const newData: Node[] = message.nodeStatusData || [];
    prevNodeStatusDataRef.current = newData;

    // Use startTransition so React yields to the browser between renders,
    // preventing the UI thread from freezing on large datasets.
    startTransition(() => {
      setNodeStatusData(newData);
      setIsLoading(false);

      if (message.openClusterViewOnConnect !== undefined) {
        setOpenClusterViewOnConnect(message.openClusterViewOnConnect !== false);
      }
      if (message.checksResult) {
        setChecksResult(message.checksResult);
      }
    });
  }, []);

  useEffect(() => {
    // If the module-level listener already captured the init payload, apply it now.
    if (__initPayload) {
      applyInitOrUpdate(__initPayload);
    }

    // Register callback for init arriving after this effect runs.
    __onInitPayload = (payload) => applyInitOrUpdate(payload);

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'updateData': {
          const newData: Node[] = message.nodeStatusData || [];
          prevNodeStatusDataRef.current = newData;
          const scrollPos = scrollPositionRef.current;
          startTransition(() => {
            setNodeStatusData(newData);
            setIsLoading(false);
            if (message.openClusterViewOnConnect !== undefined) {
              setOpenClusterViewOnConnect(message.openClusterViewOnConnect !== false);
            }
          });
          if (contentRef.current && scrollPos > 0) {
            setTimeout(() => {
              if (contentRef.current) {
                contentRef.current.scrollTop = scrollPos;
              }
            }, 0);
          }
          break;
        }
        case 'checksResult':
          setChecksResult(message.result ?? null);
          setIsRunningChecks(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => {
      __onInitPayload = null;
      window.removeEventListener('message', messageHandler);
    };
  }, [applyInitOrUpdate]);

  const filteredNodeStatusData = useMemo(() => {
    if (!searchQuery.trim()) {
      return nodeStatusData;
    }
    const q = searchQuery.toLowerCase();
    return nodeStatusData
      .map((node) => ({
        ...node,
        shards: (node.shards || []).filter(
          (shard) =>
            shard.class.toLowerCase().includes(q) ||
            shard.name.toLowerCase().includes(q) ||
            shard.vectorIndexingStatus.toLowerCase().includes(q)
        ),
      }))
      .filter((node) => node.shards.length > 0);
  }, [nodeStatusData, searchQuery]);

  const handleRefresh = useCallback(() => {
    // Save current scroll position
    if (contentRef.current) {
      scrollPositionRef.current = contentRef.current.scrollTop;
    }
    setIsLoading(true);
    vscode.postMessage({
      command: 'refresh',
    });
  }, []);

  const handleNodeSelect = useCallback((nodeName: string) => {
    setSelectedNodeName((prev) => (prev === nodeName ? null : nodeName));
    setSelectedShardName(null);
  }, []);

  const handleShardSelect = useCallback((shardName: string) => {
    setSelectedShardName((prev) => (prev === shardName ? null : shardName));
  }, []);

  const handleCollectionSelect = useCallback((collectionName: string) => {
    setSelectedCollectionName((prev) => (prev === collectionName ? null : collectionName));
    setSelectedNodeName(null);
    setSelectedShardName(null);
  }, []);

  const handleToggleAutoOpen = useCallback(() => {
    setOpenClusterViewOnConnect((prev) => {
      const newValue = !prev;
      vscode.postMessage({
        command: 'toggleAutoOpen',
        value: newValue,
      });
      return newValue;
    });
  }, []);

  const handleRunChecks = useCallback(() => {
    setIsRunningChecks(true);
    vscode.postMessage({ command: 'runChecks' });
  }, []);

  const handleAutoRefreshChange = useCallback((interval: 'off' | '5s' | '10s' | '30s') => {
    setAutoRefreshInterval(interval);
    setShowAutoRefreshMenu(false);
  }, []);

  const toggleAutoRefreshMenu = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowAutoRefreshMenu((prev) => !prev);
  }, []);

  const getAutoRefreshLabel = () => {
    if (autoRefreshInterval === 'off') {
      return 'Off';
    }
    return autoRefreshInterval.toUpperCase();
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshInterval === 'off') {
      return;
    }

    const intervalMs = {
      '5s': 5000,
      '10s': 10000,
      '30s': 30000,
    }[autoRefreshInterval];

    const intervalId = setInterval(() => {
      handleRefresh();
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoRefreshInterval, handleRefresh]);

  // Close auto-refresh menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autoRefreshMenuRef.current &&
        !autoRefreshMenuRef.current.contains(event.target as HTMLElement)
      ) {
        setShowAutoRefreshMenu(false);
      }
    };

    if (showAutoRefreshMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutoRefreshMenu]);

  // Must be called unconditionally — cannot be inside a ternary (Rules of Hooks)
  const nodeOrCollectionContent = useMemo(
    () =>
      nodeStatusData && nodeStatusData.length > 0 ? (
        viewType === 'node' ? (
          <div className="nodes-list">
            {filteredNodeStatusData.length > 0 ? (
              filteredNodeStatusData.map((node) => (
                <NodeComponent
                  key={node.name}
                  node={node}
                  isSelected={selectedNodeName === node.name}
                  onSelect={() => handleNodeSelect(node.name)}
                  selectedShardName={selectedShardName}
                  onShardSelect={handleShardSelect}
                />
              ))
            ) : (
              <div className="no-data">
                <p>No results match your search</p>
              </div>
            )}
          </div>
        ) : (
          <CollectionView
            nodeStatusData={filteredNodeStatusData}
            selectedNodeName={selectedNodeName}
            selectedShardName={selectedShardName}
            selectedCollectionName={selectedCollectionName}
            onNodeSelect={handleNodeSelect}
            onShardSelect={handleShardSelect}
            onCollectionSelect={handleCollectionSelect}
          />
        )
      ) : isLoading ? (
        <div className="no-data">
          <p>Loading cluster data…</p>
        </div>
      ) : (
        <div className="no-data">
          <p>No cluster data available</p>
        </div>
      ),
    [
      nodeStatusData,
      filteredNodeStatusData,
      viewType,
      selectedNodeName,
      selectedShardName,
      selectedCollectionName,
    ]
  );

  return (
    <div className="cluster-panel">
      <div className="cluster-header">
        <h1>Cluster Information</h1>
        <div className="header-controls">
          <div className="search-input-wrapper">
            <span className="search-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
              </svg>
            </span>
            <input
              className="search-input"
              type="text"
              placeholder="Filter by collection, shard, status…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear-button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <span className="view-toggle-label">View:</span>
          <div className="view-toggle">
            <button
              className={`view-toggle-button ${viewType === 'node' ? 'active' : ''}`}
              onClick={() => setViewType('node')}
            >
              Node
            </button>
            <button
              className={`view-toggle-button ${viewType === 'collection' ? 'active' : ''}`}
              onClick={() => setViewType('collection')}
            >
              Collection
            </button>
            <button
              className={`view-toggle-button ${viewType === 'checks' ? 'active' : ''}`}
              onClick={() => setViewType('checks')}
            >
              Checks
              {checksResult?.multiTenancy?.groups?.length
                ? ` (${checksResult.multiTenancy.groups.length})`
                : ''}
            </button>
          </div>
          <div className="refresh-button-group">
            <button
              onClick={handleRefresh}
              className="refresh-button"
              disabled={isLoading}
              title="Refresh cluster data"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c-.335.415-.927 1.341-1.124 2.876l-.021.165.033.163.071.345c0 1.654-1.346 3-3 3-.795 0-1.545-.311-2.107-.868-.563-.567-.873-1.317-.873-2.111 0-1.431 1.007-2.632 2.351-2.929v2.498l2.528-2.134-2.528-2.076v2.11C4.753 6.867 3 8.819 3 11.131c0 1.14.445 2.21 1.253 3.014.808.803 1.883 1.246 3.027 1.246 2.31 0 4.216-1.751 4.455-4.027.098-.858.451-1.935.832-2.489.167-.237.351-.469.555-.678l.131-.117zm-2.359.81c-.172-.268-.33-.518-.475-.748-1.303-2.066-2.916-2.758-4.093-2.758-1.087 0-2.1.563-2.7 1.5-.302.473-.5 1.013-.6 1.596l1.013.014c.087-.484.245-.95.465-1.371.437-.838 1.176-1.34 1.987-1.34.852 0 1.839.428 2.659 1.147.411.363.771.77 1.073 1.211.136.202.261.408.376.616.092-.085.184-.168.278-.25l.017-.017z" />
              </svg>
            </button>
            <div className="refresh-dropdown-container" ref={autoRefreshMenuRef}>
              <button
                className="refresh-dropdown-button"
                onClick={toggleAutoRefreshMenu}
                title="Select auto-refresh interval"
              >
                {getAutoRefreshLabel()}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M4 6l4 4 4-4z" />
                </svg>
              </button>
              {showAutoRefreshMenu && (
                <div className="auto-refresh-menu">
                  <div className="menu-header">Auto-refresh</div>
                  {(['off', '5s', '10s', '30s'] as const).map((interval) => (
                    <button
                      key={interval}
                      className={`menu-item ${autoRefreshInterval === interval ? 'current' : ''}`}
                      onClick={() => handleAutoRefreshChange(interval)}
                    >
                      {interval === 'off' ? 'Off' : interval.toUpperCase()}
                      {autoRefreshInterval === interval && ' ✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="cluster-content" ref={contentRef}>
        {viewType !== 'checks' && !checksWarningDismissed && (
          <ChecksWarningBanner
            checksResult={checksResult}
            onOpenChecks={() => setViewType('checks')}
            onDismiss={() => setChecksWarningDismissed(true)}
          />
        )}
        {viewType === 'checks' ? (
          <ChecksView
            checksResult={checksResult}
            isRunning={isRunningChecks}
            onRunChecks={handleRunChecks}
          />
        ) : (
          nodeOrCollectionContent
        )}
      </div>

      <div className="cluster-footer">
        <button onClick={handleToggleAutoOpen} className="toggle-auto-open-button">
          {openClusterViewOnConnect ? '✓' : '✗'} Auto-open cluster view on connect
        </button>
      </div>
    </div>
  );
}

// Mount the React component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ClusterPanelWebview />
    </React.StrictMode>
  );
}
