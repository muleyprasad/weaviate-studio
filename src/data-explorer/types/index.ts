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

export interface WeaviateObjectMetadata {
  uuid?: string;
  creationTime?: string;
  lastUpdateTime?: string;
  creationTimeUnix?: number;
  lastUpdateTimeUnix?: number;
  distance?: number;
  certainty?: number;
  score?: number;
  explainScore?: string;
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
export type VectorSearchType = 'none' | 'nearText' | 'nearVector';

export interface VectorSearchParams {
  type: VectorSearchType;
  // nearText parameters
  text?: string;
  // nearVector parameters
  vector?: number[];
  // Common parameters
  certainty?: number; // 0-1, higher means more similar
  distance?: number; // 0-2, lower means more similar
  targetVector?: string; // For named vectors
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
  | 'refresh';

export type WebviewMessageCommand =
  | 'initialize'
  | 'fetchObjects'
  | 'getSchema'
  | 'getObjectDetail'
  | 'refresh';

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
  requestId?: string; // For tracking and cancelling requests
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
