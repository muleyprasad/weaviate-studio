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
 * Parameters for fetching objects
 */
export interface FetchParams {
  collectionName: string;
  limit: number;
  offset: number;
  properties?: string[];
  sortBy?: SortConfig;
}

/**
 * Result from fetching objects
 */
export interface FetchResult {
  objects: WeaviateObject[];
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
  | { type: 'SET_DATA'; payload: { objects: WeaviateObject[]; totalCount: number } }
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
  | { type: 'TOGGLE_DETAIL_PANEL'; payload: boolean };

/**
 * Message types for webview communication
 */
export type WebviewMessageCommand =
  | 'initialize'
  | 'fetchObjects'
  | 'getSchema'
  | 'selectObject'
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
