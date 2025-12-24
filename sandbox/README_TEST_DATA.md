# Weaviate Studio Test Data Setup

This directory contains scripts to populate your Weaviate sandbox with comprehensive test data for testing nested properties and cross-references in Weaviate Studio.

## 🚀 Quick Start

1. **Start Weaviate:**

   ```bash
   docker-compose up -d
   ```

2. **Run the complete setup:**
   ```bash
   python3 setup_test_data.py
   ```

This will create all collections and populate them with test data.

## 📊 What Gets Created

### Original Data

- **JeopardyQuestion** - 100 trivia questions (from original populate.py)

### Advanced Collections (Books Domain)

- **Author** - Authors with nested address objects and geo coordinates
- **Publisher** - Publishers with nested contact information
- **Book** - Books with references to authors/publishers and nested metadata
- **Review** - Reviews with nested reviewer info and references to books

### Real-World Data (GitHub Domain)

- **GitHubUser** - Real GitHub users with nested stats and URLs
- **GitHubRepo** - Real repositories with nested metrics and license info
- **GitHubIssue** - Real issues with nested reactions and labels

## 🧪 Testing Features

### 1. Nested Object Properties

Test these nested structures in your queries:

**Author.address:**

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
    }
  }
}
```

**Book.metadata:**

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
    }
  }
}
```

**GitHubUser.stats:**

```graphql
{
  Get {
    GitHubUser {
      name
      stats {
        publicRepos
        followers
        following
      }
    }
  }
}
```

### 2. Cross-References

Test relationship traversal:

**Books with Authors and Publishers:**

```graphql
{
  Get {
    Book {
      title
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

**GitHub Repos with Owners:**

```graphql
{
  Get {
    GitHubRepo {
      name
      language
      metrics {
        stargazersCount
        forksCount
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
```

### 3. Complex Nested Queries

**Issues with Full Context:**

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
          ownedBy {
            ... on GitHubUser {
              name
            }
          }
        }
      }
    }
  }
}
```

### 4. Various Data Types

The collections include:

- **Text**: names, descriptions, bios
- **Numbers**: years, counts, prices, ratings
- **Booleans**: isActive, inStock, verified
- **Dates**: publishedDate, createdAt, reviewDate
- **GeoCoordinates**: author locations, publisher headquarters

### 5. Filtering and Aggregation

Test filters on nested properties:

```graphql
{
  Get {
    Book(where: { path: ["metadata", "language"], operator: Equal, valueText: "English" }) {
      title
      metadata {
        language
        format
      }
    }
  }
}
```

## 📁 Individual Scripts

If you want to run scripts individually:

- `populate.py` - Original Jeopardy questions (fixed for HTTP-only)
- `populate_advanced.py` - Books domain with nested properties
- `populate_github_data.py` - Real GitHub data via API
- `setup_test_data.py` - Runs all scripts in sequence

## 🔧 Manual Testing Checklist

Use Weaviate Studio to test:

- [ ] **Schema Introspection** - Verify nested properties appear in schema
- [ ] **Query Templates** - Test if templates work with nested properties
- [ ] **Autocomplete** - Check if nested fields show in autocomplete
- [ ] **Cross-Reference Navigation** - Verify reference traversal works
- [ ] **Sample Query Generation** - Test auto-generated queries include nested fields
- [ ] **Error Handling** - Test invalid nested property paths
- [ ] **Performance** - Test queries with multiple levels of nesting

## 🐛 Troubleshooting

**Connection Issues:**

- Ensure Weaviate is running: `docker-compose ps`
- Check logs: `docker-compose logs weaviate`

**Data Issues:**

- Clear all data: `docker-compose down -v && docker-compose up -d`
- Re-run setup: `python3 setup_test_data.py`

**GitHub API Rate Limits:**

- The GitHub script includes rate limiting delays
- If you hit limits, wait and re-run just the GitHub script

## 🎯 Expected Outcomes

After running the setup, you should be able to:

1. **See nested properties** in Weaviate Studio's schema view
2. **Generate sample queries** that include nested field selections
3. **Navigate cross-references** in query results
4. **Use autocomplete** for nested property paths
5. **Test complex queries** with multiple levels of nesting
6. **Verify error handling** for invalid nested paths

This comprehensive test data will help validate that the nested property support in QueryEditorPanel.ts and graphqlTemplates.ts is working correctly across various real-world scenarios.
