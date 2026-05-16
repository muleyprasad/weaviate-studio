# Testing Guide

This guide is the **single source of truth** for end-to-end testing the Weaviate Studio extension before publishing.

::: tip Source of truth
The root [`TESTING_GUIDE.md`](https://github.com/muleyprasad/weaviate-studio/blob/main/TESTING_GUIDE.md) is a short stub that links here. See [Documentation Structure](/guide/contributing#documentation-structure) for the reasoning.
:::

## Pre-Testing Setup

### 1. Create Test Package

```bash
# Clean install
npm ci

# Package the extension (runs vscode:prepublish scripts)
vsce package

# Verify the VSIX exists
ls -la weaviate-studio-*.vsix
```

Install the latest packaged file quickly on macOS/Linux:

```bash
code --install-extension "$(ls -t weaviate-studio-*.vsix | head -n1)" --force
```

### 2. Prepare Test Environment

- **VS Code:** Latest stable (or at least the minimum supported version)
- **Weaviate instance:** Local or cloud
- **Seed data:** Sample collections with varied data types (see [Quick Start Sandbox](/guide/sandbox))

## Compatibility

- Minimum VS Code version: `^1.80.0` (see `package.json` → `engines.vscode`)
- Weaviate server must support the Collections API
- Verify CSP/nonce handling: no blocked scripts in webview DevTools

## Testing Checklist

### Installation

- [ ] Install from VSIX: `code --install-extension weaviate-studio-<version>.vsix`
- [ ] Extension appears in Extensions panel
- [ ] Weaviate icon appears in Activity Bar
- [ ] No console errors in Developer Tools (`Help > Toggle Developer Tools`)

### UI/UX

- [ ] Activity Bar icon displays correctly
- [ ] Tree View (Connections panel) loads without errors
- [ ] Welcome message ("No connections found") appears when empty
- [ ] All icons display properly (database, add, refresh, etc.)

### Connection Management

- [ ] Add connection with valid credentials
- [ ] Form validation rejects invalid URLs / credentials
- [ ] Connection status shows connected / disconnected
- [ ] Edit existing connection details
- [ ] Delete connection with confirmation

### Tree View

- [ ] Expand/collapse works on all tree items
- [ ] Expanding a disconnected connection prompts to connect
- [ ] Connection info, cluster health, server info display correctly
- [ ] Collections list loads and displays properly
- [ ] Collection properties expand and show details
- [ ] Statistics (live object counts) display

### Query Editor

- [ ] Right-click collection → "Query Collection" opens the editor
- [ ] Monaco Editor loads with GraphQL syntax highlighting
- [ ] Schema-aware autocompletion works
- [ ] All query templates load and execute
- [ ] Table view and JSON view render results
- [ ] Invalid queries show proper errors

### Schema Management

- [ ] Right-click collection → "View Detailed Schema"
- [ ] **Overview tab:** collection stats and configuration
- [ ] **Properties tab:** lists all properties with types
- [ ] **Raw JSON tab:** complete schema definition
- [ ] **API Equivalent tab:** code examples in Python / JS / cURL
- [ ] **Creation Scripts tab:** Python scripts for recreation

### Data Explorer

- [ ] Interactive table with sorting and pagination
- [ ] Filter builder with 10+ operators and AND/OR logic
- [ ] Vector search modes (Text, Object, Vector, Hybrid)
- [ ] Export to JSON and CSV
- [ ] Virtual scrolling for large datasets
- [ ] Filter presets (save, load, delete)
- [ ] Keyboard shortcuts and preference persistence

### Multi-Vector Search (Muvera)

> Requires Weaviate v1.26+ with a multi-vector collection (e.g. `MultiVectorCollection` seeded by `sandbox/populate_cloud_muvera.py`).

- [ ] Target Vectors drawer shows all named vectors with vectorizer badges
- [ ] Auto-selection: all vectors pre-checked on first open; can be deselected individually
- [ ] **Single-target search:** check exactly one vector → Text Semantic returns results
- [ ] **Multi-target search:** check 2+ vectors → "Join Strategy" enabled → search returns results
- [ ] **Join Strategy: Minimum** (default) — search completes without error
- [ ] **Join Strategy: Sum / Average** — change strategy, re-run; different ordering may appear
- [ ] **Join Strategy: Manual Weights** — Weight Editor appears; adjust sliders, click Normalize, re-run
- [ ] **Join Strategy: Relative Score** — weights by relative score
- [ ] **Run button disabled** when all vectors deselected
- [ ] **Version gate:** on a server < v1.26, the Join Strategy section shows the version warning
- [ ] **Max Distance default** slider starts at `1.00 (no filter)`
- [ ] **Max Distance tightened:** move slider below 1.0 → fewer/no distant results returned
- [ ] **Copy as Code:** TypeScript/Python snippet includes correct `multiTargetVector` combination call
- [ ] **Text (Semantic)** works when collection has a vectorizer; error shown if none configured
- [ ] **Similar Object / Raw Vector** work for `none`-vectorizer collections

### Generative Search

- [ ] Multi-collection selection with pill badges
- [ ] Top-K and timeout controls work
- [ ] Retrieved context with source attribution displays
- [ ] Context objects link to Data Explorer
- [ ] Markdown toggle and copy buttons function

### RBAC

- [ ] Create, edit, delete roles
- [ ] User management with API key rotation
- [ ] Activate / deactivate users
- [ ] Group management

### Advanced Features

- [ ] Multiple query tabs open simultaneously
- [ ] Reference field queries (cross-references) work
- [ ] Complex queries (vector search, filters, aggregations)
- [ ] Export schema
- [ ] Delete collection with confirmation
- [ ] Delete all collections requires double confirmation and updates the tree

### Performance

- [ ] Extension loads within 2-3 seconds
- [ ] Memory usage acceptable (check Activity Monitor)
- [ ] Large datasets (1000+ objects) render smoothly
- [ ] Multiple connections (3+) work simultaneously

### Error Handling

- [ ] Network errors show user-friendly messages
- [ ] Invalid credentials handled gracefully
- [ ] Server-unavailable state works
- [ ] Malformed GraphQL queries show proper errors

### Cross-Platform

- [ ] macOS
- [ ] Windows (if available)
- [ ] Linux (if available)
- [ ] Different VS Code versions (1.85+ and latest)

### Webview Security (CSP / Nonce)

- [ ] No CSP violations in DevTools Console
- [ ] `<script nonce="...">` present in webview HTML (search the Elements panel)
- [ ] Loads correctly in strict environments (e.g., corporate policies)

### Weaviate Compatibility

- [ ] Server supports Collections API (extension lists collections, not legacy classes)
- [ ] GraphQL queries succeed via `/v1/graphql` (with API key when needed)

## Common Issues to Check

### Installation

- **Extension won't install** — check VS Code version compatibility
- **Missing dependencies** — verify all files are included in the package
- **Permission errors** — check file permissions

### Runtime

- **Extension not activating** — check activation events in `package.json`
- **Webview not loading** — check webpack configuration
- **Monaco Editor errors** — verify Monaco webpack plugin setup

### Performance

- **Slow loading** — check bundle size and optimization
- **Memory leaks** — monitor memory usage during extended use
- **UI freezing** — test with large datasets

## Test Results Template

```markdown
## Test Results — [Date]

### ✅ Passed Tests

- Installation: ✅
- Connection Management: ✅
- Query Editor: ✅
- Schema Management: ✅
- Performance: ✅

### ⚠️ Issues Found

- [Issue description]
- [Severity: Low/Medium/High]
- [Steps to reproduce]

### 🔧 Fixes Applied

- [Fix description]
- [Files modified]

### 📝 Notes

- [Additional observations]
- [Performance metrics]
- [User experience feedback]
```

## Pre-Publishing Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Builds succeed: `npm run compile && npm run build:webview && npm run build:add-collection`
- [ ] No console errors in VS Code DevTools
- [ ] Documentation updated (README, CHANGELOG, docs site)
- [ ] Version bumped in `package.json`
- [ ] Git tag created for release

See the [Release Guide](/guide/release) for the full publishing workflow.

## Troubleshooting

### Extension Won't Load

1. Check VS Code Developer Console for errors
2. Verify all dependencies are bundled
3. Check webpack configuration
4. Test in clean VS Code environment

### Webview Won't Load

1. Check `webpack.webview.config.js`
2. Verify Monaco Editor configuration
3. Check browser console for errors
4. Test with different VS Code versions

### Queries Fail

1. Verify Weaviate connection
2. Check GraphQL schema
3. Test with simple queries first
4. Verify API key permissions

---

**Remember:** Thorough testing ensures a smooth user experience and reduces support requests after publishing.
