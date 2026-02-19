# Changelog

All notable changes to the Weaviate Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-02-18

### Added - Data Explorer

- **Interactive Data Browser** - Visual table interface for browsing Weaviate collections

  - Sortable columns with ascending/descending order
  - Configurable pagination (10, 20, 50, 100 objects per page)
  - Column visibility management (show, hide, reorder)
  - Object detail panel with expandable nested properties
  - Support for all Weaviate data types (text, number, boolean, date, references, geo-coordinates, phone numbers, blobs, vectors)

- **Advanced Filtering System**

  - Visual filter builder with 10+ operators (Equal, Not Equal, Contains, Greater Than, Less Than, Like, ContainsAny, ContainsAll, IsNull, IsNotNull)
  - AND/OR logic for combining multiple filter conditions
  - Nested filter groups for complex queries
  - Filter presets - save, load, and delete frequently used filter combinations
  - Real-time active filter badges
  - Match mode toggle (AND/OR)

- **Vector Search (4 Modes)**

  - Text-based semantic search using nearText
  - Object-based similarity search ("Find Similar" action in object menu)
  - Direct vector embedding search for advanced users
  - Hybrid search combining BM25 keyword + vector semantic search
    - Alpha slider to balance keyword (0.0) vs semantic (1.0) weight
    - Score breakdown display (keyword score, semantic score, combined score)
    - Property selection for targeted search
    - Preset buttons (Keyword Only, Balanced, Semantic Only)

- **Data Export**

  - Export to JSON or CSV formats
  - Three export scopes: current page, filtered results, or entire collection
  - Export options: include/exclude metadata, vectors, flatten nested objects
  - Native VS Code save dialog integration
  - Large dataset warnings (>10,000 objects)
  - Progress indicators for long-running exports
  - Cancellable export operations

- **Performance Optimizations**

  - Virtual scrolling for collections with 100+ objects
  - React.memo optimization on frequently rendered components (CellRenderer, TableRow)
  - Optimized context subscriptions to prevent cascade re-renders
  - TableRow context subscription uses props instead of context to prevent cascade re-renders
  - FilterContext actions use refs to avoid recreation on every state change
  - CellRenderer memoized to prevent unnecessary re-renders on table updates
  - Race condition fixes in useDataFetch with proper dependencies
  - useDebouncedCallback stabilized to avoid recreating functions on every render
  - Infinite loop fix in data fetching caused by circular dependencies
  - Debounced search and filter inputs
  - Network request timeouts (30 second default)
  - Efficient ref-based state access in hooks

- **User Experience Enhancements**

  - Loading skeleton screens with shimmer animation
  - Error boundaries on all major components with recovery options
  - Keyboard shortcuts (Ctrl+F, Ctrl+K, Ctrl+E, Ctrl+R, Escape)
  - Keyboard shortcuts help tooltip
  - User preferences persistence per collection (columns, sort, filters, panel states)
  - Empty states with actionable suggestions
  - Accessibility support (ARIA labels, keyboard navigation, focus management)
  - High contrast mode support
  - Reduced motion support for animations
  - Updated toolbar icons for better visual clarity: Query Editor uses `$(edit)` (pencil) and Data Explorer uses `$(telescope)` (telescope)
  - Debug console.log statements controlled by DEBUG flag

- **Error Handling**

  - Silent API failures now throw proper errors with user-facing messages
  - Silent message handler failures now send error responses to webview
  - Missing API connection errors display user-friendly messages
  - postMessage to disposed webview handled gracefully
  - localStorage quota exceeded errors with automatic recovery
  - Network timeout handling for slow/unreliable connections

- **Security Hardening**

  - XSS vulnerability fix in webview initialization (unsafe string interpolation)
  - UUID format validation using regex pattern
  - Vector array size limit enforcement (max 65,536 dimensions)
  - Proper input sanitization in filter values

## [1.3.0] — 2025-12-26

### Added

- Cluster Information Panel for comprehensive cluster monitoring and management (PR #48):

  - Replaces "Server Information" with enhanced "Cluster Information" dashboard
  - Auto-opens cluster view on connection by default (configurable)
  - "Save and Connect" functionality in connection manager for streamlined workflow
  - Automatically closes cluster panel when disconnecting

- Nested Object support with enhanced tree view and Add Collection integration (PR #47):

  - Visual property type icons in tree view (text, number, boolean, date, object, geo coordinates, phone, blob)

- Docker Compose test sandbox for local Weaviate development (PR #46):

  - Pre-configured Weaviate server with text2vec-contextionary module
  - Automated backup/restore for test data persistence
  - Ready-to-use local development environment with backup capabilities

- React-based Add Collection interface as external module (PR #38):

  - Migrated to external React component package (weaviate-add-collection)
  - Enhanced collection creation workflow with improved UX and comprehensive feature exploration
  - Support for creating collections from scratch, cloning existing collections, and importing from JSON
  - Dedicated build step for add-collection webview
  - Updated CI/CD workflows to include add-collection build process
  - Developer documentation for working with external module dependency

- Enhanced GraphQL template system with intelligent, schema-aware query generation (PR #42):
  - 8 new dynamic query generators that adapt to collection schema (nearVector, nearText, hybrid, BM25, generative search, filter, aggregation, groupBy)
  - Auto-populated properties based on actual collection schema and data types
  - Support for 15+ popular embedding models with automatic dimension detection (OpenAI, Cohere, Sentence Transformers, BERT, PaLM, Ollama, AWS Bedrock)
  - Comprehensive error handling with graceful fallback to static templates
  - Multi-strategy vector dimension detection across Weaviate v1/v2 schema formats
  - Test coverage increased from ~40% to ~80% with 21 new test cases across 6 comprehensive test suites
  - Enhanced documentation with visual decision tree and troubleshooting guide covering 41 common mistakes
  - Retry logic with maximum attempt limits to prevent infinite loops

### Changed

- Connection Manager now supports "Save and Connect" workflow for faster connection setup (PR #48)
- Tree view refresh commands are now granular: separate refresh for backups, collections, nodes, and metadata (PR #41)
- Add Collection workflow now uses external React component for better maintainability (PR #38)

### Fixed

- Connection instantiation issue when no API key is provided for custom connections (PR #37)
- RQ compression not being exported correctly in Add Collection workflow (PR #40)
- Static query templates now dynamically generated based on collection schema (Issue #36, resolved in PR #42)

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

---

## Legend

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes
