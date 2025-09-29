# 🧪 Testing Guide for Weaviate Studio Extension

This guide helps you validate the extension end‑to‑end before publishing.

## 📦 Pre‑Testing Setup

### 1) Create Test Package
```bash
# Install dependencies (clean)
npm ci

# Package the extension (runs vscode:prepublish scripts)
vsce package

# Verify the VSIX exists (version comes from package.json)
ls -la weaviate-studio-*.vsix
```

Tip: To install the latest packaged file quickly on macOS/Linux:
```bash
code --install-extension "$(ls -t weaviate-studio-*.vsix | head -n1)" --force
```

### 2) Prepare Test Environment
- VS Code: Latest stable (or at least the minimum supported — see Compatibility)
- Weaviate instance: Local or cloud
- Seed data: Sample collections with varied data types

## 🔁 Compatibility

- Minimum VS Code version: see `package.json` → `engines.vscode` (currently `^1.80.0`).
- If you must test older VS Code, use a previous extension version from Releases.
- Verify CSP/nonce handling: ensure no blocked scripts in webview DevTools.

## 🎯 Testing Checklist

### ✅ Installation
- [ ] Install from VSIX: `code --install-extension weaviate-studio-<version>.vsix`
- [ ] **Verify Installation**: Extension appears in Extensions panel
- [ ] **Check Activation**: Weaviate icon appears in Activity Bar
- [ ] **No Console Errors**: Check Developer Tools (Help > Toggle Developer Tools)

### ✅ UI/UX
- [ ] **Activity Bar Icon**: Weaviate icon displays correctly
- [ ] **Tree View**: Connections panel loads without errors
- [ ] **Welcome Message**: "No connections found" message appears
- [ ] **Icons**: All icons display properly (database, add, refresh, etc.)

### ✅ Connection Management
- [ ] **Add Connection**: Click "Add New Weaviate Connection"
- [ ] **Form Validation**: Test with invalid URLs/credentials
- [ ] **Successful Connection**: Connect to a real Weaviate instance
- [ ] **Connection Status**: Shows connected/disconnected state
- [ ] **Edit Connection**: Modify existing connection details
- [ ] **Delete Connection**: Remove connection with confirmation

### ✅ Tree View
- [ ] **Expand/Collapse**: All tree items expand/collapse properly
- [ ] **Connect Prompt on Expand**: Expanding a disconnected connection prompts to connect
- [ ] **Connection Info**: Server info, cluster health display correctly
- [ ] **Collections**: Collections list loads and displays properly
- [ ] **Properties**: Collection properties expand and show details
- [ ] **Statistics**: Live object counts and statistics display

### ✅ Query Editor
- [ ] **Open Query Editor**: Right-click collection → "Query Collection"
- [ ] **Monaco Editor**: GraphQL syntax highlighting works
- [ ] **Auto-completion**: Schema-aware suggestions appear
- [ ] **Query Templates**: All 9 templates load and work
- [ ] **Execute Query**: Run queries and see results
- [ ] **Results Display**: Table view and JSON view work
- [ ] **Error Handling**: Invalid queries show proper errors

### ✅ Schema Management
- [ ] **View Detailed Schema**: Right-click collection → "View Detailed Schema"
- [ ] **Overview Tab**: Shows collection stats and configuration
- [ ] **Properties Tab**: Lists all properties with types
- [ ] **Raw JSON Tab**: Complete schema definition
- [ ] **API Equivalent Tab**: Code examples in Python/JS/cURL
- [ ] **Creation Scripts Tab**: Python scripts for recreation

### ✅ Advanced Features
- [ ] **Multiple Tabs**: Open multiple query tabs
- [ ] **Reference Fields**: Test queries with cross-references
- [ ] **Complex Queries**: Vector search, filters, aggregations
- [ ] **Export Schema**: Export collection schema
- [ ] **Delete Collection**: Remove collections with confirmation
- [ ] **Delete All Collections**: Destructive bulk delete requires double confirmation and updates tree

### ✅ Performance
- [ ] **Load Time**: Extension loads within 2-3 seconds
- [ ] **Memory Usage**: Check memory consumption in Activity Monitor
- [ ] **Large Datasets**: Test with collections having 1000+ objects
- [ ] **Multiple Connections**: Test with 3+ simultaneous connections

### ✅ Error Handling
- [ ] **Network Errors**: Disconnect internet and test error messages
- [ ] **Invalid Credentials**: Test with wrong API keys
- [ ] **Server Down**: Test when Weaviate server is unavailable
- [ ] **Malformed Queries**: Test GraphQL syntax error handling

### ✅ Cross‑Platform
- [ ] **macOS**: Test on macOS (current)
- [ ] **Windows**: Test on Windows if available
- [ ] **Linux**: Test on Linux if available
- [ ] **Different VS Code Versions**: Test on VS Code 1.85+ and latest

### ✅ Webview Security (CSP/Nonce)
- [ ] DevTools Console has no CSP violations
- [ ] `<script nonce="...">` present in webview HTML (search Elements panel)
- [ ] Loading works in strict environments (e.g., corporate policies)

### ✅ Weaviate Compatibility
- [ ] Server supports Collections API (extension lists collections, not legacy classes)
- [ ] GraphQL queries succeed via /v1/graphql (with API key when needed)

## 🐛 Common Issues to Check

### Installation
- **Extension won't install**: Check VS Code version compatibility
- **Missing dependencies**: Verify all files are included in package
- **Permission errors**: Check file permissions

### Runtime
- **Extension not activating**: Check activation events in package.json
- **Webview not loading**: Check webpack configuration
- **Monaco Editor errors**: Verify Monaco webpack plugin setup

### Performance
- **Slow loading**: Check bundle size and optimization
- **Memory leaks**: Monitor memory usage during extended use
- **UI freezing**: Test with large datasets

## 📊 Testing Results Template

```markdown
## Test Results - [Date]

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

## 🚀 Pre‑Publishing Checklist

Before publishing, ensure:
- [ ] Tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Builds are green: `npm run compile && npm run build:webview`
- [ ] No console errors in VS Code DevTools
- [ ] Performance is acceptable (open/execute renders under a few seconds)
- [ ] Documentation updated: README, TESTING_GUIDE, RELEASE_GUIDE
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG updated (Added/Changed/Fixed/Breaking)
- [ ] Screenshots/assets current (if applicable)

## 🆘 Troubleshooting

### If Extension Won't Load
1. Check VS Code Developer Console for errors
2. Verify all dependencies are bundled
3. Check webpack configuration
4. Test in clean VS Code environment

### If Webview Won't Load
1. Check webpack.webview.config.js
2. Verify Monaco Editor configuration
3. Check browser console for errors
4. Test with different VS Code versions

### If Queries Fail
1. Verify Weaviate connection
2. Check GraphQL schema
3. Test with simple queries first
4. Verify API key permissions

---

**Remember**: Thorough testing ensures a smooth user experience and reduces support requests after publishing! 
