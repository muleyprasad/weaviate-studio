import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
          <h4>{shard.class}</h4>
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
  const nonReadyCount = nonReadyShards.length;
  const hasReadonly = statusGroups['READONLY'] > 0;

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
                .map(([status, count]) => `${count} ${status}`)
                .join(', ')}
            >
              ⚠️{' '}
              {Object.entries(statusGroups)
                .map(([status, count]) => `${count} ${status}`)
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
            <div className="shards-grid">
              {[...shards]
                .sort((a, b) => {
                  // First sort by collection name
                  const collectionCompare = a.class.localeCompare(b.class);
                  if (collectionCompare !== 0) {
                    return collectionCompare;
                  }
                  // Then sort by shard name
                  return a.name.localeCompare(b.name);
                })
                .map((shard) => (
                  <ShardComponent
                    key={shard.name}
                    shard={shard}
                    nodeName={node.name}
                    isSelected={selectedShardName === shard.name}
                    onSelect={() => onShardSelect(shard.name)}
                  />
                ))}
            </div>
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
                      .map(([status, count]) => `${count} ${status}`)
                      .join(', ')}
                  >
                    ⚠️{' '}
                    {Object.entries(statusGroups)
                      .map(([status, count]) => `${count} ${status}`)
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
                              <div className="shards-grid">
                                {nodeData.shards
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((shard) => (
                                    <ShardComponent
                                      key={shard.name}
                                      shard={shard}
                                      nodeName={nodeData.nodeName}
                                      isSelected={selectedShardName === shard.name}
                                      onSelect={() => onShardSelect(shard.name)}
                                    />
                                  ))}
                              </div>
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
  const [openClusterViewOnConnect, setOpenClusterViewOnConnect] = useState<boolean>(true);
  const [viewType, setViewType] = useState<'node' | 'collection'>('node');
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<'off' | '5s' | '10s' | '30s'>(
    'off'
  );
  const [showAutoRefreshMenu, setShowAutoRefreshMenu] = useState(false);
  const autoRefreshMenuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const prevNodeStatusDataRef = useRef<Node[]>([]);

  // Signal to the extension that the webview is ready to receive data.
  // This must run before the message listener is set up so the extension
  // can respond with the initial 'init' payload without a race condition.
  useEffect(() => {
    vscode.postMessage({ command: 'ready' });
  }, []);

  useEffect(() => {
    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'init':
        case 'updateData':
          // Only update if data has actually changed (using ref to avoid stale closure)
          const newData = message.nodeStatusData || [];
          const hasDataChanged =
            JSON.stringify(newData) !== JSON.stringify(prevNodeStatusDataRef.current);

          // Only update state if there are actual changes
          if (hasDataChanged || prevNodeStatusDataRef.current.length === 0) {
            prevNodeStatusDataRef.current = newData;
            setNodeStatusData(newData);

            // Update openClusterViewOnConnect state
            if (message.openClusterViewOnConnect !== undefined) {
              setOpenClusterViewOnConnect(message.openClusterViewOnConnect !== false);
            }

            // Auto-select defaults on initial load only, not on refresh
            if (message.nodeStatusData && message.nodeStatusData.length > 0 && !hasInitialized) {
              const data: Node[] = message.nodeStatusData;

              // Node view: expand the first node in the list
              setSelectedNodeName(data[0].name);

              // Collection view: expand the first collection (alphabetically) and its first node
              const allCollectionNames = new Set<string>();
              data.forEach((node) => {
                (node.shards || []).forEach((shard) => allCollectionNames.add(shard.class));
              });
              const sortedCollections = Array.from(allCollectionNames).sort((a, b) =>
                a.localeCompare(b)
              );
              if (sortedCollections.length > 0) {
                const firstCollection = sortedCollections[0];
                setSelectedCollectionName(firstCollection);
                // Find the first node (alphabetically) that has shards in this collection
                const nodesInFirstCollection = data
                  .filter((node) =>
                    (node.shards || []).some((shard) => shard.class === firstCollection)
                  )
                  .sort((a, b) => a.name.localeCompare(b.name));
                if (nodesInFirstCollection.length > 0) {
                  setSelectedNodeName(nodesInFirstCollection[0].name);
                }
              }

              setHasInitialized(true);
            }

            // Restore scroll position after data update
            if (contentRef.current && scrollPositionRef.current > 0) {
              setTimeout(() => {
                if (contentRef.current) {
                  contentRef.current.scrollTop = scrollPositionRef.current;
                }
              }, 0);
            }
          }

          // Always stop loading indicator
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [selectedNodeName, hasInitialized]);

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

  return (
    <div className="cluster-panel">
      <div className="cluster-header">
        <h1>Cluster Information</h1>
        <div className="header-controls">
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
        {useMemo(
          () =>
            nodeStatusData && nodeStatusData.length > 0 ? (
              viewType === 'node' ? (
                <div className="nodes-list">
                  {nodeStatusData.map((node) => (
                    <NodeComponent
                      key={node.name}
                      node={node}
                      isSelected={selectedNodeName === node.name}
                      onSelect={() => handleNodeSelect(node.name)}
                      selectedShardName={selectedShardName}
                      onShardSelect={handleShardSelect}
                    />
                  ))}
                </div>
              ) : (
                <CollectionView
                  nodeStatusData={nodeStatusData}
                  selectedNodeName={selectedNodeName}
                  selectedShardName={selectedShardName}
                  selectedCollectionName={selectedCollectionName}
                  onNodeSelect={handleNodeSelect}
                  onShardSelect={handleShardSelect}
                  onCollectionSelect={handleCollectionSelect}
                />
              )
            ) : (
              <div className="no-data">
                <p>No cluster data available</p>
              </div>
            ),
          [nodeStatusData, viewType, selectedNodeName, selectedShardName, selectedCollectionName]
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
