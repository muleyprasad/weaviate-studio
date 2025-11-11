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

## Troubleshooting FAQ

- “Unknown argument nearText”:

  - Ensure a text vectorizer is configured; otherwise use nearVector or hybrid/BM25.

- “No results returned”:

  - Check your thresholds (distance too low or certainty too high).
  - Confirm your class names and property selections match the schema.

- “Nested results are huge” in relationship queries:

  - Lower the main query limit or query references with separate, targeted calls.

- “ExplainScore missing”:

  - Confirm includeScores is true and includeExplainScore isn’t explicitly set to false.

- “Slow queries”:
  - Reduce limit, scope properties (BM25/hybrid), add where filters, and avoid large nested selections.

Best practices:

- Prefer distance thresholds with modern Weaviate versions.
- Keep result selections concise; select only the properties you need.
- Use hybrid/BM25 for field-scoped keyword relevance; use nearText/nearVector for semantic similarity.
