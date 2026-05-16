---
title: Getting Started with Weaviate Studio for VS Code
description: Install the Weaviate Studio VS Code extension and connect to your first self-hosted, on-prem, or cloud Weaviate vector database in under two minutes.
---

# Getting Started

This guide will help you set up Weaviate Studio and connect to your first Weaviate instance.

## Prerequisites

- **VS Code** (version 1.80.0 or later)
- A running **Weaviate instance** (local, on-prem, or cloud)
- **Docker** (optional — for the local sandbox)

## Installation

1. Open VS Code
2. Go to the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Weaviate Studio"**
4. Click **Install**

Or install from the command line:

```bash
code --install-extension prasadmuley.weaviate-studio
```

::: tip Other Editors
Weaviate Studio also works in Cursor, Windsurf, and VSCodium. Install from [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio).
:::

## Connecting to Weaviate

1. Click the **Weaviate icon** in the Activity Bar (sidebar)
2. Click **"Add New Weaviate Connection"**
3. Fill in your connection details:
   - **Name:** A friendly name (e.g., "Production", "Local Dev")
   - **Endpoint Type:** Cloud or Custom
   - **URL:** Your Weaviate instance URL (e.g., `http://localhost:8080`)
   - **API Key:** Your authentication key (required for Cloud)
4. Click **Save and Connect**

Once connected, you'll see your Weaviate instance in the sidebar with its collections, nodes, and management options.

## Your First Query

1. Right-click a collection in the sidebar
2. Select **"Open Query Editor"**
3. Choose a query template from the dropdown
4. Click **Run Query** (or press `Ctrl+Enter`)

```graphql
{
  Get {
    YourCollection(limit: 10) {
      _additional {
        id
      }
    }
  }
}
```

## What's Next?

- [Explore your data](/features/data-explorer) with the interactive data browser
- [Try Generative Search](/features/generative-search) for AI-powered queries
- [Run the local sandbox](/guide/sandbox) for a quick test environment
- [Browse the full feature list](/features/overview)
