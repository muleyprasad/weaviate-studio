# Weaviate Data Explorer

A visual data browser for Weaviate collections with advanced filtering, vector search, and export capabilities.

## Features

### Data Browsing

- **Interactive table view** with sortable columns and pagination
- **Configurable page size** (10, 20, 50, or 100 objects per page)
- **Column management** - show, hide, and reorder columns
- **Object detail panel** - view full object details with expandable nested properties
- **Support for all Weaviate data types** - text, numbers, booleans, dates, references, geo-coordinates, phone numbers, and more

### Advanced Filtering

- **Visual filter builder** with 10+ operators (Equal, Not Equal, Contains, Greater Than, Less Than, Like, etc.)
- **AND/OR logic** for combining multiple filter conditions
- **Filter presets** - save, load, and delete frequently used filter combinations
- **Real-time filtering** with instant table updates

### Vector Search

Four search modes to find similar objects:

1. **Text Search** - Natural language semantic search using nearText
2. **Object Search** - Find objects similar to an existing object (click "Find Similar" in object menu)
3. **Vector Search** - Direct vector similarity search by pasting embedding vectors
4. **Hybrid Search** - Combines BM25 keyword search with vector semantic search
   - Alpha slider to balance keyword (0.0) vs semantic (1.0) weighting
   - Score breakdown showing keyword, semantic, and combined scores
   - Property selection for targeted search

### Export

- **Multiple formats** - JSON or CSV
- **Three export scopes**:
  - Current page only (quick samples)
  - Filtered results (export search/filter results)
  - Entire collection (full backup)
- **Export options** - include/exclude metadata, vectors, and flatten nested objects
- **Native VS Code save dialog** integration

### Performance & UX

- **Virtual scrolling** for smooth performance with large datasets (1000+ objects)
- **Keyboard shortcuts** - Ctrl+F (filters), Ctrl+K (vector search), Ctrl+E (export), Ctrl+R (refresh)
- **User preferences persistence** - column visibility, sort order, and panel states saved per collection
- **Loading states** with skeleton screens and progress indicators
- **Error handling** with recovery options and user-friendly messages
- **Accessibility** - ARIA labels, keyboard navigation, and high contrast mode support

## Getting Started

### Open Data Explorer

1. In the Weaviate sidebar, expand your connection
2. Right-click on a collection
3. Select **"Open Data Explorer"** or click the search icon

### Browse Data

- **Navigate**: Scroll through objects in the table view
- **Sort**: Click column headers to sort ascending/descending
- **View details**: Click any row to open the detail panel on the right
- **Manage columns**: Click the "Columns" button to show/hide columns

### Filter Data

1. Press **Ctrl+F** or click the "Filters" button
2. Click "Add Filter" and select a property
3. Choose an operator and enter a value
4. Add more filters and combine with AND/OR logic
5. Click "Apply Filters" to update the table
6. **Save** frequently used filters as presets for quick access

### Vector Search

1. Press **Ctrl+K** or click the "Vector Search" button
2. Choose your search mode:
   - **Text**: Enter a natural language query (e.g., "articles about machine learning")
   - **Hybrid**: Balance keyword and semantic search with the alpha slider
     - Alpha = 0.5: Balanced approach (recommended)
     - Alpha = 0.0: Pure keyword search
     - Alpha = 1.0: Pure semantic search
   - **Object**: Click "Find Similar" from any object's action menu
   - **Vector**: Paste an embedding vector (advanced users)
3. Adjust distance threshold and result limit as needed
4. Click "Search" to view results with similarity scores

### Export Data

1. Press **Ctrl+E** or click the "Export" button
2. Select export scope (current page, filtered results, or all)
3. Choose format (JSON or CSV)
4. Configure options:
   - Include metadata (creation time, update time)
   - Include vectors (not recommended for CSV)
   - Flatten nested objects (CSV only)
5. Click "Export" and choose save location

## Keyboard Shortcuts

| Shortcut        | Action                                |
| --------------- | ------------------------------------- |
| `Ctrl+F`        | Open/close filters panel              |
| `Ctrl+K`        | Open/close vector search panel        |
| `Ctrl+E`        | Open export dialog                    |
| `Ctrl+R`        | Refresh data                          |
| `Escape`        | Close active panel                    |
| `Arrow Up/Down` | Navigate table when detail panel open |

## Tips & Best Practices

### Filtering

- Use **"Contains"** for partial text matches when you don't know the exact value
- Use **"Greater Than"** with date fields to find recent objects
- **Save complex filters** as presets to avoid rebuilding them
- Combine filters with vector search for precision results

### Vector Search

- **Text mode**: Best for natural language queries
- **Hybrid mode**: Best when you need both keyword accuracy and semantic understanding
  - Use **alpha = 0.5** for balanced results (works well for most cases)
  - Use **alpha = 0.0** when you need exact term matches (like product codes)
  - Use **alpha = 1.0** when concepts matter more than exact wording
- **Object mode**: Great for "show me more like this" workflows

### Performance

- Virtual scrolling automatically handles large datasets
- Apply **filters before exporting** large collections to reduce file size
- Use **"Current page"** export for quick samples
- **Hide unused columns** to improve rendering performance

### Export

- **JSON** format better preserves complex nested data structures
- **CSV** format easier to open in Excel/spreadsheets
- **Uncheck "Include vectors"** for CSV exports to avoid giant files
- Use **"Filtered results"** scope after applying filters or vector search

## Troubleshooting

### No results found

- Check if filters are too restrictive - try removing some conditions
- Increase "Max Distance" threshold in vector search settings
- Try hybrid search with a lower alpha value (more keyword-focused)

### Failed to load data

- Verify your Weaviate connection is still active (check sidebar)
- Ensure the collection still exists
- Click "Try Again" or press Ctrl+R to refresh

### Slow performance

- Virtual scrolling should handle large datasets automatically
- If still slow, reduce page size or apply filters to limit results
- Consider hiding columns you don't need

## Limitations

- **Max vector dimensions**: 65,536
- **Recommended export limit**: <100,000 objects per file
- **LocalStorage limit**: ~5MB per collection for preferences (automatic cleanup if exceeded)
- **Network timeout**: Requests timeout after 30 seconds

## Requirements

- **Weaviate**: v1.23 or later
- **Weaviate TypeScript Client**: v3.0 or later
- **VS Code**: 1.80 or later

## Contributing

See the main [Weaviate Studio repository](https://github.com/muleyprasad/weaviate-studio) for development setup and contribution guidelines.

## License

Part of Weaviate Studio - MIT License
