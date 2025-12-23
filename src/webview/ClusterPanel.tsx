import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './Cluster.css';

// Setup VS Code API for message passing with the extension host
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

// Get VS Code API reference for messaging
let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
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
  return (
    <div className={`shard-item ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="shard-header">
        <h4>{shard.class}</h4>
        <span className="shard-name">{shard.name}</span>
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
  // Calculate unique collections
  const uniqueCollections = new Set(node.shards.map((shard) => shard.class));
  const uniqueCollectionCount = uniqueCollections.size;

  // Group shards by status (excluding READY)
  const nonReadyShards = node.shards.filter((shard) => shard.vectorIndexingStatus !== 'READY');
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
            <h4>Shards ({node.shards.length})</h4>
            <div className="shards-grid">
              {node.shards.map((shard) => (
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

function ClusterPanelWebview() {
  const [nodeStatusData, setNodeStatusData] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [selectedShardName, setSelectedShardName] = useState<string | null>(null);

  useEffect(() => {
    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'init':
        case 'updateData':
          setNodeStatusData(message.nodeStatusData || []);
          setIsLoading(false);

          // Auto-select first node if none selected
          if (message.nodeStatusData && message.nodeStatusData.length > 0 && !selectedNodeName) {
            setSelectedNodeName(message.nodeStatusData[0].name);
          }
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [selectedNodeName]);

  const handleRefresh = () => {
    setIsLoading(true);
    vscode.postMessage({
      command: 'refresh',
    });
  };

  const handleNodeSelect = (nodeName: string) => {
    setSelectedNodeName(nodeName === selectedNodeName ? null : nodeName);
    setSelectedShardName(null); // Reset shard selection when changing nodes
  };

  const handleShardSelect = (shardName: string) => {
    setSelectedShardName(shardName === selectedShardName ? null : shardName);
  };

  return (
    <div className="cluster-panel">
      <div className="cluster-header">
        <h1>Cluster Information</h1>
        <button onClick={handleRefresh} className="refresh-button" disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="cluster-content">
        {isLoading ? (
          <div className="loading">
            <p>Loading cluster data...</p>
          </div>
        ) : nodeStatusData && nodeStatusData.length > 0 ? (
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
          <div className="no-data">
            <p>No cluster data available</p>
          </div>
        )}
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
