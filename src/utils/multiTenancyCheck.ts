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

// ─── Empty shard ratio check ─────────────────────────────────────────────────

/**
 * Severity assigned to a collection based on the fraction of its shards/tenants
 * that are empty (zero objects).
 */
export type EmptyShardRatioSeverity = 'warning' | 'critical';

/**
 * Configurable thresholds for the empty-shard-ratio check, expressed as a
 * fraction (0–1) of a collection's shards/tenants that report zero objects.
 *
 * - At or above `warning`  → severity "warning".
 * - At or above `critical` → severity "critical" (takes precedence).
 *
 * These are intentionally defined as code-level constants so they can be tuned
 * in one place without a settings UI. The `critical` value must be ≥ `warning`.
 */
export const EMPTY_SHARD_RATIO_THRESHOLDS: { warning: number; critical: number } = {
  warning: 0.1, // 10% of shards/tenants empty
  critical: 0.5, // 50% of shards/tenants empty
};

/** A collection flagged because a significant fraction of its shards are empty. */
export interface EmptyShardRatioEntry {
  collectionName: string;
  /** True when the collection has multi-tenancy enabled (shards are tenants). */
  isMultiTenant: boolean;
  /** Number of distinct shards/tenants (replicas collapsed by shard name). */
  totalShards: number;
  /** Number of distinct shards/tenants that are empty on every replica. */
  emptyShards: number;
  /** emptyShards / totalShards, in the range 0–1. */
  ratio: number;
  severity: EmptyShardRatioSeverity;
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
  /**
   * Per-shard replication completeness in the range 0–1:
   * `sum(replicas) / (maxReplica × replicaCount)`.
   *
   * Example — replicas 12 / 12 / 10 → `34 / (12 × 3)` ≈ 0.94.
   */
  replicationRatio: number;
  /** Fully-replicated expectation for this shard: `maxReplica × replicaCount`. */
  expectedObjects: number;
  /** Actual objects stored across this shard's replicas: `sum(replicas)`. */
  actualObjects: number;
}

/** A collection that contains at least one imbalanced shard. */
export interface ReplicationImbalanceCollection {
  collectionName: string;
  shards: ImbalancedShard[];
  /**
   * Replication completeness ratio in the range 0–1, computed **per shard**.
   *
   * For each shard the most complete replica (the max object count across its
   * replicas) is taken as the shard's true object count, and the fully-replicated
   * expectation is `max × replicaCount`. These are summed across every shard of
   * the collection to give `expectedObjects`, and the actual stored objects across
   * all replicas are summed to give `actualObjects`. The ratio is
   * `actualObjects / expectedObjects`.
   *
   * Example — a shard with replicas 12 / 12 / 10 contributes `expected = 12 × 3 = 36`
   * and `actual = 34`, so it is 34/36 ≈ 94% replicated.
   *
   * `1` means every replica of every shard is complete; a value below `1` means
   * some replicas are missing or lagging behind. Computing per shard (rather than
   * from per-node totals) is essential: a shard whose most complete replica lives
   * on a different node than another shard's would otherwise be masked.
   */
  replicationRatio: number;
  /**
   * Fully-replicated expectation: `Σ over shards (maxReplica × replicaCount)`.
   */
  expectedObjects: number;
  /** Actual object total summed across every shard/replica of this collection. */
  actualObjects: number;
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
  emptyShardRatio: {
    entries: EmptyShardRatioEntry[];
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
 * Flags collections in which a significant fraction of shards/tenants are empty.
 *
 * Unlike {@link findEmptyShards}, this check applies to BOTH single-tenant and
 * multi-tenant collections — for multi-tenant collections each shard is a tenant,
 * so this surfaces "mostly-empty" collections (e.g. many provisioned-but-unused
 * tenants) that the per-shard check intentionally suppresses.
 *
 * Replicas are collapsed by shard name: a shard counts as empty only when every
 * replica reports zero objects (max object count across replicas === 0), so a
 * replica that is merely lagging is not mistaken for an empty shard — that case
 * is handled by {@link findReplicationImbalances}.
 *
 * A collection is flagged when its empty ratio reaches `thresholds.warning`,
 * and escalated to "critical" at `thresholds.critical`.
 *
 * @param nodes         Verbose cluster node data.
 * @param mtCollections Names of multi-tenant collections (used only to label
 *                      each entry's `isMultiTenant` flag — nothing is skipped).
 * @param thresholds    Warning/critical fractions; defaults to
 *                      {@link EMPTY_SHARD_RATIO_THRESHOLDS}.
 * @returns Flagged collections, sorted critical-first then by ratio descending.
 */
export function findEmptyShardRatios(
  nodes: NodeLike[],
  mtCollections?: Set<string>,
  thresholds: { warning: number; critical: number } = EMPTY_SHARD_RATIO_THRESHOLDS
): EmptyShardRatioEntry[] {
  // collectionName → shardName → max objectCount seen across replicas
  const byCollection = new Map<string, Map<string, number>>();

  for (const node of nodes) {
    for (const shard of node.shards ?? []) {
      let byShardName = byCollection.get(shard.class);
      if (!byShardName) {
        byShardName = new Map();
        byCollection.set(shard.class, byShardName);
      }
      const prev = byShardName.get(shard.name) ?? 0;
      byShardName.set(shard.name, Math.max(prev, shard.objectCount ?? 0));
    }
  }

  const result: EmptyShardRatioEntry[] = [];

  for (const [collectionName, byShardName] of byCollection) {
    const totalShards = byShardName.size;
    if (totalShards === 0) {
      continue;
    }
    let emptyShards = 0;
    for (const maxObjects of byShardName.values()) {
      if (maxObjects === 0) {
        emptyShards++;
      }
    }
    const ratio = emptyShards / totalShards;

    let severity: EmptyShardRatioSeverity | null = null;
    if (ratio >= thresholds.critical) {
      severity = 'critical';
    } else if (ratio >= thresholds.warning) {
      severity = 'warning';
    }
    if (!severity) {
      continue;
    }

    result.push({
      collectionName,
      isMultiTenant: mtCollections?.has(collectionName) ?? false,
      totalShards,
      emptyShards,
      ratio,
      severity,
    });
  }

  // Critical entries first; within the same severity, higher ratio first.
  const severityRank: Record<EmptyShardRatioSeverity, number> = { critical: 0, warning: 1 };
  result.sort((a, b) => {
    if (a.severity !== b.severity) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.ratio - a.ratio;
  });

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
 *
 * Each flagged collection also carries a {@link ReplicationImbalanceCollection.replicationRatio}
 * quantifying how complete replication is across nodes.
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
    // Per-shard replication accounting (see ReplicationImbalanceCollection.replicationRatio).
    let expectedObjects = 0;
    let actualObjects = 0;

    for (const [shardName, replicas] of byShardName) {
      const counts = replicas.map((r) => r.objectCount ?? 0);
      const maxReplica = Math.max(...counts);
      const sumReplicas = counts.reduce((sum, c) => sum + c, 0);
      // The most complete replica is the shard's true size; every replica should
      // match it, so a fully-replicated shard holds maxReplica × replicaCount.
      expectedObjects += maxReplica * replicas.length;
      actualObjects += sumReplicas;

      if (replicas.length < 2) {
        continue; // single replica — nothing to compare for imbalance
      }
      const first = counts[0];
      if (counts.some((c) => c !== first)) {
        const shardExpected = maxReplica * replicas.length;
        imbalanced.push({
          shardName,
          replicas,
          replicationRatio: shardExpected > 0 ? sumReplicas / shardExpected : 1,
          expectedObjects: shardExpected,
          actualObjects: sumReplicas,
        });
      }
    }

    if (imbalanced.length > 0) {
      const replicationRatio = expectedObjects > 0 ? actualObjects / expectedObjects : 1;
      result.push({
        collectionName,
        shards: imbalanced,
        replicationRatio,
        expectedObjects,
        actualObjects,
      });
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
