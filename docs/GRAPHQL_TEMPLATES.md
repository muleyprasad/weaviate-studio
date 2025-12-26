# Weaviate Studio GraphQL Templates

This document explains the built-in GraphQL query templates available in the Query Editor, when to use each, configuration options, and schema-aware behavior. It also captures best practices (distance vs. certainty), requirements (nearText), and known caveats (mutations).

Contents

- Quick start
- Template catalog (with examples)
- Distance vs. certainty
- nearText requirements
- Dynamic generation and schema awareness
- Configuration (QueryConfig)
- Template placeholders and processing
- Editor validations and UX
- Mutations note
- Troubleshooting FAQ

## Quick start

- Open the Query Editor and choose a template from the selector.
- Templates are processed by processTemplate, which injects the collection name, limit, and schema-aware fields when available.
- Execute the generated GraphQL against your Weaviate instance and iterate.

## When to Use Which Template?

Choosing the right template depends on your use case:

```
┌─────────────────────────────────────────────────────────────────┐
│                    What do you need to do?                      │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼────┐            ┌─────▼─────┐
│ Search │            │  Analyze  │
└───┬────┘            └─────┬─────┘
    │                       │
    ├─── Exact keywords? ───┐            ├─── Statistics? ────────┐
    │                       │            │                        │
    │    ┌──────────────────▼──────┐     │    ┌──────────────────▼────────┐
    │    │   BM25 Search           │     │    │   Aggregation Query       │
    │    │   Fast keyword matching │     │    │   Count, min, max, mean   │
    │    └─────────────────────────┘     │    └───────────────────────────┘
    │                                    │
    ├─── Semantic meaning? ──────┐       ├─── Group by field? ────┐
    │                            │       │                        │
    │    ┌───────────────────────▼─┐     │    ┌──────────────────▼────────┐
    │    │   nearText / nearVector│     │    │   Group By Query          │
    │    │   AI-powered similarity │     │    │   Aggregate by categories │
    │    └────────────────────────┘     │    └───────────────────────────┘
    │                                    │
    ├─── Best of both? ──────────┐       └─── Filter data? ────────┐
    │                            │                                 │
    │    ┌───────────────────────▼─┐         ┌──────────────────▼────────┐
    │    │   Hybrid Search         │         │   Filter Query            │
    │    │   Keyword + Vector (α)  │         │   Where conditions        │
    │    └─────────────────────────┘         └───────────────────────────┘
    │
    └─── AI-generated summaries? ─┐
                                  │
         ┌────────────────────────▼──────┐
         │   Generative Search           │
         │   RAG with summaries          │
         └───────────────────────────────┘
```

**Quick decision guide:**

- **Keyword search** (exact matches, SQL-like) → **BM25 Search**
- **Semantic search** (meaning, concepts) → **nearText** or **nearVector**
- **Both keyword + semantic** → **Hybrid Search** (adjust alpha: 0=vector, 1=keyword)
- **Count, sum, average** → **Aggregation Query**
- **Group results by property** → **Group By Query**
- **Filter specific values** → **Filter Query**
- **AI-generated answers** → **Generative Search**
- **Find similar to object** → **nearObject**
- **Multi-tenant data** → **Tenant Query**

## Template catalog

The selector surfaces non-mutating templates that are stable across Weaviate versions. Below are summaries and minimal examples. Replace "Article" with your collection.

- Vector Search (nearVector)

  - Purpose: Vector similarity using an explicit query vector.
  - Notes: Prefers distance in v1.14+; falls back to certainty if needed.
  - Minimal example:
    ```
    {
      Get {
        Article(
          nearVector: {
            vector: [0.1, 0.2, 0.3]
            distance: 0.6
          }
          limit: 10
        ) {
          _additional { id distance certainty vector }
        }
      }
    }
    ```

- Vector Search (nearObject)

  - Purpose: “Search like this object” using its id; convenient when you have an existing item.
  - Minimal example:
    ```
    {
      Get {
        Article(
          nearObject: { id: "your-object-id" }
          limit: 10
        ) {
          _additional { id distance certainty }
        }
      }
    }
    ```

- Semantic Search (nearText)

  - Purpose: Concept-driven search using text2vec modules.
  - Requirements: A text vectorizer configured (see nearText requirements below).
  - Supports moveTo/moveAwayFrom to steer results.
  - Minimal example:
    ```
    {
      Get {
        Article(
          nearText: {
            concepts: ["search terms", "semantic concepts"]
            distance: 0.6
            moveAwayFrom: { concepts: ["unwanted terms"], force: 0.45 }
            moveTo: { concepts: ["desired terms"], force: 0.85 }
          }
          limit: 10
        ) {
          _additional { id distance certainty explainScore }
        }
      }
    }
    ```

- Hybrid Search

  - Purpose: Combine BM25 (keyword) and vector search with alpha balancing.
  - Scope BM25 to specific properties via properties.
  - Minimal example:
    ```
    {
      Get {
        Article(
          hybrid: {
            query: "your search query here"
            alpha: 0.5
            vector: [0.1, 0.2, 0.3]
            properties: ["title", "description"]
          }
          limit: 10
        ) {
          _additional { id score explainScore }
        }
      }
    }
    ```

- BM25 Search

  - Purpose: Keyword-based retrieval, optionally scoped to properties.
  - Minimal example:
    ```
    {
      Get {
        Article(
          bm25: {
            query: "search keywords here"
            properties: ["title", "description"]
          }
          limit: 10
        ) {
          _additional { id score }
        }
      }
    }
    ```

- Generative Search

  - Purpose: nearText retrieval followed by grouped generative summaries.
  - Minimal example:
    ```
    {
      Get {
        Article(
          nearText: { concepts: ["search terms"], distance: 0.6 }
          limit: 5
        ) {
          _additional {
            id
            generate(
              groupedResult: {
                task: "Summarize these results in 2-3 sentences"
                properties: ["title", "description"]
              }
            ) {
              groupedResult
              error
            }
          }
        }
      }
    }
    ```

- Group By Query

  - Purpose: Aggregate grouped by a property path with groupedBy metadata.
  - Minimal example:
    ```
    {
      Aggregate {
        Article(groupBy: ["category"], limit: 10) {
          groupedBy { value path }
          meta { count }
        }
      }
    }
    ```

- Filter Query

  - Purpose: Filter results with where operands and standard operators.
  - Minimal example:
    ```
    {
      Get {
        Article(
          where: {
            operator: And
            operands: [
              { path: ["title"], operator: Like, valueText: "*search term*" }
              { path: ["likes"], operator: GreaterThan, valueNumber: 100 }
            ]
          }
          limit: 10
        ) {
          _additional { id }
        }
      }
    }
    ```

- Aggregation Query

  - Purpose: Property-type-aware statistics (count/min/max/etc.) plus meta.count.
  - Minimal example:
    ```
    {
      Aggregate {
        Article {
          meta { count }
          # Add specific property aggregations, e.g.:
          # title { count topOccurrences(limit: 5) { value occurs } }
          # likes { count minimum maximum mean median sum }
        }
      }
    }
    ```

- Relationship Query

  - Purpose: Explore cross-references via inline fragments with minimal nested fields.
  - Caveat: Reference traversal can return many linked objects; consider separate targeted queries.
  - Minimal example:
    ```
    {
      Get {
        Article(limit: 5) {
          # Example reference selection:
          # author {
          #   ... on Person { _additional { id } }
          # }
          _additional { id }
        }
      }
    }
    ```

- Explore Query

  - Purpose: Return metadata, vector, and optional singleResult generation per object.
  - Minimal example:
    ```
    {
      Get {
        Article(limit: 1) {
          _additional {
            id
            creationTimeUnix
            lastUpdateTimeUnix
            vector
            generate(singleResult: { prompt: "Summarize this object in one sentence: {title} {description}" }) {
              singleResult
              error
            }
          }
        }
      }
    }
    ```

- Tenant Query
  - Purpose: Query objects in a specific tenant for multi-tenant setups.
  - Minimal example:
    ```
    {
      Get {
        Article(tenant: "tenant-name", limit: 10) {
          _additional { id creationTimeUnix tenant }
        }
      }
    }
    ```

## Distance vs. certainty

- distance (preferred in v1.14+):
  - Lower values mean closer. Threshold acts as a maximum; smaller is stricter.
  - Actual ranges depend on the distance metric (cosine, dot, euclidean).
- certainty (compatibility / legacy):
  - 0–1 range; higher is stricter.
- Static templates default to distance where appropriate.
- Dynamic templates accept both and will prefer distance when provided via configuration.

## nearText requirements

- nearText requires a text vectorizer module configured on the collection or properties (e.g., text2vec-openai, text2vec-transformers, cohere).
- If no text vectorizer is detected, dynamic nearText templates add a reminder comment in the output.
- If “Unknown argument nearText” occurs, use nearVector or configure and redeploy with a text vectorizer.

## Dynamic generation and schema awareness

When schema is provided, dynamic templates:

- Prefer primitive properties (text/string/int/number/boolean/date).
- Include geocoordinates with latitude/longitude sub-selection.
- Keep cross-reference selections minimal (inline fragment with \_additional.id) to avoid overwhelming results.
- Tailor generative prompts to an available text property if generativePrompt isn’t provided.

## Configuration (QueryConfig)

You can customize dynamic generation via QueryConfig. Notable fields:

- includeVectors: boolean — include object vectors in \_additional.
- includeMetadata: boolean — include id/creationTimeUnix/lastUpdateTimeUnix.
- includeScores: boolean — include score/certainty/distance (+ explainScore unless disabled).
- includeExplainScore: boolean — omit explainScore when includeScores is true by setting false.
- maxProperties: number — cap displayed properties (priors: primitive, then geo, then minimal references).
- tenantName: string — limit queries to a tenant (multi-tenant collections).
- generativePrompt: string — prompt for \_additional.generate(singleResult/groupedResult).
- searchProperties: string[] — properties to target (BM25/hybrid).
- filterOperator: 'And' | 'Or' — top-level filter operator for where.
- certainty: number — threshold for certainty (0–1).
- distance: number — max distance threshold (preferred in v1.14+).
- limit: number — result limit.
- offset: number — pagination offset.
- alpha: number — hybrid balance (0=vector, 1=keyword).
- searchQuery: string — query text for BM25/hybrid.
- concepts: string[] — concepts for nearText.
- propertiesOverride: string[] — explicit properties for BM25/hybrid/generative grouping (text only).
- moveTo: { concepts: string[]; force?: number } — steer toward specific concepts.
- moveAwayFrom: { concepts: string[]; force?: number } — steer away from concepts.
- vector: number[] — explicit query vector for nearVector/hybrid.
- sortBy: { path: string; order?: 'asc' | 'desc' } — sort clause.
- returnProperties: string[] — explicit GraphQL selection fields.

## Template placeholders and processing

processTemplate supports placeholders in raw template strings and also resolves selector names:

- Supported placeholders:

  - {nearVectorQuery}
  - {nearObjectQuery}
  - {nearTextQuery}
  - {hybridQuery}
  - {bm25Query}
  - {generativeSearchQuery}
  - {groupByQuery}
  - {filterQuery}
  - {aggregationQuery}
  - {relationshipQuery}
  - {exploreQuery}
  - {tenantQuery}

- Selector names map internally to these placeholders. When schema is provided, dynamic generators are used automatically; otherwise static templates are used.

## Editor validations and UX

The Query Editor adds helpful validations:

- Limit: Warns when limit > 100 (performance guidance).
- Certainty: Errors for values outside 0–1.
- Distance: Soft warnings for suspicious values (since ranges are metric-dependent).

Formatting:

- Queries can be formatted via Prettier with parser-graphql for readability.

## Mutations note

Weaviate GraphQL does not support mutations for insert/update/delete; those operations are handled via REST/clients. The selector excludes mutation templates to avoid confusion, though the codebase contains illustrative generators as references.

## Common Mistakes & Solutions

Understanding common pitfalls can save you time and frustration. Here's a comprehensive guide:

### Template Selection Mistakes

| Mistake                                  | Symptom                           | Solution                                                                      |
| ---------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Using nearText without text vectorizer   | "Unknown argument nearText"       | Use nearVector instead or configure a text vectorizer (text2vec-openai, etc.) |
| Using BM25 on non-indexed properties     | Poor/no results                   | Ensure properties have `indexSearchable: true` or omit `properties` parameter |
| Mixing distance and certainty            | Unexpected result ordering        | Use **either** distance (v1.14+) **or** certainty, not both                   |
| High certainty (>0.9) with no results    | Empty response                    | Lower certainty (try 0.7) or switch to distance (~0.6)                        |
| Wrong alpha value in hybrid              | Results don't match expectations  | alpha: 0=pure vector, 0.5=balanced, 1=pure keyword. Start with 0.5 and tune   |
| Large limit (>1000) with nested refs     | Timeout or very slow              | Reduce limit or use pagination with `offset`. Query references separately     |
| Using aggregation in Get                 | Syntax error                      | Aggregations use `Aggregate` not `Get`                                        |
| Filtering dates without timezone         | Wrong results or errors           | Use ISO 8601 format with timezone: `"2024-01-01T00:00:00Z"`                   |
| Cross-references without inline fragment | "Cannot query field" error        | Use `... on ClassName { }` syntax for cross-references                        |
| Missing \_additional.id                  | Can't identify objects in results | Always include `_additional { id }` for object identification                 |

### Vector Search Mistakes

| Mistake                          | Symptom                        | Solution                                                                   |
| -------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Wrong vector dimensions          | "Vector length mismatch" error | Match vector length to your model (OpenAI ada-002: 1536, mpnet: 768, etc.) |
| Using random vectors for testing | Nonsensical results            | Use actual embeddings from your vectorizer or similar objects              |
| Distance threshold too strict    | Empty results                  | Try higher distance (0.6-1.0) or lower certainty (0.6-0.8)                 |
| Not normalizing vectors          | Inconsistent similarity scores | Ensure vectors are L2-normalized if using cosine similarity                |
| Comparing vectors across models  | Meaningless similarity         | Don't compare vectors from different models (ada-002 vs Cohere won't work) |

### Query Performance Mistakes

| Mistake                            | Symptom                              | Solution                                                   |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| No limit specified                 | Returns all objects (very slow)      | Always specify `limit` (default: 10, max recommended: 100) |
| Fetching all properties            | Slow queries, large payloads         | Only select properties you need                            |
| Deep reference nesting (3+ levels) | Exponential data explosion           | Flatten queries: do separate queries for each level        |
| No filters on large collections    | Scanning millions of objects         | Add `where` filters to reduce search space                 |
| Requesting vectors in every query  | 10-100x larger payloads              | Only include `vector` in `_additional` when you need it    |
| Not using pagination               | Trying to fetch 10K+ results at once | Use `limit` + `offset` or cursor-based pagination          |

### Schema-Related Mistakes

| Mistake                             | Symptom                                     | Solution                                                                      |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Querying non-existent properties    | "Cannot query field" error                  | Check schema first or use template auto-generation                            |
| Wrong property type in filters      | Type mismatch errors                        | Use `valueText` for strings, `valueInt` for numbers, `valueBoolean` for bools |
| Querying wrong collection name      | "Unknown type" error                        | Collection names are case-sensitive (use exact name from schema)              |
| Missing cross-reference declaration | Can't query relationships                   | Ensure cross-references are defined in collection schema                      |
| Inconsistent property naming        | Query works in some collections, not others | Use schema-aware templates or check property names per collection             |

### Generative Search Mistakes

| Mistake                           | Symptom                               | Solution                                                                   |
| --------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Missing generative module config  | "Generative module not enabled" error | Configure generative-openai, generative-cohere, etc. on your collection    |
| Vague/generic prompts             | Poor quality summaries                | Be specific: "Summarize in 2 sentences focusing on X" not "Summarize this" |
| Too many properties in generate   | Slow, expensive API calls             | Limit to 2-3 most relevant properties                                      |
| Large result sets with generation | Timeout, high costs                   | Use small limit (5-10) for generative queries                              |
| Not handling generate errors      | Silent failures                       | Always check `_additional.generate.error` in results                       |

### Multi-Tenancy Mistakes

| Mistake                        | Symptom                              | Solution                                                         |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------------------- |
| Forgetting tenant parameter    | "Tenant required" error              | Add `tenant: "tenant-name"` to query                             |
| Wrong tenant name              | Empty results or "Tenant not found"  | Verify tenant exists: check collection schema for active tenants |
| Mixing tenants in single query | Can't query multiple tenants at once | Run separate queries per tenant and merge results client-side    |

## Troubleshooting FAQ

### Quick Diagnostics

**"Unknown argument nearText"**

- **Cause**: No text vectorizer configured on collection
- **Fix**: Use nearVector instead, or configure a text vectorizer (text2vec-openai, text2vec-cohere, text2vec-transformers)
- **Verify**: Check schema → moduleConfig for text2vec-\* entries

**"No results returned"**

- **Causes**:
  - Thresholds too strict (distance too low, certainty too high)
  - Collection name mismatch (case-sensitive!)
  - Property names don't match schema
  - No data in collection
- **Fixes**:
  - Try distance: 1.0 or certainty: 0.5 (very permissive) to test
  - Confirm collection name exactly matches schema
  - Use schema-aware templates to auto-populate correct properties
  - Verify data exists: run simple `Get { Collection(limit: 1) { _additional { id } } }`

**"Nested results are huge" in relationship queries**

- **Cause**: Cross-references multiply result size (1 article with 100 authors = 100x data)
- **Fix**:
  - Lower main query limit (e.g., `limit: 5`)
  - Query references separately with targeted properties
  - Use `_additional { id }` only for refs, then fetch details separately

**"ExplainScore missing"**

- **Causes**:
  - Not using vector/hybrid search (explainScore only works with similarity searches)
  - `includeExplainScore: false` in config
- **Fix**: Ensure using nearVector/nearText/hybrid and include `explainScore` in `_additional`

**"Slow queries"**

- **Diagnostics**:
  - Check `limit` value (>100 is slow)
  - Count nested cross-references (each level multiplies data)
  - Check if requesting `vector` in results (large payloads)
- **Optimizations**:
  - Reduce limit to 10-50
  - Scope BM25/hybrid to specific properties: `properties: ["title"]`
  - Add `where` filters to reduce search space
  - Avoid deep nesting (>2 levels)
  - Exclude `vector` from `_additional` unless needed
  - Use pagination instead of large single queries

**"Vector length mismatch"**

- **Cause**: Vector dimensions don't match configured model
- **Fix**:
  - OpenAI ada-002: 1536 dimensions
  - OpenAI text-embedding-3-small: 1536
  - OpenAI text-embedding-3-large: 3072
  - Cohere v3: 1024
  - Sentence Transformers (mpnet): 768
  - Check your model's documentation for exact dimensions

**"Cannot query field X"**

- **Causes**:
  - Property doesn't exist in schema
  - Typo in property name
  - Cross-reference without inline fragment
- **Fixes**:
  - View schema in Weaviate Studio explorer
  - Use schema-aware templates (auto-populates correct properties)
  - For cross-refs: use `... on ClassName { properties }`

Best practices:

- Prefer distance thresholds with modern Weaviate versions.
- Keep result selections concise; select only the properties you need.
- Use hybrid/BM25 for field-scoped keyword relevance; use nearText/nearVector for semantic similarity.
