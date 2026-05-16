---
title: Data Explorer — Browse & Filter Weaviate Collections in VS Code
description: Visually browse Weaviate collections, apply advanced filters, run vector and hybrid searches, and export results as JSON or CSV — all from the Weaviate Studio VS Code extension.
---

# Data Explorer

The Data Explorer is an interactive visual browser for your Weaviate collections. Browse objects, apply filters, run vector searches, and export data — all with a rich table interface.

## Key Capabilities

- **Interactive table** with sortable columns, configurable pagination, and column visibility management
- **Visual filter builder** with 10+ operators (Equal, Not Equal, Contains, Greater Than, Less Than, Like, ContainsAny, ContainsAll, IsNull, IsNotNull)
- **AND/OR logic** for combining multiple filter conditions
- **Four vector search modes**: Text (semantic), Object (similarity), Vector (raw embeddings), Hybrid (BM25 + vector)
- **Data export** to JSON or CSV (current page, filtered results, or entire collection)
- **Virtual scrolling** for large datasets (1000+ objects)
- **Filter presets** — save, load, and delete frequently used filter combinations

## Vector Search Modes

### Text (Semantic)

Uses `nearText` for concept-driven search. Requires a text vectorizer configured on the collection.

### Similar Object

Finds objects similar to an existing object by its ID. Uses `nearObject`.

### Raw Vector

Direct vector embedding input for advanced users. Uses `nearVector`.

### Hybrid Search

Combines BM25 keyword matching with vector semantic search. Features:

- **Alpha slider** to balance keyword vs semantic weight
- **Score breakdown** showing keyword, semantic, and combined scores
- **Property selection** for targeted keyword search
- **Preset buttons** (Keyword Only, Balanced, Semantic Only)

## Exporting Data

Choose from three export scopes:

| Scope             | Description                          |
| ----------------- | ------------------------------------ |
| Current Page      | Only visible rows                    |
| Filtered Results  | All objects matching current filters |
| Entire Collection | Every object in the collection       |

Export options include:

- Include/exclude metadata (`_additional` fields)
- Include/exclude vectors
- Flatten nested objects
- CSV or JSON format

::: warning Large Exports
Exporting more than 10,000 objects may take significant time. Progress indicators and cancellation are available.
:::

## Keyboard Shortcuts

| Shortcut | Action               |
| -------- | -------------------- |
| `Ctrl+F` | Focus filter search  |
| `Ctrl+K` | Open filter builder  |
| `Ctrl+E` | Export data modal    |
| `Ctrl+R` | Refresh current page |

## User Preferences

Per-collection preferences are persisted across sessions:

- Visible columns and column order
- Sort direction and column
- Page size
- Filter presets
- Panel expanded/collapsed states
