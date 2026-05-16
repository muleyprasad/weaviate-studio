---
title: Multi-Vector Search (Muvera) — Named Vector Queries in Weaviate Studio
description: Query across multiple Weaviate named vector spaces simultaneously with configurable fusion strategies — Muvera / multi-vector search support in the Weaviate Studio VS Code extension.
---

# Multi-Vector Search (Muvera)

Weaviate Studio supports Weaviate's named-vector / Muvera search — query across multiple vector spaces simultaneously and combine results with configurable strategies.

::: warning Version Requirement
Multi-vector search requires Weaviate **v1.26+** for near queries and **v1.27+** for hybrid queries. A version-gate notice is shown on older servers.
:::

## Target Vector Selection

The Vector Options drawer shows all named vectors for the current collection:

- Each named vector displays its **vectorizer badge** (e.g., `text2vec-weaviate`, `none`)
- **Auto-selection** — all named vectors are pre-checked when opening a multi-vector collection
- Deselect individual vectors to narrow your search

## Join Strategies

When multiple target vectors are selected, choose how distances from different vector spaces are combined:

| Strategy              | Description                                | Best For                              |
| --------------------- | ------------------------------------------ | ------------------------------------- |
| **Minimum** (default) | Conservative merge using minimum distance  | General-purpose, safe default         |
| **Sum**               | Add distances from all spaces              | When all vector spaces matter equally |
| **Average**           | Mean of all distances                      | Balanced multi-modal search           |
| **Manual Weights**    | Per-vector distance weighting with sliders | Fine-grained control                  |
| **Relative Score**    | Weight by relative scores                  | Score-based combination               |

## Weight Editor

Available when using **Manual Weights** or **Relative Score** strategies:

- **Per-vector sliders** for fine-grained distance weighting
- **Normalize** button to auto-balance weights
- Real-time weight sum display

## Search Modes

Multi-vector search works with all vector search modes:

- **Text (Semantic)** — requires a text vectorizer on the collection
- **Similar Object** — find objects similar across multiple vector spaces
- **Raw Vector** — provide vectors for each target manually

## Copy as Code

Generated TypeScript and Python code snippets automatically include the correct `multiTargetVector` combination call:

```typescript
// TypeScript example
collection.query.nearText('your query', {
  targetVectors: ['title_vector', 'body_vector'],
  combination: 'minimum',
});
```

```python
# Python example
collection.query.near_text(
    query="your query",
    target_vectors=["title_vector", "body_vector"],
    combination="minimum"
)
```

## Validation Guard

The **Run Vector Search** button is automatically disabled when:

- A multi-vector collection has **no target vectors** checked
- A clear validation hint explains the issue

This prevents cryptic server errors and guides users to the right configuration.
