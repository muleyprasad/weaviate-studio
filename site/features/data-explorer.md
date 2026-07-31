---
title: Data Explorer — Browse & Filter Weaviate Collections in VS Code
description: Visually browse Weaviate collections, apply advanced filters, run vector and hybrid searches with query profiling, and export results as JSON or CSV — all from the Weaviate Studio VS Code extension.
---

# Data Explorer

The Data Explorer is an interactive visual browser for your Weaviate collections. Browse objects, apply filters, run vector searches, and export data — all with a rich table interface.

## Key Capabilities

- **Interactive table** with sortable columns, configurable pagination, and column visibility management
- **Visual filter builder** with 10+ operators (Equal, Not Equal, Contains, Greater Than, Less Than, Like, ContainsAny, ContainsAll, IsNull, IsNotNull)
- **AND/OR logic** for combining multiple filter conditions
- **Four vector search modes**: Text (semantic), Object (similarity), Vector (raw embeddings), Hybrid (BM25 + vector)
- **Query profiling** — per-shard timing breakdowns to diagnose slow searches
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

## Query Profiling

::: tip Requires Weaviate ≥ 1.36.9
Query profiling uses the same instrumentation as Weaviate's slow query log. The toggle only appears when connected to a compatible server.
:::

Query profiling returns an inline timing breakdown for each search, showing exactly where time was spent across all shards and nodes. It's designed for debugging and optimization — not for always-on production use.

### Enabling Profiling

1. Open the **Vector Search** panel (`Ctrl+K`)
2. In **Search Parameters**, check **Profile query**
3. Run any search (text, object, vector, or hybrid)
4. The **Query Profile** panel appears below the results

### What You'll See

The profile is organized by **shard**, with tabs for multi-shard collections. Each shard shows:

- **Shard name** and **node** that executed the search
- **Search type sections** (Vector Search, Keyword/BM25, Object) — only sections that ran are shown

#### Vector Search Metrics

| Metric                      | What it measures                                                |
| --------------------------- | --------------------------------------------------------------- |
| **Total**                   | Wall time for the entire shard search                           |
| **Vector Search**           | Time in the vector index (HNSW graph traversal)                 |
| **HNSW Layer N**            | Per-layer traversal time (Layer 0 usually dominates)            |
| **Rescore (decompression)** | Time reading full-precision vectors when compression is enabled |
| **Filter Allow List**       | Time resolving `where` filters via the inverted index           |
| **Filter IDs Matched**      | Number of document IDs matched by filters                       |
| **Object Hydration**        | Time loading final objects from disk                            |
| **Flat Search**             | `true` when filters were selective enough for brute-force scan  |

#### Keyword / BM25 Metrics

| Metric        | What it measures                                        |
| ------------- | ------------------------------------------------------- |
| **Term Time** | Time reading per-term posting lists from inverted index |
| **BMW Time**  | Time in BlockMax WAND traversal and scoring             |

### Reading the Waterfall

Each timing metric shows a **color-coded bar** proportional to its share of total time:

- 🟢 **Green** — under 33% of total (healthy)
- 🟡 **Yellow** — 33–66% (worth investigating)
- 🔴 **Red** — over 66% (likely bottleneck)

### Common Patterns

| Pattern                     | Likely cause                              | Tuning lever                           |
| --------------------------- | ----------------------------------------- | -------------------------------------- |
| Object Hydration dominates  | Large objects or high `limit`             | Reduce limit, select fewer properties  |
| Filter Allow List dominates | Broad filter matching many IDs            | Tighten filter selectivity             |
| HNSW Layer 0 dominates      | Expensive graph traversal                 | Tune `ef`, check vector dimensionality |
| Rescore dominates           | Compression enabled, disk-bound rescoring | Check disk I/O, consider RQ over PQ    |

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
