# Weaviate Local Sandbox

This sandbox provides a lightweight **two-container Weaviate environment** for local testing and development:

- One container runs **Weaviate**, the open-source vector database with **file-based backup support**
- The second container runs a **local text2vec-transformers inference service** for text embeddings

Everything runs locally — **no paid API keys or external services** are required, since embeddings are generated within the local transformer container.

This setup is ideal for experimenting with schema design, testing queries, integrating with the Weaviate client libraries, or building local prototypes before deploying to the cloud.

For more details, see the official Weaviate documentation:

- [Weaviate Quickstart (Local)](https://docs.weaviate.io/weaviate/quickstart/local)
- [Docker Installation Guide](https://docs.weaviate.io/deploy/installation-guides/docker-installation)
- [Local Transformers Module](https://docs.weaviate.io/weaviate/model-providers/transformers)

---

## Prerequisites

- Docker and Docker Compose installed
- Python 3.8+ (for running the sample data script)
- At least 4GB of available RAM (8GB recommended)
- Optional: NVIDIA GPU for accelerated embeddings

---

## What’s Included

- **docker-compose.yml**  
  Launches a local Weaviate instance with the `text2vec-transformers` module configured for CPU or GPU embeddings.
- **populate.py**  
  A sample script that:
  - Uses Weaviate’s latest v4 client API
  - Creates a `JeopardyQuestion` collection with text vectorization
  - Imports 100 sample Jeopardy questions
  - Demonstrates schema creation, batch importing, and error handling
- **API Key configuration**
  - API Key: `test-key-123`
  - User: `studio-user@example.com` (any username works)
- **Preconfigured for fast local testing** with VS Code extensions, Weaviate Studio, or CLI-based scripts.

---

## Getting Started

### 1. Start the Environment

```bash
docker compose up -d
```

This command builds and starts both containers:

- The **Weaviate** database
- The **text2vec-transformers** embedding service

---

### 2. Load Sample Data (Optional)

```bash
# Install the Python Weaviate client
pip install weaviate-client

# Run the data population script
python populate.py
```

This script creates a `JeopardyQuestion` collection with 100 imported records, great for experimenting with vector search, metadata filtering, and hybrid querying.

---

### 3. Connect to Weaviate

- **Endpoint:** `http://localhost:8080`
- **API Key:** `test-key-123`

You can use:

- [Weaviate Studio](https://weaviate.io/developers/weaviate/tools/weaviate-studio)
- Python or JS clients
- Your own REST or gRPC APIs

**Optional sample collection:** `JeopardyQuestion`

Try the following:

- Run vector search queries on questions
- Filter by `round` or `value` fields
- Inspect vector embeddings created by the transformer

---

### 4. Create Backups (Optional)

This sandbox includes **file-based backup support** enabled by default. You can create backups of your collections using the Weaviate client:

**Python Example:**

```python
from weaviate.classes.backup import BackupLocation

result = client.backup.create(
    backup_id="my-backup",
    backend="filesystem",
    wait_for_completion=True,
    backup_location=BackupLocation.FileSystem(path="/var/lib/weaviate/backups")
)
print(result)
```

**REST API Example:**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-123" \
  -d '{"id": "my-backup"}' \
  http://localhost:8080/v1/backups/filesystem
```

**Key Points:**

- Backups are stored in the `weaviate_backups` Docker volume
- Backups include all collections by default (you can specify include/exclude)
- Suitable for development and testing (not recommended for production)
- Use `backup-s3`, `backup-gcs`, or `backup-azure` for production deployments

---

### 5. Stop the Environment

To stop the sandbox but keep your data:

```bash
docker compose down
```

To completely remove the containers and stored data:

```bash
docker compose down -v
```

---

## Customization

You can easily modify your environment to fit specific use cases:

- Change or upgrade the embedding model in the `text2vec-transformers` service.
- Enable GPU by setting:
  ```yaml
  ENABLE_CUDA: '1'
  ```
- Allow anonymous access instead of API key authentication by toggling:
  ```yaml
  AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
  AUTHENTICATION_APIKEY_ENABLED: 'false'
  ```

More configuration references:

- [Weaviate Configuration Variables](https://docs.weaviate.io/deploy/configuration/environment-variables)
- [Modules Overview](https://docs.weaviate.io/weaviate/modules)
- [Transformers Integration Guide](https://docs.weaviate.io/weaviate/model-providers/transformers)

---

**This sandbox is designed to give you a cost-free, local playground for learning, testing, and developing with Weaviate — no cloud, no authentication complexity, and no external vector APIs.**
