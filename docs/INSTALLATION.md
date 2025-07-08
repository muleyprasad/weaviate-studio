# 📦 Installation Guide

## Quick Installation

### From VS Code Marketplace (Recommended)
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Weaviate Studio"
4. Click "Install"

### From Cursor
1. Open Cursor
2. Go to Extensions panel
3. Search for "Weaviate Studio"
4. Click "Install"

### From Windsurf
1. Open Windsurf
2. Go to Extensions panel
3. Search for "Weaviate Studio"
4. Click "Install"

## Manual Installation

### Download VSIX File
1. Go to [GitHub Releases](https://github.com/prasadmuley/weaviate-studio/releases)
2. Download the latest `.vsix` file
3. Install using command: `code --install-extension weaviate-studio-1.0.0.vsix`

### Command Line Installation
```bash
# VS Code
code --install-extension prasadmuley.weaviate-studio

# Cursor
cursor --install-extension prasadmuley.weaviate-studio
```

## First-Time Setup

1. **Open Weaviate Studio**
   - Click the Weaviate icon in the Activity Bar
   - Or press `Ctrl+Shift+P` → "Weaviate: Open Query Editor"

2. **Add Your First Connection**
   - Click "Add New Weaviate Connection"
   - Enter connection details:
     - **Name**: Friendly name (e.g., "Local Development")
     - **URL**: Weaviate endpoint (e.g., `http://localhost:8080`)
     - **API Key**: Optional authentication key

3. **Start Exploring**
   - Connect to your instance
   - Browse collections in the sidebar
   - Open Query Editor to start querying

## System Requirements

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Version 18.x or higher (for development)
- **Weaviate**: Version 1.0.0 or higher

## Troubleshooting

### Extension Won't Load
1. Check VS Code version compatibility
2. Restart VS Code
3. Check Developer Console for errors (`Help > Toggle Developer Tools`)

### Connection Issues
1. Verify Weaviate server is running
2. Check network connectivity
3. Validate API key if required
4. Ensure CORS is properly configured

### Performance Issues
1. Close unnecessary tabs
2. Restart VS Code
3. Clear extension cache
4. Check system resources

## Getting Help

- **Documentation**: [README.md](../README.md)
- **Issues**: [GitHub Issues](https://github.com/prasadmuley/weaviate-studio/issues)
- **Community**: [Weaviate Discord](https://discord.com/invite/weaviate)
- **Support**: [Weaviate Support](https://weaviate.io/support) 