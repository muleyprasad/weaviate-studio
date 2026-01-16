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

  // Vector Search
  vectorSearch: VectorSearchState;

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
  | { type: 'CLEAR_VECTOR_SEARCH' };

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
export type VectorSearchMode = 'text' | 'object' | 'vector';

/**
 * Distance metric for vector search
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'manhattan' | 'dot';

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
  // Common options
  limit: number;
  distance?: number;
  certainty?: number;
  useDistance: boolean; // true = distance, false = certainty
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  object: WeaviateObject<Record<string, unknown>, string>;
  distance?: number;
  certainty?: number;
  score?: number;
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
