# Weaviate Studio Sandbox

A local sandbox for testing **nested properties**, **cross-references**, and **multi-collection RAG** in [Weaviate Studio](https://marketplace.visualstudio.com/items?itemName=weaviate.weaviate-studio).

## What This Sandbox Supports

- **Nested object properties** – `Author.address`, `Book.metadata`, `GitHubUser.stats`
- **Cross-references** – `Book → Author`, `GitHubRepo → GitHubUser`, `Review → Book`
- **Multi-collection RAG** – query across Books and Podcasts with generative search
- **Generative queries** – natural-language answers grounded in retrieved data
- **Retrieved context inspection** – see which objects were retrieved before generation
- **Collection selection** – pick one or more collections in RAG Chat / Generative Search

## How It Works

All collections use the **local text2vec-transformers** sidecar for free embeddings — no API key needed for data import or vector search. The **generative-openai** module is also enabled, so you can run RAG / generative queries when you provide an `OPENAI_API_KEY` (only charged at query time, not on import).

## Collections

### Legacy (nested properties & cross-references)

| Collection           | Objects | Source                                                                      |
| -------------------- | ------- | --------------------------------------------------------------------------- |
| **JeopardyQuestion** | 100     | [Weaviate edu-datasets](https://github.com/weaviate-tutorials/edu-datasets) |
| **Author**           | 3       | Hardcoded sample data                                                       |
| **Publisher**        | 3       | Hardcoded sample data                                                       |
| **Book**             | 3       | Hardcoded sample data (refs → Author, Publisher)                            |
| **Review**           | 3       | Hardcoded sample data (refs → Book)                                         |
| **GitHubUser**       | ~5      | Live GitHub API                                                             |
| **GitHubRepo**       | ~10     | Live GitHub API (refs → GitHubUser)                                         |
| **GitHubIssue**      | ~5      | Live GitHub API (refs → GitHubRepo, GitHubUser)                             |

### RAG (text-rich, generative-ready)

| Collection        | Objects | Source                                                                                                                                              |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Books**         | ~10,000 | [Goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) — [books.csv](https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/books.csv) |
| **PodcastSearch** | ~10,000 | [Podcasts-Data](https://github.com/odenizgiz/Podcasts-Data) — `df_popular_podcasts.csv`                                                             |

Each RAG collection includes a synthesised `content` field that combines key metadata into a single text block for better retrieval and generation.

## Prerequisites

- Docker and Docker Compose
- Python 3.8+ with `pip`
- At least 4 GB RAM (8 GB recommended — the transformers sidecar needs memory)
- **Optional:** An OpenAI API key (only needed for generative / RAG queries)

## Setup

### 1. Create your `.env` file (optional — only for RAG queries)

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with your real OpenAI API key:

```
OPENAI_API_KEY=sk-…
```

> **Without an OpenAI key:** data import and vector search work fine. Only generative queries require the key.

### 2. Start Weaviate

```bash
docker compose up -d
```

### 3. Install Python dependencies

```bash
pip install weaviate-client requests
```

### 4. Populate seed data

```bash
# All collections (legacy + RAG)
python3 populate.py

# Or selectively:
python3 populate.py --rag-only        # Only Books + PodcastSearch
python3 populate.py --legacy-only     # Only Jeopardy, Author, Book, GitHub, etc.
python3 populate.py --skip-github     # Skip GitHub API calls
python3 populate.py --verify-only     # Just check what's already loaded
```

By default all rows are imported (embeddings are free). To limit import size, set `BOOKS_LIMIT` and `PODCASTS_LIMIT` in `populate.py` to a non-zero value. Note: importing ~20k objects through the local transformer can take a while on CPU.

### 5. Connect from Weaviate Studio

| Setting  | Value                   |
| -------- | ----------------------- |
| Endpoint | `http://localhost:8080` |
| API Key  | `test-key-123`          |

## Example Prompts to Test

### RAG / Generative Search (requires OpenAI key)

- _"Find highly rated fantasy books"_
- _"What topics do these podcasts cover?"_
- _"Which books and podcasts are related to psychology?"_
- _"Compare rationality-related podcast topics with highly rated nonfiction books"_

### Nested Properties & Cross-References

```graphql
{
  Get {
    Author {
      name
      address {
        city
        country
      }
      coordinates {
        latitude
        longitude
      }
    }
  }
}
```

```graphql
{
  Get {
    Book {
      title
      metadata {
        language
        edition
        format
      }
      writtenBy {
        ... on Author {
          name
        }
      }
      publishedBy {
        ... on Publisher {
          name
        }
      }
    }
  }
}
```

## Troubleshooting

### Container not starting

```bash
docker compose ps
docker compose logs weaviate
docker compose logs text2vec-transformers
```

### Missing OpenAI key (generative queries fail)

If you see `unauthorized` or `API key` errors on generative queries, make sure `.env` contains a valid `OPENAI_API_KEY` and restart:

```bash
docker compose down
docker compose up -d
```

> Vector search and data import work without an OpenAI key — only generative queries need it.

### GitHub API rate limits

The script includes rate-limiting delays. If you hit limits, wait an hour and re-run, or use `--skip-github`.

### Dataset download fails

The populate script downloads CSVs from GitHub. If URLs are unreachable, retry after a few minutes. The script logs the exact error and continues gracefully.

### Reset everything

```bash
docker compose down -v
docker compose up -d
python3 populate.py
```

## Files

| File                 | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `docker-compose.yml` | Weaviate + text2vec-transformers sidecar + generative-openai module |
| `.env.example`       | Template for the optional `OPENAI_API_KEY`                          |
| `populate.py`        | Creates all collections (legacy + RAG) and imports seed data        |
| `README.md`          | This documentation                                                  |

## References

- [Weaviate Documentation](https://docs.weaviate.io/)
- [OpenAI Generative Module](https://docs.weaviate.io/weaviate/model-providers/openai/generative)
- [Local Transformers Module](https://docs.weaviate.io/weaviate/model-providers/transformers)
- [Goodbooks-10k Dataset](https://github.com/zygmuntz/goodbooks-10k)
- [Podcasts-Data Dataset](https://github.com/odenizgiz/Podcasts-Data)
