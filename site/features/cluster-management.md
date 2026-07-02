---
title: Weaviate Cluster Management — Health, Nodes & Shards Dashboard
description: Monitor self-hosted Weaviate cluster health, node status, shard distribution, and run diagnostic checks in real time — Cluster Management panel in Weaviate Studio for VS Code.
---

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

### Empty Shards Check (Single-Tenant Collections)

Flags shards with zero objects in **single-tenant collections** — may indicate misconfiguration or stale state. Multi-tenant collections are evaluated separately by the Empty Shard Ratio check below, since individual tenant shards start empty by design.

### Empty Shard Ratio Check

Flags collections — both single-tenant and multi-tenant — where too many shards or tenants are empty:

| Threshold   | Severity    |
| ----------- | ----------- |
| ≥ 10% empty | ⚠️ Warning  |
| ≥ 50% empty | ⛔ Critical |

Replicas are collapsed by shard name before counting: a shard is only considered empty when **every** replica reports zero objects, so a replica that is merely lagging replication is not mistaken for an empty shard.

### Async Replication Disabled Check

Lists replicated collections (replication factor > 1) that do **not** have async replication enabled. Without async replication, replicas that drift apart are never automatically reconciled — imbalances become permanent. Enable async replication to allow Weaviate to self-heal replica drift. See the [Weaviate async replication docs](https://docs.weaviate.io/deploy/configuration/async-rep) for details.

### Replication Imbalance Check

Identifies collections with uneven object counts across replica nodes. Each flagged collection and shard now shows a **replication ratio** badge (e.g. `94% replicated`) computed per shard:

- The most complete replica of each shard is taken as the shard's true object count
- A fully-replicated shard should hold that count × replica factor (e.g. 12 × 3 = 36)
- These are summed across the collection and compared to actual stored objects

Collections also show whether async replication is on or off, since disabled async replication means drift will not self-heal.

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
