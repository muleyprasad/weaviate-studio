# Weaviate Studio

<div align="center">

![Weaviate Studio Logo](resources/weaviate-logo.png)

**A powerful VS Code extension for managing Weaviate vector databases with an intuitive GraphQL interface**

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=weaviate.weaviate-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)

</div>

## Features

### Connection Management
- Connect to multiple Weaviate instances simultaneously
- Secure credential storage with VS Code's built-in secret storage
- Support for both local and cloud-hosted Weaviate deployments
- Connection health monitoring and automatic reconnection

### Advanced Data Visualization
- **Table View**: Intelligent flattening of nested JSON data into readable tables
- **JSON View**: Syntax-highlighted, collapsible JSON viewer
- **Schema Explorer**: Interactive browsing of your Weaviate schema
- **Real-time Results**: Live query execution with instant feedback

### Intelligent GraphQL Editor
- **Syntax Highlighting**: Full GraphQL syntax support with Monaco Editor
- **Auto-completion**: Context-aware suggestions based on your schema
- **Schema-Aware Queries**: Automatic generation of sample queries with proper reference handling
- **Error Detection**: Real-time validation and error highlighting
- **Query Templates**: Pre-built templates for common operations

### Schema Management
- Browse collections and their properties
- View detailed schema information including data types and relationships
- Support for cross-references and nested object structures
- Visual representation of your data model

### Developer Experience
- **Hot Reload**: Instant updates during development
- **TypeScript Support**: Full type safety and IntelliSense
- **Modern UI**: Dark theme optimized for VS Code
- **Responsive Design**: Works seamlessly across different screen sizes

## Screenshots

### Connection Management
![Connection Management](docs/images/connections.png)

### GraphQL Query Interface
![Query Interface](docs/images/query-interface.png)

### Table View Results
![Table View](docs/images/table-view.png)

### Schema Explorer
![Schema Explorer](docs/images/schema-explorer.png)

## Quick Start

### Installation

1. **From VS Code Marketplace** (Recommended)
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Weaviate Studio"
   - Click Install

2. **From VSIX Package**
   ```bash
   code --install-extension weaviate-studio-0.0.1.vsix
   ```

### First Steps

1. **Open Weaviate Studio**
   - Click the Weaviate icon in the Activity Bar
   - Or use Command Palette: `Ctrl+Shift+P` → "Weaviate: Open Query Editor"

2. **Add Your First Connection**
   - Click "Add New Weaviate Connection"
   - Enter your Weaviate instance details:
     - **Name**: A friendly name for your connection
     - **URL**: Your Weaviate endpoint (e.g., `http://localhost:8080`)
     - **API Key**: (Optional) Your Weaviate API key

3. **Start Querying**
   - Connect to your instance
   - Browse collections in the sidebar
   - Click "Query Collection" to open the GraphQL editor
   - Use the "Sample" button to generate example queries

## Usage Guide

### Managing Connections

```typescript
// Example connection configuration
{
  "name": "Local Development",
  "url": "http://localhost:8080",
  "apiKey": "optional-api-key"
}
```

### Writing GraphQL Queries

The extension provides intelligent auto-completion and validation:

```graphql
{
  Get {
    Article(limit: 10) {
      title
      content
      author {
        ... on Person {
          name
          email
          _additional {
            id
          }
        }
      }
      _additional {
        id
        distance
      }
    }
  }
}
```

### Query Templates

Built-in templates for common operations:

- **Basic Get Query**: Simple data retrieval
- **Vector Search**: Similarity search using `nearVector`
- **Semantic Search**: Text-based search using `nearText`
- **Hybrid Search**: Combined BM25 + Vector search
- **Filtered Queries**: Complex filtering with `where` clauses
- **Aggregation**: Statistical operations across your data

## Development

### Prerequisites

- **Node.js** (v16 or later)
- **npm** (v8 or later)
- **VS Code** (v1.85.0 or later)

### Setup

```bash
# Clone the repository
git clone https://github.com/weaviate/weaviate-studio.git
cd weaviate-studio

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Development Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   ```
   This runs both the extension and webview in watch mode.

2. **Launch Extension**
   - Press `F5` in VS Code
   - Or use "Run Extension" from the Run and Debug panel

3. **Debug Webview**
   - Right-click in the webview → "Inspect Element"
   - Use Chrome DevTools for debugging

### Building

```bash
# Build for production
npm run package

# Build webview only
npm run package:webview

# Create VSIX package
vsce package
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Architecture

### Extension Structure

```
src/
├── extension.ts              # Main extension entry point
├── WeaviateTreeDataProvider.ts # Tree view provider for connections
├── services/                 # Business logic and API services
├── types/                    # TypeScript type definitions
├── views/                    # Custom views and panels
├── query-editor/             # GraphQL editor components
│   ├── enhanced/             # Monaco editor integration
│   │   ├── MonacoQueryEditor.ts
│   │   ├── queryTemplates.ts # Query generation logic
│   │   └── schemaProvider.ts # Schema integration
│   └── WeaviateQueryEditor.ts
└── webview/                  # React-based webview components
    ├── index.tsx             # Main webview application
    ├── components/           # Reusable React components
    │   └── ResultsTable.tsx  # Table view component
    ├── MonacoGraphQLEditor.tsx
    └── ErrorBoundary.tsx
```

### Key Components

- **Extension Host**: Manages VS Code integration and commands
- **Tree Data Provider**: Handles the sidebar connection tree
- **Webview**: React-based UI for query editing and results
- **Monaco Editor**: GraphQL editor with syntax highlighting
- **Results Table**: Intelligent data visualization component

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Weaviate](https://weaviate.io/) for the amazing vector database
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the code editor
- [React](https://reactjs.org/) for the UI framework
- The VS Code team for the excellent extension API

## Support

- **Documentation**: [Full Documentation](docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/weaviate/weaviate-studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/weaviate/weaviate-studio/discussions)
- **Weaviate Community**: [Slack](https://weaviate.io/slack)

## Roadmap

- [ ] **Enhanced Visualizations**: Graph view for relationships
- [ ] **Batch Operations**: Bulk import/export functionality
- [ ] **Query History**: Save and manage query history
- [ ] **Performance Monitoring**: Query performance analytics
- [ ] **Collaborative Features**: Share queries and connections
- [ ] **Plugin System**: Extensible architecture for custom features

---

<div align="center">

**Made with ❤️ by the Weaviate Community**

[Website](https://weaviate.io) • [Documentation](https://weaviate.io/developers/weaviate) • [Community](https://weaviate.io/slack)

</div>
