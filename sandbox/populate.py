import weaviate
import weaviate.classes as wvc
import requests
import json

# Connect to Weaviate (v4 syntax)
client = weaviate.connect_to_local(
    host="localhost",
    port=8080,
    auth_credentials=weaviate.auth.AuthApiKey("test-key-123")
)

try:
    # Check if collection already exists and delete it
    try:
        client.collections.delete("JeopardyQuestion")
        print("Deleted existing collection")
    except:
        pass

    # Create the collection (v4 syntax)
    collection = client.collections.create(
        name="JeopardyQuestion",
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(
                name="question",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="answer",
                data_type=wvc.config.DataType.TEXT
            ),
            wvc.config.Property(
                name="round",
                data_type=wvc.config.DataType.TEXT,
                skip_vectorization=True
            ),
            wvc.config.Property(
                name="value",
                data_type=wvc.config.DataType.INT
            ),
        ]
    )
    print("Collection created successfully!")

    # Load sample data
    url = 'https://raw.githubusercontent.com/weaviate-tutorials/edu-datasets/main/jeopardy_100.json'
    resp = requests.get(url)
    data = json.loads(resp.text)

    # Import data using batch (v4 syntax)
    with collection.batch.dynamic() as batch:
        for i, row in enumerate(data):
            question_object = {
                "question": row["Question"],
                "answer": row["Answer"],
                "value": row.get("Value", 0) if row.get("Value") else 0,
                "round": row["Round"],
            }
            
            batch.add_object(properties=question_object)
            
            if (i + 1) % 10 == 0:
                print(f"Imported {i + 1} objects...")

    # Check for failed objects
    if len(collection.batch.failed_objects) > 0:
        print(f"\nFailed to import {len(collection.batch.failed_objects)} objects")
        for failed in collection.batch.failed_objects[:3]:
            print(f"Error: {failed}")
    
    # Verify import
    result = collection.aggregate.over_all(total_count=True)
    print(f"\nTotal objects imported: {result.total_count}")

    # Test a simple query
    response = collection.query.fetch_objects(limit=3)
    print("\nSample queries:")
    for obj in response.objects:
        print(f"Q: {obj.properties['question'][:60]}...")
        print(f"A: {obj.properties['answer']}")
        print(f"Round: {obj.properties['round']}\n")

finally:
    client.close()
