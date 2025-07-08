# Change Log

All notable changes to the "weaviate-studio" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2024-12-XX

### Added
- **Initial Release** - Complete Weaviate vector database management extension
- **Connection Management**: 
  - Multi-instance connection support
  - Secure credential storage with VS Code's built-in secret storage
  - Connection health monitoring and automatic reconnection
  - Support for local and cloud-hosted Weaviate deployments
- **Advanced GraphQL Query Interface**:
  - Monaco Editor with full GraphQL syntax highlighting
  - Schema-aware auto-completion and validation
  - Real-time error detection and highlighting
  - 9 comprehensive query templates covering all major Weaviate operations
- **Enhanced Data Visualization**:
  - Intelligent table view with nested JSON flattening
  - Syntax-highlighted JSON viewer with collapsible sections
  - Real-time query results with instant feedback
- **Comprehensive Schema Management**:
  - Interactive collection and property browsing
  - Detailed schema viewer with multiple tabs (Overview, Properties, Raw JSON, API Equivalent, Creation Scripts)
  - Support for cross-references and complex data types
  - Schema export functionality
- **Rich Tree Explorer**:
  - Connection-level information (server info, cluster health, available modules)
  - Collection-level details (properties, vector configuration, statistics, sharding)
  - Organized collection grouping with real-time counts
- **Developer Experience**:
  - Hot reload during development
  - Full TypeScript support with IntelliSense
  - Modern dark theme optimized for VS Code
  - Responsive design across different screen sizes
- **Advanced Query Features**:
  - Vector search (nearVector) with similarity thresholds
  - Semantic search (nearText) with concept refinement
  - Hybrid search combining BM25 + Vector search
  - Complex filtering with multiple operators
  - Aggregation queries with comprehensive statistics
  - Multi-level sorting capabilities
  - Relationship exploration for cross-references

### Security
- Secure API key storage using VS Code's secret storage
- Safe connection management with proper error handling

### Performance
- Optimized webview rendering for large datasets
- Efficient GraphQL query execution
- Lazy loading of collection data

## [Unreleased]

- Additional query templates
- Enhanced performance optimizations
- Extended platform support