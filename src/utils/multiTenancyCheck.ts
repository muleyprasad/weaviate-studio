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

/**
 * The result payload returned by a full checks run.
 * Serialized to globalState so it survives panel close/reopen.
 */
export interface ChecksResult {
  /** ISO-8601 timestamp of when the check was last run. */
  timestamp: string;
  multiTenancy: {
    groups: MtCandidateGroup[];
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
