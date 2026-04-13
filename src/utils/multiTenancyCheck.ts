/**
 * Multi-tenancy compatibility checker.
 *
 * Collections with identical property fingerprints (same property names, tokenization,
 * and data types) can be consolidated into a single multi-tenant collection in Weaviate.
 *
 * @see https://docs.weaviate.io/weaviate/manage-collections/multi-tenancy
 */

import { CollectionWithSchema } from '../types';

export interface PropertyLike {
  name: string;
  dataType?: string | string[];
  tokenization?: string | null;
  nestedProperties?: PropertyLike[];
}

/** A single collection entry within a candidate group, with its object count. */
export interface MtCollectionEntry {
  name: string;
  /** Total object count across all shards/nodes. 0 when node data is unavailable. */
  objectCount: number;
}

/**
 * A group of collections that share an identical schema fingerprint and could
 * be consolidated into a single multi-tenant collection.
 *
 * Collections are sorted by `objectCount` descending so the most-impactful
 * migration candidate appears first.
 */
export interface MtCandidateGroup {
  /** Collections in this group, sorted by objectCount descending. */
  collections: MtCollectionEntry[];
  /** Number of collections in this group (= collections.length). */
  count: number;
  /** Sum of objectCount across all collections in the group. */
  totalObjects: number;
}

// ─── Shared node/shard shape ─────────────────────────────────────────────────

/** Minimal shard shape required by cluster checks (compatible with weaviate-client Node). */
export interface ShardLike {
  class: string;
  name: string;
  objectCount: number;
}

/** Minimal node shape required by cluster checks. */
export interface NodeLike {
  name: string;
  shards: ShardLike[] | null | undefined;
}

// ─── Empty shards check ───────────────────────────────────────────────────────

/** A single shard entry identified as empty. */
export interface EmptyShardEntry {
  collectionName: string;
  nodeName: string;
  shardName: string;
}

// ─── Replication imbalance check ─────────────────────────────────────────────

/** Object-count breakdown for one replica of a shard. */
export interface ShardReplica {
  nodeName: string;
  objectCount: number;
}

/** A shard whose replicas have mismatched object counts. */
export interface ImbalancedShard {
  shardName: string;
  replicas: ShardReplica[];
}

/** A collection that contains at least one imbalanced shard. */
export interface ReplicationImbalanceCollection {
  collectionName: string;
  shards: ImbalancedShard[];
}

// ─── Combined result ──────────────────────────────────────────────────────────

/**
 * The result payload returned by a full checks run.
 * Serialized to globalState so it survives panel close/reopen.
 */
export interface ChecksResult {
  /** ISO-8601 timestamp of when the check was last run. */
  timestamp: string;
  /** True when any individual check has issues. */
  hasIssues: boolean;
  multiTenancy: {
    groups: MtCandidateGroup[];
    hasIssues: boolean;
  };
  emptyShards: {
    entries: EmptyShardEntry[];
    hasIssues: boolean;
  };
  replicationImbalance: {
    collections: ReplicationImbalanceCollection[];
    hasIssues: boolean;
  };
}

// ─── Internal hash helpers ────────────────────────────────────────────────────

/**
 * Normalizes tokenization: null / undefined / blank → "word" (Weaviate default).
 */
function normalizeTokenization(t: string | null | undefined): string {
  if (!t || t.trim() === '') {
    return 'word';
  }
  return t;
}

/**
 * Computes a deterministic fingerprint segment for a single property.
 * Format: `name|tokenization|type1+type2`
 * For object/object[] types, nested properties are appended as `{nestedFingerprint}`.
 */
function computePropertyFingerprint(prop: PropertyLike): string {
  const name = prop.name;
  const tokenization = normalizeTokenization(prop.tokenization);

  // Normalize dataType to a sorted array to guarantee consistent ordering
  let dataTypeArr: string[];
  if (Array.isArray(prop.dataType)) {
    dataTypeArr = [...prop.dataType].sort();
  } else if (prop.dataType) {
    dataTypeArr = [prop.dataType];
  } else {
    dataTypeArr = [];
  }
  const dataType = dataTypeArr.join('+');

  let segment = `${name}|${tokenization}|${dataType}`;

  // Recursively fingerprint nested properties (object / object[] types)
  if (prop.nestedProperties && prop.nestedProperties.length > 0) {
    segment += `{${buildPropertiesFingerprint(prop.nestedProperties)}}`;
  }

  return segment;
}

/**
 * Sorts properties by name and concatenates their fingerprints with `;`.
 * Sorting guarantees that property declaration order does not affect the result.
 */
function buildPropertiesFingerprint(properties: PropertyLike[]): string {
  return [...properties]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(computePropertyFingerprint)
    .join(';');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes a deterministic fingerprint for a collection's full property list.
 * Returns `""` for collections with no properties.
 *
 * Two collections with the same hash have identical schemas and are candidates
 * for consolidation into a single multi-tenant collection.
 */
export function computeCollectionHash(properties: PropertyLike[]): string {
  if (!properties || properties.length === 0) {
    return '';
  }
  return buildPropertiesFingerprint(properties);
}

/**
 * Finds groups of collections that share identical schema fingerprints.
 *
 * Collections that already have multi-tenancy enabled are excluded — they are
 * already consolidated and do not need to be warned about.
 *
 * Within each group, collections are sorted by `objectCount` descending.
 * Groups themselves are sorted by `totalObjects` descending so the
 * highest-impact candidates appear first.
 *
 * @param collections  All collections for a connection.
 * @param objectCounts Optional map of collection name → total object count,
 *                     derived from cluster node shard data.
 * @returns Array of candidate groups (only groups with ≥ 2 collections).
 */
export function findMultiTenantCandidates(
  collections: CollectionWithSchema[],
  objectCounts?: Record<string, number>
): MtCandidateGroup[] {
  const hashToEntries = new Map<string, MtCollectionEntry[]>();

  for (const col of collections) {
    // Skip collections already using multi-tenancy
    if (col.schema?.multiTenancy?.enabled) {
      continue;
    }

    const properties = (col.schema?.properties as PropertyLike[] | undefined) ?? [];
    const hash = computeCollectionHash(properties);
    // Skip collections with no properties — they have no meaningful schema to compare
    if (!hash) {
      continue;
    }
    const entry: MtCollectionEntry = {
      name: col.label,
      objectCount: objectCounts?.[col.label] ?? 0,
    };

    const existing = hashToEntries.get(hash);
    if (existing) {
      existing.push(entry);
    } else {
      hashToEntries.set(hash, [entry]);
    }
  }

  const groups: MtCandidateGroup[] = [];

  for (const entries of hashToEntries.values()) {
    if (entries.length < 2) {
      continue;
    }

    // Sort collections within the group by object count descending
    const sorted = [...entries].sort((a, b) => b.objectCount - a.objectCount);
    const totalObjects = sorted.reduce((sum, e) => sum + e.objectCount, 0);

    groups.push({ collections: sorted, count: sorted.length, totalObjects });
  }

  // Sort groups by total objects descending — highest-impact first
  groups.sort((a, b) => b.totalObjects - a.totalObjects);

  return groups;
}

/**
 * Finds shards with zero objects across all nodes.
 *
 * Multi-tenant collections are skipped via `skipCollections` because individual
 * tenant shards start empty by design and would generate false positives.
 *
 * @param nodes           Verbose cluster node data.
 * @param skipCollections Collection names to exclude (e.g. MT-enabled ones).
 */
export function findEmptyShards(
  nodes: NodeLike[],
  skipCollections?: Set<string>
): EmptyShardEntry[] {
  const result: EmptyShardEntry[] = [];
  for (const node of nodes) {
    for (const shard of node.shards ?? []) {
      if (skipCollections?.has(shard.class)) {
        continue;
      }
      if (shard.objectCount === 0) {
        result.push({
          collectionName: shard.class,
          nodeName: node.name,
          shardName: shard.name,
        });
      }
    }
  }
  return result;
}

/**
 * Finds collections whose shards have inconsistent object counts across replicas.
 *
 * When the same shard name appears on multiple nodes (replication factor > 1)
 * with different object counts, it may indicate async replication is disabled
 * or lagging behind.
 *
 * Note: object counts in node status are not immediately synchronised and may
 * be slightly delayed, so small short-lived discrepancies are expected.
 */
export function findReplicationImbalances(nodes: NodeLike[]): ReplicationImbalanceCollection[] {
  // collectionName → shardName → replicas
  const byCollection = new Map<string, Map<string, ShardReplica[]>>();

  for (const node of nodes) {
    for (const shard of node.shards ?? []) {
      if (!byCollection.has(shard.class)) {
        byCollection.set(shard.class, new Map());
      }
      const byShardName = byCollection.get(shard.class)!;
      if (!byShardName.has(shard.name)) {
        byShardName.set(shard.name, []);
      }
      byShardName.get(shard.name)!.push({ nodeName: node.name, objectCount: shard.objectCount });
    }
  }

  const result: ReplicationImbalanceCollection[] = [];

  for (const [collectionName, byShardName] of byCollection) {
    const imbalanced: ImbalancedShard[] = [];
    for (const [shardName, replicas] of byShardName) {
      if (replicas.length < 2) {
        continue; // single replica — nothing to compare
      }
      const first = replicas[0].objectCount;
      if (replicas.some((r) => r.objectCount !== first)) {
        imbalanced.push({ shardName, replicas });
      }
    }
    if (imbalanced.length > 0) {
      result.push({ collectionName, shards: imbalanced });
    }
  }

  return result;
}

/**
 * Creates a stable string key representing the current MT candidate state.
 *
 * Stored in globalState to track dismiss actions. If the schema changes
 * (collections added, removed, or modified), the key changes and the warning
 * reappears automatically without requiring any manual reset.
 */
export function computeCandidatesDismissKey(groups: MtCandidateGroup[]): string {
  return groups
    .flatMap((g) => g.collections.map((c) => c.name))
    .sort()
    .join(',');
}
