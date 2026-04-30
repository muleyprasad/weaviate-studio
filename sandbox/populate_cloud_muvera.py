"""
populate_cloud_muvera.py
Populates a Weaviate Cloud instance with a MultiVectorCollection
configured for Multi-Vector Search (Muvera) testing.

Uses text2vec-weaviate (built-in, no external API key needed) so that
Text (Semantic) search mode works in the extension.
"""

import weaviate
from weaviate.classes.config import Property, DataType, Configure

REST_URL = ""
GRPC_URL = ""
API_KEY  = ""

DOCUMENTS = [
    {
        "title": "Introduction to Vector Databases",
        "description": (
            "A comprehensive guide to how vector databases work and their use "
            "cases in AI. Learn about embeddings, approximate nearest neighbour "
            "search, and HNSW indexing."
        ),
    },
    {
        "title": "Multi-Vector Search Explained",
        "description": (
            "Deep dive into Muvera and how to combine results from multiple vector "
            "targets. Covers join strategies: sum, average, minimum, and "
            "manual-weights."
        ),
    },
    {
        "title": "Cloud Native AI Applications",
        "description": (
            "Building scalable AI solutions using cloud-native architectures and "
            "vector search. Includes container orchestration, auto-scaling, and "
            "observability patterns."
        ),
    },
    {
        "title": "Semantic Search with Weaviate",
        "description": (
            "End-to-end tutorial on building a semantic search engine using Weaviate, "
            "Python, and the weaviate-client library. Covers schema design, data "
            "ingestion, and query optimization."
        ),
    },
    {
        "title": "Understanding Hybrid Search",
        "description": (
            "Hybrid search combines keyword BM25 scoring with dense vector similarity. "
            "Learn how the alpha parameter balances the two signals and when each "
            "approach performs best."
        ),
    },
]


def populate_cloud() -> None:
    print(f"Connecting to Weaviate Cloud: {REST_URL}...")

    client = weaviate.connect_to_weaviate_cloud(
        cluster_url=REST_URL,
        auth_credentials=weaviate.auth.AuthApiKey(API_KEY),
    )

    try:
        # --- Delete existing collection ---
        if client.collections.exists("MultiVectorCollection"):
            print("Deleting existing MultiVectorCollection...")
            client.collections.delete("MultiVectorCollection")

        # --- Create collection with 3 named vectors using text2vec-weaviate ---
        # text2vec-weaviate is built-in on all Weaviate Cloud instances
        # (no external API key required).
        # Each named vector embeds a different source property so the
        # multi-target search has meaningful signal differences.
        print("Creating MultiVectorCollection with text2vec-weaviate named vectors...")
        client.collections.create(
            name="MultiVectorCollection",
            vectorizer_config=[
                Configure.NamedVectors.text2vec_weaviate(
                    name="title_vector",
                    source_properties=["title"],
                ),
                Configure.NamedVectors.text2vec_weaviate(
                    name="desc_vector",
                    source_properties=["description"],
                ),
                Configure.NamedVectors.text2vec_weaviate(
                    name="combined_vector",
                    source_properties=["title", "description"],
                ),
            ],
            properties=[
                Property(name="title",       data_type=DataType.TEXT),
                Property(name="description", data_type=DataType.TEXT),
            ],
        )

        # --- Insert sample documents (vectors auto-generated) ---
        collection = client.collections.get("MultiVectorCollection")
        print(f"Inserting {len(DOCUMENTS)} documents (vectors auto-generated)...")

        with collection.batch.dynamic() as batch:
            for doc in DOCUMENTS:
                batch.add_object(properties=doc)

        print("\n✓ MultiVectorCollection populated on Weaviate Cloud!")
        print("  - 3 named vectors: title_vector, desc_vector, combined_vector")
        print("  - Vectorizer: text2vec-weaviate (no API key needed)")
        print(f"  - {len(DOCUMENTS)} documents inserted")
        print("\nYou can now test ALL search modes in Weaviate Studio:")
        print("  • Text (Semantic) — type any query and pick target vectors")
        print("  • Raw Vector      — paste a vector array")
        print("  • Similar Object  — pick any UUID from the collection")
        print("  • Hybrid          — combines keyword + semantic search")

    except Exception as e:
        print(f"\n✗ Error: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    populate_cloud()
