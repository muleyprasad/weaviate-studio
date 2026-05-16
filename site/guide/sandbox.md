---
title: Quick Start Sandbox — Try Weaviate Studio Locally with Docker
description: Spin up a local Weaviate instance with sample data in minutes using the Weaviate Studio sandbox — test collections, cross-references, generative search, and multi-vector queries locally.
---

# Quick Start Sandbox

A local sandbox for testing Weaviate Studio features — including nested properties, cross-references, and multi-collection generative search.

## What's Included

- **Nested object properties** — `Author.address`, `Book.metadata`
- **Cross-references** — `Book → Author`, `GitHubRepo → GitHubUser`
- **Multi-collection RAG** — Query across Books and Podcasts
- **Generative queries** — AI-powered answers grounded in retrieved data
- **No API key needed** — for data import and vector search

## Collections

### RAG Collections (text-rich, generative-ready)

| Collection        | Objects | Description                                          |
| ----------------- | ------- | ---------------------------------------------------- |
| **Books**         | ~10,000 | Goodbooks-10k dataset with synthesized content field |
| **PodcastSearch** | ~10,000 | Podcasts metadata with synthesized content           |

### Legacy Collections (nested properties & cross-references)

| Collection           | Objects | Notes                                |
| -------------------- | ------- | ------------------------------------ |
| **JeopardyQuestion** | 100     | edu-datasets sample                  |
| **Author**           | 3       | With nested address and coordinates  |
| **Publisher**        | 3       | Simple entity                        |
| **Book**             | 3       | Cross-refs to Author, Publisher      |
| **Review**           | 3       | Cross-refs to Book                   |
| **GitHubUser**       | ~5      | Live GitHub API                      |
| **GitHubRepo**       | ~10     | Cross-refs to GitHubUser             |
| **GitHubIssue**      | ~5      | Cross-refs to GitHubRepo, GitHubUser |

## Prerequisites

- Docker and Docker Compose
- Python 3.8+ with `pip`
- At least 4 GB RAM (8 GB recommended)
- **Optional:** OpenAI API key (only for generative queries)

## Setup

### 1. Environment (optional)

```bash
cp .env.example .env
```

Set your OpenAI key in `.env` if you want to use generative search:

```
OPENAI_API_KEY=sk-...
```

### 2. Start Weaviate

```bash
docker compose up -d
```

### 3. Install Python Dependencies

```bash
pip install weaviate-client requests
```

### 4. Populate Data

```bash
# All collections
python3 populate.py

# Or selectively:
python3 populate.py --rag-only        # Only Books + PodcastSearch
python3 populate.py --legacy-only     # Only legacy collections
python3 populate.py --skip-github     # Skip GitHub API calls
python3 populate.py --verify-only     # Check what's already loaded
```

### 5. Connect from Weaviate Studio

| Setting  | Value                   |
| -------- | ----------------------- |
| Endpoint | `http://localhost:8080` |
| API Key  | `test-key-123`          |

## Example Generative Queries

- _"Find highly rated fantasy books"_
- _"What topics do these podcasts cover?"_
- _"Compare rationality-related podcast topics with highly rated nonfiction books"_
- _"What stories involve mystery or investigation?"_

## Troubleshooting

### Container not starting

```bash
docker compose ps
docker compose logs weaviate
```

### Reset everything

```bash
docker compose down -v
docker compose up -d
python3 populate.py
```
