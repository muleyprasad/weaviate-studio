# Features Overview

Weaviate Studio provides a comprehensive suite of tools for managing your Weaviate vector databases — all within VS Code.

## Core Features

| Feature                                                | Description                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [**Data Explorer**](/features/data-explorer)           | Interactive table browser with filtering, vector search, and export |
| [**Generative Search**](/features/generative-search)   | RAG-powered natural language queries across collections             |
| [**GraphQL Editor**](/features/graphql-templates)      | Monaco editor with schema-aware templates and autocomplete          |
| [**RBAC & Security**](/features/rbac-security)         | Manage users, roles, and groups with API key rotation               |
| [**Backup & Restore**](/features/backup-restore)       | Create and restore backups across multiple backends                 |
| [**Cluster Management**](/features/cluster-management) | Health monitoring and real-time node statistics                     |
| [**Schema Management**](/features/schema)              | Visualize collections, properties, and relationships                |
| [**Multi-Vector Search**](/features/muvera)            | Named-vector / Muvera search with join strategies                   |

## Connection Management

- Connect to **multiple Weaviate instances** simultaneously
- Secure credential storage with VS Code's built-in secret storage
- Connection health monitoring and automatic reconnection
- Support for Cloud and Custom endpoints
- Configurable per-operation timeouts
- **Read-Only mode** to protect production data

## Tree View Explorer

The sidebar tree gives you a complete overview of your Weaviate instances:

- **Connection level:** Cluster info, backups, modules, collections
- **Collection level:** Properties (with nested objects), vectors, inverted index, generative config, statistics, sharding, replication, multi-tenancy

## Data Visualization

- **Table view** with flattened, readable tables for nested JSON
- **JSON view** with syntax highlighting and collapsible sections
- **Schema explorer** with interactive browsing of your data model
- Real-time results with instant feedback

## Keyboard Shortcuts

| Shortcut | Action               |
| -------- | -------------------- |
| `Ctrl+F` | Focus filter search  |
| `Ctrl+K` | Open filter builder  |
| `Ctrl+E` | Export data          |
| `Ctrl+R` | Refresh data         |
| `Escape` | Close modals/drawers |

## Supported Weaviate Versions

The extension requires a Weaviate server that supports the **Collections API** (v1.24+). Multi-vector search (Muvera) requires **v1.26+** for near queries and **v1.27+** for hybrid queries.
