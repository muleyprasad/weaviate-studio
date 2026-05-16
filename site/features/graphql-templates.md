# GraphQL Editor & Templates

The Query Editor is a Monaco-powered GraphQL interface with intelligent, schema-aware templates that adapt to your collection's actual schema.

## Features

- **Monaco Editor** with full GraphQL syntax highlighting
- **Schema-aware autocompletion** based on your connected Weaviate instance
- **12+ query templates** covering all major Weaviate operations
- **Real-time validation** and error highlighting
- **Dynamic template generation** that auto-populates properties from your schema

## Query Templates

Choose the right template for your use case:

| Template                       | Use Case                                     |
| ------------------------------ | -------------------------------------------- |
| **Basic Get**                  | Simple object retrieval                      |
| **Vector Search** (nearVector) | Similarity search with explicit vector       |
| **Semantic Search** (nearText) | Concept-driven search with AI embeddings     |
| **Object Search** (nearObject) | Find similar to existing object              |
| **Hybrid Search**              | BM25 + Vector with alpha balancing           |
| **BM25 Search**                | Keyword-based retrieval                      |
| **Generative Search**          | RAG with AI-generated summaries              |
| **Filter Query**               | Complex WHERE conditions                     |
| **Aggregation Query**          | Statistics (count, min, max, mean)           |
| **Group By Query**             | Aggregate by property categories             |
| **Relationship Query**         | Explore cross-references                     |
| **Explore Query**              | Metadata, vectors, and per-object generation |
| **Tenant Query**               | Multi-tenant data access                     |

## Schema-Aware Generation

When your schema is available, dynamic templates:

- Auto-populate **primitive properties** (text, number, boolean, date)
- Include **geo-coordinates** with latitude/longitude selection
- Keep **cross-reference selections minimal** (inline fragment with `_additional.id`)
- Tailor **generative prompts** to available text properties
- Detect **embedding model dimensions** for 15+ popular models

## Configuration

Customize template generation via `QueryConfig`:

| Field             | Purpose                              |
| ----------------- | ------------------------------------ |
| `limit`           | Result limit (default: 10)           |
| `offset`          | Pagination offset                    |
| `includeVectors`  | Include object vectors               |
| `includeMetadata` | Include creation/update timestamps   |
| `includeScores`   | Include distance/certainty/score     |
| `maxProperties`   | Cap displayed properties             |
| `tenantName`      | Multi-tenant target                  |
| `searchQuery`     | BM25/hybrid query text               |
| `concepts`        | nearText concepts                    |
| `alpha`           | Hybrid balance (0=vector, 1=keyword) |

## Distance vs. Certainty

- **distance** (preferred in v1.14+): Lower = closer. Threshold acts as maximum.
- **certainty** (legacy): 0–1 range; higher is stricter.

## Supported Embedding Models

The template system detects dimensions for 15+ models:

- OpenAI (ada-002: 1536, text-embedding-3-small: 1536, text-embedding-3-large: 3072)
- Cohere v3: 1024
- Sentence Transformers (mpnet): 768
- BERT, PaLM, Ollama, AWS Bedrock, and more

::: tip
For a comprehensive guide covering all templates, best practices, and a troubleshooting FAQ with 41 common mistakes, see the [full GraphQL Templates Guide](https://github.com/muleyprasad/weaviate-studio/blob/main/docs/GRAPHQL_TEMPLATES.md).
:::
