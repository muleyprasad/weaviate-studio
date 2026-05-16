# Cluster Management

The Cluster Information Panel provides comprehensive real-time monitoring of your Weaviate cluster — health, nodes, shards, and more.

## Auto-Open on Connect

By default, the Cluster Panel automatically opens when you connect to a Weaviate instance. This behavior is configurable — you can disable it in your VS Code settings.

## What's Monitored

### Server Information

- Weaviate version and build info
- Server uptime
- Module configuration (vectorizers, generative, reranker)

### Cluster Health

- Overall cluster status (healthy / degraded / down)
- Node count and status
- Shard distribution and status

### Nodes

- Individual node information
- Node status and health
- Resource utilization

### Shards

- Per-collection shard details
- Shard status: `READY`, `READONLY`, `INDEXING`
- Vector indexing progress
- Reindexing status

## Health Checks

The Cluster Panel runs **parallel health checks** for comprehensive analysis:

### Multi-Tenancy Schema Check

Detects collections that would benefit from enabling multi-tenancy. Surfaces actionable suggestions for collections that are good candidates.

### Empty Shards Check

Flags shards with zero objects — may indicate misconfiguration or stale state that needs attention.

### Replication Imbalance Check

Identifies uneven shard distribution across nodes that could affect availability and query latency.

## Access Points

| Entry Point      | How to Access                        |
| ---------------- | ------------------------------------ |
| Sidebar          | Click 📊 icon on server info item    |
| Command Palette  | `Weaviate: View Cluster Information` |
| Collection Group | Click "Open Checks" button           |

## Multi-Panel Support

Multiple Cluster Panel instances can be open simultaneously — useful for comparing two connections side-by-side.

## Search & Filter

For large clusters with many nodes and shards:

- **Search** across nodes and shards
- **Filter** by status (ready, indexing, readonly)
- Status badges for quick visual scanning
