# Weaviate Local Sandbox

This folder contains Docker Compose files and scripts to quickly launch a local Weaviate instance (with local text2vec-transformer support and API key authentication) for development, testing, and experimentation.

## What’s Included

- **docker-compose.yml**: Launches a local Weaviate vector database with a local text2vec-transformers module for GPU/CPU embeddings.
- **Sample API key authentication**:
  - API key: `test-key-123`
  - Username: `studio-user@example.com` (any username allowed)
- **Pre-configured for local VS Code/Weaviate Studio testing**

## Getting Started

### 1. Start the Environment

```bash
docker compose up -d
```

### 2. Connect to Weaviate

- **Endpoint:** `http://localhost:8080`
- **API Key:** `test-key-123`
- **Ideal for use with**: VS Code extensions, Weaviate Studio, Python/JS clients, etc.

### 3. Stop the Environment

To stop the sandbox but keep your data:

```bash
docker compose down
```

To completely remove all data (fresh start):

```bash
docker compose down -v
```

## Customization

You can easily swap the embedding model in `text2vec-transformers` by changing the Docker image or enable GPU by `ENABLE_CUDA: '1'`.
