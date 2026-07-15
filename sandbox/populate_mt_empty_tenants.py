#!/usr/bin/env python3
"""
Weaviate Studio Sandbox – Multi-Tenant "Empty Tenants" Test Fixture

Creates a single multi-tenant collection and populates it with a large number of
tenants, most of which are intentionally left EMPTY. This is the fixture for
manually testing the two multi-tenancy features in Weaviate Studio:

  1. "Edit multi-tenancy options" — the collection is created with
     autoTenantCreation and autoTenantActivation set to False, so it shows up in
     the "auto-tenant flags off" check and can be toggled from the tree.

  2. "Delete empty tenants to free memory" — every tenant is created ACTIVE
     (loaded into memory), but only a fraction receive objects. The rest are
     empty ACTIVE tenants, which is exactly what the empty-tenants check flags.

By default: 1000 tenants, 20% filled with 100 objects each, 80% left empty.

The collection uses `Vectorizer.none()` so no embedding sidecar is required and
inserts are fast (self-provided/no vectors — fine for this structural fixture).

Usage:
    python3 populate_mt_empty_tenants.py
    python3 populate_mt_empty_tenants.py --tenants 1000 --fill-ratio 0.2 \
        --objects-per-tenant 100 --collection MultiTenantDocs
    python3 populate_mt_empty_tenants.py --drop           # delete the collection
    python3 populate_mt_empty_tenants.py --verify-only    # just report counts

Requires the sandbox Weaviate running (see docker-compose.yml in this folder):
    docker compose up -d
"""

import argparse
import os
import sys
import time

import weaviate
import weaviate.classes as wvc
from weaviate.classes.config import Configure, Property, DataType
from weaviate.classes.tenants import Tenant

# ──────────────────────────────────────────────────────────────
# Connection — matches populate.py / docker-compose.yml
# ──────────────────────────────────────────────────────────────
WEAVIATE_HOST = os.environ.get("WEAVIATE_HOST", "localhost")
WEAVIATE_PORT = int(os.environ.get("WEAVIATE_PORT", "8080"))
# Optional — leave unset for a server with anonymous access enabled. Sending an
# Authorization header to an anonymous server returns 401, so we only pass
# credentials when an API key is explicitly provided.
WEAVIATE_API_KEY = os.environ.get("WEAVIATE_API_KEY", "")

TENANT_CHUNK = 100   # tenants created per API call
INSERT_CHUNK = 200   # objects inserted per insert_many call


def connect_to_weaviate():
    """Connect to the local sandbox Weaviate, waiting for readiness."""
    client = weaviate.connect_to_local(
        host=WEAVIATE_HOST,
        port=WEAVIATE_PORT,
        auth_credentials=(
            weaviate.auth.AuthApiKey(WEAVIATE_API_KEY) if WEAVIATE_API_KEY else None
        ),
        skip_init_checks=True,
        additional_config=weaviate.config.AdditionalConfig(
            timeout=weaviate.config.Timeout(init=30, query=60, insert=180)
        ),
    )
    for attempt in range(10):
        try:
            client.collections.list_all()
            print("✓ Connected to Weaviate")
            return client
        except Exception:
            print(f"  waiting for Weaviate… ({attempt + 1}/10)")
            time.sleep(2)
    print("✗ Weaviate not ready — is `docker compose up -d` running?")
    client.close()
    return None


def create_collection(client, name):
    """(Re)create the multi-tenant collection with auto-tenant flags OFF."""
    if client.collections.exists(name):
        print(f"• Collection '{name}' already exists — deleting it first")
        client.collections.delete(name)

    client.collections.create(
        name=name,
        description="Multi-tenant fixture with many empty ACTIVE tenants",
        # auto_tenant_* intentionally OFF so the collection is flagged by the
        # "auto-tenant flags off" check and tenants must be created explicitly.
        multi_tenancy_config=Configure.multi_tenancy(
            enabled=True,
            auto_tenant_creation=False,
            auto_tenant_activation=False,
        ),
        vector_config=Configure.Vectors.self_provided(),
        properties=[
            Property(name="title", data_type=DataType.TEXT),
            Property(name="body", data_type=DataType.TEXT),
        ],
    )
    print(f"✓ Created multi-tenant collection '{name}' (auto-tenant flags OFF)")


def create_tenants(collection, count):
    """Create `count` ACTIVE tenants named tenant-0000 … tenant-NNNN."""
    names = [f"tenant-{i:04d}" for i in range(count)]
    created = 0
    for start in range(0, count, TENANT_CHUNK):
        chunk = names[start : start + TENANT_CHUNK]
        collection.tenants.create([Tenant(name=n) for n in chunk])
        created += len(chunk)
        print(f"  tenants: {created}/{count}", end="\r", flush=True)
    print(f"\n✓ Created {created} ACTIVE tenants")
    return names


def populate_tenants(collection, tenant_names, fill_ratio, objects_per_tenant):
    """Insert objects into the first `fill_ratio` share of tenants; leave the rest empty.

    Selection is deterministic (every Nth tenant) so re-runs are reproducible.
    """
    total = len(tenant_names)
    fill_every = max(1, round(1 / fill_ratio)) if fill_ratio > 0 else 0
    filled = 0
    empty = 0

    for idx, tenant_name in enumerate(tenant_names):
        should_fill = fill_every and (idx % fill_every == 0)
        if not should_fill:
            empty += 1
            continue

        tenant = collection.with_tenant(tenant_name)
        objs = [
            {"title": f"{tenant_name} doc {j}", "body": f"Body text for object {j}"}
            for j in range(objects_per_tenant)
        ]
        for start in range(0, len(objs), INSERT_CHUNK):
            tenant.data.insert_many(objs[start : start + INSERT_CHUNK])
        filled += 1
        print(
            f"  filled tenants: {filled} (empty so far: {empty})",
            end="\r",
            flush=True,
        )

    print(
        f"\n✓ Populated {filled} tenants with {objects_per_tenant} objects each; "
        f"left {empty} tenants empty"
    )
    return filled, empty


def verify(collection, name):
    """Report tenant count and how many tenants are empty."""
    tenants = collection.tenants.get()
    empty = 0
    filled = 0
    for tenant_name in tenants:
        count = collection.with_tenant(tenant_name).aggregate.over_all(
            total_count=True
        ).total_count
        if count == 0:
            empty += 1
        else:
            filled += 1
    print(f"\nCollection '{name}':")
    print(f"  tenants total : {len(tenants)}")
    print(f"  with objects  : {filled}")
    print(f"  empty         : {empty}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection", default="MultiTenantDocs")
    parser.add_argument("--tenants", type=int, default=1000)
    parser.add_argument("--fill-ratio", type=float, default=0.2,
                        help="Fraction of tenants that receive objects (0–1)")
    parser.add_argument("--objects-per-tenant", type=int, default=100)
    parser.add_argument("--drop", action="store_true",
                        help="Delete the collection and exit")
    parser.add_argument("--verify-only", action="store_true",
                        help="Only report tenant/object counts")
    args = parser.parse_args()

    client = connect_to_weaviate()
    if client is None:
        sys.exit(1)

    try:
        if args.drop:
            if client.collections.exists(args.collection):
                client.collections.delete(args.collection)
                print(f"✓ Deleted collection '{args.collection}'")
            else:
                print(f"• Collection '{args.collection}' does not exist")
            return

        if args.verify_only:
            if not client.collections.exists(args.collection):
                print(f"✗ Collection '{args.collection}' does not exist")
                sys.exit(1)
            verify(client.collections.get(args.collection), args.collection)
            return

        create_collection(client, args.collection)
        collection = client.collections.get(args.collection)
        tenant_names = create_tenants(collection, args.tenants)
        populate_tenants(
            collection, tenant_names, args.fill_ratio, args.objects_per_tenant
        )
        verify(collection, args.collection)
        print("\n✓ Done. Open Weaviate Studio and run the cluster checks.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
