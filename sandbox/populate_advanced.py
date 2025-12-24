import weaviate
import weaviate.classes as wvc
import requests
import json
import time
import os
from datetime import datetime, timedelta
import random

# Force HTTP-only mode
os.environ['WEAVIATE_GRPC_ENABLED'] = 'false'

# Connect to Weaviate using simple HTTP connection
try:
    client = weaviate.connect_to_local(
        host="localhost",
        port=8080,
        auth_credentials=weaviate.auth.AuthApiKey("test-key-123"),
        additional_config=weaviate.config.AdditionalConfig(
            timeout=weaviate.config.Timeout(init=30, query=60, insert=120)
        )
    )
    print("✓ Connected to Weaviate successfully")
    
    # Wait for Weaviate to be fully ready
    print("Checking if Weaviate is ready...")
    ready = False
    for attempt in range(10):
        try:
            client.collections.list_all()
            ready = True
            break
        except Exception as e:
            print(f"Waiting for Weaviate to be ready... (attempt {attempt + 1}/10)")
            time.sleep(2)
    
    if not ready:
        print("✗ Weaviate is not ready after 20 seconds")
        exit(1)
    
    print("✓ Weaviate is ready")
    
except Exception as e:
    print(f"✗ Failed to connect to Weaviate: {e}")
    print("Make sure Weaviate is running with: docker-compose up -d")
    exit(1)

try:
    # Collection 1: Author (with nested address object)
    print("\n=== Creating Author collection ===")
    try:
        if client.collections.exists("Author"):
            client.collections.delete("Author")
            print("✓ Deleted existing Author collection")
    except Exception as e:
        print(f"Note: Could not delete existing Author collection: {e}")

    author_collection = client.collections.create(
        name="Author",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="name",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="bio",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="birthYear",
                data_type=wvc.config.DataType.INT
            ),
            wvc.config.Property(
                name="isActive",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="address",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="street", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="city", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="country", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="zipCode", data_type=wvc.config.DataType.TEXT),
                ]
            ),
            wvc.config.Property(
                name="coordinates",
                data_type=wvc.config.DataType.GEO_COORDINATES
            ),
        ]
    )
    print("✓ Author collection created successfully!")

    # Collection 2: Publisher (with nested contact info)
    print("\n=== Creating Publisher collection ===")
    try:
        if client.collections.exists("Publisher"):
            client.collections.delete("Publisher")
            print("✓ Deleted existing Publisher collection")
    except Exception as e:
        print(f"Note: Could not delete existing Publisher collection: {e}")

    publisher_collection = client.collections.create(
        name="Publisher",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="name",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="foundedYear",
                data_type=wvc.config.DataType.INT
            ),
            wvc.config.Property(
                name="website",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="contactInfo",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="email", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="phone", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="address", data_type=wvc.config.DataType.TEXT),
                ]
            ),
            wvc.config.Property(
                name="headquarters",
                data_type=wvc.config.DataType.GEO_COORDINATES
            ),
        ]
    )
    print("✓ Publisher collection created successfully!")

    # Collection 3: Book (with references to Author and Publisher, plus nested metadata)
    print("\n=== Creating Book collection ===")
    try:
        if client.collections.exists("Book"):
            client.collections.delete("Book")
            print("✓ Deleted existing Book collection")
    except Exception as e:
        print(f"Note: Could not delete existing Book collection: {e}")

    book_collection = client.collections.create(
        name="Book",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="title",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="description",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="isbn",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="publishedDate",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="pageCount",
                data_type=wvc.config.DataType.INT
            ),
            wvc.config.Property(
                name="price",
                data_type=wvc.config.DataType.NUMBER
            ),
            wvc.config.Property(
                name="inStock",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="genre",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="metadata",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="language", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="edition", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="format", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="weight", data_type=wvc.config.DataType.NUMBER),
                ]
            ),
        ],
        # References defined separately
        references=[
            wvc.config.ReferenceProperty(
                name="writtenBy",
                target_collection="Author"
            ),
            wvc.config.ReferenceProperty(
                name="publishedBy",
                target_collection="Publisher"
            ),
        ]
    )
    print("✓ Book collection created successfully!")

    # Collection 4: Review (with nested reviewer info and references to Book)
    print("\n=== Creating Review collection ===")
    try:
        if client.collections.exists("Review"):
            client.collections.delete("Review")
            print("✓ Deleted existing Review collection")
    except Exception as e:
        print(f"Note: Could not delete existing Review collection: {e}")

    review_collection = client.collections.create(
        name="Review",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="title",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="content",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="rating",
                data_type=wvc.config.DataType.INT
            ),
            wvc.config.Property(
                name="reviewDate",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="verified",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="reviewer",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="name", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="email", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="memberSince", data_type=wvc.config.DataType.DATE),
                    wvc.config.Property(name="totalReviews", data_type=wvc.config.DataType.INT),
                ]
            ),
        ],
        # Cross-reference
        references=[
            wvc.config.ReferenceProperty(
                name="reviewsBook",
                target_collection="Book"
            ),
        ]
    )
    print("✓ Review collection created successfully!")

    # Now populate with sample data
    print("\n=== Populating collections with sample data ===")

    # Sample Authors
    authors_data = [
        {
            "name": "J.K. Rowling",
            "bio": "British author best known for the Harry Potter fantasy series",
            "birthYear": 1965,
            "isActive": True,
            "address": {
                "street": "123 Magic Lane",
                "city": "Edinburgh",
                "country": "Scotland",
                "zipCode": "EH1 1AA"
            },
            "coordinates": {"latitude": 55.9533, "longitude": -3.1883}
        },
        {
            "name": "George R.R. Martin",
            "bio": "American novelist and short story writer, known for A Song of Ice and Fire",
            "birthYear": 1948,
            "isActive": True,
            "address": {
                "street": "456 Winter Street",
                "city": "Santa Fe",
                "country": "USA",
                "zipCode": "87501"
            },
            "coordinates": {"latitude": 35.6870, "longitude": -105.9378}
        },
        {
            "name": "Agatha Christie",
            "bio": "English writer known for her detective novels featuring Hercule Poirot",
            "birthYear": 1890,
            "isActive": False,
            "address": {
                "street": "789 Mystery Avenue",
                "city": "Torquay",
                "country": "England",
                "zipCode": "TQ1 1AA"
            },
            "coordinates": {"latitude": 50.4619, "longitude": -3.5253}
        }
    ]

    author_ids = []
    for i, author_data in enumerate(authors_data):
        try:
            result = author_collection.data.insert(author_data)
            author_ids.append(result)
            print(f"✓ Inserted author: {author_data['name']}")
        except Exception as e:
            print(f"✗ Failed to insert author {author_data['name']}: {e}")

    # Sample Publishers
    publishers_data = [
        {
            "name": "Bloomsbury Publishing",
            "foundedYear": 1986,
            "website": "https://www.bloomsbury.com",
            "contactInfo": {
                "email": "info@bloomsbury.com",
                "phone": "+44 20 7631 5600",
                "address": "50 Bedford Square, London WC1B 3DP"
            },
            "headquarters": {"latitude": 51.5194, "longitude": -0.1291}
        },
        {
            "name": "Bantam Books",
            "foundedYear": 1945,
            "website": "https://www.bantam.com",
            "contactInfo": {
                "email": "contact@bantam.com",
                "phone": "+1 212 782 9000",
                "address": "1745 Broadway, New York, NY 10019"
            },
            "headquarters": {"latitude": 40.7614, "longitude": -73.9776}
        },
        {
            "name": "HarperCollins",
            "foundedYear": 1989,
            "website": "https://www.harpercollins.com",
            "contactInfo": {
                "email": "info@harpercollins.com",
                "phone": "+1 212 207 7000",
                "address": "195 Broadway, New York, NY 10007"
            },
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

    # Sample Books with references
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
            "metadata": {
                "language": "English",
                "edition": "First Edition",
                "format": "Hardcover",
                "weight": 0.5
            }
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
            "metadata": {
                "language": "English",
                "edition": "Mass Market",
                "format": "Paperback",
                "weight": 0.8
            }
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
            "metadata": {
                "language": "English",
                "edition": "Reprint",
                "format": "Paperback",
                "weight": 0.3
            }
        }
    ]

    book_ids = []
    for i, book_data in enumerate(books_data):
        try:
            # Insert book with references
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

    # Sample Reviews with references
    reviews_data = [
        {
            "title": "Magical and Captivating",
            "content": "An absolutely wonderful introduction to the wizarding world. Rowling's imagination knows no bounds!",
            "rating": 5,
            "reviewDate": "2023-01-15T10:30:00Z",
            "verified": True,
            "reviewer": {
                "name": "BookLover123",
                "email": "booklover@example.com",
                "memberSince": "2020-03-01T00:00:00Z",
                "totalReviews": 47
            }
        },
        {
            "title": "Epic but Slow Start",
            "content": "Game of Thrones is incredibly detailed and complex. Takes time to get into but worth the investment.",
            "rating": 4,
            "reviewDate": "2023-02-20T14:45:00Z",
            "verified": True,
            "reviewer": {
                "name": "FantasyFan",
                "email": "fantasy@example.com",
                "memberSince": "2019-07-15T00:00:00Z",
                "totalReviews": 23
            }
        },
        {
            "title": "Classic Mystery Done Right",
            "content": "Christie's plotting is masterful. Every clue is perfectly placed and the solution is both surprising and logical.",
            "rating": 5,
            "reviewDate": "2023-03-10T09:15:00Z",
            "verified": False,
            "reviewer": {
                "name": "MysteryReader",
                "email": "mystery@example.com",
                "memberSince": "2021-11-20T00:00:00Z",
                "totalReviews": 12
            }
        }
    ]

    for i, review_data in enumerate(reviews_data):
        try:
            result = review_collection.data.insert(
                properties=review_data,
                references={
                    "reviewsBook": book_ids[i] if i < len(book_ids) else book_ids[0]
                }
            )
            print(f"✓ Inserted review: {review_data['title']}")
        except Exception as e:
            print(f"✗ Failed to insert review {review_data['title']}: {e}")

    print("\n=== Data Population Complete! ===")
    print(f"✓ Created {len(authors_data)} authors")
    print(f"✓ Created {len(publishers_data)} publishers") 
    print(f"✓ Created {len(books_data)} books")
    print(f"✓ Created {len(reviews_data)} reviews")

    # Test queries to verify everything works
    print("\n=== Testing Sample Queries ===")
    
    # Test basic query
    try:
        response = author_collection.query.fetch_objects(limit=1)
        if response.objects:
            print("✓ Basic query test passed")
        else:
            print("⚠ Warning: No objects found in basic query test")
    except Exception as e:
        print(f"⚠ Warning: Basic query test failed: {e}")

    # Test nested property access via HTTP API
    try:
        import requests
        headers = {
            'Authorization': 'Bearer test-key-123',
            'Content-Type': 'application/json'
        }
        
        query = {
            "query": """
            {
                Get {
                    Author(limit: 1) {
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
            """
        }
        
        response = requests.post(
            'http://localhost:8080/v1/graphql',
            headers=headers,
            json=query,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'data' in result and 'Get' in result['data'] and 'Author' in result['data']['Get']:
                authors = result['data']['Get']['Author']
                if authors and len(authors) > 0:
                    author = authors[0]
                    print(f"✓ Nested properties test passed - Author: {author.get('name', 'Unknown')}")
                    if 'address' in author:
                        print(f"  - City: {author['address'].get('city', 'Unknown')}")
                    if 'coordinates' in author:
                        print(f"  - Coordinates: {author['coordinates']}")
                else:
                    print("⚠ Warning: No authors returned in nested properties test")
            else:
                print("⚠ Warning: Unexpected response structure in nested properties test")
        else:
            print(f"⚠ Warning: HTTP API test failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"⚠ Warning: Nested properties test failed: {e}")

    # Test cross-reference query
    try:
        query = {
            "query": """
            {
                Get {
                    Book(limit: 1) {
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
            """
        }
        
        response = requests.post(
            'http://localhost:8080/v1/graphql',
            headers=headers,
            json=query,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'data' in result and 'Get' in result['data'] and 'Book' in result['data']['Get']:
                books = result['data']['Get']['Book']
                if books and len(books) > 0:
                    book = books[0]
                    print(f"✓ Cross-reference test passed - Book: {book.get('title', 'Unknown')}")
                    if 'writtenBy' in book and book['writtenBy']:
                        print(f"  - Author: {book['writtenBy'].get('name', 'Unknown')}")
                    if 'publishedBy' in book and book['publishedBy']:
                        print(f"  - Publisher: {book['publishedBy'].get('name', 'Unknown')}")
                else:
                    print("⚠ Warning: No books returned in cross-reference test")
            else:
                print("⚠ Warning: Unexpected response structure in cross-reference test")
        else:
            print(f"⚠ Warning: Cross-reference test failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"⚠ Warning: Cross-reference test failed: {e}")

    print("\n🎉 Advanced collections setup complete!")
    print("\nYou can now test the following features in Weaviate Studio:")
    print("1. Nested object properties (Author.address, Publisher.contactInfo, Book.metadata, Review.reviewer)")
    print("2. Cross-references (Book -> Author, Book -> Publisher, Review -> Book)")
    print("3. Various data types (text, int, number, boolean, date, geoCoordinates)")
    print("4. Complex queries with relationships and nested selections")

finally:
    client.close()