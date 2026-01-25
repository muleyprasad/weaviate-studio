/**
 * Data Explorer TypeScript Types
 * Defines interfaces for state management, API responses, and UI components
 */

// Weaviate object structure
export interface WeaviateObject {
  uuid: string;
  properties: Record<string, unknown>;
  metadata?: WeaviateObjectMetadata;
  vector?: number[];
  vectors?: Record<string, number[]>;
}

export interface HybridExplainScoreDetails {
  keyword?: number;
  vector?: number;
  combined?: number;
  matchedTerms?: string[];
}

/**
 * Raw explainScore format from Weaviate API
 * Can be either a JSON string or an object with various field names
 */
export interface WeaviateExplainScoreRaw {
  bm25?: number;
  keyword?: number;
  vector?: number;
  nearText?: number;
  score?: number;
  matchedTerms?: string[];
  keywords?: string[];
}

export interface WeaviateObjectMetadata {
  uuid?: string;
  creationTime?: string;
  lastUpdateTime?: string;
  creationTimeUnix?: number;
  lastUpdateTimeUnix?: number;
  distance?: number;
  certainty?: number;
  score?: number;
  explainScore?: string | HybridExplainScoreDetails; // Can be string or structured object
}

// Collection schema types
export interface CollectionConfig {
  name: string;
  description?: string;
  properties?: PropertyConfig[];
  vectorizerConfig?: unknown;
  generativeConfig?: unknown;
  replicationConfig?: unknown;
  invertedIndex?: unknown;
  multiTenancy?: unknown;
  shardingConfig?: unknown;
  vectorIndexConfig?: unknown;
}

export interface PropertyConfig {
  name: string;
  dataType: string[];
  description?: string;
  indexFilterable?: boolean;
  indexSearchable?: boolean;
  skipVectorisation?: boolean;
  tokenization?: string;
  nestedProperties?: PropertyConfig[];
}

// Pagination state
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// Sort state
export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

// Column configuration
export interface ColumnConfig {
  id: string;
  name: string;
  dataType: string;
  visible: boolean;
  pinned: boolean;
  width?: number;
  order: number;
}

// Data Explorer main state
export interface DataExplorerState {
  // Collection
  collectionName: string;
  schema: CollectionConfig | null;

  // Data
  objects: WeaviateObject[];
  totalCount: number;
  loading: boolean;
  error: string | null;

  // Pagination
  currentPage: number;
  pageSize: number;

  // UI
  visibleColumns: string[];
  pinnedColumns: string[];
  columnWidths: Record<string, number>;
  columnOrder: string[];
  sortBy: SortState | null;
  selectedRows: Set<string>; // UUIDs
  selectedObjectId: string | null; // For detail panel
  showDetailPanel: boolean;
  showColumnManager: boolean;
}

// Action types for reducer
export type DataExplorerAction =
  | { type: 'SET_COLLECTION'; payload: { name: string; schema: CollectionConfig } }
  | { type: 'SET_DATA'; payload: { objects: WeaviateObject[]; total: number } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_VISIBLE_COLUMNS'; payload: string[] }
  | { type: 'TOGGLE_COLUMN'; payload: string }
  | { type: 'SET_PINNED_COLUMNS'; payload: string[] }
  | { type: 'TOGGLE_PIN_COLUMN'; payload: string }
  | { type: 'SET_COLUMN_WIDTH'; payload: { column: string; width: number } }
  | { type: 'SET_COLUMN_ORDER'; payload: string[] }
  | { type: 'TOGGLE_ROW_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_ROWS'; payload: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SORT'; payload: SortState | null }
  | { type: 'SELECT_OBJECT'; payload: string | null }
  | { type: 'TOGGLE_DETAIL_PANEL'; payload?: boolean }
  | { type: 'TOGGLE_COLUMN_MANAGER'; payload?: boolean }
  | { type: 'RESET_STATE' };

// Filter types for Phase 2
export type FilterOperator =
  | 'Equal'
  | 'NotEqual'
  | 'GreaterThan'
  | 'GreaterThanEqual'
  | 'LessThan'
  | 'LessThanEqual'
  | 'Like'
  | 'ContainsAny'
  | 'ContainsAll'
  | 'IsNull'
  | 'IsNotNull';

export interface FilterCondition {
  id: string;
  path: string;
  operator: FilterOperator;
  value: unknown;
  valueType?: 'text' | 'number' | 'boolean' | 'date';
}

// Filter match mode for combining filters
export type FilterMatchMode = 'AND' | 'OR';

// Vector search types for Phase 3
export type VectorSearchType = 'none' | 'nearText' | 'nearVector' | 'nearObject' | 'hybrid';

export interface VectorSearchParams {
  type: VectorSearchType;
  // nearText parameters
  text?: string;
  // nearVector parameters
  vector?: number[];
  // nearObject parameters
  objectId?: string;
  // Common parameters
  certainty?: number;
  distance?: number;
  distanceMetric?: string;
  targetVector?: string;
  // Hybrid search parameters
  alpha?: number; // 0 = pure BM25, 1 = pure vector
  fusionType?: 'rankedFusion' | 'relativeScoreFusion';
  properties?: string[]; // Which properties to search in
}

// Fetch params for API
export interface FetchObjectsParams {
  collectionName: string;
  limit: number;
  offset: number;
  properties?: string[];
  sortBy?: SortState;
  where?: FilterCondition[]; // Phase 2: Filter support
  matchMode?: FilterMatchMode; // Phase 2: AND/OR logic
  vectorSearch?: VectorSearchParams; // Phase 3: Vector search support
}

// Fetch response type
export interface FetchObjectsResponse {
  objects: WeaviateObject[];
  total: number;
}

// Message types for extension <-> webview communication
export type ExtensionMessageCommand =
  | 'init'
  | 'objectsLoaded'
  | 'schemaLoaded'
  | 'objectDetailLoaded'
  | 'error'
  | 'updateData'
  | 'refresh'
  | 'connectionStatus' // Connection state updates
  // Phase 5: Aggregations and Export
  | 'aggregationsLoaded'
  | 'exportComplete'
  | 'exportProgress'
  | 'exportCancelled';

export type WebviewMessageCommand =
  | 'initialize'
  | 'fetchObjects'
  | 'getSchema'
  | 'getObjectDetail'
  | 'refresh'
  // Phase 5: Aggregations and Export
  | 'getAggregations'
  | 'exportObjects'
  | 'cancelExport';

export interface ExtensionMessage {
  command: ExtensionMessageCommand;
  data?: unknown;
  error?: string;
  collectionName?: string;
  objects?: WeaviateObject[];
  schema?: CollectionConfig;
  object?: WeaviateObject;
  total?: number;
  requestId?: string; // Match with request ID
  // Connection status
  status?: 'connecting' | 'connected' | 'disconnected';
  message?: string;
  // Phase 5: Aggregations and Export
  aggregations?: AggregationResult;
  exportResult?: ExportResult;
  exportProgress?: {
    current: number;
    total: number;
    phase: 'fetching' | 'formatting' | 'complete';
  };
}

export interface WebviewMessage {
  command: WebviewMessageCommand;
  collectionName?: string;
  uuid?: string;
  limit?: number;
  offset?: number;
  properties?: string[];
  sortBy?: SortState;
  where?: FilterCondition[]; // Phase 2: Filter conditions
  matchMode?: FilterMatchMode; // Phase 2: AND/OR logic
  vectorSearch?: VectorSearchParams; // Phase 3: Vector search parameters
  requestId?: string; // For tracking and cancelling requests
  // Phase 5: Aggregations and Export
  aggregationParams?: AggregationParams;
  exportParams?: ExportParams;
}

// Property data types enumeration
export enum PropertyDataType {
  TEXT = 'text',
  STRING = 'string',
  INT = 'int',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  UUID = 'uuid',
  GEO_COORDINATES = 'geoCoordinates',
  PHONE_NUMBER = 'phoneNumber',
  BLOB = 'blob',
  OBJECT = 'object',
  OBJECT_ARRAY = 'object[]',
  TEXT_ARRAY = 'text[]',
  INT_ARRAY = 'int[]',
  NUMBER_ARRAY = 'number[]',
  BOOLEAN_ARRAY = 'boolean[]',
  DATE_ARRAY = 'date[]',
  UUID_ARRAY = 'uuid[]',
}

// Cell render value type
export interface CellRenderValue {
  displayValue: string;
  fullValue: unknown;
  dataType: string;
  isExpandable: boolean;
  itemCount?: number;
}

// VS Code API type
export interface VSCodeAPI {
  postMessage: (message: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

// Note: Window.acquireVsCodeApi is declared elsewhere in the project

// =====================================================
// Phase 5: Aggregation Types
// =====================================================

/**
 * Represents a failure during property aggregation
 */
export interface AggregationFailure {
  property: string;
  error: string;
  type?: string; // The property type that failed
}

/**
 * Result of aggregation queries for collection insights
 */
export interface AggregationResult {
  totalCount: number;

  // Categorical properties (text with low cardinality)
  topValues?: PropertyTopValues[];

  // Numeric properties
  numericStats?: PropertyNumericStats[];

  // Date properties
  dateRange?: PropertyDateRange[];

  // Boolean properties
  booleanCounts?: PropertyBooleanCounts[];

  // Properties that failed to aggregate
  aggregationFailures?: AggregationFailure[];
}

/**
 * Top values breakdown for categorical/text properties
 */
export interface PropertyTopValues {
  property: string;
  values: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Numeric statistics for number/int properties
 */
export interface PropertyNumericStats {
  property: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median?: number;
  sum?: number;
}

/**
 * Date range for date properties
 */
export interface PropertyDateRange {
  property: string;
  earliest: string;
  latest: string;
}

/**
 * Boolean counts for boolean properties
 */
export interface PropertyBooleanCounts {
  property: string;
  trueCount: number;
  falseCount: number;
  truePercentage: number;
  falsePercentage: number;
}

// =====================================================
// Phase 5: Export Types
// =====================================================

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Export scope options
 */
export type ExportScope = 'currentPage' | 'filtered' | 'all';

/**
 * Options for exporting data
 */
export interface ExportOptions {
  scope: ExportScope;
  format: ExportFormat;
  includeMetadata: boolean; // UUID, creationTime, updateTime
  includeVectors: boolean;
  flattenNested: boolean; // Convert nested objects to dot notation
  includeProperties: boolean;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  filename: string; // e.g., "Articles_2025-01-22_filtered.json"
  data: string; // File content
  objectCount: number;
  format: ExportFormat;
  isTruncated?: boolean; // Whether export was limited to max objects
  totalCount?: number; // Total count if export was truncated
  truncationLimit?: number; // The limit that was applied
}

/**
 * Parameters for export API call
 */
export interface ExportParams {
  collectionName: string;
  scope: ExportScope;
  format: ExportFormat;
  options: ExportOptions;
  currentObjects?: WeaviateObject[]; // For currentPage scope
  where?: FilterCondition[]; // For filtered scope
  matchMode?: FilterMatchMode;
}

/**
 * Parameters for aggregation API call
 */
export interface AggregationParams {
  collectionName: string;
  where?: FilterCondition[];
  matchMode?: FilterMatchMode;
  properties?: string[]; // Limit to specific properties
}
