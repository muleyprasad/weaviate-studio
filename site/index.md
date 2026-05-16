---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Weaviate Studio'
  text: 'Manage Weaviate from VS Code'
  tagline: The go-to management UI for self-hosted and custom Weaviate installations — local, on-prem, or cloud. More features than the cloud dashboard.
  image:
    src: /weaviate-studio-color.png
    alt: Weaviate Studio
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/muleyprasad/weaviate-studio

features:
  - icon: 🔗
    title: Multiple Connections
    details: Manage several Weaviate instances at once — local, on-prem, or cloud.
    link: /features/overview
    linkText: Browse features
  - icon: 🔭
    title: Data Explorer
    details: Interactive visual browser with advanced filtering, 4 vector search modes, and JSON/CSV export.
    link: /features/data-explorer
    linkText: Explore data
  - icon: 🤖
    title: Generative Search
    details: Ask natural-language questions across collections with RAG-powered answers and source attribution.
    link: /features/generative-search
    linkText: Ask questions
  - icon: 🛡️
    title: RBAC & Security
    details: Manage users, roles, and groups with native RBAC and API key rotation.
    link: /features/rbac-security
    linkText: Manage access
  - icon: 📝
    title: GraphQL Editor
    details: Monaco-powered editor with intelligent, schema-aware templates and auto-completion.
    link: /features/graphql-templates
    linkText: Write queries
  - icon: 💾
    title: Backup & Restore
    details: Create, monitor, and restore backups across filesystem, S3, GCS, and Azure backends.
    link: /features/backup-restore
    linkText: Protect data
  - icon: 📊
    title: Cluster Management
    details: Comprehensive cluster info panel with health monitoring and real-time statistics.
    link: /features/cluster-management
    linkText: Monitor cluster
  - icon: 🏗️
    title: Schema Explorer
    details: Visualize collections, properties, nested objects, and relationships in your data model.
    link: /features/schema
    linkText: Browse schema
---

## Quick Install

| VS Code                                                                                        | Cursor                                                                 | Windsurf                                                               | Manual                                                                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio) | [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio) | [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio) | [Download VSIX](https://github.com/muleyprasad/weaviate-studio/releases) |

---

## What is Weaviate Studio?

Weaviate Studio is a [VS Code](https://code.visualstudio.com/) extension that gives you a full-featured management interface for **any** Weaviate instance — local, on-prem, or cloud. Unlike [Weaviate's cloud-only web UI](https://console.weaviate.cloud), Weaviate Studio works with **self-hosted and custom installations** where no management dashboard exists.

**Why Weaviate Studio?**

- **Works everywhere** — local Docker, on-prem servers, or Weaviate Cloud
- **More features** than the cloud dashboard: Data Explorer, Generative Search, RBAC, Backup & Restore, Multi-Vector Search, and more
- **No browser needed** — everything lives inside your editor

### Demo

![Extension Demo](/images/extension-demo.gif)

See the extension in action: tree explorer, query editor, and real-time results. [Learn more →](/guide/getting-started)

### Data Explorer

![Data Explorer Demo](/images/data-explorer-demo.gif)

Interactive visual browser with advanced filtering, vector search, and data export. [Learn more →](/features/data-explorer)

### Generative Search

![Generative Search Demo](/images/generative-search-demo.gif)

Ask natural-language questions across collections with RAG-powered answers. [Learn more →](/features/generative-search)

### Cluster Management

![Cluster Management](/images/cluster-panel.png)

Monitor your cluster health, node status, shard distribution, and run diagnostic checks — all from a real-time dashboard. [Learn more →](/features/cluster-management)

### Schema Explorer

![Schema Explorer](/images/schema-explorer.png)

Browse collections, inspect nested properties, view raw JSON schemas, and generate API code equivalents. [Learn more →](/features/schema)

### RBAC & Security

Manage users, roles, and groups with native RBAC support. Rotate API keys, toggle read-only mode, and control access per connection. [Learn more →](/features/rbac-security)

---

## Supported Editors

Weaviate Studio works in all editors that support VS Code extensions:

- **VS Code** — [Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio)
- **Cursor** — [Install from Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio)
- **Windsurf** — [Install from Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio)
- **VSCodium** — [Install from Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio)

---

## Quick Local Sandbox

Want to try Weaviate Studio right away? Our sandbox spins up a fully-configured Weaviate instance with sample data:

```bash
cd sandbox
docker-compose up -d
python3 populate.py
```

[Learn more →](/guide/sandbox)

---

## Stay Connected

- **Issues & Bugs:** [GitHub Issues](https://github.com/muleyprasad/weaviate-studio/issues)
- **Feature Requests:** Open a [GitHub Issue](https://github.com/muleyprasad/weaviate-studio/issues)
- **Contributing:** Read our [Contributing Guide](/guide/contributing)
- **Weaviate Community:** [Weaviate Discord](https://discord.com/invite/weaviate)

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);
}

.VPHero .image-container {
  max-width: 200px;
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

.vp-doc table {
  width: 100%;
}

.vp-doc table td {
  text-align: center;
}
</style>
