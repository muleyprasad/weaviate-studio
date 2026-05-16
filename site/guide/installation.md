# Installation

## Quick Install

### VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Weaviate Studio"**
4. Click **Install**

### Cursor

1. Open Cursor
2. Go to Extensions panel
3. Search for **"Weaviate Studio"**
4. Click **Install**

### Windsurf

1. Open Windsurf
2. Go to Extensions panel
3. Search for **"Weaviate Studio"**
4. Click **Install**

## Manual Installation (VSIX)

1. Go to [GitHub Releases](https://github.com/muleyprasad/weaviate-studio/releases)
2. Download the latest `.vsix` file
3. Install using the command:

```bash
code --install-extension weaviate-studio-<version>.vsix
```

## Command Line Installation

```bash
# VS Code
code --install-extension prasadmuley.weaviate-studio

# Cursor
cursor --install-extension prasadmuley.weaviate-studio
```

## System Requirements

| Requirement       | Version                          |
| ----------------- | -------------------------------- |
| VS Code           | ^1.80.0                          |
| Node.js (for dev) | 18.x or higher                   |
| Weaviate Server   | Collections API support (v1.24+) |

::: warning Legacy Servers
Weaviate servers that only expose the legacy class/schema endpoints are **not supported** by the current extension version.
:::

## First-Time Setup

1. **Open Weaviate Studio** — Click the Weaviate icon in the Activity Bar
2. **Add Your First Connection** — Click "Add New Weaviate Connection" and enter your endpoint details
3. **Start Exploring** — Browse collections, run queries, and manage your data

## Troubleshooting

### Extension Won't Load

1. Check VS Code version compatibility
2. Restart VS Code
3. Check Developer Console for errors (`Help > Toggle Developer Tools`)

### Connection Issues

1. Verify your Weaviate server is running
2. Check network connectivity
3. Validate your API key if required
4. Ensure CORS is properly configured

### Performance Issues

1. Close unnecessary tabs
2. Restart VS Code
3. Clear the extension cache
4. Check system resources

## Getting Help

- [GitHub Issues](https://github.com/muleyprasad/weaviate-studio/issues)
- [Weaviate Discord](https://discord.com/invite/weaviate)
- [Weaviate Support](https://weaviate.io/support)
