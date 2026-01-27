# <img src="resources/weaviate-studio-color.png" alt="Weaviate Studio Logo" width="48" height="48" style="vertical-align:middle;"> Weaviate Studio

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio)
[![Open VSX Registry](https://img.shields.io/badge/Open%20VSX-Registry-purple?style=flat-square&logo=eclipse-ide)](https://open-vsx.org/extension/prasadmuley/weaviate-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)

---

**A powerful VS Code extension for managing Weaviate vector databases with an intuitive GraphQL
interface. Supports self-hosted and cloud Weaviate instances.**

![Extension Demo](docs/images/extension-demo.gif)

---

## Key Benefits

- **Unified Experience:** Manage, query, and monitor Weaviate directly in VS Code—no browser switching.
- **Works Everywhere:** Connect to local, on-prem, or cloud Weaviate instances.
- **Visual Data Exploration:** Browse schema, run queries, and view results in rich tables and JSON.
- **Intelligent GraphQL Editor:** Auto-complete (wip), schema-aware templates, and error highlighting.
- **Secure & Productive:** Secure credential storage, hot reload, and type-safe development.

---

## Quick Install

| **VS Code**                                                                                    | **Cursor**                                                             | **Windsurf**                                                           | **Manual Install**                                                       |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio) | [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio) | [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio) | [Download VSIX](https://github.com/muleyprasad/weaviate-studio/releases) |

---

## Top Features

- **Multiple Connections:** Manage several Weaviate instances at once
- **Backup & Restore:** Create, monitor, and restore backups across multiple backends (filesystem, S3, GCS, Azure)
- **Cluster Management:** Comprehensive cluster information panel with health monitoring
- **Schema Explorer:** Visualize and browse collections, properties, and nested object structures
- **Advanced Query Editor:** Monaco-powered GraphQL editor with intelligent, schema-aware templates
- **Live Results:** Table and JSON views for query results
- **Secure Storage:** Credentials stored with VS Code's secret storage
- **Modern UI:** Responsive, dark-theme optimized interface

---

## Getting Started

### New to Weaviate? 🚀

**Try our quick local sandbox with Docker!** Perfect for learning and development:

```bash
cd sandbox
docker-compose up -d
python3 populate.py
```

This spins up a fully-configured Weaviate instance with sample jeopardy questions, vector embeddings, and backup support enabled. [Learn more →](sandbox/readme.md)

### Connecting to Weaviate

1. **Install** Weaviate Studio from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio) or [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio).
2. **Open the Weaviate Studio panel** from the VS Code sidebar.
3. **Add a connection** to your Weaviate instance (local, on-prem, or cloud).
4. **Explore your schema, run queries, and manage your data—all within VS Code!**

---

<details>
<summary><strong>Full Feature List</strong></summary>

### Connection Management

- Connect to multiple Weaviate instances simultaneously
- Secure credential storage with VS Code's built-in secret storage
- Connection health monitoring and automatic reconnection
- Cloud and Custom endpoints with API key support for Cloud
- Advanced options: per-operation timeouts and skip-initialization checks
- API keys are not displayed when editing existing connections
- Optional connect‑on‑expand prompt for disconnected connections

### Data Visualization

- Table view: Flattened, readable tables for nested JSON
- JSON view: Syntax-highlighted, collapsible JSON viewer
- Schema explorer: Interactive browsing of your Weaviate schema
- Real-time results: Live query execution with instant feedback

### GraphQL Editor

- Monaco Editor with full GraphQL syntax support
- Auto-completion and context-aware suggestions
- Intelligent, schema-aware query generation that adapts to your collection schema
- Dynamic query templates with auto-populated properties and accurate vector dimensions
- Real-time validation and error highlighting
- Enhanced query templates for all major Weaviate operations with comprehensive error handling
- Reference field support and type-safe generation

### Schema Management

- Browse collections and their properties
- View detailed schema information, data types, and relationships
- Support for cross-references and nested object structures with recursive navigation
- Visual property type icons (text, number, boolean, date, object, geo coordinates, phone, blob)
- Visual representation of your data model with hierarchical nested property display
- Create collections via three paths: From scratch, Copy from existing, or Import from JSON schema

### Cluster Management

- Comprehensive Cluster Information Panel with real-time monitoring
- Auto-opens on connection by default (configurable)
- "Save and Connect" workflow for streamlined connection setup
- Cluster health and status monitoring
- Node information and statistics

### Backup & Restore

- Create backups with real-time progress tracking
- Monitor backup status (in-progress, success, failed)
- Restore backups from any available backend
- Retry failed backups or cancel in-progress operations
- Multi-backend support: filesystem, S3, GCS, Azure
- Automatic detection of available backup modules
- Advanced configuration: include/exclude collections, custom paths
- Independent refresh controls for backups, collections, nodes, and metadata

### Tree View

- Connection-level: Cluster information panel, backups, modules, collections overview
- Collection-level: Properties (with nested object support), vectors (with count), inverted index, generative config, statistics, sharding, replication, multi‑tenancy

### Schema Analysis

- Enhanced schema viewer with overview, properties, raw JSON, API equivalents, and creation scripts

### Developer Experience

- Hot reload for instant updates
- Full TypeScript support
- Modern, responsive UI

### Query Templates

- Core: Basic Get, Vector Search, Semantic Search, Hybrid Search
- Advanced: Filter, Aggregation, Relationship, Sort, Explore
- Intelligent, schema-aware templates that dynamically adapt to your collection's actual schema
- Auto-populated properties based on data types (primitives, geo coordinates, references)
- Support for 15+ popular embedding models with automatic dimension detection
- Comprehensive error handling with graceful fallback system
- Visual decision tree and troubleshooting guide for 41 common mistakes

See the GraphQL Templates Guide for detailed usage, examples, and best practices: [docs/GRAPHQL_TEMPLATES.md](docs/GRAPHQL_TEMPLATES.md)

### Bulk Operations

- Delete All Collections (destructive) with double confirmation

</details>

---

## Development & Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development, and pull request guidelines.

Need a quick Weaviate instance for development or learning? Check out our [local sandbox environment](sandbox/readme.md) with pre-configured Docker setup and test data.

### Architecture

Weaviate Studio uses a modular architecture with external React components for enhanced UI:

- **Add Collection UI**: Powered by [`weaviate-add-collection`](https://github.com/dudanogueira/weaviate-add-collection) ([Live Demo](https://dudanogueira.github.io/weaviate-add-collection/)) - a standalone React component for creating, cloning, and importing collections
- **Extension Core**: TypeScript-based VS Code extension
- **Webviews**: React-based UIs with Monaco editor integration

For details on updating external dependencies, see the [Working with Dependencies](CONTRIBUTING.md#working-with-dependencies) section in CONTRIBUTING.md.

---

## Testing & Quality

- Comprehensive unit and integration tests with Jest
- Strict TypeScript and linting for code quality
- See [TESTING_GUIDE.md](TESTING_GUIDE.md) for details

---

## Support & License

- **Issues:** [GitHub Issues](https://github.com/muleyprasad/weaviate-studio/issues)
- **Marketplace:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio)
- **Open VSX:** [Open VSX Registry](https://open-vsx.org/extension/prasadmuley/weaviate-studio)
- **License:** MIT ([LICENSE](LICENSE))

---

**Happy querying with Weaviate Studio! 🚀**
