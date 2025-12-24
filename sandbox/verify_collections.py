import weaviate
import weaviate.classes as wvc
import requests
import json
import os

# Force HTTP-only mode
os.environ['WEAVIATE_GRPC_ENABLED'] = 'false'

# Connect to Weaviate
try:
    client = weaviate.connect_to_local(
        host="localhost",
        port=8080,
        auth_credentials=weaviate.auth.AuthApiKey("test-key-123")
    )
    print("✓ Connected to Weaviate successfully")
    
except Exception as e:
    print(f"✗ Failed to connect to Weaviate: {e}")
    exit(1)

try:
    print("\n📊 COLLECTIONS OVERVIEW")
    print("=" * 50)
    
    # List all collections
    collections = client.collections.list_all()
    
    for collection in collections:
        print(f"\n🗂️  {collection.name}")
        
        # Get collection config to show properties
        try:
            config = client.collections.get(collection.name).config.get()
            
            # Show regular properties
            if hasattr(config, 'properties') and config.properties:
                print("   Properties:")
                for prop in config.properties:
                    data_type = prop.data_type if hasattr(prop, 'data_type') else 'unknown'
                    print(f"     • {prop.name} ({data_type})")
                    
                    # Show nested properties if they exist
                    if hasattr(prop, 'nested_properties') and prop.nested_properties:
                        for nested_prop in prop.nested_properties:
                            nested_type = nested_prop.data_type if hasattr(nested_prop, 'data_type') else 'unknown'
                            print(f"       ↳ {nested_prop.name} ({nested_type})")
            
            # Show references
            if hasattr(config, 'references') and config.references:
                print("   References:")
                for ref in config.references:
                    target = ref.target_collection if hasattr(ref, 'target_collection') else 'unknown'
                    print(f"     • {ref.name} → {target}")
                    
        except Exception as e:
            print(f"   ⚠️  Could not get detailed config: {e}")
        
        # Get count via HTTP API
        try:
            headers = {
                'Authorization': 'Bearer test-key-123',
                'Content-Type': 'application/json'
            }
            
            query = {
                "query": f"""
                {{
                    Aggregate {{
                        {collection.name} {{
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
                    agg_data = result['data']['Aggregate'].get(collection.name, [])
                    if agg_data and len(agg_data) > 0:
                        count = agg_data[0].get('meta', {}).get('count', 0)
                        print(f"   📈 Objects: {count}")
                    else:
                        print(f"   📈 Objects: 0")
                else:
                    print(f"   📈 Objects: unknown")
            else:
                print(f"   📈 Objects: unknown (HTTP {response.status_code})")
                
        except Exception as e:
            print(f"   📈 Objects: unknown ({e})")

    print(f"\n🎯 TESTING RECOMMENDATIONS")
    print("=" * 50)
    print("Now you can test these features in Weaviate Studio:")
    print()
    print("1. 🏗️  NESTED PROPERTIES:")
    print("   • Author.address.city, Author.address.country")
    print("   • Book.metadata.language, Book.metadata.format")
    print("   • GitHubUser.stats.followers, GitHubUser.stats.publicRepos")
    print("   • GitHubRepo.metrics.stargazersCount")
    print("   • GitHubIssue.reactions.totalCount, GitHubIssue.reactions.heart")
    print()
    print("2. 🔗 CROSS-REFERENCES:")
    print("   • Book → Author (writtenBy)")
    print("   • Book → Publisher (publishedBy)")
    print("   • Review → Book (reviewsBook)")
    print("   • GitHubRepo → GitHubUser (ownedBy)")
    print("   • GitHubIssue → GitHubRepo (belongsToRepo)")
    print("   • GitHubIssue → GitHubUser (createdBy)")
    print()
    print("3. 📊 DATA TYPES:")
    print("   • Text: names, descriptions, bios")
    print("   • Numbers: years, counts, prices, ratings")
    print("   • Booleans: isActive, inStock, verified")
    print("   • Dates: publishedDate, createdAt, reviewDate")
    print("   • GeoCoordinates: Author.coordinates, Publisher.headquarters")
    print()
    print("4. 🔍 SAMPLE QUERIES TO TRY:")
    print("   • Books with nested metadata and author relationships")
    print("   • GitHub repos with owner stats and repository metrics")
    print("   • Authors with full address information")
    print("   • Issues with reaction counts and repository context")

finally:
    client.close()