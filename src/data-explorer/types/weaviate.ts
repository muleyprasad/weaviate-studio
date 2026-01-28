/**
 * Weaviate Client Type Definitions
 *
 * These types provide type safety for Weaviate SDK interactions.
 * The Weaviate SDK uses complex builder patterns and generics that vary by version.
 * These types capture the structure we actually use while maintaining flexibility.
 */

/**
 * Metadata fields that can be returned from Weaviate queries
 * Used in returnMetadata option for queries
 */
export type WeaviateMetadataField =
  | 'creationTime'
  | 'updateTime'
  | 'distance'
  | 'certainty'
  | 'score'
  | 'explainScore';

/**
 * Array of metadata fields to return in query results
 */
export type WeaviateQueryMetadata = WeaviateMetadataField[];

/**
 * Weaviate filter object
 * Returned by collection.filter.byProperty().equal() and Filters.and()/or()
 * The internal structure is opaque and version-specific, so we use any for SDK compatibility
 */
export type WeaviateFilter = any;

/**
 * Weaviate sort builder object
 * Returned by collection.sort.byProperty(name, direction)
 * The internal structure is opaque, so we use unknown
 */
export type WeaviateSortBuilder = unknown;

/**
 * Base query options used across all query types
 * Compatible with Weaviate SDK query methods
 */
export interface WeaviateQueryOptions {
  /** Maximum number of results to return */
  limit: number;

  /** Number of results to skip (not used in vector search) */
  offset?: number;

  /** Metadata fields to include in results */
  returnMetadata?: WeaviateQueryMetadata;

  /** Specific properties to return (omit for all properties) */
  returnProperties?: string[];

  /** Sort configuration (only for non-vector queries) */
  sort?: any;

  /** Filter conditions to apply */
  filters?: WeaviateFilter;

  /** Include vector embeddings in results */
  includeVector?: boolean;
}

/**
 * Query options specific to vector search operations
 * Extends base options with vector-specific parameters
 */
export interface WeaviateVectorQueryOptions extends Omit<WeaviateQueryOptions, 'offset' | 'sort'> {
  /** Minimum certainty threshold (0-1) */
  certainty?: number;

  /** Maximum distance threshold */
  distance?: number;

  /** Distance metric override (if different from collection default) */
  distanceMetric?: string;

  /** Target vector name for named vectors */
  targetVector?: string;

  /** Allow additional properties for SDK compatibility */
  [key: string]: unknown;
}

/**
 * Query options specific to hybrid search
 * Combines BM25 keyword search with vector similarity
 */
export interface WeaviateHybridQueryOptions extends WeaviateVectorQueryOptions {
  /** Balance between keyword (0) and vector (1) search */
  alpha: number;

  /** Fusion algorithm type */
  fusionType?: 'rankedFusion' | 'relativeScoreFusion';

  /** Properties to search in for keyword matching */
  queryProperties?: string[];
}

/**
 * Object returned from Weaviate queries
 * This is the raw shape before transformation to our WeaviateObject type
 */
export interface WeaviateRawObject {
  uuid: string;
  properties: unknown;
  metadata?: {
    creationTime?: Date;
    updateTime?: Date;
    distance?: number;
    certainty?: number;
    score?: number;
    explainScore?: string | Record<string, unknown>;
  };
  vectors?: Record<string, any>;
}

/**
 * Result from query methods
 * Returned by collection.query.fetchObjects(), .nearText(), etc.
 */
export interface WeaviateQueryResult {
  objects: WeaviateRawObject[];
}

/**
 * Aggregation options for overAll() method
 */
export interface WeaviateAggregateOptions {
  /** Filter to apply to aggregation */
  filters?: WeaviateFilter;

  /** Metrics to compute (for numeric/date properties) */
  returnMetrics?: any;
}

/**
 * Result from aggregate.overAll() queries
 */
export interface WeaviateAggregateResult {
  /** Total count of objects */
  totalCount?: number;

  /** Metrics for each property (if returnMetrics was specified) */
  properties?: Record<string, unknown>;
}

/**
 * Options for groupBy aggregation queries
 */
export interface WeaviateGroupByOptions {
  /** Property to group by */
  groupBy: {
    property: string;
  };

  /** Filter to apply */
  filters?: WeaviateFilter;
}

/**
 * Single group in groupBy result
 */
export interface WeaviateGroupByGroup {
  /** The value that was grouped by */
  groupedBy?: {
    value: unknown;
  };

  /** Count of objects in this group */
  totalCount?: number;
}

/**
 * Result from aggregate.groupBy.overAll() queries
 * Returns an array of groups
 */
export type WeaviateGroupByResult = WeaviateGroupByGroup[];

/**
 * Numeric metrics returned from aggregation
 */
export interface WeaviateNumericMetrics {
  count?: number;
  minimum?: number;
  maximum?: number;
  mean?: number;
  median?: number;
  sum?: number;
}

/**
 * Date metrics returned from aggregation
 */
export interface WeaviateDateMetrics {
  minimum?: Date | string;
  maximum?: Date | string;
}

/**
 * Union of all metric types
 */
export type WeaviateMetrics = WeaviateNumericMetrics | WeaviateDateMetrics;

/**
 * Type guard to check if value is a Weaviate filter
 * Filters created by the SDK are objects but with internal structure
 */
export function isWeaviateFilter(value: unknown): value is WeaviateFilter {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if aggregate result has properties
 */
export function hasAggregateProperties(
  result: WeaviateAggregateResult
): result is WeaviateAggregateResult & { properties: Record<string, unknown> } {
  return result.properties !== undefined;
}

/**
 * Type guard for numeric metrics
 */
export function isNumericMetrics(metrics: unknown): metrics is WeaviateNumericMetrics {
  if (typeof metrics !== 'object' || metrics === null) {
    return false;
  }
  const m = metrics as Record<string, unknown>;
  return (
    m.count !== undefined ||
    m.minimum !== undefined ||
    m.maximum !== undefined ||
    m.mean !== undefined
  );
}

/**
 * Type guard for date metrics
 */
export function isDateMetrics(metrics: unknown): metrics is WeaviateDateMetrics {
  if (typeof metrics !== 'object' || metrics === null) {
    return false;
  }
  const m = metrics as Record<string, unknown>;
  return (
    (m.minimum !== undefined && (m.minimum instanceof Date || typeof m.minimum === 'string')) ||
    (m.maximum !== undefined && (m.maximum instanceof Date || typeof m.maximum === 'string'))
  );
}
