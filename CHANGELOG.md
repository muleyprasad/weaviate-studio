# Change Log

All notable changes to the "weaviate-studio" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.0] — 2025-10-21

### Added

- GraphQL Monaco Editor with Schema-Aware IntelliSense for enhanced query editing experience (PR #29)
- Support for .weaviate connection files to streamline connection setup (PR #17)
- Reranker functionality added to tree view for improved data ranking (PR #27)
- Query editor run/stop/clear commands added to command palette for better accessibility (PR #29)
- Test sandbox with Docker Compose setup for local development (PR #32)
- Pre-commit linting hooks to enforce code quality standards (PR #23)
- Icon and inline action for query collection command (PR #30)

### Changed

- Improved Monaco editor Enter key behavior and completion settings for better UX (PR #29)
- Enhanced connection flow with query cancellation support (PR #29)
- Updated output channel initialization with caching and error handling (PR #25)
- Disabled intrusive auto-completion behavior while maintaining helpful suggestion previews (PR #29)

### Fixed

- Handle null/undefined descriptions in tree view to prevent crashes (PR #34)
- Fixed GraphQL error overflow handling for better error display (PR #25)
- Fix clone/create schema dataType serialization by normalizing to server version (PR #20)
- Removed URL cache busting for Monaco workers (PR #29)

### Security

- Updated CSP to allow https: and blob: for connect-src for better security compliance (PR #29)

## [1.1.0] — 2025-09-28

### Added

- New connection model supporting both Cloud and Custom endpoints with advanced options (timeouts, skip init checks).
- Tree view enhancements: vector count, generative configuration, replication, multi‑tenancy, and more detailed property nodes.
- Command: `weaviate.deleteAllCollections` (with double confirmation) to remove all collections from a connected instance.
- Create Collection options: From scratch, Copy from existing collection, and Import from JSON file.

### Changed

- Migrated from `weaviate-ts-client@^2` to `weaviate-client@^3.8.0` and updated internal APIs to use the Collections API.
- Query Editor: schema loading now uses Collections API and falls back to direct HTTP when GraphQL client helpers are unavailable.
- Auto‑connect behavior: no longer auto‑connect on selection; prompts to connect when expanding a disconnected connection.
- Command ID rename: `weaviate.refreshConnections` → `weaviate.refresh`.
- Docs: Testing and Release guides generalized VSIX filenames and added compatibility/CSP checks.

### Fixed

- More robust connection persistence, validation, and name‑conflict handling.
- Improved error messages and fallback paths for GraphQL execution.

### Security

- Connection form no longer pre-fills API keys when editing, avoiding accidental exposure in the UI.
- Cloud connections now require an API key and enforce re-entry when the target cloud URL changes.
- GraphQL fallback uses Authorization: Bearer headers when an API key is present.

### Breaking

- Requires a Weaviate server that supports the Collections API. Older servers exposing only legacy class/schema endpoints are not supported by this version of the extension.
- Power users with custom keybindings targeting `weaviate.refreshConnections` should update them to `weaviate.refresh`.

## [1.0.2] — 2025-01-27

### Added

- Support for Windsurf and Cursor marketplace publishing
- Enhanced compatibility with VS Code-based editors

### Fixed

- Improved error handling in test scenarios
- Better console error management

## [1.0.1] — 2025-07-08

### Added

- WebviewNoncePlugin to fix CSP violation.

### Fixed

- Webview fails to load under strict CSP policy.

### Internal

- CI workflow now packages webview with nonce placeholders.

## [1.0.0] - 2025-07-08

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
