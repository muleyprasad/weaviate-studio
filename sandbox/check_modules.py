"""Check available modules on the cloud instance."""
import weaviate

REST_URL = "https://fnl3iugnrviq0uvkjjl2yg.c0.us-west3.gcp.weaviate.cloud"
API_KEY = "bkhHUE92K2VPbWlWQnY0R18xNWxNanFtc1dwOGs3eUYzYnAwUmNFaS9LTVRpMkUrNGFzdjBKamhaVVRVPV92MjAw"

client = weaviate.connect_to_weaviate_cloud(
    cluster_url=REST_URL,
    auth_credentials=weaviate.auth.AuthApiKey(API_KEY),
)

try:
    meta = client.get_meta()
    modules = meta.get("modules", {})
    print(f"Version: {meta.get('version')}")
    print(f"\nAvailable modules ({len(modules)}):")
    for name in sorted(modules.keys()):
        print(f"  - {name}")
finally:
    client.close()
