# Data Explorer - Phase 1

The Data Explorer provides a zero-code table view for browsing Weaviate collection objects with pagination, column management, and smart type rendering.

## Features

### ✅ Implemented in Phase 1

1. **Automatic Data Loading** - Objects load automatically when opening the Data Explorer
2. **Pagination Controls** - Navigate through pages with 10/20/50/100 items per page
3. **Smart Type Rendering** - Type-specific cell formatting:
   - Text: Truncated at 100 chars with tooltip for full text
   - Numbers: Right-aligned, formatted with commas
   - Booleans: ✓ (green) or ✗ (red) icons
   - Dates: Relative time ("2 hours ago"), absolute on hover
   - UUIDs: Shortened format with copy button
   - GeoCoordinates: "📍 lat, lng" format
   - Objects: "{3 properties}" badge with expand
   - Arrays: "[5 items]" badge with expand
   - Vectors: "🔢 [768 dims]" badge (full view in detail panel)
4. **Column Management** - Show/hide columns, pin columns to left
5. **Row Selection** - Checkboxes for selecting rows
6. **Detail Panel** - Slide-out panel showing full object data
7. **Loading States** - Skeleton loading during fetch
8. **Error Handling** - Error banner with retry button
9. **Empty States** - Helpful guidance when collection is empty
10. **Client-side Sorting** - Sort by clicking column headers

## How to Test

### Prerequisites

1. Make sure you have a Weaviate instance running with some data
2. Connect to the instance in Weaviate Studio

### Testing the Feature

1. **Build the webview bundle:**

   ```bash
   npm run build:webview
   ```

2. **Open VS Code with the extension:**

   ```bash
   code --extensionDevelopmentPath=/path/to/weaviate-studio
   ```

   Or press F5 in VS Code to launch the extension development host.

3. **Open Data Explorer:**

   - Connect to a Weaviate instance
   - Expand the Collections node
   - Right-click on a collection → "Open Data Explorer"
   - Or click the search icon (🔍) next to the collection name

4. **Test pagination:**

   - Change page size using the dropdown (10/20/50/100)
   - Navigate using Previous/Next buttons
   - Click page numbers directly

5. **Test column management:**

   - Click "⚙️ Columns" button in the toolbar
   - Toggle column visibility
   - Pin/unpin columns
   - Search for columns

6. **Test row selection:**

   - Click checkboxes to select individual rows
   - Use the header checkbox to select all
   - View selection count in toolbar

7. **Test detail panel:**

   - Click on any row to open the detail panel
   - View all properties with type-specific formatting
   - Copy UUID using the copy button
   - Press Escape or click outside to close

8. **Test sorting:**
   - Click on column headers to sort
   - Click again to toggle ascending/descending
   - Click a third time to clear sort

### Testing Checklist

- [ ] Test with empty collection
- [ ] Test with 1 object
- [ ] Test with 1000+ objects
- [ ] Test with all property types
- [ ] Test with deeply nested objects (5+ levels)
- [ ] Test with very long text fields (10,000+ chars)
- [ ] Test with disconnected Weaviate instance
- [ ] Test rapid page switching (debounce check)
- [ ] Test detail panel with all data types
- [ ] Test keyboard navigation (Arrow keys, Enter, Escape, Space)

## Known Limitations

1. **No server-side sorting** - Sorting is client-side, so it only sorts the current page
2. **No filtering** - Will be added in Phase 2
3. **No vector search** - Will be added in Phase 3
4. **No export** - Will be added in Phase 5
5. **Column widths are not persisted** - Resizing is not implemented yet
6. **No column reordering** - Drag and drop will be added later

## File Structure

```
src/data-explorer/
├── extension/
│   ├── DataExplorerPanel.ts      # VS Code webview panel controller
│   └── DataExplorerAPI.ts        # Weaviate API wrapper
├── webview/
│   ├── DataExplorer.tsx          # Root React component
│   ├── index.tsx                 # Webview entry point
│   ├── styles.css                # Component styles
│   ├── data-explorer.html        # HTML template
│   ├── components/
│   │   ├── DataBrowser/
│   │   │   ├── DataTable.tsx     # Main table component
│   │   │   ├── TableHeader.tsx   # Column headers with sort
│   │   │   ├── TableRow.tsx      # Individual row
│   │   │   ├── CellRenderer.tsx  # Type-specific cells
│   │   │   ├── ColumnManager.tsx # Show/hide columns dialog
│   │   │   └── Pagination.tsx    # Page controls
│   │   └── ObjectDetail/
│   │       ├── DetailPanel.tsx   # Slide-out panel
│   │       └── PropertyView.tsx  # Property display
│   ├── context/
│   │   ├── DataContext.tsx       # Data fetching & objects state
│   │   ├── UIContext.tsx         # UI state (columns, pagination, selection)
│   │   ├── FilterContext.tsx     # Filter state (Phase 2)
│   │   └── index.ts              # Context exports
│   ├── hooks/
│   │   ├── useDataFetch.ts       # Fetch objects hook
│   │   └── usePagination.ts      # Pagination logic
│   └── utils/
│       └── typeRenderers.ts      # Type formatting helpers
└── types/
    └── index.ts                  # TypeScript interfaces
```

## Next Steps for Phase 2 (Filtering)

1. Add FilterBuilder component
2. Implement filter operators (equals, contains, greater than, etc.)
3. Add filter persistence in URL/state
4. Server-side filtering via Weaviate queries
5. Filter presets/saved filters

## Architecture Notes

### State Management

- Uses React Context + useReducer pattern with **three separate contexts**:
  - **DataContext** - Data fetching & objects (schema, objects, loading, error)
  - **UIContext** - UI state (columns, pagination, sorting, selection, panels)
  - **FilterContext** - Filter state (for Phase 2 filtering)
- No external state libraries required
- Split contexts prevent unnecessary re-renders for better performance

### Message Passing

- Extension → Webview: `postMessage({ command: 'objectsLoaded', objects, total })`
- Webview → Extension: `vscode.postMessage({ command: 'fetchObjects', limit, offset })`

### Performance Considerations

- Pagination limits data fetched per page (max 100)
- Skeleton loading prevents layout shifts
- Client-side sorting avoids API calls for small datasets
- Debounced page changes prevent rapid API calls
