# Weaviate Data Explorer - Product Specification

**Version:** 1.0
**Status:** Draft
**Created:** 2026-01-16
**Target:** Weaviate Studio v2.0

---

## 1. Executive Summary

### Problem Statement
Weaviate Studio's current GraphQL-based query interface, while powerful, creates barriers for simple data exploration tasks:
- **Steep learning curve**: Users must learn GraphQL syntax and Weaviate's specific query structure
- **Not intuitive for browsing**: Simple tasks like "show me 100 objects" require writing queries
- **Overkill for common tasks**: Filtering, sorting, and pagination shouldn't require code
- **Future risk**: Weaviate may move away from REST/GraphQL, making current interface obsolete

### Solution Overview
A **visual Data Explorer** inspired by MongoDB Compass that provides:
- **Zero-code data browsing** with visual controls
- **Point-and-click filtering** with a visual query builder
- **Integrated vector search UI** with semantic similarity features
- **Rich data visualization** with smart type detection
- **Quick insights** without writing queries
- **Progressive disclosure**: Simple by default, powerful when needed

### Success Metrics
- 90% of data exploration tasks completable without GraphQL
- Time to first data view: <5 seconds (vs current ~30s to write query)
- User can filter and sort data without documentation
- Support for all Weaviate search types (vector, hybrid, keyword, filter)

---

## 2. Core Features

### 2.1 Data Browser (Foundation)

#### Purpose
Browse collection objects like browsing files in a folder - immediate, visual, no queries required.

#### UI Components

**Main Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Collection: Articles                        [100 objects]   │
├─────────────────────────────────────────────────────────────┤
│ [🔍 Quick Search] [⚡ Vector Search] [🎯 Filters (2)]      │
│ [+ Add Filter] [🔄 Refresh] [⚙️ View Options] [📤 Export]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ TABLE VIEW                                              │ │
│ │ ☑ | _id (uuid)    | title           | category | ...   │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ ☐ | abc-123...    | AI Advances     | Tech     | ...   │ │
│ │ ☐ | def-456...    | Climate Change  | Science  | ...   │ │
│ │ ☐ | ghi-789...    | Market Trends   | Business | ...   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [< Previous] Page 1 of 45 [Next >]    [10 ▾] per page      │
└─────────────────────────────────────────────────────────────┘
```

**Features:**

1. **Automatic Data Loading**
   - On collection select, immediately load first 20 objects
   - No query writing required
   - Smart defaults: all properties, sorted by _creationTimeUnix desc

2. **Column Management**
   - Show/hide columns via checkboxes
   - Drag-to-reorder columns
   - Pin important columns to left
   - Auto-resize based on content
   - Save column preferences per collection

3. **Smart Type Display**
   - **text/string**: Full text with ellipsis (hover for full)
   - **number**: Right-aligned with formatting
   - **boolean**: ✓/✗ icons
   - **date**: Relative time (e.g., "2 hours ago") + absolute on hover
   - **geoCoordinates**: Map pin icon (click to show mini-map)
   - **phoneNumber**: Formatted display
   - **uuid**: Shortened (abc-123...) with copy button
   - **blob**: File type icon + size
   - **object**: {3 fields} (click to expand inline)
   - **array**: [5 items] (click to expand inline)
   - **vector**: 🔢 [768 dims] (click to visualize dimensions)

4. **Pagination**
   - Client-side pagination for fast browsing
   - Configurable page size: 10, 20, 50, 100, 500
   - Virtual scrolling for large result sets
   - Total count indicator
   - Jump to page input

5. **Row Actions**
   - Checkbox selection (single/multiple)
   - Click row to open detail panel
   - Right-click context menu:
     - View Full Object
     - Find Similar (vector search)
     - Copy UUID
     - Copy as JSON
     - Delete Object (with confirmation)

#### Implementation Details

**API Calls:**
```typescript
// Use weaviate-client collections API
const collection = client.collections.get('Articles')

// Fetch with pagination
const result = await collection.query.fetchObjects({
  limit: 20,
  offset: 0,
  // Include all properties by default
  returnProperties: allProperties,
  // Sort by creation time
  sort: { path: '_creationTimeUnix', order: 'desc' }
})
```

**State Management:**
```typescript
interface DataBrowserState {
  collectionName: string
  objects: WeaviateObject[]
  totalCount: number
  currentPage: number
  pageSize: number
  visibleColumns: string[]
  pinnedColumns: string[]
  sortBy: { field: string, direction: 'asc' | 'desc' }
  selectedRows: string[] // UUIDs
  loading: boolean
}
```

**Performance Considerations:**
- Fetch only visible data (no over-fetching)
- Cache recent pages in memory
- Debounce rapid page changes
- Show loading skeleton during fetches
- Cancel pending requests on navigation

---

### 2.2 Visual Filter Builder

#### Purpose
Build complex filters without GraphQL using a point-and-click interface.

#### UI Components

**Filter Panel:**
```
┌─────────────────────────────────────────────────────┐
│ Filters: Match ALL ▾ of the following               │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ category      [equals ▾]      [Tech        ▾]  │ │
│ │                                        [× Remove] │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ publishedDate [after ▾]       [2025-01-01]     │ │
│ │                                        [× Remove] │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ [+ Add Filter]                                       │
│                                                      │
│ [Clear All] [Apply Filters]                         │
└─────────────────────────────────────────────────────┘
```

**Filter Types by Property Type:**

| Property Type | Available Operators | Input Type |
|---------------|---------------------|------------|
| text/string | equals, not equals, contains, starts with, ends with, in, not in | Text input or multi-select |
| number/int | equals, not equals, greater than, less than, between, in range | Number input or range slider |
| boolean | is true, is false | Toggle |
| date | equals, before, after, between, in last X days | Date picker |
| geoCoordinates | within distance of, within polygon | Map picker + distance input |
| uuid | equals, in list | UUID input (paste multiple) |
| null check | is null, is not null | N/A |
| array | contains, not contains, length equals, length greater than | Based on array item type |

**Advanced Features:**

1. **Nested Filters (AND/OR/NOT)**
   ```
   ┌─────────────────────────────────────────┐
   │ Match ALL ▾ of the following             │
   │ ┌─────────────────────────────────────┐ │
   │ │ category = Tech                     │ │
   │ └─────────────────────────────────────┘ │
   │ ┌─────────────────────────────────────┐ │
   │ │ Match ANY ▾ of the following        │ │
   │ │ ├─ views > 1000                     │ │
   │ │ └─ featured = true                  │ │
   │ └─────────────────────────────────────┘ │
   │ [+ Add Filter Group]                     │
   └─────────────────────────────────────────┘
   ```

2. **Filter Templates**
   - Save commonly used filters
   - Quick filters: "Published Today", "High Engagement", "Unprocessed"
   - Per-collection saved filters
   - Share filters as JSON

3. **Smart Suggestions**
   - Show distinct values for low-cardinality fields
   - Suggest recent filter values
   - Auto-complete for text fields
   - Range suggestions based on min/max

#### Implementation Details

**Filter State:**
```typescript
interface Filter {
  id: string
  property: string
  operator: FilterOperator
  value: any
  type: 'simple' | 'group'
  combineOperator?: 'AND' | 'OR' | 'NOT'
  children?: Filter[] // For nested groups
}

type FilterOperator =
  | 'equals' | 'notEquals'
  | 'greaterThan' | 'lessThan' | 'greaterThanEqual' | 'lessThanEqual'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'in' | 'notIn'
  | 'isNull' | 'isNotNull'
  | 'withinDistance' | 'withinPolygon'
  | 'between'
```

**Translation to Weaviate API:**
```typescript
function buildWhereFilter(filters: Filter[]): WhereFilter {
  return {
    operator: 'And',
    operands: filters.map(f => ({
      path: [f.property],
      operator: mapOperator(f.operator),
      valueText: f.value // or valueInt, valueBoolean, etc.
    }))
  }
}

// Use with query
await collection.query.fetchObjects({
  where: buildWhereFilter(activeFilters),
  limit: pageSize,
  offset: currentPage * pageSize
})
```

---

### 2.3 Vector Search Panel

#### Purpose
Make vector similarity search accessible without understanding vector math or GraphQL syntax.

#### UI Components

**Search Panel:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔮 Vector Search                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Search by:  ○ Text (Semantic)  ● Similar Object  ○ Vector  │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ SELECT REFERENCE OBJECT                                  ││
│ │                                                          ││
│ │ Object ID: abc-123-def-456                              ││
│ │ [Browse Objects...]                                      ││
│ │                                                          ││
│ │ Preview: "AI Advances in Healthcare"                    ││
│ │ Category: Technology | Published: 2025-12-15            ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Distance Metric: ○ Cosine  ● Euclidean  ○ Manhattan        │
│                                                              │
│ Max Distance: [0.5        ] (0 = identical, 2 = very diff) │
│               ├──────────────────────┤                      │
│               0.0                  2.0                       │
│                                                              │
│ Limit Results: [10 ▾]                                       │
│                                                              │
│ [🔍 Find Similar Objects]                                   │
└─────────────────────────────────────────────────────────────┘
```

**Three Search Modes:**

1. **Text (Semantic Search)**
   ```
   ┌──────────────────────────────────────┐
   │ Enter search text:                   │
   │ ┌────────────────────────────────────┤
   │ │ artificial intelligence healthcare │
   │ └────────────────────────────────────┤
   │                                      │
   │ Vectorizer: text2vec-openai         │
   │ (configured for this collection)     │
   │                                      │
   │ [🔍 Search]                          │
   └──────────────────────────────────────┘
   ```

2. **Similar Object (nearObject)**
   - Object picker with search
   - Preview of selected object
   - "Find More Like This" quick action from data browser

3. **Raw Vector Input**
   ```
   ┌────────────────────────────────────────┐
   │ Paste vector (768 dimensions):        │
   │ ┌──────────────────────────────────────┤
   │ │ [0.123, -0.456, 0.789, ...]        │
   │ └──────────────────────────────────────┤
   │                                        │
   │ Dimensions: 768 / 768 ✓               │
   │ [🔍 Search]                            │
   └────────────────────────────────────────┘
   ```

**Result Display:**
```
┌─────────────────────────────────────────────────────────┐
│ Found 8 similar objects                                  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 95% Match ████████████████████░░                    │ │
│ │ Title: "Machine Learning in Medical Diagnosis"      │ │
│ │ Distance: 0.05 | UUID: xyz-789                      │ │
│ │ Category: Technology | Published: 2025-11-20        │ │
│ │ [View Object] [Find Similar to This]                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 87% Match ████████████████░░░░░                     │ │
│ │ Title: "Deep Learning Applications"                 │ │
│ │ Distance: 0.13 | UUID: uvw-456                      │ │
│ │ [View Object] [Find Similar to This]                │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Advanced Options (Collapsible):**
- Combine with filters (hybrid search)
- Multiple vector support (if collection has multiple vectors)
- Certainty vs Distance toggle
- Group by configuration

#### Implementation Details

```typescript
// Semantic Search
await collection.query.nearText(
  searchText,
  {
    limit: 10,
    distance: 0.5,
    returnMetadata: ['distance', 'certainty']
  }
)

// Similar Object
await collection.query.nearObject(
  objectId,
  {
    limit: 10,
    distance: 0.5
  }
)

// Raw Vector
await collection.query.nearVector(
  vectorArray,
  {
    limit: 10,
    distance: 0.5
  }
)
```

---

### 2.4 Hybrid Search Interface

#### Purpose
Combine keyword (BM25) and vector search in a single, intuitive interface.

#### UI Components

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Hybrid Search (Keyword + Semantic)                        │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Search Query: [climate change policy               ]  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Search Strategy:                                             │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ Keyword Weight (BM25)      Semantic Weight (Vector) │    │
│ │                                                      │    │
│ │        ○                                    ●        │    │
│ │        ├────────────────────────────────────┤        │    │
│ │        0%                50%              100%       │    │
│ │                                                      │    │
│ │        Alpha: 0.75                                   │    │
│ │        (75% semantic, 25% keyword)                   │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ☑ Enable query rewriting (improve semantic understanding)   │
│                                                              │
│ Search in properties: [All ▾]                               │
│   ☑ title  ☑ content  ☐ summary  ☐ tags                    │
│                                                              │
│ [🔍 Search]  [Reset]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Result Explanation:**
```
┌─────────────────────────────────────────────────────────┐
│ Result #1                                       Score: 0.89│
│                                                          │
│ Title: "Global Climate Policy Changes"                  │
│ ─────────────────────────────────────────────────────── │
│ Match Breakdown:                                         │
│ • Keyword (BM25):  ████████░░  0.82                     │
│ • Semantic:        █████████░  0.91                     │
│ • Combined:        █████████░  0.89                     │
│                                                          │
│ Matched terms: climate(title), policy(title, content)   │
│ [View Object]                                            │
└─────────────────────────────────────────────────────────┘
```

#### Implementation Details

```typescript
await collection.query.hybrid(
  query,
  {
    alpha: 0.75, // Slider value
    limit: 20,
    returnMetadata: ['score', 'explainScore']
  }
)
```

---

### 2.5 Quick Aggregations Panel

#### Purpose
Get instant insights without writing aggregate queries.

#### UI Components

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Collection Insights: Articles                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Total Objects: 12,457                                   │
│                                                          │
│ ┌──────────────────┐  ┌──────────────────┐             │
│ │ Category         │  │ Status           │             │
│ │ ──────────────── │  │ ──────────────── │             │
│ │ Tech: 4,231 (34%)│  │ Published: 8,234 │             │
│ │ Science: 3,127   │  │ Draft: 3,108     │             │
│ │ Business: 2,845  │  │ Archived: 1,115  │             │
│ │ Health: 2,254    │  │                  │             │
│ └──────────────────┘  └──────────────────┘             │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Views (numeric stats)                               │ │
│ │ ───────────────────────────────────────────────────│ │
│ │ Count: 12,457  │  Min: 0       │  Max: 145,823    │ │
│ │ Mean: 2,341    │  Median: 892  │  Mode: 0         │ │
│ │                                                     │ │
│ │ Distribution:                                       │ │
│ │ 0-1k:    ████████████████  8,234 (66%)            │ │
│ │ 1k-10k:  ████████░░░░░░░░  3,127 (25%)            │ │
│ │ 10k+:    ███░░░░░░░░░░░░░  1,096 (9%)             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Published Date Range: 2023-01-15 to 2026-01-16         │
│                                                          │
│ [Refresh] [Configure Metrics]                           │
└─────────────────────────────────────────────────────────┘
```

**Configuration:**
- Choose which properties to analyze
- Set custom buckets for numeric ranges
- Save preferred metrics per collection
- Auto-refresh options

#### Implementation Details

```typescript
// Use aggregate API
const aggregates = await collection.aggregate.overAll({
  returnMetrics: [
    // For text/categorical
    aggregate.metrics.topOccurrences({ topOccurrencesProperties: ['category'] }),

    // For numeric
    aggregate.metrics.sum({ sum: 'views' }),
    aggregate.metrics.minimum({ minimum: 'views' }),
    aggregate.metrics.maximum({ maximum: 'views' }),
    aggregate.metrics.mean({ mean: 'views' }),
    aggregate.metrics.mode({ mode: 'views' }),
    aggregate.metrics.median({ median: 'views' })
  ]
})
```

---

### 2.6 Object Detail Panel

#### Purpose
Rich, read-only view of a single object with all metadata and relationships.

#### UI Components

**Slide-out Panel (Right Side):**
```
┌─────────────────────────────────────────────────────────┐
│ Object Details                                    [✕]   │
├─────────────────────────────────────────────────────────┤
│ UUID: abc-123-def-456-ghi-789                          │
│ [Copy UUID] [Find Similar] [Delete]                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Properties] [Metadata] [Vectors] [References] [JSON]  │
│                                                          │
│ ┌ Properties ──────────────────────────────────────┐   │
│ │                                                   │   │
│ │ title                                            │   │
│ │ "Advances in Artificial Intelligence"           │   │
│ │                                                   │   │
│ │ content                                          │   │
│ │ "Recent developments in AI have shown..." [more]│   │
│ │                                                   │   │
│ │ category                                         │   │
│ │ Technology                                       │   │
│ │                                                   │   │
│ │ publishedDate                                    │   │
│ │ 2025-12-15T10:30:00Z (3 weeks ago)              │   │
│ │                                                   │   │
│ │ author (nested object)                           │   │
│ │ ├─ name: "Dr. Sarah Chen"                       │   │
│ │ ├─ email: "schen@example.com"                   │   │
│ │ └─ verified: ✓                                   │   │
│ │                                                   │   │
│ │ tags (array)                                     │   │
│ │ [AI, Machine Learning, Healthcare, Research]     │   │
│ │                                                   │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ┌ Metadata ─────────────────────────────────────────┐   │
│ │ Creation Time: 2025-12-15T10:30:15Z              │   │
│ │ Last Update: 2025-12-20T14:22:03Z                │   │
│ │ Vector Index: Included                           │   │
│ │ Tenant: default                                   │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ┌ Vectors ──────────────────────────────────────────┐   │
│ │ default (768 dimensions)                         │   │
│ │ [0.123, -0.456, 0.234, 0.567, ...]              │   │
│ │                                                   │   │
│ │ Magnitude: 1.0                                   │   │
│ │ First 10: [0.123, -0.456, 0.234...]             │   │
│ │ [Show All] [Copy Vector] [Visualize]            │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ┌ References ───────────────────────────────────────┐   │
│ │ relatedArticles (3)                              │   │
│ │ ├─ "Machine Learning Basics" →                  │   │
│ │ ├─ "AI Ethics in Medicine" →                    │   │
│ │ └─ "Future of Healthcare Tech" →                │   │
│ │                                                   │   │
│ │ citations (12)                                   │   │
│ │ [View All References]                            │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Syntax-highlighted JSON tab
- Copy individual properties
- Navigate to referenced objects
- Edit mode (future enhancement)
- Version history (if tracked)

---

### 2.7 Export Functionality

#### Purpose
Export query results in multiple formats for external analysis.

#### UI Components

```
┌─────────────────────────────────────────┐
│ Export Data                             │
├─────────────────────────────────────────┤
│                                         │
│ Export Format:                          │
│ ○ JSON (with metadata)                  │
│ ● CSV (flattened)                       │
│ ○ Excel (.xlsx)                         │
│ ○ Parquet (for data analysis)          │
│                                         │
│ Include:                                │
│ ☑ Properties                            │
│ ☑ Vectors                               │
│ ☑ Metadata (_id, timestamps)           │
│ ☐ References (as UUIDs)                 │
│                                         │
│ Scope:                                  │
│ ● Current Page (20 objects)             │
│ ○ All Filtered Results (457 objects)   │
│ ○ Entire Collection (12,457 objects)   │
│                                         │
│ [Cancel] [Export]                       │
└─────────────────────────────────────────┘
```

**Export Formats:**

1. **JSON**
   ```json
   {
     "collection": "Articles",
     "exportedAt": "2026-01-16T10:30:00Z",
     "totalObjects": 20,
     "filters": { /* applied filters */ },
     "objects": [ /* array of objects */ ]
   }
   ```

2. **CSV**
   - Flatten nested objects (author.name, author.email)
   - Arrays as comma-separated values
   - Vectors as separate file or column with array string

3. **Excel**
   - Multiple sheets: Data, Schema, Metadata
   - Formatted cells based on type
   - Freeze header row

4. **Parquet**
   - Efficient binary format
   - Preserves types
   - For data science workflows

#### Implementation

```typescript
interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'parquet'
  includeVectors: boolean
  includeMetadata: boolean
  includeReferences: boolean
  scope: 'page' | 'filtered' | 'all'
}

async function exportData(options: ExportOptions) {
  // Fetch data based on scope
  // Transform to selected format
  // Trigger download via VS Code API
  vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${collectionName}_export.${extension}`),
    filters: { /* file type filters */ }
  })
}
```

---

### 2.8 Schema Visualizer

#### Purpose
Visual representation of collection schema for better understanding.

#### UI Components

```
┌─────────────────────────────────────────────────────────┐
│ Schema: Articles                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Articles                                            │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ 📝 title                     text                   │ │
│ │ 📝 content                   text                   │ │
│ │ 📝 summary                   text                   │ │
│ │ 🏷️  category                 text                   │ │
│ │ 📅 publishedDate             date                   │ │
│ │ 🔢 views                     int                    │ │
│ │ ✓  featured                  boolean                │ │
│ │ 👤 author                    object ──┐             │ │
│ │                                        │             │ │
│ │ 🔗 relatedArticles           ref[] ───┼──→ Articles│ │
│ │ 🔗 citations                 ref[] ───┘             │ │
│ │                                                     │ │
│ │ 🔮 Vectors:                                         │ │
│ │    • default (768 dims) - text2vec-openai          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ author (nested object)                              │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ 📝 name                      text                   │ │
│ │ 📧 email                     text                   │ │
│ │ ✓  verified                  boolean                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Configuration:                                           │
│ • Vectorizer: text2vec-openai (all text props)          │
│ • Inverted Index: timestamp, searchable                 │
│ • Replication: factor 1                                 │
│ • Sharding: desiredCount 1, actualCount 1               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Interactive Features:**
- Click property to see full config
- Visual arrows for cross-references
- Filterable by property type
- Export schema as JSON/diagram

---

## 3. Technical Architecture

### 3.1 Component Structure

```
src/
├── data-explorer/
│   ├── extension/
│   │   └── DataExplorerPanel.ts          # Main webview controller
│   ├── webview/
│   │   ├── components/
│   │   │   ├── DataBrowser/
│   │   │   │   ├── DataTable.tsx         # Main table component
│   │   │   │   ├── ColumnManager.tsx     # Show/hide columns
│   │   │   │   ├── Pagination.tsx        # Page controls
│   │   │   │   └── CellRenderer.tsx      # Type-specific rendering
│   │   │   ├── FilterBuilder/
│   │   │   │   ├── FilterPanel.tsx       # Main filter UI
│   │   │   │   ├── FilterRule.tsx        # Single filter rule
│   │   │   │   ├── FilterGroup.tsx       # Nested AND/OR groups
│   │   │   │   └── OperatorSelector.tsx  # Type-specific operators
│   │   │   ├── VectorSearch/
│   │   │   │   ├── VectorSearchPanel.tsx # Main search UI
│   │   │   │   ├── SemanticSearch.tsx    # Text input mode
│   │   │   │   ├── SimilarObject.tsx     # Object picker mode
│   │   │   │   ├── VectorInput.tsx       # Raw vector mode
│   │   │   │   └── SearchResults.tsx     # Results with similarity
│   │   │   ├── HybridSearch/
│   │   │   │   ├── HybridSearchPanel.tsx
│   │   │   │   └── AlphaSlider.tsx       # Keyword/semantic balance
│   │   │   ├── Aggregations/
│   │   │   │   ├── InsightsPanel.tsx
│   │   │   │   ├── CategoricalChart.tsx  # For text/enum
│   │   │   │   └── NumericStats.tsx      # For numbers
│   │   │   ├── ObjectDetail/
│   │   │   │   ├── DetailPanel.tsx       # Slide-out panel
│   │   │   │   ├── PropertiesTab.tsx
│   │   │   │   ├── MetadataTab.tsx
│   │   │   │   ├── VectorsTab.tsx
│   │   │   │   └── ReferencesTab.tsx
│   │   │   ├── Export/
│   │   │   │   ├── ExportDialog.tsx
│   │   │   │   └── exporters/
│   │   │   │       ├── jsonExporter.ts
│   │   │   │       ├── csvExporter.ts
│   │   │   │       └── xlsxExporter.ts
│   │   │   └── Schema/
│   │   │       └── SchemaVisualizer.tsx
│   │   ├── hooks/
│   │   │   ├── useDataFetch.ts           # Query execution
│   │   │   ├── useFilters.ts             # Filter state management
│   │   │   ├── usePagination.ts          # Pagination logic
│   │   │   └── useVectorSearch.ts        # Vector search state
│   │   ├── utils/
│   │   │   ├── filterBuilder.ts          # Filter → Weaviate API
│   │   │   ├── typeRenderers.ts          # Type-specific display
│   │   │   └── exportUtils.ts            # Export formatting
│   │   └── DataExplorer.tsx              # Root component
│   └── types/
│       └── index.ts                       # TypeScript interfaces
```

### 3.2 State Management

**Approach:** React Context + Custom Hooks (lightweight, no external dependencies)

```typescript
// Central state context
interface DataExplorerState {
  // Collection
  collectionName: string
  schema: CollectionConfig | null

  // Data
  objects: WeaviateObject[]
  totalCount: number
  loading: boolean
  error: string | null

  // Pagination
  currentPage: number
  pageSize: number

  // Filters
  activeFilters: Filter[]

  // Search
  searchMode: 'none' | 'vector' | 'hybrid' | 'keyword'
  vectorSearchConfig: VectorSearchConfig | null

  // UI
  visibleColumns: string[]
  sortBy: { field: string, direction: 'asc' | 'desc' }
  selectedObjectId: string | null
  showDetailPanel: boolean
}

// Actions
type DataExplorerAction =
  | { type: 'SET_COLLECTION', payload: string }
  | { type: 'SET_DATA', payload: { objects: WeaviateObject[], total: number } }
  | { type: 'ADD_FILTER', payload: Filter }
  | { type: 'REMOVE_FILTER', payload: string }
  | { type: 'SET_PAGE', payload: number }
  | { type: 'SET_VECTOR_SEARCH', payload: VectorSearchConfig }
  | { type: 'SELECT_OBJECT', payload: string }
  // ... more actions
```

### 3.3 API Integration

**Weaviate Client Wrapper:**

```typescript
class DataExplorerAPI {
  constructor(private client: WeaviateClient) {}

  // Fetch with filters and pagination
  async fetchObjects(params: FetchParams): Promise<FetchResult> {
    const collection = this.client.collections.get(params.collectionName)

    const result = await collection.query.fetchObjects({
      limit: params.limit,
      offset: params.offset,
      where: this.buildWhereFilter(params.filters),
      sort: params.sortBy ? {
        path: params.sortBy.field,
        order: params.sortBy.direction
      } : undefined,
      returnProperties: params.properties,
      returnMetadata: ['uuid', 'creationTimeUnix', 'lastUpdateTimeUnix']
    })

    return {
      objects: result.objects,
      totalCount: await this.getTotalCount(params.collectionName, params.filters)
    }
  }

  // Vector search
  async vectorSearch(params: VectorSearchParams): Promise<VectorSearchResult> {
    const collection = this.client.collections.get(params.collectionName)

    if (params.mode === 'text') {
      return await collection.query.nearText(params.query, {
        limit: params.limit,
        distance: params.maxDistance,
        returnMetadata: ['distance', 'certainty']
      })
    } else if (params.mode === 'object') {
      return await collection.query.nearObject(params.objectId, {
        limit: params.limit,
        distance: params.maxDistance,
        returnMetadata: ['distance', 'certainty']
      })
    } else {
      return await collection.query.nearVector(params.vector, {
        limit: params.limit,
        distance: params.maxDistance,
        returnMetadata: ['distance', 'certainty']
      })
    }
  }

  // Hybrid search
  async hybridSearch(params: HybridSearchParams): Promise<HybridSearchResult> {
    const collection = this.client.collections.get(params.collectionName)

    return await collection.query.hybrid(params.query, {
      alpha: params.alpha,
      limit: params.limit,
      returnMetadata: ['score', 'explainScore']
    })
  }

  // Aggregations
  async getAggregations(params: AggregationParams): Promise<AggregationResult> {
    const collection = this.client.collections.get(params.collectionName)

    return await collection.aggregate.overAll({
      returnMetrics: this.buildMetrics(params.properties)
    })
  }

  // Helper: Build WHERE filter from UI state
  private buildWhereFilter(filters: Filter[]): WhereFilter | undefined {
    if (filters.length === 0) return undefined

    return {
      operator: 'And',
      operands: filters.map(f => this.filterToOperand(f))
    }
  }

  private filterToOperand(filter: Filter): any {
    if (filter.type === 'group') {
      return {
        operator: filter.combineOperator,
        operands: filter.children!.map(c => this.filterToOperand(c))
      }
    }

    // Map UI operators to Weaviate operators
    const operatorMap: Record<string, string> = {
      'equals': 'Equal',
      'notEquals': 'NotEqual',
      'greaterThan': 'GreaterThan',
      'lessThan': 'LessThan',
      'contains': 'Like',
      // ... more mappings
    }

    return {
      path: [filter.property],
      operator: operatorMap[filter.operator],
      [this.getValueKey(filter)]: filter.value
    }
  }

  private getValueKey(filter: Filter): string {
    // Determine valueText, valueInt, valueBoolean, etc. based on property type
    const propertyType = this.getPropertyType(filter.property)
    const keyMap: Record<string, string> = {
      'text': 'valueText',
      'int': 'valueInt',
      'number': 'valueNumber',
      'boolean': 'valueBoolean',
      'date': 'valueDate'
    }
    return keyMap[propertyType] || 'valueText'
  }
}
```

### 3.4 Message Passing (Extension ↔ Webview)

```typescript
// Extension side (DataExplorerPanel.ts)
class DataExplorerPanel {
  private async handleWebviewMessage(message: any) {
    switch (message.command) {
      case 'fetchObjects':
        const result = await this.api.fetchObjects(message.params)
        this.panel.webview.postMessage({
          command: 'objectsLoaded',
          data: result
        })
        break

      case 'vectorSearch':
        const searchResult = await this.api.vectorSearch(message.params)
        this.panel.webview.postMessage({
          command: 'searchResults',
          data: searchResult
        })
        break

      case 'export':
        await this.handleExport(message.options)
        break
    }
  }
}

// Webview side (DataExplorer.tsx)
function DataExplorer() {
  const vscode = acquireVsCodeApi()

  const fetchObjects = (params: FetchParams) => {
    vscode.postMessage({
      command: 'fetchObjects',
      params
    })
  }

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data
      switch (message.command) {
        case 'objectsLoaded':
          dispatch({ type: 'SET_DATA', payload: message.data })
          break
        case 'searchResults':
          dispatch({ type: 'SET_SEARCH_RESULTS', payload: message.data })
          break
      }
    }

    window.addEventListener('message', messageHandler)
    return () => window.removeEventListener('message', messageHandler)
  }, [])
}
```

---

## 4. User Experience Flow

### 4.1 First-Time User Flow

1. **User opens Data Explorer**
   - Click "Open Data Explorer" from collection tree item
   - Or Command Palette: "Weaviate: Open Data Explorer"

2. **Initial Load (< 2 seconds)**
   - Fetch collection schema
   - Load first 20 objects
   - Display table with smart defaults
   - Show quick insights panel (top 3 categorical breakdowns)

3. **Zero-State Guidance**
   - If collection is empty: "No objects yet. Add objects to start exploring."
   - If collection has objects: Table view with all columns visible

### 4.2 Filtering Flow

1. **User clicks "+ Add Filter"**
   - Dropdown shows all properties
   - User selects property (e.g., "category")

2. **Operator Selection**
   - System shows relevant operators based on type
   - For text: equals, contains, starts with, etc.
   - User selects "equals"

3. **Value Input**
   - For low-cardinality fields (<100 distinct values): Show dropdown with all values
   - For high-cardinality: Text input with autocomplete
   - User selects "Technology"

4. **Immediate Application**
   - Filter applies on "Apply" button click
   - Results update in <500ms
   - Total count updates
   - Filter chip appears in active filters bar

5. **Refinement**
   - User adds more filters
   - Each filter shows "AND" relationship visually
   - Can remove individual filters

### 4.3 Vector Search Flow

1. **User clicks "Vector Search" tab**
   - Three modes presented: Text, Similar Object, Vector

2. **User selects "Text (Semantic)" mode**
   - Input field appears: "What are you looking for?"
   - User types: "machine learning applications in healthcare"

3. **System validates**
   - Check if vectorizer is configured
   - If not: Show error with guidance to configure vectorizer
   - If yes: Enable search button

4. **User clicks "Search"**
   - Show loading state
   - Execute nearText query
   - Return 10 most similar objects

5. **Results Display**
   - Results show similarity percentage
   - Distance metric displayed
   - Preview of key properties
   - Click to view full object

6. **Follow-up Actions**
   - "Find Similar to This" on any result
   - Combine with filters for refined search
   - Export results

### 4.4 Hybrid Search Flow

1. **User types query in Hybrid Search**
   - Input: "climate change policy 2025"

2. **User adjusts alpha slider**
   - Default: 0.75 (75% semantic, 25% keyword)
   - User moves to 0.5 for balanced search

3. **Results show match breakdown**
   - Each result displays:
     - Keyword match score
     - Semantic match score
     - Combined score
   - Highlighted matching terms

4. **User refines**
   - Adjust alpha based on results
   - Add filters to narrow down
   - Re-run search instantly

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic data browsing without filters

**Deliverables:**
- Data Browser component with table view
- Pagination controls
- Type-specific cell renderers
- Column show/hide
- Basic object detail panel
- Integration with ConnectionManager

**Success Criteria:**
- Can view first 100 objects of any collection
- Can navigate pages
- Can click object to see details
- Renders all property types correctly

---

### Phase 2: Filtering (Week 3)
**Goal:** Visual filter builder for common use cases

**Deliverables:**
- Filter panel UI
- Simple filter rules (equals, greater than, contains)
- Filter-to-WHERE translation
- Apply/clear filters
- Filter persistence per collection

**Success Criteria:**
- Can filter by text, number, boolean, date fields
- Filters apply correctly to queries
- Filter state persists when switching views

---

### Phase 3: Vector Search (Week 4)
**Goal:** Make vector search accessible

**Deliverables:**
- Vector Search panel
- Three search modes: Text, Similar Object, Vector
- Distance/certainty configuration
- Search results with similarity scores
- "Find Similar" quick action from data browser

**Success Criteria:**
- Can search by text (nearText)
- Can find similar objects (nearObject)
- Results show accurate similarity scores
- Quick action works from table rows

---

### Phase 4: Advanced Search (Week 5)
**Goal:** Hybrid search and advanced filters

**Deliverables:**
- Hybrid search panel with alpha slider
- Nested filter groups (AND/OR/NOT)
- Filter templates
- Search result explanations

**Success Criteria:**
- Hybrid search balances keyword + semantic correctly
- Can create complex nested filters
- Can save and reuse filter templates

---

### Phase 5: Insights & Export (Week 6)
**Goal:** Aggregations and export functionality

**Deliverables:**
- Quick Insights panel
- Aggregation API integration
- Export dialog
- JSON, CSV, Excel exporters
- Schema visualizer

**Success Criteria:**
- Insights show accurate stats
- Can export current page, filtered results, or all
- Exports work for all formats
- Schema visualizer displays all property types

---

### Phase 6: Polish & Performance (Week 7)
**Goal:** Production-ready quality

**Deliverables:**
- Virtual scrolling for large datasets
- Loading skeletons
- Error boundaries
- Comprehensive error handling
- Performance optimizations (memoization, debouncing)
- User preferences persistence
- Keyboard shortcuts
- Accessibility (ARIA labels, keyboard navigation)

**Success Criteria:**
- Can handle 10,000+ object result sets smoothly
- All error cases handled gracefully
- Meets WCAG 2.1 Level A accessibility
- User preferences saved between sessions

---

## 6. Performance Considerations

### 6.1 Large Collections

**Challenge:** Collections with millions of objects

**Solutions:**
1. **Smart Pagination**
   - Fetch only requested page (20-100 objects)
   - Cache last 3 pages in memory
   - Pre-fetch next page on scroll near bottom

2. **Virtual Scrolling**
   - Render only visible rows
   - Use react-window or react-virtualized
   - Maintain scroll position on updates

3. **Lazy Loading**
   - Load full object details only when detail panel opens
   - Load aggregations on-demand
   - Stream large vector arrays

### 6.2 Complex Queries

**Challenge:** Filters + vector search + aggregations = slow

**Solutions:**
1. **Query Debouncing**
   - Wait 300ms after last filter change before executing
   - Cancel pending queries when new one starts
   - Show loading state immediately

2. **Progressive Enhancement**
   - Load objects first
   - Load aggregations in background
   - Show partial results as they arrive

3. **Caching**
   - Cache recent query results (LRU cache, max 10 queries)
   - Cache schema and metadata (5-minute TTL)
   - Invalidate on data changes

### 6.3 Large Objects

**Challenge:** Objects with huge text fields or large vectors

**Solutions:**
1. **Selective Property Loading**
   - Load only visible columns
   - Lazy load large text fields (truncate in table, full in detail)
   - Load vectors only in detail panel

2. **Truncation**
   - Show first 100 chars in table cells
   - Expand on hover or click
   - Full text in detail panel

### 6.4 Responsiveness

**Target:** Every user action responds in <100ms

**Solutions:**
1. **Optimistic Updates**
   - Update UI immediately
   - Revert if API call fails

2. **Background Processing**
   - Heavy calculations in Web Workers
   - Aggregate processing off main thread

3. **Skeleton Loading**
   - Show content placeholders during load
   - Reduce perceived wait time

---

## 7. Accessibility

### 7.1 Keyboard Navigation

- **Tab**: Move between UI elements
- **Enter**: Activate buttons, open detail panel
- **Space**: Toggle checkboxes, expand/collapse
- **Escape**: Close modals, clear selection
- **Arrow Keys**: Navigate table cells, move filters
- **Ctrl+F**: Focus quick search
- **Ctrl+E**: Export dialog
- **Ctrl+R**: Refresh data

### 7.2 Screen Reader Support

- All controls have ARIA labels
- Table headers announced
- Filter state changes announced
- Loading states announced
- Error messages announced

### 7.3 Visual

- High contrast mode support
- Respects VS Code theme (dark/light)
- Focus indicators on all interactive elements
- Minimum 4.5:1 contrast ratio
- Scalable fonts (respect VS Code zoom)

---

## 8. Error Handling

### 8.1 Connection Errors

**Scenario:** Weaviate instance unreachable

**Handling:**
- Show error banner: "Unable to connect to Weaviate. Check connection settings."
- Provide "Retry" button
- Link to connection management
- Don't lose user's current filters/state

### 8.2 Query Errors

**Scenario:** Invalid filter or API error

**Handling:**
- Show inline error near problematic filter
- Explain error in plain language
- Suggest fixes if possible
- Allow removing problematic filter
- Don't crash entire UI

### 8.3 Empty States

**Scenario:** No results found

**Handling:**
- Friendly message: "No objects match your filters"
- Suggest actions:
  - "Try removing some filters"
  - "Widen your search criteria"
  - "Create your first object"
- Show which filters are active

### 8.4 Missing Features

**Scenario:** Collection doesn't have vectorizer

**Handling:**
- Disable vector search UI
- Show info message: "Vector search unavailable. This collection has no vectorizer configured."
- Link to documentation on configuring vectorizers

---

## 9. Future Enhancements (Post-MVP)

### 9.1 Editing Capabilities

- Inline editing of object properties
- Bulk update operations
- Create new objects via form builder
- Delete with undo

### 9.2 Advanced Visualizations

- Vector space 2D/3D visualization (t-SNE, UMAP)
- Property correlation heatmaps
- Time-series charts for temporal data
- Geospatial maps for location data

### 9.3 Saved Views

- Save filter + column + sort combinations as "Views"
- Quick switch between views
- Share views with team
- Default view per collection

### 9.4 Batch Operations

- Bulk delete with filters
- Bulk update properties
- Batch export
- Import from CSV/JSON

### 9.5 Advanced Search

- Regex support in text filters
- Fuzzy search
- Cross-collection search
- Saved search history

### 9.6 Collaboration

- Share query results via URL
- Export and share filter configs
- Collaborative annotations on objects

---

## 10. Migration Strategy

### 10.1 Coexistence with GraphQL Editor

**Approach:** Both interfaces available, gradual migration

**Implementation:**
- Add "Data Explorer" as new panel option
- Keep existing GraphQL editor
- Add "Switch to Data Explorer" link in GraphQL editor
- Add "Advanced: Use GraphQL" link in Data Explorer
- Track usage analytics to understand adoption

### 10.2 Feature Parity

**Before deprecating GraphQL editor:**
- ✅ Data Explorer supports all query types
- ✅ Can export query as GraphQL (for advanced users)
- ✅ Power user feedback incorporated
- ✅ Performance equal or better than GraphQL
- ✅ 90%+ of users prefer Data Explorer (survey)

### 10.3 User Education

- In-app tutorial on first launch
- "What's New" announcement
- Video walkthrough
- Updated documentation
- Migration guide from GraphQL to Data Explorer

---

## 11. Success Metrics

### 11.1 Adoption Metrics

- % of users who try Data Explorer within first week
- % of data exploration tasks done via Data Explorer vs GraphQL
- Time to first successful query (target: <30s)
- Daily active users of Data Explorer

### 11.2 Performance Metrics

- Time to first data view: <2s (target)
- Query execution time: <1s for simple queries, <5s for complex
- UI responsiveness: All interactions <100ms
- Page load time: <3s

### 11.3 User Satisfaction

- NPS score for Data Explorer: >40 (target)
- User survey rating: >4/5 stars
- Support tickets related to data browsing: -50%
- User-reported bugs: <1 per 100 sessions

### 11.4 Feature Usage

- % of users who use filters: >60%
- % of users who use vector search: >30%
- % of users who export data: >20%
- Average filters per query: 2-3

---

## 12. Technical Risks & Mitigation

### 12.1 Risk: Weaviate API Changes

**Probability:** Medium
**Impact:** High

**Mitigation:**
- Abstract API calls behind DataExplorerAPI class
- Version detection and graceful degradation
- Regular testing against latest Weaviate versions
- Fallback to GraphQL for unsupported features

### 12.2 Risk: Performance with Large Collections

**Probability:** High
**Impact:** Medium

**Mitigation:**
- Implement virtual scrolling from day 1
- Set hard limits on page size (max 500)
- Add warnings for large exports
- Optimize rendering with React.memo
- Use Web Workers for heavy processing

### 12.3 Risk: Complex Filter UI Overwhelming Users

**Probability:** Medium
**Impact:** Medium

**Mitigation:**
- Progressive disclosure (start simple, add complexity)
- Filter templates for common use cases
- Clear documentation and examples
- User testing with non-technical users
- "Simple" and "Advanced" filter modes

### 12.4 Risk: Scope Creep

**Probability:** High
**Impact:** Medium

**Mitigation:**
- Strict adherence to phased rollout
- MVP feature freeze after Phase 3
- Park nice-to-haves in "Future Enhancements"
- Regular check-ins against original spec
- Timebox each phase

---

## 13. Dependencies

### 13.1 Required Libraries

**Already in project:**
- ✅ `weaviate-client` v3.8.0 - Core API access
- ✅ `react` v18.2.0 - UI framework
- ✅ `@vscode/webview-ui-toolkit` - VS Code components

**New dependencies:**

| Library | Purpose | Size | Justification |
|---------|---------|------|---------------|
| `react-window` | Virtual scrolling | 6 KB | Essential for large datasets |
| `date-fns` | Date formatting | 13 KB (tree-shaken) | Better than Moment.js, smaller |
| `papaparse` | CSV export | 45 KB | Industry standard, reliable |
| `xlsx` | Excel export | 480 KB | Necessary for .xlsx support |
| `react-hook-form` | Filter form state | 24 KB | Cleaner than manual state |
| _(Optional)_ `recharts` | Charts in Insights | 400 KB | Only if visualizations needed |

**Total new bundle size:** ~568 KB (minified)

### 13.2 API Requirements

**Weaviate Client v3.x+ required features:**
- `collections.get().query.fetchObjects()`
- `collections.get().query.nearText()`
- `collections.get().query.nearObject()`
- `collections.get().query.nearVector()`
- `collections.get().query.hybrid()`
- `collections.get().aggregate.overAll()`
- Support for WHERE filters with nested operands

**Fallback plan:**
- If older client version: Detect and show upgrade prompt
- If feature missing: Gray out UI and show "Requires Weaviate v1.23+"

---

## 14. Open Questions

1. **Should we support multi-collection search?**
   - Pro: Very powerful for cross-referencing
   - Con: Complex UI, hard to implement
   - **Decision:** Not in MVP, evaluate for v2

2. **How to handle multi-tenancy?**
   - Current design assumes single tenant
   - Need tenant selector if multi-tenant collection
   - **Decision:** Add tenant dropdown if collection has multi-tenancy enabled

3. **Should filters support custom operators?**
   - Some users may want regex, custom functions
   - **Decision:** Not in MVP, provide "Use GraphQL" escape hatch

4. **How much historical query context to save?**
   - Useful for "back" navigation
   - Can consume memory
   - **Decision:** Last 10 queries in session, cleared on panel close

5. **Should we integrate with VS Code search?**
   - Could make data searchable via Cmd+Shift+F
   - Technically complex
   - **Decision:** Nice to have, not MVP

---

## 15. Conclusion

This Data Explorer transforms Weaviate Studio from a developer-focused GraphQL tool into a **user-friendly data exploration platform**. By modeling the UX after proven tools like MongoDB Compass while preserving Weaviate's unique vector search capabilities, we make vector databases accessible to a much broader audience.

**Key Benefits:**
- ✅ **Zero-code data browsing** - No GraphQL required for 90% of tasks
- ✅ **Intuitive filtering** - Point-and-click instead of writing queries
- ✅ **Vector search made easy** - Semantic search without understanding vectors
- ✅ **Fast time-to-insight** - See data in <5 seconds
- ✅ **Future-proof** - Not dependent on GraphQL/REST APIs

**Pragmatic Scope:**
- 6-7 week implementation
- No complex dependencies
- Leverages existing infrastructure
- Phased rollout minimizes risk
- Coexists with GraphQL editor

**Next Steps:**
1. Review and approve specification
2. Create design mockups in Figma
3. Set up project tracking (GitHub Projects)
4. Begin Phase 1 implementation
5. Weekly demos and feedback sessions

---

## Appendix A: UI Mockup References

_(Would include screenshots/Figma links of:)_
- Main data browser layout
- Filter builder states
- Vector search panel
- Object detail panel
- Export dialog
- Insights panel

## Appendix B: API Examples

_(Would include complete code examples of:)_
- fetchObjects with complex filters
- nearText search
- hybrid search
- aggregate queries
- Error handling patterns

## Appendix C: Migration Guide

_(Would include:)_
- How to translate GraphQL queries to UI actions
- Side-by-side comparison table
- Common patterns and their Data Explorer equivalents
