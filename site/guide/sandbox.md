---
title: Quick Start Sandbox — Test Query Profiling and Semantic Search Locally
description: Run Weaviate Studio’s local Docker sandbox with searchable demo collections, Text (Semantic) search, and query profiling — then inspect per-shard timing in VS Code.
---

# Quick Start Sandbox

The sandbox lets you try Weaviate Studio against a local Weaviate instance before connecting a production cluster. For the query-profiling release, use the dedicated profiling configuration first: it creates searchable collections with a local text vectorizer, so the ordinary **Text (Semantic)** workflow remains available without a cloud embedding API key.

## Choose a Sandbox

| Sandbox | Best for | Start command |
| --- | --- | --- |
| **Query Profiling sandbox** | Testing **Profile**, **View profile**, Text (Semantic) search, and per-shard timing | `docker compose -f docker-compose.profiling.yml up -d` |
| **Extended sandbox** | Exploring the older RAG, nested-object, cross-reference, and bulk demo data | `docker compose up -d` |

## Query Profiling Sandbox

### Prerequisites

Install Docker with Docker Compose and Node.js. From a fresh repository clone, run `npm install` once so the seed script can use the project dependencies.

### 1. Start the Services

Run these commands from the repository’s `sandbox` directory:

```bash
docker compose -f docker-compose.profiling.yml up -d
docker compose -f docker-compose.profiling.yml ps
```

The first start downloads the local embedding model. Wait until the `text2vec-transformers` container is healthy before seeding. The seed script also waits for Weaviate readiness before creating data.

### 2. Seed Searchable Demo Collections

```bash
node seed-query-profiling.cjs
```

The script creates or refreshes the following focused demo collections:

| Collection | Recommended use |
| --- | --- |
| **ProfileTest** | A small, focused smoke-test collection for the profiling workflow. |
| **TravelGuide** | Ordinary **Text (Semantic)** search with travel-oriented content. |
| **ProductCatalog** | Ordinary **Text (Semantic)** search with product-oriented content. |

Re-running the script refreshes only these three collections.

### 3. Connect Weaviate Studio

| Setting | Value |
| --- | --- |
| Endpoint | `http://localhost:8080` |
| API key | `test-key-123` |

Open the **Weaviate Studio** side-bar view in VS Code, add the connection, then open **Data Explorer** for one of the seeded collections.

### 4. Profile a Search

1. Select **Vector Search**.
2. Use **Text (Semantic)** for `ProfileTest`, `TravelGuide`, or `ProductCatalog`, then enter a natural-language query such as `independence day of india`.
3. Check **Profile** beside **Run Vector Search**.
4. Run the search. Once results arrive, select **View profile** to reveal the per-shard **Timing breakdown**.

The setting is remembered across collection changes and Data Explorer panel reopens. Select **Hide profile** when you want to return to the compact results view.

> **Text (Semantic) search requirement:** A collection needs a text vectorizer. The profiling sandbox supplies a local `text2vec-transformers` service, so its three demo collections support this mode without a cloud API key.

### Reset the Profiling Sandbox

```bash
docker compose -f docker-compose.profiling.yml down -v --remove-orphans
docker compose -f docker-compose.profiling.yml up -d
node seed-query-profiling.cjs
```

## Extended Sandbox

The standard `docker compose.yml` workflow remains available for the larger legacy data set. It covers nested properties, cross-references, multi-collection RAG, generative queries, and bulk sample data.

### What’s Included

- **Nested object properties** — `Author.address`, `Book.metadata`
- **Cross-references** — `Book → Author`, `GitHubRepo → GitHubUser`
- **Multi-collection RAG** — Query across Books and Podcasts
- **Generative queries** — AI-powered answers grounded in retrieved data

### Start and Populate

```bash
docker compose up -d
pip install weaviate-client requests
python3 populate.py
```

For a smaller or specialized import, the script supports `--rag-only`, `--legacy-only`, `--skip-github`, and `--verify-only`.

### Example Generative Queries

- _"Find highly rated fantasy books"_
- _"What topics do these podcasts cover?"_
- _"Compare rationality-related podcast topics with highly rated nonfiction books"_
- _"What stories involve mystery or investigation?"_

## Troubleshooting

| Situation | What to do |
| --- | --- |
| The profiling seed fails immediately | Run `docker compose -f docker-compose.profiling.yml ps`, wait for the transformer service to become healthy, then rerun `node seed-query-profiling.cjs`. |
| The endpoint is not ready | Check `docker compose -f docker-compose.profiling.yml logs weaviate` and wait for Weaviate readiness. |
| Text (Semantic) search cannot vectorize input | Confirm that the profiling compose file, rather than the manual-vector-only setup, is running and that the selected collection is one of the seeded profiling collections. |
| You need a clean start | Use the reset commands above; they remove the profiling sandbox’s local volumes before reseeding. |
