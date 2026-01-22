# Data Explorer - Phase 1-3

The Data Explorer provides a zero-code table view for browsing Weaviate collection objects with pagination, column management, smart type rendering, visual filtering, and vector search.

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

### ✅ Implemented in Phase 2

1. **Visual Filter Builder** - Slide-in panel with intuitive filter creation
2. **Filter Operators** - Equal, NotEqual, GreaterThan, LessThan, Like, ContainsAny, ContainsAll, IsNull, IsNotNull
3. **AND/OR Match Mode** - Combine filters with logical operators
4. **Server-side Filtering** - Filters applied via Weaviate queries
5. **Filter Chips** - Quick visibility and removal of active filters
6. **Debounced Input** - Prevents excessive API calls

### ✅ Implemented in Phase 3

1. **Vector Search Panel** - Slide-in panel with three search modes
2. **Text (Semantic) Search** - Natural language queries using configured vectorizer
3. **Similar Object Search** - Find objects similar to a reference UUID
4. **Raw Vector Search** - Paste vector embeddings directly
5. **Search Parameters** - Distance metric, max distance slider, result limit
6. **Match Percentage Display** - Visual match quality indicators
7. **Find Similar Actions** - Quick action buttons in table rows and detail panel
8. **Result Cards** - Rich result display with rank, distance, and actions

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

### Testing Phase 3 - Vector Search

1. **Open Vector Search Panel:**

   - Click "Vector Search" button in the header toolbar
   - Panel slides in from the right

2. **Test Text (Semantic) Search:**

   - Select "Text (Semantic)" mode tab
   - Enter a natural language query (e.g., "machine learning healthcare")
   - Adjust max distance and result limit
   - Click "Run Vector Search"
   - View results with match percentages

3. **Test Similar Object Search:**

   - Select "Similar Object" mode tab
   - Paste a UUID or use "Find Similar" from:
     - Table row action buttons (🔍 icon)
     - Detail panel "Find Similar" button
   - Click "Run Vector Search"
   - View objects similar to the reference

4. **Test Raw Vector Search:**

   - Select "Raw Vector" mode tab
   - Paste a JSON array of numbers (e.g., `[0.1, -0.2, 0.3, ...]`)
   - Validation shows dimension count
   - Click "Run Vector Search"

5. **Test Search Results:**

   - Click "View" to open object in detail panel
   - Click "Find Similar" to chain searches
   - Observe match percentage color coding:
     - Green (90%+): Excellent match
     - Blue (75%+): Good match
     - Yellow (50%+): Moderate match
     - Gray (<50%): Low match

6. **Test Edge Cases:**
   - Collection without vectorizer → Warning message
   - Invalid vector format → Validation error
   - Empty results → Empty state message

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
- [ ] Test vector search with text query
- [ ] Test "Find Similar" from table rows
- [ ] Test "Find Similar" from detail panel
- [ ] Test raw vector input validation
- [ ] Test chained "Find Similar" searches

## Known Limitations

1. **No server-side sorting** - Sorting is client-side, so it only sorts the current page
2. **No hybrid search** - Will be added in Phase 4
3. **No export** - Will be added in Phase 5
4. **Column widths are not persisted** - Resizing is not implemented yet
5. **No column reordering** - Drag and drop will be added later
6. **Single vector support** - Named vectors not fully supported yet

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
│   │   ├── FilterBuilder/
│   │   │   ├── FilterPanel.tsx   # Filter builder panel
│   │   │   ├── FilterRule.tsx    # Single filter rule
│   │   │   ├── FilterChips.tsx   # Active filter chips
│   │   │   └── ValueInput.tsx    # Type-aware value inputs
│   │   ├── VectorSearch/         # Phase 3
│   │   │   ├── VectorSearchPanel.tsx  # Main search panel
│   │   │   ├── SearchModeSelector.tsx # Mode tabs
│   │   │   ├── TextSearchInput.tsx    # Text mode UI
│   │   │   ├── ObjectSearchInput.tsx  # Object mode UI
│   │   │   ├── VectorInput.tsx        # Vector mode UI
│   │   │   ├── SearchResults.tsx      # Results container
│   │   │   └── ResultCard.tsx         # Result display
│   │   └── ObjectDetail/
│   │       ├── DetailPanel.tsx   # Slide-out panel
│   │       └── PropertyView.tsx  # Property display
│   ├── context/
│   │   ├── DataContext.tsx       # Data fetching & objects state
│   │   ├── UIContext.tsx         # UI state (columns, pagination, selection)
│   │   ├── FilterContext.tsx     # Filter state (Phase 2)
│   │   ├── VectorSearchContext.tsx # Vector search state (Phase 3)
│   │   └── index.ts              # Context exports
│   ├── hooks/
│   │   ├── useDataFetch.ts       # Fetch objects hook
│   │   ├── usePagination.ts      # Pagination logic
│   │   └── useVectorSearch.ts    # Vector search hook (Phase 3)
│   └── utils/
│       └── typeRenderers.ts      # Type formatting helpers
└── types/
    └── index.ts                  # TypeScript interfaces
```

## Architecture Notes

### State Management

- Uses React Context + useReducer pattern with **four separate contexts**:
  - **DataContext** - Data fetching & objects (schema, objects, loading, error)
  - **UIContext** - UI state (columns, pagination, sorting, selection, panels)
  - **FilterContext** - Filter state (activeFilters, pendingFilters, matchMode)
  - **VectorSearchContext** - Vector search state (mode, params, results)
- No external state libraries required
- Split contexts prevent unnecessary re-renders for better performance
- **Pending/Active filter pattern**: UI edits update pending state, only Apply triggers API calls

### Message Passing

- Extension → Webview: `postMessage({ command: 'objectsLoaded', objects, total })`
- Webview → Extension: `vscode.postMessage({ command: 'fetchObjects', limit, offset, where, matchMode, vectorSearch })`

### Vector Search Integration

The vector search feature integrates with the existing data fetching infrastructure:

1. **VectorSearchContext** manages search panel state (mode, params, results)
2. **useVectorSearch** hook handles search execution and result processing
3. **DataExplorerAPI** supports three query modes:
   - `nearText` - Semantic text search
   - `nearVector` - Raw vector similarity
   - Standard `fetchObjects` with optional `nearObject`

### Performance Considerations

- Pagination limits data fetched per page (max 100)
- Skeleton loading prevents layout shifts
- Client-side sorting avoids API calls for small datasets
- Debounced page changes prevent rapid API calls
- **Debounced filter inputs** (300ms) prevent excessive re-renders
- **Efficient aggregate counting** with filters for total count
- **Request cancellation** prevents stale responses
- **Filters cleared on collection switch** prevents invalid queries
- **Vector search results cached** to prevent redundant queries
