# Changelog

All notable changes to the Weaviate Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed - Data Explorer Security

- XSS vulnerability in webview initialization (unsafe string interpolation)
- UUID format validation using regex pattern
- Vector array size limit enforcement (max 65,536 dimensions)
- Proper input sanitization in filter values

### Fixed - Data Explorer Error Handling

- Silent API failures now throw proper errors with user-facing messages
- Silent message handler failures now send error responses to webview
- Missing API connection errors now display user-friendly messages
- postMessage to disposed webview now handled gracefully
- localStorage quota exceeded errors with automatic recovery
- Network timeout handling for slow/unreliable connections

### Fixed - Data Explorer Performance Issues

- TableRow context subscription causing cascade re-renders (now uses props)
- FilterContext actions recreated on every state change (now uses refs)
- CellRenderer unnecessary re-renders on table updates (now memoized)
- useDataFetch race conditions with missing dependencies
- useDebouncedCallback recreating functions on every render
- Infinite loop in data fetching caused by circular dependencies

### Changed - Data Explorer

- Debug console.log statements now controlled by DEBUG flag
- Improved error messages throughout the application
- Enhanced empty state messages with clearer calls-to-action

## Previous Releases

### [1.3.0] - Previous

- Initial Weaviate Studio features
- Connection management
- Collection browser
- Schema viewer
- Query editor
- Cluster information viewer
- Backup management

---

## Legend

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes
