/**
 * TypeScript type definitions for Weaviate Data Explorer
 */

import type { WeaviateObject } from 'weaviate-client';

/**
 * Main state for the Data Explorer
 */
export interface DataExplorerState {
  // Collection
  collectionName: string;
  schema: CollectionSchema | null;

  // Data
  objects: WeaviateObject<Record<string, unknown>, string>[];
  totalCount: number;
  loading: boolean;
  error: string | null;

  // Pagination
  currentPage: number;
  pageSize: number;

  // Filters
  filters: Filter[];
  activeFilters: Filter[];
  filterGroup: FilterGroup | null;
  activeFilterGroup: FilterGroup | null;
  filterTemplates: FilterTemplate[];

  // Vector Search
  vectorSearch: VectorSearchState;

  // Insights
  insights: InsightsState;

  // Export
  showExportDialog: boolean;

  // UI
  visibleColumns: string[];
  pinnedColumns: string[];
  sortBy: SortConfig | null;
  selectedObjectId: string | null;
  showDetailPanel: boolean;
}

/**
 * Collection schema information
 */
export interface CollectionSchema {
  name: string;
  properties: PropertySchema[];
  vectorizers: VectorizerConfig[];
  description?: string;
}

/**
 * Property schema definition
 */
export interface PropertySchema {
  name: string;
  dataType: PropertyDataType;
  description?: string;
  indexFilterable?: boolean;
  indexSearchable?: boolean;
  tokenization?: string;
  // For nested objects
  nestedProperties?: PropertySchema[];
}

/**
 * Supported property data types
 */
export type PropertyDataType =
  | 'text'
  | 'text[]'
  | 'int'
  | 'int[]'
  | 'number'
  | 'number[]'
  | 'boolean'
  | 'boolean[]'
  | 'date'
  | 'date[]'
  | 'uuid'
  | 'uuid[]'
  | 'geoCoordinates'
  | 'phoneNumber'
  | 'blob'
  | 'object'
  | 'object[]';

/**
 * Vectorizer configuration
 */
export interface VectorizerConfig {
  name: string;
  vectorizer: string;
  dimensions?: number;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter operators for different data types
 */
export type FilterOperator =
  // Equality
  | 'equals'
  | 'notEquals'
  // Numeric comparisons
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanEqual'
  | 'lessThanEqual'
  | 'between'
  // Text operations
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  // Array operations
  | 'in'
  | 'notIn'
  // Null checks
  | 'isNull'
  | 'isNotNull'
  // Geo operations
  | 'withinDistance'
  | 'withinPolygon';

/**
 * Filter configuration for a property
 */
export interface Filter {
  id: string;
  property: string;
  operator: FilterOperator;
  value: FilterValue;
  dataType: PropertyDataType;
}

/**
 * Logical operators for filter groups
 */
export type FilterGroupOperator = 'AND' | 'OR' | 'NOT';

/**
 * Filter group - combines filters and other groups with logical operators
 */
export interface FilterGroup {
  id: string;
  operator: FilterGroupOperator;
  filters: Filter[];
  groups: FilterGroup[];
}

/**
 * Filter template - saved filter configuration
 */
export interface FilterTemplate {
  id: string;
  name: string;
  description?: string;
  collectionName: string;
  group: FilterGroup;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Filter value types (union of all possible value types)
 */
export type FilterValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | number[]
  | { min: number; max: number }
  | { min: Date; max: Date }
  | { lat: number; lon: number; distance: number }
  | null;

/**
 * Weaviate operator types
 */
export type WeaviateOperator =
  // Logical operators
  | 'And'
  | 'Or'
  | 'Not'
  // Comparison operators
  | 'Equal'
  | 'NotEqual'
  | 'GreaterThan'
  | 'LessThan'
  | 'GreaterThanEqual'
  | 'LessThanEqual'
  // Text operators
  | 'Like'
  // Array operators
  | 'ContainsAny'
  // Null check
  | 'IsNull'
  // Geo operators
  | 'WithinGeoRange';

/**
 * Weaviate WHERE filter structure
 */
export interface WhereFilter {
  operator: WeaviateOperator;
  operands?: WhereFilter[];
  path?: string[];
  valueText?: string;
  valueInt?: number;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueGeoRange?: {
    geoCoordinates: {
      latitude: number;
      longitude: number;
    };
    distance: {
      max: number;
    };
  };
}

/**
 * Parameters for fetching objects
 */
export interface FetchParams {
  collectionName: string;
  limit: number;
  offset: number;
  properties?: string[];
  sortBy?: SortConfig;
  filters?: Filter[];
}

/**
 * Result from fetching objects
 */
export interface FetchResult {
  objects: WeaviateObject<Record<string, unknown>, string>[];
  totalCount: number;
}

/**
 * Column configuration
 */
export interface ColumnConfig {
  name: string;
  dataType: PropertyDataType;
  visible: boolean;
  pinned: boolean;
  width?: number;
}

/**
 * Cell renderer props
 */
export interface CellRendererProps {
  value: any;
  dataType: PropertyDataType;
  propertyName: string;
  objectId?: string;
}

/**
 * Actions for state management
 */
export type DataExplorerAction =
  | { type: 'SET_COLLECTION'; payload: string }
  | { type: 'SET_SCHEMA'; payload: CollectionSchema }
  | { type: 'SET_DATA'; payload: { objects: WeaviateObject<Record<string, unknown>, string>[]; totalCount: number } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_VISIBLE_COLUMNS'; payload: string[] }
  | { type: 'TOGGLE_COLUMN'; payload: string }
  | { type: 'PIN_COLUMN'; payload: string }
  | { type: 'UNPIN_COLUMN'; payload: string }
  | { type: 'SET_SORT'; payload: SortConfig | null }
  | { type: 'SELECT_OBJECT'; payload: string | null }
  | { type: 'TOGGLE_DETAIL_PANEL'; payload: boolean }
  | { type: 'ADD_FILTER'; payload: Filter }
  | { type: 'UPDATE_FILTER'; payload: { id: string; filter: Partial<Filter> } }
  | { type: 'REMOVE_FILTER'; payload: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'APPLY_FILTERS' }
  | { type: 'SET_VECTOR_SEARCH_CONFIG'; payload: Partial<VectorSearchConfig> }
  | { type: 'SET_VECTOR_SEARCH_ACTIVE'; payload: boolean }
  | { type: 'SET_VECTOR_SEARCH_RESULTS'; payload: VectorSearchResult[] }
  | { type: 'SET_VECTOR_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_VECTOR_SEARCH_ERROR'; payload: string | null }
  | { type: 'CLEAR_VECTOR_SEARCH' }
  | { type: 'SET_FILTER_GROUP'; payload: FilterGroup | null }
  | { type: 'UPDATE_FILTER_GROUP'; payload: Partial<FilterGroup> }
  | { type: 'ADD_GROUP_TO_GROUP'; payload: { parentId: string; group: FilterGroup } }
  | { type: 'ADD_FILTER_TO_GROUP'; payload: { groupId: string; filter: Filter } }
  | { type: 'REMOVE_FILTER_FROM_GROUP'; payload: { groupId: string; filterId: string } }
  | { type: 'REMOVE_GROUP_FROM_GROUP'; payload: { parentId: string; groupId: string } }
  | { type: 'UPDATE_GROUP_OPERATOR'; payload: { groupId: string; operator: FilterGroupOperator } }
  | { type: 'APPLY_FILTER_GROUP' }
  | { type: 'CLEAR_FILTER_GROUP' }
  | { type: 'SAVE_FILTER_TEMPLATE'; payload: FilterTemplate }
  | { type: 'DELETE_FILTER_TEMPLATE'; payload: string }
  | { type: 'LOAD_FILTER_TEMPLATE'; payload: string }
  | { type: 'SET_INSIGHTS_LOADING'; payload: boolean }
  | { type: 'SET_INSIGHTS_ERROR'; payload: string | null }
  | { type: 'SET_INSIGHTS_DATA'; payload: { totalCount: number; categoricalAggregations: CategoricalAggregation[]; numericAggregations: NumericAggregation[]; dateAggregations: DateAggregation[] } }
  | { type: 'UPDATE_INSIGHTS_CONFIG'; payload: Partial<InsightsConfig> }
  | { type: 'REFRESH_INSIGHTS' }
  | { type: 'TOGGLE_EXPORT_DIALOG'; payload: boolean }
  | { type: 'START_EXPORT'; payload: ExportOptions }
  | { type: 'EXPORT_SUCCESS'; payload: { format: ExportFormat; scope: ExportScope; objectCount: number } }
  | { type: 'EXPORT_ERROR'; payload: string };

/**
 * Message types for webview communication
 */
export type WebviewMessageCommand =
  | 'initialize'
  | 'fetchObjects'
  | 'getSchema'
  | 'selectObject'
  | 'savePreferences'
  | 'vectorSearch'
  | 'error';

export interface WebviewMessage {
  command: WebviewMessageCommand;
  data?: any;
}

/**
 * Message types from extension to webview
 */
export type ExtensionMessageCommand =
  | 'initialized'
  | 'schemaLoaded'
  | 'objectsLoaded'
  | 'objectSelected'
  | 'vectorSearchResults'
  | 'error';

export interface ExtensionMessage {
  command: ExtensionMessageCommand;
  data?: any;
}

/**
 * Preferences for the Data Explorer (persisted)
 */
export interface DataExplorerPreferences {
  [collectionName: string]: {
    visibleColumns?: string[];
    pinnedColumns?: string[];
    pageSize?: number;
    sortBy?: SortConfig;
    filters?: Filter[];
  };
}

/**
 * Object metadata from Weaviate
 */
export interface ObjectMetadata {
  uuid: string;
  creationTimeUnix?: number;
  lastUpdateTimeUnix?: number;
  distance?: number;
  certainty?: number;
  score?: number;
  explainScore?: string;
  vector?: number[];
}

/**
 * Vector search mode
 */
export type VectorSearchMode = 'text' | 'object' | 'vector' | 'hybrid';

/**
 * Vector search configuration
 */
export interface VectorSearchConfig {
  mode: VectorSearchMode;
  // Text search (nearText)
  searchText?: string;
  // Object search (nearObject)
  referenceObjectId?: string;
  // Vector search (nearVector)
  vectorInput?: number[];
  // Hybrid search
  alpha?: number; // 0-1: 0=pure keyword (BM25), 1=pure semantic (vector)
  searchProperties?: string[]; // Properties to search in
  enableQueryRewriting?: boolean; // Improve semantic understanding
  // Common options
  limit: number;
  distance?: number;
  certainty?: number;
  /** If true, use distance metric; if false, use certainty metric */
  useDistanceMetric: boolean;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  object: WeaviateObject<Record<string, unknown>, string>;
  distance?: number;
  certainty?: number;
  score?: number;
  explainScore?: string;
}

/**
 * Vector search state
 */
export interface VectorSearchState {
  isActive: boolean;
  config: VectorSearchConfig;
  results: VectorSearchResult[];
  loading: boolean;
  error: string | null;
}

/**
 * Vector search query options for API
 */
export interface VectorSearchOptions {
  limit: number;
  distance?: number;
  certainty?: number;
}

/**
 * Vector search parameters for webview messages
 */
export interface VectorSearchParams {
  mode: VectorSearchMode;
  searchText?: string;
  referenceObjectId?: string;
  vectorInput?: number[];
  alpha?: number;
  searchProperties?: string[];
  enableQueryRewriting?: boolean;
  limit: number;
  distance?: number;
  certainty?: number;
}

/**
 * Aggregation metric types
 */
export type AggregationMetric =
  | 'topOccurrences'
  | 'sum'
  | 'min'
  | 'max'
  | 'mean'
  | 'median'
  | 'mode'
  | 'count';

/**
 * Categorical aggregation result (for text/enum properties)
 */
export interface CategoricalAggregation {
  property: string;
  topOccurrences: Array<{
    value: string;
    count: number;
    percentage?: number;
  }>;
}

/**
 * Numeric aggregation result (for numeric properties)
 */
export interface NumericAggregation {
  property: string;
  count: number;
  sum?: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  mode?: number;
  distribution?: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Date aggregation result (for date properties)
 */
export interface DateAggregation {
  property: string;
  earliest?: Date;
  latest?: Date;
  count: number;
}

/**
 * Insights configuration - which properties to analyze
 */
export interface InsightsConfig {
  categoricalProperties: string[];
  numericProperties: string[];
  dateProperties: string[];
  autoRefresh: boolean;
  refreshInterval?: number; // seconds
}

/**
 * Insights state
 */
export interface InsightsState {
  loading: boolean;
  error: string | null;
  totalCount: number;
  categoricalAggregations: CategoricalAggregation[];
  numericAggregations: NumericAggregation[];
  dateAggregations: DateAggregation[];
  config: InsightsConfig;
  lastRefreshed: Date | null;
}

/**
 * Export format types
 */
export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'parquet';

/**
 * Export scope - what data to export
 */
export type ExportScope = 'page' | 'filtered' | 'all';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  includeProperties: boolean;
  includeVectors: boolean;
  includeMetadata: boolean;
  includeReferences: boolean;
}

/**
 * Export state
 */
export interface ExportState {
  exporting: boolean;
  error: string | null;
  lastExport: {
    format: ExportFormat;
    scope: ExportScope;
    objectCount: number;
    timestamp: Date;
  } | null;
}

