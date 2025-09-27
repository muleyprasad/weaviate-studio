# <img src="resources/weaviate-studio-color.png" alt="Weaviate Studio Logo" width="48" height="48" style="vertical-align:middle;"> Weaviate Studio

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio)
[![Open VSX Registry](https://img.shields.io/badge/Open%20VSX-Registry-purple?style=flat-square&logo=eclipse-ide)](https://open-vsx.org/extension/prasadmuley/weaviate-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)

---

**A powerful VS Code extension for managing Weaviate vector databases with an intuitive GraphQL 
interface. Supports self-hosted and cloud Weaviate instances.**

---

## Key Benefits

- **Unified Experience:** Manage, query, and monitor Weaviate directly in VS Code—no browser switching.
- **Works Everywhere:** Connect to local, on-prem, or cloud Weaviate instances.
- **Visual Data Exploration:** Browse schema, run queries, and view results in rich tables and JSON.
- **Intelligent GraphQL Editor:** Auto-complete (wip), schema-aware templates, and error highlighting.
- **Secure & Productive:** Secure credential storage, hot reload, and type-safe development.

---

## Quick Install

| **VS Code** | **Cursor** | **Windsurf** | **Manual Install** |
|-------------|------------|--------------|-------------------|
| [Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio) | [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio) | [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio) | [Download VSIX](https://github.com/muleyprasad/weaviate-studio/releases) |

---

## Top Features

- **Multiple Connections:** Manage several Weaviate instances at once
- **Schema Explorer:** Visualize and browse collections, properties, and relationships
- **Advanced Query Editor:** Monaco-powered GraphQL editor with auto-complete and validation
- **Live Results:** Table and JSON views for query results
- **Comprehensive Templates:** Built-in, schema-aware GraphQL templates for all major operations
- **Secure Storage:** Credentials stored with VS Code’s secret storage
- **Modern UI:** Responsive, dark-theme optimized interface

---

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/images/query-editor.png" alt="Query Editor" width="350"/><br/>Query Editor</td>
    <td align="center"><img src="docs/images/connections.png" alt="Connection Management" width="350"/><br/>Connection Management</td>
  </tr>
  <tr>
    <td align="center"><img src="docs/images/add-collection.png" alt="Add Collection" width="350"/><br/>Add Collection</td>
    <td align="center"><img src="docs/images/detailed-schema.png" alt="Detailed Schema" width="350"/><br/>Detailed Schema</td>
  </tr>
</table>

---

## Getting Started

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

### Data Visualization
- Table view: Flattened, readable tables for nested JSON
- JSON view: Syntax-highlighted, collapsible JSON viewer
- Schema explorer: Interactive browsing of your Weaviate schema
- Real-time results: Live query execution with instant feedback

### GraphQL Editor
- Monaco Editor with full GraphQL syntax support
- Auto-completion and context-aware suggestions
- Schema-aware query generation
- Real-time validation and error highlighting
- Enhanced query templates for all major Weaviate operations
- Reference field support and type-safe generation

### Schema Management
- Browse collections and their properties
- View detailed schema information, data types, and relationships
- Support for cross-references and nested object structures
- Visual representation of your data model

### Tree View
- Connection-level: Server info, cluster health, modules, collections overview
- Collection-level: Properties, vector config, indexes, statistics, sharding, replication

### Schema Analysis
- Enhanced schema viewer with overview, properties, raw JSON, API equivalents, and creation scripts

### Developer Experience
- Hot reload for instant updates
- Full TypeScript support
- Modern, responsive UI

### Query Templates
- Core: Basic Get, Vector Search, Semantic Search, Hybrid Search
- Advanced: Filter, Aggregation, Relationship, Sort, Explore
- Schema-aware, type-safe, and educational templates

</details>

---

## Sample Datasets (Local)

New to Weaviate self-hosting? Spin up local demo datasets with Docker using the included helper script.

- Prerequisites: Docker Desktop with Docker Compose v2
- Script: `./scripts/weaviate-sample-datasets.sh`

Examples
- Start News dataset: `./scripts/weaviate-sample-datasets.sh news`
- Start Wikipedia dataset (CPU): `./scripts/weaviate-sample-datasets.sh wiki`
- Start Wikipedia dataset (GPU): `./scripts/weaviate-sample-datasets.sh wiki-gpu`
- Preload Wikipedia backup (~112GB) and start: `./scripts/weaviate-sample-datasets.sh --wiki-backup wiki`
- Start both: `./scripts/weaviate-sample-datasets.sh all`
- Stop a dataset: `./scripts/weaviate-sample-datasets.sh --down news`
- List available datasets: `./scripts/weaviate-sample-datasets.sh --list`

Notes
- The script caches upstream Docker Compose files under `.weaviate-samples/` (ignored by git).
- For Wikipedia, using `--wiki-backup` downloads and mounts the pre-vectorized dataset so Weaviate starts with data immediately. You can override the backup URL via `--wiki-backup-url <URL>` or `WEAVIATE_WIKI_BACKUP_URL`.
- Upstream demos typically expose Weaviate on `localhost:8080`. If you run multiple datasets simultaneously, adjust the cached compose files to use different host ports.

Port override example
- To run multiple stacks side-by-side, create a compose override that remaps the Weaviate port, then pass it to the script with `--compose-arg "-f <override.yml>"`.

Example override file `weaviate-port-8081.override.yml`:

```
services:
  weaviate:
    ports:
      - "8081:8080"
```

Usage:

```
./scripts/weaviate-sample-datasets.sh --compose-arg "-f weaviate-port-8081.override.yml" wiki
```

## Development & Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development, and pull request guidelines.

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
