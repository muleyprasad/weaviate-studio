import weaviate
import weaviate.classes as wvc
import requests
import json
import time
import os
from datetime import datetime
import random

# Force HTTP-only mode
os.environ['WEAVIATE_GRPC_ENABLED'] = 'false'

# Connect to Weaviate
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
    
    # Wait for Weaviate to be ready
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
    exit(1)

try:
    # Collection 1: GitHubUser (with nested profile and stats)
    print("\n=== Creating GitHubUser collection ===")
    try:
        if client.collections.exists("GitHubUser"):
            client.collections.delete("GitHubUser")
            print("✓ Deleted existing GitHubUser collection")
    except Exception as e:
        print(f"Note: Could not delete existing GitHubUser collection: {e}")

    github_user_collection = client.collections.create(
        name="GitHubUser",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="login",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="name",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="bio",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="company",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="location",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="email",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="hireable",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="createdAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="stats",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="publicRepos", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="publicGists", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="followers", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="following", data_type=wvc.config.DataType.INT),
                ]
            ),
            wvc.config.Property(
                name="urls",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="htmlUrl", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="blog", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="twitterUsername", data_type=wvc.config.DataType.TEXT),
                ]
            ),
        ]
    )
    print("✓ GitHubUser collection created successfully!")

    # Collection 2: GitHubRepo (with nested language stats and references to user)
    print("\n=== Creating GitHubRepo collection ===")
    try:
        if client.collections.exists("GitHubRepo"):
            client.collections.delete("GitHubRepo")
            print("✓ Deleted existing GitHubRepo collection")
    except Exception as e:
        print(f"Note: Could not delete existing GitHubRepo collection: {e}")

    github_repo_collection = client.collections.create(
        name="GitHubRepo",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="name",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="fullName",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="description",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="language",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="private",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="fork",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="archived",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="createdAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="updatedAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="pushedAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="size",
                data_type=wvc.config.DataType.INT
            ),
            wvc.config.Property(
                name="metrics",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="stargazersCount", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="watchersCount", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="forksCount", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="openIssuesCount", data_type=wvc.config.DataType.INT),
                ]
            ),
            wvc.config.Property(
                name="topics",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="license",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="key", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="name", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="spdxId", data_type=wvc.config.DataType.TEXT),
                ]
            ),
        ],
        # Cross-reference to owner
        references=[
            wvc.config.ReferenceProperty(
                name="ownedBy",
                target_collection="GitHubUser"
            ),
        ]
    )
    print("✓ GitHubRepo collection created successfully!")

    # Collection 3: GitHubIssue (with nested labels and references)
    print("\n=== Creating GitHubIssue collection ===")
    try:
        if client.collections.exists("GitHubIssue"):
            client.collections.delete("GitHubIssue")
            print("✓ Deleted existing GitHubIssue collection")
    except Exception as e:
        print(f"Note: Could not delete existing GitHubIssue collection: {e}")

    github_issue_collection = client.collections.create(
        name="GitHubIssue",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="title",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="body",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="number",
                data_type=wvc.config.DataType.INT
            ),
            wvc.config.Property(
                name="state",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="locked",
                data_type=wvc.config.DataType.BOOL
            ),
            wvc.config.Property(
                name="createdAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="updatedAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="closedAt",
                data_type=wvc.config.DataType.DATE
            ),
            wvc.config.Property(
                name="labels",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="names", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="colors", data_type=wvc.config.DataType.TEXT),
                    wvc.config.Property(name="count", data_type=wvc.config.DataType.INT),
                ]
            ),
            wvc.config.Property(
                name="reactions",
                data_type=wvc.config.DataType.OBJECT,
                nested_properties=[
                    wvc.config.Property(name="totalCount", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="plusOne", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="minusOne", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="laugh", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="hooray", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="confused", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="heart", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="rocket", data_type=wvc.config.DataType.INT),
                    wvc.config.Property(name="eyes", data_type=wvc.config.DataType.INT),
                ]
            ),
        ],
        # Cross-references
        references=[
            wvc.config.ReferenceProperty(
                name="belongsToRepo",
                target_collection="GitHubRepo"
            ),
            wvc.config.ReferenceProperty(
                name="createdBy",
                target_collection="GitHubUser"
            ),
        ]
    )
    print("✓ GitHubIssue collection created successfully!")

    print("\n=== Fetching real GitHub data ===")

    # Fetch some popular GitHub users and their repos
    popular_users = [
        "torvalds",      # Linus Torvalds
        "gaearon",       # Dan Abramov (React)
        "sindresorhus",  # Sindre Sorhus
        "tj",            # TJ Holowaychuk
        "addyosmani",    # Addy Osmani
    ]

    user_ids = []
    repo_ids = []

    # Fetch users
    for username in popular_users:
        try:
            print(f"Fetching user: {username}")
            response = requests.get(f"https://api.github.com/users/{username}", timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                
                # Transform GitHub API response to our schema
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
                
                # Fetch some repos for this user
                repos_response = requests.get(f"https://api.github.com/users/{username}/repos?sort=stars&per_page=3", timeout=10)
                
                if repos_response.status_code == 200:
                    repos_data = repos_response.json()
                    
                    for repo_data in repos_data[:2]:  # Limit to 2 repos per user
                        try:
                            # Transform repo data
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
                            
                            # Fetch some issues for this repo
                            issues_response = requests.get(f"https://api.github.com/repos/{repo_data.get('full_name')}/issues?state=all&per_page=2", timeout=10)
                            
                            if issues_response.status_code == 200:
                                issues_data = issues_response.json()
                                
                                for issue_data in issues_data[:1]:  # Limit to 1 issue per repo
                                    try:
                                        # Skip pull requests (they appear in issues API)
                                        if 'pull_request' in issue_data:
                                            continue
                                            
                                        # Transform issue data
                                        labels_names = [label.get("name", "") for label in issue_data.get("labels", [])]
                                        labels_colors = [label.get("color", "") for label in issue_data.get("labels", [])]
                                        
                                        issue_obj = {
                                            "title": issue_data.get("title", ""),
                                            "body": (issue_data.get("body", "") or "")[:1000],  # Limit body length
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
                                        
                            time.sleep(0.5)  # Rate limiting
                            
                        except Exception as e:
                            print(f"  ✗ Failed to insert repo {repo_data.get('name', 'Unknown')}: {e}")
                            
                time.sleep(1)  # Rate limiting between users
                
            else:
                print(f"✗ Failed to fetch user {username}: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"✗ Failed to process user {username}: {e}")

    print("\n=== Testing GitHub Data Queries ===")
    
    # Test nested properties query
    try:
        headers = {
            'Authorization': 'Bearer test-key-123',
            'Content-Type': 'application/json'
        }
        
        query = {
            "query": """
            {
                Get {
                    GitHubUser(limit: 2) {
                        name
                        login
                        stats {
                            publicRepos
                            followers
                        }
                        urls {
                            htmlUrl
                            blog
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
            if 'data' in result and 'Get' in result['data'] and 'GitHubUser' in result['data']['Get']:
                users = result['data']['Get']['GitHubUser']
                print(f"✓ GitHub nested properties test passed - Found {len(users)} users")
                for user in users[:1]:
                    print(f"  - {user.get('name', 'Unknown')} (@{user.get('login', 'unknown')})")
                    if 'stats' in user:
                        print(f"    Repos: {user['stats'].get('publicRepos', 0)}, Followers: {user['stats'].get('followers', 0)}")
            else:
                print("⚠ Warning: Unexpected response structure in GitHub test")
        else:
            print(f"⚠ Warning: GitHub test failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"⚠ Warning: GitHub nested properties test failed: {e}")

    # Test cross-reference query
    try:
        query = {
            "query": """
            {
                Get {
                    GitHubRepo(limit: 2) {
                        name
                        description
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
            if 'data' in result and 'Get' in result['data'] and 'GitHubRepo' in result['data']['Get']:
                repos = result['data']['Get']['GitHubRepo']
                print(f"✓ GitHub cross-reference test passed - Found {len(repos)} repos")
                for repo in repos[:1]:
                    print(f"  - {repo.get('name', 'Unknown')} ({repo.get('language', 'Unknown')})")
                    if 'ownedBy' in repo and repo['ownedBy']:
                        print(f"    Owner: {repo['ownedBy'].get('name', 'Unknown')} (@{repo['ownedBy'].get('login', 'unknown')})")
                    if 'metrics' in repo:
                        print(f"    Stars: {repo['metrics'].get('stargazersCount', 0)}, Forks: {repo['metrics'].get('forksCount', 0)}")
            else:
                print("⚠ Warning: Unexpected response structure in GitHub repo test")
        else:
            print(f"⚠ Warning: GitHub repo test failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"⚠ Warning: GitHub cross-reference test failed: {e}")

    print("\n🎉 GitHub data setup complete!")
    print(f"✓ Created {len(user_ids)} GitHub users")
    print(f"✓ Created {len(repo_ids)} GitHub repositories")
    print("✓ Created GitHub issues with nested reactions and labels")
    
    print("\nYou can now test advanced features with real GitHub data:")
    print("1. Nested objects: GitHubUser.stats, GitHubUser.urls, GitHubRepo.metrics, GitHubRepo.license")
    print("2. Cross-references: GitHubRepo -> GitHubUser, GitHubIssue -> GitHubRepo, GitHubIssue -> GitHubUser")
    print("3. Complex nested structures: GitHubIssue.reactions, GitHubIssue.labels")
    print("4. Real-world data with various data types and relationships")

finally:
    client.close()