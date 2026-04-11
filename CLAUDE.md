# CLAUDE.md — Weaviate Studio

## Project Overview

Weaviate Studio is a **VS Code extension** (v1.6.2) for managing Weaviate vector database instances. It provides connection management, schema browsing, data exploration, GraphQL querying, generative search (RAG), RBAC, backups, and cluster monitoring — all within VS Code.

**Publisher:** `prasadmuley` | **License:** MIT | **VS Code Engine:** `^1.80.0`

---

## Tech Stack & Key Dependencies

### Core

- **TypeScript** (strict mode, ES2022 target, Node16 modules)
- **VS Code Extension API** (`@types/vscode ^1.80.0`)
- **React 18** (webview UIs)
- **Webpack** (3 configs: extension, webview, add-collection)

### Runtime Dependencies

| Package                                    | Purpose                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `weaviate-client ^3.11.0`                  | Official Weaviate JS/TS client (REST + gRPC)     |
| `monaco-editor ^0.52.2`                    | Code editor for GraphQL queries                  |
| `monaco-graphql ^1.7.0`                    | GraphQL language support for Monaco              |
| `react-json-tree` / `react-json-view-lite` | JSON visualization in results                    |
| `markdown-to-jsx ^9.7.8`                   | Markdown rendering in RAG chat                   |
| `@tanstack/react-virtual ^3.13.18`         | Virtual scrolling for large datasets             |
| `@vscode/webview-ui-toolkit ^1.4.0`        | VS Code design system for webviews               |
| `@vscode/extension-telemetry ^1.5.1`       | Azure Application Insights telemetry             |
| `graphql-language-service-interface`       | GraphQL language features                        |
| `weaviate-add-collection`                  | External React component for collection creation |

### Dev Dependencies

- **Jest 30** + `ts-jest` + `@testing-library/react` (jsdom environment)
- **ESLint** + **Prettier** + **Husky** (lint-staged pre-commit)
- **Webpack 5** + `ts-loader` + `css-loader` + `mini-css-extract-plugin`
- **Concurrently** (parallel dev watchers)

---

## Architecture & Folder Structure

```
src/
├── extension.ts                    # Extension entry point — registers all commands
├── constants.ts                    # Integration header constant
├── constants/
│   └── backupConfig.ts             # Backup backend configuration
├── types/
│   └── index.ts                    # Shared types (WeaviateTreeItem, BackupItem, AliasItem, schemas)
├── services/
│   └── ConnectionManager.ts        # Singleton connection manager (credentials, clients, migration)
├── WeaviateTreeDataProvider/
│   └── WeaviateTreeDataProvider.ts  # Tree view data provider (sidebar explorer)
├── views/                          # Extension-side webview panels
│   ├── AddCollectionPanel.ts       # Collection creation panel
│   ├── AliasPanel.ts               # Alias management panel
│   ├── BackupPanel.ts              # Backup creation panel
│   ├── BackupRestorePanel.ts       # Backup restore panel
│   ├── ClusterPanel.ts             # Cluster info/monitoring panel
│   ├── RbacRolePanel.ts            # RBAC role management panel
│   ├── RbacUserPanel.ts            # RBAC user management panel
│   ├── RbacGroupPanel.ts           # RBAC group management panel
│   └── ViewRenderer.ts             # Shared HTML renderer utility
├── data-explorer/                  # Data Explorer feature module
│   ├── extension/
│   │   ├── DataExplorerPanel.ts    # Panel host (extension side)
│   │   └── DataExplorerAPI.ts      # Weaviate API bridge for data operations
│   ├── types/
│   │   ├── index.ts                # Filter, sort, pagination types
│   │   └── weaviate.ts             # Weaviate-specific data types
│   └── webview/
│       ├── DataExplorer.tsx         # Root React component
│       ├── components/
│       │   ├── DataBrowser/         # Table browser with sortable columns
│       │   ├── FilterBuilder/       # Visual filter builder (10+ operators, AND/OR)
│       │   ├── VectorSearch/        # 4 search modes (Text, Object, Vector, Hybrid)
│       │   ├── Export/              # JSON/CSV export
│       │   ├── ObjectDetail/        # Object detail viewer
│       │   ├── TenantSelector/      # Multi-tenant selection
│       │   └── common/              # Shared UI components
│       ├── hooks/                   # React hooks
│       │   ├── useDataFetch.ts      # Data fetching with pagination
│       │   ├── useVectorSearch.ts   # Vector search state management
│       │   ├── useKeyboardShortcuts.ts
│       │   ├── usePagination.ts
│       │   ├── usePreferences.ts    # Per-collection preference persistence
│       │   └── useDebounce.ts
│       ├── context/                 # React context providers
│       └── utils/                   # Webview utilities
├── query-editor/                   # GraphQL Query Editor feature module
│   ├── extension/
│   │   └── QueryEditorPanel.ts     # Panel host (extension side)
│   └── webview/
│       ├── GraphQLEditor.ts        # Monaco editor integration
│       ├── GraphQLSchemaProvider.ts # Schema-aware completions
│       └── graphqlTemplates.ts     # Schema-aware query templates
├── rag-chat/                       # Generative Search (RAG) feature module
│   ├── extension/
│   │   ├── RagChatPanel.ts         # Panel host (extension side)
│   │   ├── RagChatAPI.ts           # Weaviate generative API bridge
│   │   └── utils.ts                # RAG utilities
│   ├── types/
│   │   └── index.ts                # RAG message/response types
│   └── webview/
│       ├── RagChat.tsx             # Chat UI React component
│       └── RagChat.css
├── webview/                        # Shared webview components & pages
│   ├── index.tsx                   # Query editor webview entry
│   ├── ConnectionForm.tsx          # Connection add/edit form
│   ├── ClusterPanel.tsx            # Cluster info React UI
│   ├── Backup.tsx / BackupRestore.tsx
│   ├── Alias.tsx                   # Alias management UI
│   ├── RbacRole.tsx / RbacUser.tsx / RbacGroup.tsx
│   ├── AddCollection.tsx           # Collection creation UI wrapper
│   ├── MonacoGraphQLEditor.tsx     # Shared Monaco editor component
│   ├── ErrorBoundary.tsx           # React error boundary
│   ├── LoadingIndicator.tsx
│   ├── components/
│   │   ├── ResultsTable.tsx        # Query results table
│   │   ├── CloneCollection.tsx     # Clone collection UI
│   │   ├── FileUpload.tsx          # JSON schema import
│   │   └── SelectCreateMode.tsx    # Collection creation mode selector
│   ├── *.html                      # HTML templates for each webview
│   ├── *.css                       # Styles for each webview
│   └── vscodeApi.ts                # VS Code webview API wrapper
├── shared/
│   └── timeout.ts                  # Configurable timeout utility
├── telemetry/
│   ├── index.ts                    # Telemetry barrel export
│   ├── TelemetryService.ts         # Azure App Insights integration
│   ├── TelemetrySanitizer.ts       # PII/secret scrubbing
│   └── TelemetryTypes.ts           # Event names & types
├── test/
│   ├── setup.ts                    # Jest setup
│   └── mocks/                      # Mocks for vscode, weaviate-client, monaco-editor
└── __tests__/                      # Top-level integration tests
```

### Build System (3 Webpack Configs)

1. **`webpack.config.js`** — Extension host (Node.js target, `dist/extension.js`)
2. **`webpack.webview.config.js`** — Main webviews (query editor, connection form, cluster, backup, RBAC, aliases)
3. **`webpack.add-collection.config.js`** — Add Collection webview (separate bundle)

---

## Features (Built & Working)

### Connection Management ✅

- Add/edit/delete connections (cloud + custom endpoints)
- API key + OIDC password authentication
- Secure credential storage via VS Code `context.secrets`
- Connection migration system (versioned, `v3` current)
- Auto-connect on expand, connection health monitoring
- `.weaviate` file import (open file → auto-add connection)
- Connection links (custom URL bookmarks per connection)
- Read-only mode toggle (connection-level guard against mutations)

### Tree View Explorer ✅

- Hierarchical sidebar: connections → server info, backups, modules, aliases, RBAC, collections
- Per-collection nodes: properties (nested objects), vectors, inverted index, generative config, reranker config, statistics, sharding, replication, multi-tenancy, object TTL
- Cluster nodes with per-node shard details
- Context menus with inline icons

### Data Explorer ✅

- Interactive table browser with sortable columns, pagination, virtual scrolling
- Visual filter builder (10+ operators, AND/OR logic, `FilterChips` display)
- 4 vector search modes: Text, Object, Vector, Hybrid (with alpha slider)
- Object detail panel
- Multi-tenant support
- Export: JSON/CSV (current page, filtered, full collection)
- Keyboard shortcuts (Ctrl+F, Ctrl+K, Ctrl+E)
- Per-collection user preferences persistence

### GraphQL Query Editor ✅

- Monaco editor with GraphQL syntax highlighting
- Schema-aware query template generation (adapts to collection schema)
- Templates: Get, Vector Search, Semantic Search, Hybrid Search, Filter, Aggregation, Sort, Explore
- Auto-populated properties based on data types
- Support for 15+ embedding models with dimension detection
- Results displayed in table + JSON views

### Generative Search (RAG Chat) ✅

- Chat-style interface for retrieval-augmented generation
- Multi-collection support with pill badge selection
- Configurable top-k results per collection (3, 5, 10, 20)
- Adjustable query timeout (30s, 60s, 2min, 5min)
- Markdown rendering of LLM answers with copy + raw toggle
- Retrieved context section grouped by collection with metrics
- Click telescope icon to open context objects in Data Explorer
- Filter inheritance from Data Explorer
- Relies on server-side generative config (no extra API keys)

### RBAC Management ✅

- Role CRUD with granular permissions (collections, data, backups, tenants, roles, users, aliases)
- User CRUD with API key rotation, OIDC password support, activate/deactivate
- Group CRUD
- Permission builder UI with weaviate-client permissions factory

### Backup & Restore ✅

- Create backups with real-time progress tracking
- Multi-backend: filesystem, S3, GCS, Azure
- Restore, retry failed, cancel in-progress
- Include/exclude collections, custom paths, compression levels
- Auto-detection of available backup modules

### Cluster Management ✅

- Cluster information panel with node status (verbose)
- Shard status management (update shard status per collection)
- Auto-open on connect (configurable)
- Refresh controls

### Alias Management ✅

- Create, edit, delete collection aliases

### Schema Analysis ✅

- Detailed schema viewer (via `viewDetailedSchema` command)
- Properties, raw JSON, API equivalents, creation scripts

### Telemetry ✅

- Azure Application Insights integration
- Dual consent required (VS Code telemetry + extension setting)
- PII/secret sanitization (`TelemetrySanitizer`)
- Events: lifecycle, feature opened, feature completed
- Connection string injected at build time (CI/CD)
- Dashboard deployment scripts (`scripts/telemetry/`)

---

## Key API Interactions

All Weaviate interactions go through the **`weaviate-client` v3** SDK:

| Area        | API Surface                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connections | `weaviate.connectToLocal()`, `weaviate.connectToCustom()`, `weaviate.connectToWeaviateCloud()`                                                                                             |
| Collections | `client.collections.listAll()`, `client.collections.get()`, `client.collections.create()`, `client.collections.delete()`                                                                   |
| Data CRUD   | `collection.query.fetchObjects()`, `collection.query.nearText()`, `collection.query.nearObject()`, `collection.query.nearVector()`, `collection.query.hybrid()`, `collection.query.bm25()` |
| Generative  | `collection.generate.nearText()`                                                                                                                                                           |
| Schema      | `collection.config.get()`, `collection.config.updateShards()`                                                                                                                              |
| Cluster     | `client.cluster.nodes({ output: 'verbose' })`                                                                                                                                              |
| Backups     | `client.backup.create()`, `client.backup.restore()`, `client.backup.getStatus()`, `client.collections.listAll()` (for include/exclude)                                                     |
| RBAC        | `weaviate.permissions.collections()`, `.data()`, `.backup()`, `.tenants()`, `.roles()`, `.users()`, `.aliases()`                                                                           |
| GraphQL     | Raw GraphQL via `client.graphql.raw()` (query editor)                                                                                                                                      |
| Aliases     | `client.collections.createAlias()`, `client.collections.updateAlias()`, `client.collections.deleteAlias()`, `client.collections.listAliases()`                                             |
| Meta        | `client.getMeta()`                                                                                                                                                                         |

---

## Data Model / Schema

No local database — all data lives in connected Weaviate instances. Extension state stored in:

- **`context.globalState`** — Connection configs (keyed `weaviate-connections`), user preferences
- **`context.secrets`** — API keys and passwords (keyed `weaviate-connection-{id}-{apiKey|password}`)
- **In-memory** — Active `WeaviateClient` instances (Map), collection schemas, cached node status

### Key Internal Types

- `WeaviateConnection` — Full connection config (type, auth, endpoints, timeouts, readOnly, links)
- `WeaviateTreeItem` — Tree view node (30+ item types: connection, collection, property, backup, RBAC, etc.)
- `BackupItem` — Backup status/metadata
- `AliasItem` — Collection alias mapping
- `FilterCondition` / `FilterMatchMode` — Data Explorer filter state
- `CollectionWithSchema` — Collection + its schema + node status

---

## Commands (Registered in extension.ts)

~40+ commands registered including:

- Connection: `weaviate.addConnection`, `.connect`, `.disconnect`, `.editConnection`, `.deleteConnection`, `.toggleConnectionReadOnly`
- Collections: `weaviate.addCollection`, `.deleteCollection`, `.deleteAllCollections`, `.queryCollection`
- Features: `weaviate.openDataExplorer`, `.openQueryEditor`, `.openRagChat`, `.viewDetailedSchema`, `.viewClusterInfo`
- Backups: `weaviate.createBackup`, `.restoreBackup`, `.retryBackup`, `.cancelBackup`
- Aliases: `weaviate.manageAliases`, `.editAlias`, `.deleteAlias`
- RBAC: `weaviate.rbac.addRole`, `.editRole`, `.deleteRole`, `.addUser`, `.editUser`, `.deleteUser`, `.activateUser`, `.deactivateUser`, `.rotateUserApiKey`, `.addGroup`, `.editGroup`, `.deleteGroup`
- Refresh: `weaviate.refresh`, `.refreshCollections`, `.refreshNodes`, `.refreshMetadata`, `.refreshBackups`, `.refreshAliases`, `.refreshStatistics`, `.refreshConnection`
- Links: `weaviate.addConnectionLink`, `.editConnectionLink`, `.deleteConnectionLink`

---

## Development Workflow

```bash
npm install              # Install dependencies
npm run dev              # Watch mode (extension + webviews in parallel)
npm test                 # Run Jest tests
npm run test:coverage    # Tests with coverage
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run package          # Production build (extension)
npm run vscode:prepublish  # Full production build (extension + all webviews)
```

**Debug:** Press F5 in VS Code to launch Extension Development Host.

---

## Testing

- **Framework:** Jest 30 + ts-jest + jsdom environment + @testing-library/react
- **Mocks:** Custom mocks for `vscode`, `weaviate-client`, `monaco-editor` (in `src/test/mocks/`)
- **Test locations:**
  - `src/__tests__/` — Integration tests (RAG chat, RBAC, read-only guards, timeouts, file handler)
  - `src/*/extension/__tests__/` — Extension-side unit tests per feature
  - `src/*/webview/__tests__/` — Webview component tests
  - `src/webview/__tests__/` / `src/webview/components/__tests__/` — Shared component tests
  - `src/services/__tests__/` — ConnectionManager tests
  - `src/telemetry/__tests__/` — Telemetry tests

---

## Known Limitations & Tech Debt

1. **GraphQL auto-complete is WIP** — noted in README as "(wip)"
2. **No local database / offline cache** — extension is fully online; no local data persistence beyond connection configs
3. **`ConnectionManager` is a singleton** with mutex-based serialization for add operations; complex migration logic (v1→v2→v3)
4. **`extension.ts` is monolithic** (~1500+ lines) — all command registrations in one `activate()` function
5. **`any` types** in permission builder (`buildPermissionsFromFormState`) and some API bridge code
6. **External dependency** on `weaviate-add-collection` (git URL, not npm version) — tightly coupled to upstream component
7. **CSS is not modularized** — flat CSS files per webview, no CSS modules or styled-components
8. **No E2E tests** — only unit/integration tests with mocked VS Code and Weaviate APIs
9. **Telemetry connection string** must be injected at build time; local dev has no telemetry by default
10. **React 18** is used but could be upgraded to React 19 (dev types already at `^19.1.6`)
11. **No i18n** — all strings are hardcoded in English
12. **Backup listing** relies on backend-specific discovery; no unified backup history
