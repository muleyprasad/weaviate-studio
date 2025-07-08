# 🧪 Testing Guide for Weaviate Studio Extension

This guide helps you thoroughly test the packaged extension before publishing to ensure everything works correctly.

## 📦 **Pre-Testing Setup**

### **1. Create Test Package**
```bash
# Build optimized package
vsce package

# Verify package was created
ls -la weaviate-studio-1.0.0.vsix
```

### **2. Prepare Test Environment**
- **VS Code**: Latest stable version
- **Weaviate Instance**: Local or cloud instance for testing
- **Test Data**: Sample collections with various data types

## 🎯 **Testing Checklist**

### **✅ Installation Testing**
- [ ] **Install Extension**: `code --install-extension weaviate-studio-1.0.0.vsix`
- [ ] **Verify Installation**: Extension appears in Extensions panel
- [ ] **Check Activation**: Weaviate icon appears in Activity Bar
- [ ] **No Console Errors**: Check Developer Tools (Help > Toggle Developer Tools)

### **✅ UI/UX Testing**
- [ ] **Activity Bar Icon**: Weaviate icon displays correctly
- [ ] **Tree View**: Connections panel loads without errors
- [ ] **Welcome Message**: "No connections found" message appears
- [ ] **Icons**: All icons display properly (database, add, refresh, etc.)

### **✅ Connection Management**
- [ ] **Add Connection**: Click "Add New Weaviate Connection"
- [ ] **Form Validation**: Test with invalid URLs/credentials
- [ ] **Successful Connection**: Connect to a real Weaviate instance
- [ ] **Connection Status**: Shows connected/disconnected state
- [ ] **Edit Connection**: Modify existing connection details
- [ ] **Delete Connection**: Remove connection with confirmation

### **✅ Tree View Functionality**
- [ ] **Expand/Collapse**: All tree items expand/collapse properly
- [ ] **Auto-Connect**: Clicking connection auto-connects if disconnected
- [ ] **Connection Info**: Server info, cluster health display correctly
- [ ] **Collections**: Collections list loads and displays properly
- [ ] **Properties**: Collection properties expand and show details
- [ ] **Statistics**: Live object counts and statistics display

### **✅ Query Editor Testing**
- [ ] **Open Query Editor**: Right-click collection → "Query Collection"
- [ ] **Monaco Editor**: GraphQL syntax highlighting works
- [ ] **Auto-completion**: Schema-aware suggestions appear
- [ ] **Query Templates**: All 9 templates load and work
- [ ] **Execute Query**: Run queries and see results
- [ ] **Results Display**: Table view and JSON view work
- [ ] **Error Handling**: Invalid queries show proper errors

### **✅ Schema Management**
- [ ] **View Detailed Schema**: Right-click collection → "View Detailed Schema"
- [ ] **Overview Tab**: Shows collection stats and configuration
- [ ] **Properties Tab**: Lists all properties with types
- [ ] **Raw JSON Tab**: Complete schema definition
- [ ] **API Equivalent Tab**: Code examples in Python/JS/cURL
- [ ] **Creation Scripts Tab**: Python scripts for recreation

### **✅ Advanced Features**
- [ ] **Multiple Tabs**: Open multiple query tabs
- [ ] **Reference Fields**: Test queries with cross-references
- [ ] **Complex Queries**: Vector search, filters, aggregations
- [ ] **Export Schema**: Export collection schema
- [ ] **Delete Collection**: Remove collections with confirmation

### **✅ Performance Testing**
- [ ] **Load Time**: Extension loads within 2-3 seconds
- [ ] **Memory Usage**: Check memory consumption in Activity Monitor
- [ ] **Large Datasets**: Test with collections having 1000+ objects
- [ ] **Multiple Connections**: Test with 3+ simultaneous connections

### **✅ Error Handling**
- [ ] **Network Errors**: Disconnect internet and test error messages
- [ ] **Invalid Credentials**: Test with wrong API keys
- [ ] **Server Down**: Test when Weaviate server is unavailable
- [ ] **Malformed Queries**: Test GraphQL syntax error handling

### **✅ Cross-Platform Testing**
- [ ] **macOS**: Test on macOS (current)
- [ ] **Windows**: Test on Windows if available
- [ ] **Linux**: Test on Linux if available
- [ ] **Different VS Code Versions**: Test on VS Code 1.85+ and latest

## 🐛 **Common Issues to Check**

### **Installation Issues**
- **Extension won't install**: Check VS Code version compatibility
- **Missing dependencies**: Verify all files are included in package
- **Permission errors**: Check file permissions

### **Runtime Issues**
- **Extension not activating**: Check activation events in package.json
- **Webview not loading**: Check webpack configuration
- **Monaco Editor errors**: Verify Monaco webpack plugin setup

### **Performance Issues**
- **Slow loading**: Check bundle size and optimization
- **Memory leaks**: Monitor memory usage during extended use
- **UI freezing**: Test with large datasets

## 📊 **Testing Results Template**

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

## 🚀 **Pre-Publishing Checklist**

Before publishing, ensure:
- [ ] All tests pass
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Documentation is up-to-date
- [ ] Version number is correct
- [ ] CHANGELOG is updated
- [ ] README is current

## 🆘 **Troubleshooting**

### **If Extension Won't Load**
1. Check VS Code Developer Console for errors
2. Verify all dependencies are bundled
3. Check webpack configuration
4. Test in clean VS Code environment

### **If Webview Won't Load**
1. Check webpack.webview.config.js
2. Verify Monaco Editor configuration
3. Check browser console for errors
4. Test with different VS Code versions

### **If Queries Fail**
1. Verify Weaviate connection
2. Check GraphQL schema
3. Test with simple queries first
4. Verify API key permissions

---

**Remember**: Thorough testing ensures a smooth user experience and reduces support requests after publishing! 