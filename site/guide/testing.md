# Testing Guide

This guide covers testing the Weaviate Studio extension end-to-end before publishing.

## Pre-Testing Setup

### Create Test Package

```bash
# Clean install and package
npm ci
vsce package

# Verify the VSIX exists
ls -la weaviate-studio-*.vsix
```

Quick install on macOS/Linux:

```bash
code --install-extension "$(ls -t weaviate-studio-*.vsix | head -n1)" --force
```

## Compatibility

- Minimum VS Code version: `^1.80.0` (see `package.json` → `engines.vscode`)
- Weaviate server must support the Collections API
- Verify CSP/nonce handling: no blocked scripts in webview DevTools

## Testing Checklist

### Installation

- [ ] Install from VSIX: `code --install-extension weaviate-studio-<version>.vsix`
- [ ] Extension appears in Extensions panel
- [ ] Weaviate icon appears in Activity Bar
- [ ] No console errors in Developer Tools

### Connection Management

- [ ] Add connection with valid credentials
- [ ] Form validation rejects invalid URLs
- [ ] Connection status shows connected/disconnected
- [ ] Edit and delete connections work correctly

### Query Editor

- [ ] Monaco Editor loads with GraphQL syntax highlighting
- [ ] Schema-aware autocompletion works
- [ ] All templates load and execute
- [ ] Table and JSON views render results
- [ ] Error handling for invalid queries

### Data Explorer

- [ ] Interactive table with sorting and pagination
- [ ] Filter builder with all operators
- [ ] Vector search modes (Text, Object, Vector, Hybrid)
- [ ] Export to JSON and CSV
- [ ] Virtual scrolling for large datasets

### Multi-Vector Search (Muvera)

> Requires Weaviate v1.26+ with a multi-vector collection

- [ ] Target Vectors drawer shows all named vectors
- [ ] Auto-selection on first open
- [ ] Join strategies (Minimum, Sum, Average, Manual Weights, Relative Score)
- [ ] Weight Editor with Normalize button
- [ ] Run button disabled when no vectors checked
- [ ] Copy as Code includes `multiTargetVector` combination

### Generative Search

- [ ] Multi-collection selection with pill badges
- [ ] Top-K and timeout controls work
- [ ] Retrieved context with source attribution
- [ ] Context objects link to Data Explorer
- [ ] Markdown toggle and copy buttons

### RBAC

- [ ] Create, edit, delete roles
- [ ] User management with API key rotation
- [ ] Activate/deactivate users
- [ ] Group management

### Performance

- [ ] Extension loads within 2-3 seconds
- [ ] Large datasets (1000+ objects) render smoothly
- [ ] Multiple connections (3+) work simultaneously

### Error Handling

- [ ] Network errors show user-friendly messages
- [ ] Invalid credentials handled gracefully
- [ ] Server unavailable state works
- [ ] Malformed queries show proper errors

## Pre-Publishing Checklist

- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Builds succeed: `npm run compile && npm run build:webview && npm run build:add-collection`
- [ ] No console errors in VS Code DevTools
- [ ] Documentation updated (README, CHANGELOG, docs site)
- [ ] Version bumped in `package.json`
- [ ] Git tag created for release
