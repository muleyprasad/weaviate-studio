#!/usr/bin/env python3
"""
Weaviate Studio Sandbox – Comprehensive Test Data Population

This script creates collections for both nested-property / cross-reference testing
AND multi-collection RAG / generative search testing.

All collections use local text2vec-transformers for free embeddings.
RAG collections also have generative-openai configured for generative queries.

Legacy collections (nested properties & cross-references):
  1. JeopardyQuestion – Trivia questions
  2. Author           – Authors with nested address objects
  3. Publisher         – Publishers with nested contact info
  4. Book             – Books with references and nested metadata
  5. Review           – Reviews with nested reviewer info
  6. GitHubUser       – Real GitHub users with nested stats
  7. GitHubRepo       – Real repositories with nested metrics
  8. GitHubIssue      – Real issues with nested reactions

RAG collections (text-rich, generative-ready):
  9. Books            – Goodbooks-10k metadata
 10. PodcastSearch    – iTunes popular-podcasts dataset

Usage:
    python3 populate.py [--skip-github] [--verify-only] [--rag-only] [--legacy-only]

Options:
    --skip-github   Skip GitHub data fetching (faster, no API calls)
    --verify-only   Only verify existing collections, don't populate
    --rag-only      Only create the RAG collections (Books, PodcastSearch)
    --legacy-only   Only create the legacy collections (Jeopardy, Author, etc.)
"""

import weaviate
import weaviate.classes as wvc
from weaviate.classes.config import Configure, Property, DataType
import requests
import json
import csv
import io
import time
import os
import sys
import argparse
from datetime import datetime
import random

# ──────────────────────────────────────────────────────────────
# Constants – tweak these to change how much data is imported.
# ──────────────────────────────────────────────────────────────
# Set to 0 to import all rows. Local transformer embeddings are free.
BOOKS_LIMIT = 0
PODCASTS_LIMIT = 0

BOOKS_CSV_URL = (
    "https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/books.csv"
)
PODCASTS_CSV_URL = (
    "https://raw.githubusercontent.com/odenizgiz/Podcasts-Data/master/df_popular_podcasts.csv"
)

WEAVIATE_HOST = "localhost"
WEAVIATE_PORT = 8080
WEAVIATE_API_KEY = "test-key-123"

# Force HTTP-only mode
os.environ["WEAVIATE_GRPC_ENABLED"] = "false"


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def download_csv(url: str, label: str) -> list[dict]:
    """Download a CSV from *url* and return a list of row-dicts."""
    print(f"⬇  Downloading {label} from {url} …")
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
    except Exception as exc:
        print(f"✗  Failed to download {label}: {exc}")
        return []

    try:
        text = resp.content.decode("utf-8")
    except UnicodeDecodeError:
        text = resp.content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = [row for row in reader]
    print(f"✓  Downloaded {len(rows)} rows for {label}")
    return rows


def safe_int(value, default=0):
    if not value:
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def safe_float(value, default=0.0):
    if not value:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def connect_to_weaviate():
    """Connect to Weaviate with error handling"""
    try:
        client = weaviate.connect_to_local(
            host=WEAVIATE_HOST,
            port=WEAVIATE_PORT,
            auth_credentials=weaviate.auth.AuthApiKey(WEAVIATE_API_KEY),
            skip_init_checks=True,
            additional_config=weaviate.config.AdditionalConfig(
                timeout=weaviate.config.Timeout(init=30, query=60, insert=120)
            )
        )
        print("✓ Connected to Weaviate successfully")

        print("Checking if Weaviate is ready...")
        for attempt in range(10):
            try:
                client.collections.list_all()
                print("✓ Weaviate is ready")
                return client
            except Exception:
                print(f"Waiting for Weaviate to be ready... (attempt {attempt + 1}/10)")
                time.sleep(2)

        print("✗ Weaviate is not ready after 20 seconds")
        return None

    except Exception as e:
        print(f"✗ Failed to connect to Weaviate: {e}")
        print("Make sure Weaviate is running with: docker compose up -d")
        return None


# ══════════════════════════════════════════════════════════════
# LEGACY COLLECTIONS (nested properties & cross-references)
# ══════════════════════════════════════════════════════════════

def create_jeopardy_collection(client):
    """Create and populate JeopardyQuestion collection"""
    print("\n=== Creating JeopardyQuestion collection ===")

    try:
        if client.collections.exists("JeopardyQuestion"):
            client.collections.delete("JeopardyQuestion")
            print("✓ Deleted existing JeopardyQuestion collection")
    except Exception as e:
        print(f"Note: Could not delete existing JeopardyQuestion collection: {e}")

    try:
        collection = client.collections.create(
            name="JeopardyQuestion",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="question", data_type=DataType.TEXT),
                Property(name="answer", data_type=DataType.TEXT),
                Property(name="round", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="value", data_type=DataType.INT),
            ]
        )
        print("✓ JeopardyQuestion collection created successfully!")

        print("Downloading Jeopardy sample data...")
        url = 'https://raw.githubusercontent.com/weaviate-tutorials/edu-datasets/main/jeopardy_100.json'
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = json.loads(resp.text)
        print(f"✓ Downloaded {len(data)} sample questions")

        print("Starting Jeopardy data import...")
        success_count = 0

        for i, row in enumerate(data):
            try:
                question_object = {
                    "question": row["Question"],
                    "answer": row["Answer"],
                    "value": row.get("Value", 0) if row.get("Value") else 0,
                    "round": row["Round"],
                }
                collection.data.insert(question_object)
                success_count += 1
                if (i + 1) % 10 == 0:
                    print(f"Imported {i + 1} Jeopardy questions...")
            except Exception as e:
                print(f"Failed to insert Jeopardy question {i + 1}: {e}")

        print(f"✓ Successfully imported {success_count} out of {len(data)} Jeopardy questions")
        return True

    except Exception as e:
        print(f"✗ Failed to create JeopardyQuestion collection: {e}")
        return False


def create_book_collections(client):
    """Create and populate Author, Publisher, Book, and Review collections"""
    print("\n=== Creating Book Domain Collections ===")

    # Collection 1: Author
    print("Creating Author collection...")
    try:
        if client.collections.exists("Author"):
            client.collections.delete("Author")
            print("✓ Deleted existing Author collection")
    except Exception as e:
        print(f"Note: Could not delete existing Author collection: {e}")

    try:
        author_collection = client.collections.create(
            name="Author",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="name", data_type=DataType.TEXT),
                Property(name="bio", data_type=DataType.TEXT),
                Property(name="birthYear", data_type=DataType.INT),
                Property(name="isActive", data_type=DataType.BOOL),
                Property(
                    name="address",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="street", data_type=DataType.TEXT),
                        Property(name="city", data_type=DataType.TEXT),
                        Property(name="country", data_type=DataType.TEXT),
                        Property(name="zipCode", data_type=DataType.TEXT),
                    ]
                ),
                Property(name="coordinates", data_type=DataType.GEO_COORDINATES),
            ]
        )
        print("✓ Author collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create Author collection: {e}")
        return False

    # Collection 2: Publisher
    print("Creating Publisher collection...")
    try:
        if client.collections.exists("Publisher"):
            client.collections.delete("Publisher")
            print("✓ Deleted existing Publisher collection")
    except Exception as e:
        print(f"Note: Could not delete existing Publisher collection: {e}")

    try:
        publisher_collection = client.collections.create(
            name="Publisher",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="name", data_type=DataType.TEXT),
                Property(name="foundedYear", data_type=DataType.INT),
                Property(name="website", data_type=DataType.TEXT, skip_vectorization=True),
                Property(
                    name="contactInfo",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="email", data_type=DataType.TEXT),
                        Property(name="phone", data_type=DataType.TEXT),
                        Property(name="address", data_type=DataType.TEXT),
                    ]
                ),
                Property(name="headquarters", data_type=DataType.GEO_COORDINATES),
            ]
        )
        print("✓ Publisher collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create Publisher collection: {e}")
        return False

    # Collection 3: Book
    print("Creating Book collection...")
    try:
        if client.collections.exists("Book"):
            client.collections.delete("Book")
            print("✓ Deleted existing Book collection")
    except Exception as e:
        print(f"Note: Could not delete existing Book collection: {e}")

    try:
        book_collection = client.collections.create(
            name="Book",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="title", data_type=DataType.TEXT),
                Property(name="description", data_type=DataType.TEXT),
                Property(name="isbn", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="publishedDate", data_type=DataType.DATE),
                Property(name="pageCount", data_type=DataType.INT),
                Property(name="price", data_type=DataType.NUMBER),
                Property(name="inStock", data_type=DataType.BOOL),
                Property(name="genre", data_type=DataType.TEXT, skip_vectorization=True),
                Property(
                    name="metadata",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="language", data_type=DataType.TEXT),
                        Property(name="edition", data_type=DataType.TEXT),
                        Property(name="format", data_type=DataType.TEXT),
                        Property(name="weight", data_type=DataType.NUMBER),
                    ]
                ),
            ],
            references=[
                wvc.config.ReferenceProperty(name="writtenBy", target_collection="Author"),
                wvc.config.ReferenceProperty(name="publishedBy", target_collection="Publisher"),
            ]
        )
        print("✓ Book collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create Book collection: {e}")
        return False

    # Collection 4: Review
    print("Creating Review collection...")
    try:
        if client.collections.exists("Review"):
            client.collections.delete("Review")
            print("✓ Deleted existing Review collection")
    except Exception as e:
        print(f"Note: Could not delete existing Review collection: {e}")

    try:
        review_collection = client.collections.create(
            name="Review",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="title", data_type=DataType.TEXT),
                Property(name="content", data_type=DataType.TEXT),
                Property(name="rating", data_type=DataType.INT),
                Property(name="reviewDate", data_type=DataType.DATE),
                Property(name="verified", data_type=DataType.BOOL),
                Property(
                    name="reviewer",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="name", data_type=DataType.TEXT),
                        Property(name="email", data_type=DataType.TEXT),
                        Property(name="memberSince", data_type=DataType.DATE),
                        Property(name="totalReviews", data_type=DataType.INT),
                    ]
                ),
            ],
            references=[
                wvc.config.ReferenceProperty(name="reviewsBook", target_collection="Book"),
            ]
        )
        print("✓ Review collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create Review collection: {e}")
        return False

    # Populate with sample data
    print("\nPopulating book domain collections...")

    authors_data = [
        {
            "name": "J.K. Rowling",
            "bio": "British author best known for the Harry Potter fantasy series",
            "birthYear": 1965,
            "isActive": True,
            "address": {"street": "123 Magic Lane", "city": "Edinburgh", "country": "Scotland", "zipCode": "EH1 1AA"},
            "coordinates": {"latitude": 55.9533, "longitude": -3.1883}
        },
        {
            "name": "George R.R. Martin",
            "bio": "American novelist and short story writer, known for A Song of Ice and Fire",
            "birthYear": 1948,
            "isActive": True,
            "address": {"street": "456 Winter Street", "city": "Santa Fe", "country": "USA", "zipCode": "87501"},
            "coordinates": {"latitude": 35.6870, "longitude": -105.9378}
        },
        {
            "name": "Agatha Christie",
            "bio": "English writer known for her detective novels featuring Hercule Poirot",
            "birthYear": 1890,
            "isActive": False,
            "address": {"street": "789 Mystery Avenue", "city": "Torquay", "country": "England", "zipCode": "TQ1 1AA"},
            "coordinates": {"latitude": 50.4619, "longitude": -3.5253}
        }
    ]

    author_ids = []
    for author_data in authors_data:
        try:
            result = author_collection.data.insert(author_data)
            author_ids.append(result)
            print(f"✓ Inserted author: {author_data['name']}")
        except Exception as e:
            print(f"✗ Failed to insert author {author_data['name']}: {e}")

    publishers_data = [
        {
            "name": "Bloomsbury Publishing",
            "foundedYear": 1986,
            "website": "https://www.bloomsbury.com",
            "contactInfo": {"email": "info@bloomsbury.com", "phone": "+44 20 7631 5600", "address": "50 Bedford Square, London WC1B 3DP"},
            "headquarters": {"latitude": 51.5194, "longitude": -0.1291}
        },
        {
            "name": "Bantam Books",
            "foundedYear": 1945,
            "website": "https://www.bantam.com",
            "contactInfo": {"email": "contact@bantam.com", "phone": "+1 212 782 9000", "address": "1745 Broadway, New York, NY 10019"},
            "headquarters": {"latitude": 40.7614, "longitude": -73.9776}
        },
        {
            "name": "HarperCollins",
            "foundedYear": 1989,
            "website": "https://www.harpercollins.com",
            "contactInfo": {"email": "info@harpercollins.com", "phone": "+1 212 207 7000", "address": "195 Broadway, New York, NY 10007"},
            "headquarters": {"latitude": 40.7128, "longitude": -74.0060}
        }
    ]

    publisher_ids = []
    for publisher_data in publishers_data:
        try:
            result = publisher_collection.data.insert(publisher_data)
            publisher_ids.append(result)
            print(f"✓ Inserted publisher: {publisher_data['name']}")
        except Exception as e:
            print(f"✗ Failed to insert publisher {publisher_data['name']}: {e}")

    books_data = [
        {
            "title": "Harry Potter and the Philosopher's Stone",
            "description": "The first book in the Harry Potter series about a young wizard's adventures",
            "isbn": "978-0-7475-3269-9",
            "publishedDate": "1997-06-26T00:00:00Z",
            "pageCount": 223,
            "price": 12.99,
            "inStock": True,
            "genre": "Fantasy",
            "metadata": {"language": "English", "edition": "First Edition", "format": "Hardcover", "weight": 0.5}
        },
        {
            "title": "A Game of Thrones",
            "description": "The first novel in A Song of Ice and Fire series, epic fantasy set in Westeros",
            "isbn": "978-0-553-10354-0",
            "publishedDate": "1996-08-01T00:00:00Z",
            "pageCount": 694,
            "price": 15.99,
            "inStock": True,
            "genre": "Epic Fantasy",
            "metadata": {"language": "English", "edition": "Mass Market", "format": "Paperback", "weight": 0.8}
        },
        {
            "title": "Murder on the Orient Express",
            "description": "A classic detective novel featuring Hercule Poirot solving a murder on a train",
            "isbn": "978-0-00-711926-0",
            "publishedDate": "1934-01-01T00:00:00Z",
            "pageCount": 256,
            "price": 9.99,
            "inStock": False,
            "genre": "Mystery",
            "metadata": {"language": "English", "edition": "Reprint", "format": "Paperback", "weight": 0.3}
        }
    ]

    book_ids = []
    for i, book_data in enumerate(books_data):
        try:
            result = book_collection.data.insert(
                properties=book_data,
                references={
                    "writtenBy": author_ids[i] if i < len(author_ids) else author_ids[0],
                    "publishedBy": publisher_ids[i] if i < len(publisher_ids) else publisher_ids[0]
                }
            )
            book_ids.append(result)
            print(f"✓ Inserted book: {book_data['title']}")
        except Exception as e:
            print(f"✗ Failed to insert book {book_data['title']}: {e}")

    reviews_data = [
        {
            "title": "Magical and Captivating",
            "content": "An absolutely wonderful introduction to the wizarding world. Rowling's imagination knows no bounds!",
            "rating": 5,
            "reviewDate": "2023-01-15T10:30:00Z",
            "verified": True,
            "reviewer": {"name": "BookLover123", "email": "booklover@example.com", "memberSince": "2020-03-01T00:00:00Z", "totalReviews": 47}
        },
        {
            "title": "Epic but Slow Start",
            "content": "Game of Thrones is incredibly detailed and complex. Takes time to get into but worth the investment.",
            "rating": 4,
            "reviewDate": "2023-02-20T14:45:00Z",
            "verified": True,
            "reviewer": {"name": "FantasyFan", "email": "fantasy@example.com", "memberSince": "2019-07-15T00:00:00Z", "totalReviews": 23}
        },
        {
            "title": "Classic Mystery Done Right",
            "content": "Christie's plotting is masterful. Every clue is perfectly placed and the solution is both surprising and logical.",
            "rating": 5,
            "reviewDate": "2023-03-10T09:15:00Z",
            "verified": False,
            "reviewer": {"name": "MysteryReader", "email": "mystery@example.com", "memberSince": "2021-11-20T00:00:00Z", "totalReviews": 12}
        }
    ]

    for i, review_data in enumerate(reviews_data):
        try:
            review_collection.data.insert(
                properties=review_data,
                references={"reviewsBook": book_ids[i] if i < len(book_ids) else book_ids[0]}
            )
            print(f"✓ Inserted review: {review_data['title']}")
        except Exception as e:
            print(f"✗ Failed to insert review {review_data['title']}: {e}")

    print("✓ Book domain collections populated successfully!")
    return True


def create_github_collections(client, skip_github=False):
    """Create and populate GitHub collections"""
    print("\n=== Creating GitHub Collections ===")

    # Collection 1: GitHubUser
    print("Creating GitHubUser collection...")
    try:
        if client.collections.exists("GitHubUser"):
            client.collections.delete("GitHubUser")
            print("✓ Deleted existing GitHubUser collection")
    except Exception as e:
        print(f"Note: Could not delete existing GitHubUser collection: {e}")

    try:
        github_user_collection = client.collections.create(
            name="GitHubUser",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="login", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="name", data_type=DataType.TEXT),
                Property(name="bio", data_type=DataType.TEXT),
                Property(name="company", data_type=DataType.TEXT),
                Property(name="location", data_type=DataType.TEXT),
                Property(name="email", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="hireable", data_type=DataType.BOOL),
                Property(name="createdAt", data_type=DataType.DATE),
                Property(
                    name="stats",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="publicRepos", data_type=DataType.INT),
                        Property(name="publicGists", data_type=DataType.INT),
                        Property(name="followers", data_type=DataType.INT),
                        Property(name="following", data_type=DataType.INT),
                    ]
                ),
                Property(
                    name="urls",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="htmlUrl", data_type=DataType.TEXT),
                        Property(name="blog", data_type=DataType.TEXT),
                        Property(name="twitterUsername", data_type=DataType.TEXT),
                    ]
                ),
            ]
        )
        print("✓ GitHubUser collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create GitHubUser collection: {e}")
        return False

    # Collection 2: GitHubRepo
    print("Creating GitHubRepo collection...")
    try:
        if client.collections.exists("GitHubRepo"):
            client.collections.delete("GitHubRepo")
            print("✓ Deleted existing GitHubRepo collection")
    except Exception as e:
        print(f"Note: Could not delete existing GitHubRepo collection: {e}")

    try:
        github_repo_collection = client.collections.create(
            name="GitHubRepo",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="name", data_type=DataType.TEXT),
                Property(name="fullName", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="description", data_type=DataType.TEXT),
                Property(name="language", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="private", data_type=DataType.BOOL),
                Property(name="fork", data_type=DataType.BOOL),
                Property(name="archived", data_type=DataType.BOOL),
                Property(name="createdAt", data_type=DataType.DATE),
                Property(name="updatedAt", data_type=DataType.DATE),
                Property(name="pushedAt", data_type=DataType.DATE),
                Property(name="size", data_type=DataType.INT),
                Property(
                    name="metrics",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="stargazersCount", data_type=DataType.INT),
                        Property(name="watchersCount", data_type=DataType.INT),
                        Property(name="forksCount", data_type=DataType.INT),
                        Property(name="openIssuesCount", data_type=DataType.INT),
                    ]
                ),
                Property(name="topics", data_type=DataType.TEXT, skip_vectorization=True),
                Property(
                    name="license",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="key", data_type=DataType.TEXT),
                        Property(name="name", data_type=DataType.TEXT),
                        Property(name="spdxId", data_type=DataType.TEXT),
                    ]
                ),
            ],
            references=[
                wvc.config.ReferenceProperty(name="ownedBy", target_collection="GitHubUser"),
            ]
        )
        print("✓ GitHubRepo collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create GitHubRepo collection: {e}")
        return False

    # Collection 3: GitHubIssue
    print("Creating GitHubIssue collection...")
    try:
        if client.collections.exists("GitHubIssue"):
            client.collections.delete("GitHubIssue")
            print("✓ Deleted existing GitHubIssue collection")
    except Exception as e:
        print(f"Note: Could not delete existing GitHubIssue collection: {e}")

    try:
        github_issue_collection = client.collections.create(
            name="GitHubIssue",
            vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
            generative_config=Configure.Generative.openai(),
            properties=[
                Property(name="title", data_type=DataType.TEXT),
                Property(name="body", data_type=DataType.TEXT),
                Property(name="number", data_type=DataType.INT),
                Property(name="state", data_type=DataType.TEXT, skip_vectorization=True),
                Property(name="locked", data_type=DataType.BOOL),
                Property(name="createdAt", data_type=DataType.DATE),
                Property(name="updatedAt", data_type=DataType.DATE),
                Property(name="closedAt", data_type=DataType.DATE),
                Property(
                    name="labels",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="names", data_type=DataType.TEXT),
                        Property(name="colors", data_type=DataType.TEXT),
                        Property(name="count", data_type=DataType.INT),
                    ]
                ),
                Property(
                    name="reactions",
                    data_type=DataType.OBJECT,
                    nested_properties=[
                        Property(name="totalCount", data_type=DataType.INT),
                        Property(name="plusOne", data_type=DataType.INT),
                        Property(name="minusOne", data_type=DataType.INT),
                        Property(name="laugh", data_type=DataType.INT),
                        Property(name="hooray", data_type=DataType.INT),
                        Property(name="confused", data_type=DataType.INT),
                        Property(name="heart", data_type=DataType.INT),
                        Property(name="rocket", data_type=DataType.INT),
                        Property(name="eyes", data_type=DataType.INT),
                    ]
                ),
            ],
            references=[
                wvc.config.ReferenceProperty(name="belongsToRepo", target_collection="GitHubRepo"),
                wvc.config.ReferenceProperty(name="createdBy", target_collection="GitHubUser"),
            ]
        )
        print("✓ GitHubIssue collection created successfully!")
    except Exception as e:
        print(f"✗ Failed to create GitHubIssue collection: {e}")
        return False

    if skip_github:
        print("⏭️  Skipping GitHub data fetching (--skip-github flag)")
        return True

    # Fetch real GitHub data
    print("\nFetching real GitHub data...")
    popular_users = ["torvalds", "gaearon", "sindresorhus", "tj", "addyosmani"]
    user_ids = []
    repo_ids = []

    for username in popular_users:
        try:
            print(f"Fetching user: {username}")
            response = requests.get(f"https://api.github.com/users/{username}", timeout=10)

            if response.status_code == 200:
                user_data = response.json()

                user_obj = {
                    "login": user_data.get("login", ""),
                    "name": user_data.get("name", ""),
                    "bio": user_data.get("bio", ""),
                    "company": user_data.get("company", ""),
                    "location": user_data.get("location", ""),
                    "email": user_data.get("email", ""),
                    "hireable": user_data.get("hireable", False) if user_data.get("hireable") is not None else False,
                    "createdAt": user_data.get("created_at", ""),
                    "stats": {
                        "publicRepos": user_data.get("public_repos", 0),
                        "publicGists": user_data.get("public_gists", 0),
                        "followers": user_data.get("followers", 0),
                        "following": user_data.get("following", 0),
                    },
                    "urls": {
                        "htmlUrl": user_data.get("html_url", ""),
                        "blog": user_data.get("blog", ""),
                        "twitterUsername": user_data.get("twitter_username", ""),
                    }
                }

                result = github_user_collection.data.insert(user_obj)
                user_ids.append(result)
                print(f"✓ Inserted user: {user_data.get('name', username)}")

                repos_response = requests.get(
                    f"https://api.github.com/users/{username}/repos?sort=stars&per_page=3",
                    timeout=10
                )

                if repos_response.status_code == 200:
                    repos_data = repos_response.json()

                    for repo_data in repos_data[:2]:
                        try:
                            repo_obj = {
                                "name": repo_data.get("name", ""),
                                "fullName": repo_data.get("full_name", ""),
                                "description": repo_data.get("description", ""),
                                "language": repo_data.get("language", ""),
                                "private": repo_data.get("private", False),
                                "fork": repo_data.get("fork", False),
                                "archived": repo_data.get("archived", False),
                                "createdAt": repo_data.get("created_at", ""),
                                "updatedAt": repo_data.get("updated_at", ""),
                                "pushedAt": repo_data.get("pushed_at", ""),
                                "size": repo_data.get("size", 0),
                                "metrics": {
                                    "stargazersCount": repo_data.get("stargazers_count", 0),
                                    "watchersCount": repo_data.get("watchers_count", 0),
                                    "forksCount": repo_data.get("forks_count", 0),
                                    "openIssuesCount": repo_data.get("open_issues_count", 0),
                                },
                                "topics": ", ".join(repo_data.get("topics", [])),
                                "license": {
                                    "key": repo_data.get("license", {}).get("key", "") if repo_data.get("license") else "",
                                    "name": repo_data.get("license", {}).get("name", "") if repo_data.get("license") else "",
                                    "spdxId": repo_data.get("license", {}).get("spdx_id", "") if repo_data.get("license") else "",
                                } if repo_data.get("license") else {"key": "", "name": "", "spdxId": ""}
                            }

                            repo_result = github_repo_collection.data.insert(
                                properties=repo_obj,
                                references={"ownedBy": result}
                            )
                            repo_ids.append(repo_result)
                            print(f"  ✓ Inserted repo: {repo_data.get('name', 'Unknown')}")

                            issues_response = requests.get(
                                f"https://api.github.com/repos/{repo_data.get('full_name')}/issues?state=all&per_page=2",
                                timeout=10
                            )

                            if issues_response.status_code == 200:
                                issues_data = issues_response.json()

                                for issue_data in issues_data[:1]:
                                    try:
                                        if 'pull_request' in issue_data:
                                            continue

                                        labels_names = [label.get("name", "") for label in issue_data.get("labels", [])]
                                        labels_colors = [label.get("color", "") for label in issue_data.get("labels", [])]

                                        issue_obj = {
                                            "title": issue_data.get("title", ""),
                                            "body": (issue_data.get("body", "") or "")[:1000],
                                            "number": issue_data.get("number", 0),
                                            "state": issue_data.get("state", ""),
                                            "locked": issue_data.get("locked", False),
                                            "createdAt": issue_data.get("created_at", ""),
                                            "updatedAt": issue_data.get("updated_at", ""),
                                            "closedAt": issue_data.get("closed_at", ""),
                                            "labels": {
                                                "names": ", ".join(labels_names),
                                                "colors": ", ".join(labels_colors),
                                                "count": len(labels_names),
                                            },
                                            "reactions": {
                                                "totalCount": issue_data.get("reactions", {}).get("total_count", 0),
                                                "plusOne": issue_data.get("reactions", {}).get("+1", 0),
                                                "minusOne": issue_data.get("reactions", {}).get("-1", 0),
                                                "laugh": issue_data.get("reactions", {}).get("laugh", 0),
                                                "hooray": issue_data.get("reactions", {}).get("hooray", 0),
                                                "confused": issue_data.get("reactions", {}).get("confused", 0),
                                                "heart": issue_data.get("reactions", {}).get("heart", 0),
                                                "rocket": issue_data.get("reactions", {}).get("rocket", 0),
                                                "eyes": issue_data.get("reactions", {}).get("eyes", 0),
                                            }
                                        }

                                        github_issue_collection.data.insert(
                                            properties=issue_obj,
                                            references={
                                                "belongsToRepo": repo_result,
                                                "createdBy": result
                                            }
                                        )
                                        print(f"    ✓ Inserted issue: {issue_data.get('title', 'Unknown')[:50]}...")

                                    except Exception as e:
                                        print(f"    ✗ Failed to insert issue: {e}")

                            time.sleep(0.5)

                        except Exception as e:
                            print(f"  ✗ Failed to insert repo {repo_data.get('name', 'Unknown')}: {e}")

                time.sleep(1)

            else:
                print(f"✗ Failed to fetch user {username}: HTTP {response.status_code}")

        except Exception as e:
            print(f"✗ Failed to process user {username}: {e}")

    print("✓ GitHub collections populated successfully!")
    print(f"  - Created {len(user_ids)} GitHub users")
    print(f"  - Created {len(repo_ids)} GitHub repositories")
    return True


# ══════════════════════════════════════════════════════════════
# RAG COLLECTIONS (text-rich, generative-ready)
# ══════════════════════════════════════════════════════════════

def create_rag_books_collection(client):
    """Create and populate the Books collection (Goodbooks-10k)."""
    collection_name = "Books"
    print(f"\n{'=' * 60}")
    print(f"  Creating {collection_name} collection (RAG)")
    print(f"{'=' * 60}")

    if client.collections.exists(collection_name):
        client.collections.delete(collection_name)
        print(f"✓  Deleted existing {collection_name}")

    collection = client.collections.create(
        name=collection_name,
        vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
        generative_config=Configure.Generative.openai(),
        properties=[
            Property(name="book_id", data_type=DataType.INT, skip_vectorization=True),
            Property(name="goodreads_book_id", data_type=DataType.INT, skip_vectorization=True),
            Property(name="title", data_type=DataType.TEXT),
            Property(name="authors", data_type=DataType.TEXT),
            Property(name="original_publication_year", data_type=DataType.INT, skip_vectorization=True),
            Property(name="average_rating", data_type=DataType.NUMBER, skip_vectorization=True),
            Property(name="ratings_count", data_type=DataType.INT, skip_vectorization=True),
            Property(name="language_code", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="image_url", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="small_image_url", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="content", data_type=DataType.TEXT),
        ],
    )
    print(f"✓  {collection_name} collection created")

    rows = download_csv(BOOKS_CSV_URL, "Books")
    if not rows:
        return 0

    subset = rows if BOOKS_LIMIT == 0 else rows[:BOOKS_LIMIT]
    inserted = 0
    for i, row in enumerate(subset):
        title = (row.get("title") or row.get("original_title") or "").strip()
        if not title:
            continue

        authors = (row.get("authors") or "").strip()
        year = safe_int(row.get("original_publication_year"))
        rating = safe_float(row.get("average_rating"))
        lang = (row.get("language_code") or "").strip()

        content_parts = [f'"{title}" by {authors}.'] if authors else [f'"{title}".']
        if year:
            content_parts.append(f"Published in {year}.")
        if rating:
            content_parts.append(f"Average rating {rating}/5.")
        if lang:
            content_parts.append(f"Language: {lang}.")
        content = " ".join(content_parts)

        try:
            collection.data.insert(
                {
                    "book_id": safe_int(row.get("book_id")),
                    "goodreads_book_id": safe_int(row.get("goodreads_book_id")),
                    "title": title,
                    "authors": authors,
                    "original_publication_year": year,
                    "average_rating": rating,
                    "ratings_count": safe_int(row.get("ratings_count")),
                    "language_code": lang,
                    "image_url": (row.get("image_url") or "").strip(),
                    "small_image_url": (row.get("small_image_url") or "").strip(),
                    "content": content,
                }
            )
            inserted += 1
            if inserted % 50 == 0:
                print(f"   Inserted {inserted} books …")
        except Exception as exc:
            print(f"   ⚠  Failed to insert book #{i + 1} ({title}): {exc}")

    total = len(subset)
    print(f"✓  Inserted {inserted}/{total} books")
    return inserted


def create_rag_podcast_collection(client):
    """Create and populate the PodcastSearch collection."""
    collection_name = "PodcastSearch"
    print(f"\n{'=' * 60}")
    print(f"  Creating {collection_name} collection (RAG)")
    print(f"{'=' * 60}")

    if client.collections.exists(collection_name):
        client.collections.delete(collection_name)
        print(f"✓  Deleted existing {collection_name}")

    collection = client.collections.create(
        name=collection_name,
        vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
        generative_config=Configure.Generative.openai(),
        properties=[
            Property(name="name", data_type=DataType.TEXT),
            Property(name="description", data_type=DataType.TEXT),
            Property(name="genre_ids", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="episode_count", data_type=DataType.INT, skip_vectorization=True),
            Property(name="itunes_url", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="podcast_url", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="feed_url", data_type=DataType.TEXT, skip_vectorization=True),
            Property(name="content", data_type=DataType.TEXT),
        ],
    )
    print(f"✓  {collection_name} collection created")

    rows = download_csv(PODCASTS_CSV_URL, "PodcastSearch")
    if not rows:
        return 0

    sample = rows[0] if rows else {}
    col_map = {}
    for key in sample:
        lower = key.strip().lower()
        if "name" in lower and "name" not in col_map:
            col_map["name"] = key
        elif "description" in lower:
            col_map["description"] = key
        elif "genre" in lower and "id" in lower:
            col_map["genre_ids"] = key
        elif "episode" in lower and "count" in lower:
            col_map["episode_count"] = key
        elif "itunes" in lower and "url" in lower:
            col_map["itunes_url"] = key
        elif "podcast" in lower and "url" in lower:
            col_map["podcast_url"] = key
        elif "feed" in lower and "url" in lower:
            col_map["feed_url"] = key

    subset = rows if PODCASTS_LIMIT == 0 else rows[:PODCASTS_LIMIT]
    inserted = 0
    for i, row in enumerate(subset):
        name = (row.get(col_map.get("name", "Name")) or "").strip()
        if not name:
            continue

        description = (row.get(col_map.get("description", "Description")) or "").strip()
        genre_ids = (row.get(col_map.get("genre_ids", "Genre IDs")) or "").strip()
        episode_count = safe_int(row.get(col_map.get("episode_count", "Episode Count")))

        content_parts = [name]
        if description:
            content_parts.append(description)
        if genre_ids:
            content_parts.append(f"Genres: {genre_ids}.")
        content = ". ".join(content_parts)

        try:
            collection.data.insert(
                {
                    "name": name,
                    "description": description,
                    "genre_ids": genre_ids,
                    "episode_count": episode_count,
                    "itunes_url": (row.get(col_map.get("itunes_url", "iTunes URL")) or "").strip(),
                    "podcast_url": (row.get(col_map.get("podcast_url", "Podcast URL")) or "").strip(),
                    "feed_url": (row.get(col_map.get("feed_url", "Feed URL")) or "").strip(),
                    "content": content,
                }
            )
            inserted += 1
            if inserted % 50 == 0:
                print(f"   Inserted {inserted} podcasts …")
        except Exception as exc:
            print(f"   ⚠  Failed to insert podcast #{i + 1} ({name}): {exc}")

    total = len(subset)
    print(f"✓  Inserted {inserted}/{total} podcasts")
    return inserted


# ══════════════════════════════════════════════════════════════
# Verification
# ══════════════════════════════════════════════════════════════

def verify_collections(client):
    """Verify all collections and show object counts"""
    print("\n=== Verifying Collections ===")

    try:
        collections = client.collections.list_all()
        print(f"✓ Found {len(collections)} collections:")

        for collection_name in collections:
            print(f"  • {collection_name}")

            try:
                headers = {
                    'Authorization': 'Bearer test-key-123',
                    'Content-Type': 'application/json'
                }

                query = {
                    "query": f"""
                    {{
                        Aggregate {{
                            {collection_name} {{
                                meta {{
                                    count
                                }}
                            }}
                        }}
                    }}
                    """
                }

                response = requests.post(
                    'http://localhost:8080/v1/graphql',
                    headers=headers,
                    json=query,
                    timeout=5
                )

                if response.status_code == 200:
                    result = response.json()
                    if 'data' in result and 'Aggregate' in result['data']:
                        agg_data = result['data']['Aggregate'].get(collection_name, [])
                        if agg_data and len(agg_data) > 0:
                            count = agg_data[0].get('meta', {}).get('count', 0)
                            print(f"    Objects: {count}")
                        else:
                            print(f"    Objects: 0")
                    else:
                        print(f"    Objects: unknown")
                else:
                    print(f"    Objects: unknown (HTTP {response.status_code})")

            except Exception as e:
                print(f"    Objects: unknown ({e})")

        return True

    except Exception as e:
        print(f"✗ Verification failed: {e}")
        return False


# ══════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Populate Weaviate with comprehensive test data')
    parser.add_argument('--skip-github', action='store_true', help='Skip GitHub data fetching')
    parser.add_argument('--verify-only', action='store_true', help='Only verify existing collections')
    parser.add_argument('--rag-only', action='store_true', help='Only create RAG collections (Books, PodcastSearch)')
    parser.add_argument('--legacy-only', action='store_true', help='Only create legacy collections')
    args = parser.parse_args()

    print("🚀 Weaviate Studio Sandbox – Test Data Population")
    print("=" * 60)

    if args.verify_only:
        print("Running in verification-only mode...")
    else:
        print("Embeddings : local text2vec-transformers (free)")
        print("Generative : OpenAI (requires OPENAI_API_KEY at query time)")
        print()
        if args.rag_only:
            print("Mode: RAG collections only (Books, PodcastSearch)")
        elif args.legacy_only:
            print("Mode: Legacy collections only (Jeopardy, Author, Book, etc.)")
        else:
            print("Mode: All collections (legacy + RAG)")

    client = connect_to_weaviate()
    if not client:
        return 1

    try:
        if args.verify_only:
            if not verify_collections(client):
                return 1
        else:
            success = True

            # Legacy collections
            if not args.rag_only:
                if not create_jeopardy_collection(client):
                    success = False
                if not create_book_collections(client):
                    success = False
                if not create_github_collections(client, args.skip_github):
                    success = False

            # RAG collections
            if not args.legacy_only:
                books_count = create_rag_books_collection(client)
                podcasts_count = create_rag_podcast_collection(client)

            if not success:
                print("\n❌ Some collections failed to create. Check errors above.")
                return 1

            # Verify everything
            verify_collections(client)

        print("\n🎉 SUCCESS!")
        print("=" * 60)
        print("Your Weaviate instance now contains comprehensive test data.")
        print("\n🔗 Connect from Weaviate Studio:")
        print("   Endpoint : http://localhost:8080")
        print("   API Key  : test-key-123")
        print("\n🧪 Test features:")
        print("  Legacy – Nested Properties & Cross-References:")
        print("     Author.address, Book.metadata, GitHubUser.stats")
        print("     Book → Author, GitHubRepo → GitHubUser, Review → Book")
        print("  RAG – Generative Search (requires OPENAI_API_KEY in .env):")
        print('     "Find highly rated fantasy books"')
        print('     "What topics do these podcasts cover?"')
        print('     "Which books and podcasts are related to psychology?"')

        return 0

    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
