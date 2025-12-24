# Weaviate Studio Sandbox

A comprehensive local Weaviate environment for testing **nested properties** and **cross-references** in Weaviate Studio. This sandbox provides a complete setup with realistic test data to validate the enhanced query editor features.

## 🚀 Quick Start

1. **Start Weaviate:**

   ```bash
   docker-compose up -d
   ```

2. **Populate with test data:**

   ```bash
   python3 populate.py
   ```

3. **Connect to Weaviate:**
   - **Endpoint:** `http://localhost:8080`
   - **API Key:** `test-key-123`

## 📊 What You Get

### Collections Created

1. **JeopardyQuestion** - 100 trivia questions (original test data)
2. **Author** - Authors with nested address objects and geo coordinates
3. **Publisher** - Publishers with nested contact information
4. **Book** - Books with references to authors/publishers and nested metadata
5. **Review** - Reviews with nested reviewer info and references to books
6. **GitHubUser** - Real GitHub users with nested stats and URLs
7. **GitHubRepo** - Real repositories with nested metrics and license info
8. **GitHubIssue** - Real issues with nested reactions and labels

### Key Features to Test

- **Nested Object Properties**: `Author.address`, `Book.metadata`, `GitHubUser.stats`
- **Cross-References**: `Book → Author`, `GitHubRepo → GitHubUser`, `Review → Book`
- **Various Data Types**: Text, Numbers, Booleans, Dates, GeoCoordinates
- **Real-World Data**: Actual GitHub data via API

## 🧪 Testing Nested Properties

### Sample Queries

**Nested Address Information:**

```graphql
{
  Get {
    Author {
      name
      address {
        street
        city
        country
        zipCode
      }
      coordinates {
        latitude
        longitude
      }
    }
  }
}
```

**Book Metadata with References:**

```graphql
{
  Get {
    Book {
      title
      metadata {
        language
        edition
        format
        weight
      }
      writtenBy {
        ... on Author {
          name
          birthYear
        }
      }
      publishedBy {
        ... on Publisher {
          name
          foundedYear
        }
      }
    }
  }
}
```

**GitHub Data with Nested Stats:**

```graphql
{
  Get {
    GitHubUser {
      name
      login
      stats {
        publicRepos
        followers
        following
      }
      urls {
        htmlUrl
        blog
      }
    }
  }
}
```

**Complex Cross-Reference Query:**

```graphql
{
  Get {
    GitHubIssue {
      title
      state
      reactions {
        totalCount
        plusOne
        heart
      }
      belongsToRepo {
        ... on GitHubRepo {
          name
          metrics {
            stargazersCount
          }
          ownedBy {
            ... on GitHubUser {
              name
              login
            }
          }
        }
      }
    }
  }
}
```

## 🔧 Manual Testing Checklist

Use Weaviate Studio to verify:

- [ ] **Schema Introspection** - Nested properties appear in schema view
- [ ] **Query Templates** - Templates work with nested properties
- [ ] **Autocomplete** - Nested fields show in autocomplete
- [ ] **Cross-Reference Navigation** - Reference traversal works
- [ ] **Sample Query Generation** - Auto-generated queries include nested fields
- [ ] **Error Handling** - Invalid nested property paths handled gracefully
- [ ] **Performance** - Multi-level nested queries perform well

## 🛠️ Configuration

### Docker Compose Features

- **HTTP-Only Mode**: GRPC disabled for compatibility (`DISABLE_GRPC: 'true'`)
- **API Key Authentication**: Uses `test-key-123` for secure access
- **Local Embeddings**: `text2vec-transformers` with `sentence-transformers-multi-qa-MiniLM-L6-cos-v1`
- **Persistent Storage**: Data survives container restarts
- **Backup Support**: Filesystem backup module enabled

### GPU Support (Optional)

Enable GPU acceleration by changing in `docker-compose.yml`:

```yaml
ENABLE_CUDA: '1' # Set to '1' if you have GPU
```

## 🐛 Troubleshooting

**Connection Issues:**

```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs weaviate
docker-compose logs text2vec-transformers
```

**Data Issues:**

```bash
# Reset everything
docker-compose down -v && docker-compose up -d

# Re-populate data
python3 populate.py
```

**GitHub API Rate Limits:**

- The script includes rate limiting delays
- If you hit limits, wait 1 hour and re-run

## 📁 Files

- `docker-compose.yml` - Weaviate + transformers setup with HTTP-only mode
- `populate.py` - Comprehensive data population script
- `README.md` - This documentation

## 🎯 Expected Outcomes

After setup, you should be able to:

1. **See nested properties** in Weaviate Studio's schema view
2. **Generate sample queries** that include nested field selections
3. **Navigate cross-references** in query results
4. **Use autocomplete** for nested property paths
5. **Test complex queries** with multiple levels of nesting
6. **Verify error handling** for invalid nested paths

## 🔗 References

- [Weaviate Documentation](https://docs.weaviate.io/)
- [Weaviate Studio](https://weaviate.io/developers/weaviate/tools/weaviate-studio)
- [GraphQL Query Guide](https://docs.weaviate.io/developers/weaviate/api/graphql)
- [Nested Properties Documentation](https://docs.weaviate.io/developers/weaviate/config-refs/schema/multi-tenancy)

---

**This sandbox validates the nested property support in QueryEditorPanel.ts and graphqlTemplates.ts across various real-world scenarios.**
