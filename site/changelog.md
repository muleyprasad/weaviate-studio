---
title: Weaviate Studio Changelog — Version History & Release Notes
description: Full version history and release notes for Weaviate Studio — new features, bug fixes, and improvements across every release of the VS Code extension.
---

# Changelog

All notable changes to the Weaviate Studio extension.

## [1.8.0] - 2026-07-01

### ✨ Added

- **Empty Shard Ratio check** — flags collections (single- and multi-tenant) where ≥10% of shards/tenants are empty (Warning) or ≥50% (Critical). Replicas are collapsed by shard name so a lagging replica is not mistaken for an empty shard. (PR #78)
- **Async Replication Disabled check** — lists replicated collections (replication factor > 1) that do not have async replication enabled; without it, replica drift is never automatically reconciled. (PR #78)
- **Replication ratio metrics** — the Replication Imbalance section now shows a per-collection and per-shard replication completeness percentage (e.g. `94% replicated`), computed per shard to avoid per-node-total masking. Imbalanced collections also show their async replication status. (PR #78)
- **Race-condition fix for large clusters** — on large clusters the verbose node fetch could complete after the collections fetch, causing health checks to run against empty node data. Node fetch now triggers a serialized check recompute so results always reflect complete shard data. (PR #78)

### 🐛 Fixed

- **`weaviate.cancelBackup` command not found** — the command was declared in `package.json` and wired into the in-progress backup context menu but never registered via `vscode.commands.registerCommand`. Right-clicking an in-progress backup and choosing Cancel Backup now works correctly. (PR #79)

## [1.7.1] - 2026-05-09

### Changed

- Updated `weaviate-add-collection` dependency to use the official Weaviate repository (`weaviate/weaviate-add-collection`)

## [1.7.0] - 2026-04-30

### ✨ Added — Multi-Vector Search (Muvera)

- **Multi-Target Vector Search UI** — Full support for Weaviate's named-vector / Muvera search in Data Explorer
  - Target Vector selector in Vector Options drawer
  - Auto-selection of all named vectors on first open
  - Join Strategy selector: Minimum, Sum, Average, Manual Weights, Relative Score
  - Weight Editor with per-vector sliders and Normalize button
  - Copy as Code includes `multiTargetVector` combination
  - Requires Weaviate v1.26+ (near) / v1.27+ (hybrid)

### ✨ Added — Backup Wildcard Support

- Wildcard (`*`) option for full-instance backups
- Improved backup creation UX

### ✨ Added — Cluster Panel Improvements

- 3 new collection health checks (Multi-Tenancy, Empty Shards, Replication Imbalance)
- Parallel health checks
- Multi-panel support
- Open Checks from collection group header

### 🐛 Fixed

- Server version detection fixed on weaviate-client v4
- Multi-target search payload now correctly includes selected vectors

### 🎨 Changed

- Max Distance default raised from 0.5 to 1.0 (no filter)
- Distance slider with range labels: 0 (exact) · 1.0 (no filter) · 2 (distant)

## [1.6.0] - 2026-03-21

### 🔭 Added — Telemetry System

- Azure Application Insights integration
- Lifecycle events (activate, deactivate, errors)
- Connection telemetry (type, transport, outcome)
- Feature activation events (all major panels)
- Operation completion events (queries, RAG, backups, collections)
- Dual consent requirement (VS Code + extension settings)

## [1.5.0] - 2026-03-14

### Added — Generative Search

- Chat-style RAG interface with multi-collection support
- Top-K and timeout controls
- Source attribution with context inspection
- Markdown toggle and copy buttons
- Right-click collection → Generative Search quick access

### Added — RBAC & Security

- Role, User, and Group management
- API key rotation
- User activation/deactivation
- Read-Only mode with connection-level guards

## [1.4.0] - 2026-02-18

### Added — Data Explorer

- Interactive table browser with sortable columns
- Visual filter builder with 10+ operators and AND/OR logic
- 4 vector search modes (Text, Object, Vector, Hybrid)
- Export to JSON/CSV with flexible scopes
- Virtual scrolling for large datasets
- Filter presets (save, load, delete)
- Keyboard shortcuts and preferences persistence

## [1.3.0] - 2025-12-26

### Added

- Cluster Information Panel
- Nested Object support with visual type icons
- Docker Compose test sandbox
- React-based Add Collection interface
- Enhanced GraphQL templates with schema-aware generation
- Support for 15+ embedding models

## [1.2.0] - 2025-10-21

### Added

- GraphQL Monaco Editor with schema-aware IntelliSense
- `.weaviate` connection files

## [1.1.0] - 2025-09-28

### Added

- New connection model (Cloud + Custom endpoints)
- Tree view enhancements (vector count, generative config, replication)
- Create Collection: From scratch, Copy, Import from JSON

### Changed

- Migrated to `weaviate-client@^3` with Collections API

## [1.0.0] - 2025-07-08

### Initial Release

- Connection management with multi-instance support
- GraphQL query editor with Monaco integration
- Data visualization (table + JSON views)
- Schema management and tree explorer
- 9 query templates
- Vector, semantic, hybrid, BM25 search
- Dark theme optimized UI

---

[Full Changelog on GitHub →](https://github.com/muleyprasad/weaviate-studio/blob/main/CHANGELOG.md)
