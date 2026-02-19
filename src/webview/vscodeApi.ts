// Shared VS Code API instance - can only be acquired once per webview

/**
 * Represents a Weaviate collection/class schema as returned by the REST API.
 * Note: the `type` field is intentionally absent — it is not present in REST
 * API responses or in the JSON schema format used when creating collections.
 */
export interface WeaviateCollectionSchema {
  class: string;
  name?: string;
  description?: string;
  properties?: Array<{ name: string; dataType: string[]; [key: string]: unknown }>;
  vectorizer?: string;
  vectorIndexType?: string;
  moduleConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Available modules map from Weaviate server metadata */
export type AvailableModules = Record<string, unknown>;

/** Action to take after a schema is loaded from a file or clone */
export type SchemaLoadAction = 'edit' | 'create';

/**
 * Discriminated union of all messages the extension can send to the webview.
 * Used to type MessageEvent.data in webview message handlers.
 */
export type ExtensionToWebviewMessage =
  | { command: 'availableModules'; modules: AvailableModules }
  | { command: 'initialSchema'; schema: WeaviateCollectionSchema | null }
  | { command: 'nodesNumber'; nodesNumber: number }
  | { command: 'hasCollections'; hasCollections: boolean }
  | { command: 'vectorizers'; vectorizers: string[]; modules: AvailableModules }
  | { command: 'serverVersion'; version: string }
  | { command: 'collections'; collections: string[] }
  | { command: 'schema'; schema: WeaviateCollectionSchema }
  | { command: 'error'; message: string };

type VsCodeApi = {
  postMessage: (message: Record<string, unknown>) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

declare global {
  interface Window {
    acquireVsCodeApi: () => VsCodeApi;
  }
}

let vscodeApi: VsCodeApi | null = null;

export function getVscodeApi(): VsCodeApi | null {
  if (!vscodeApi) {
    try {
      vscodeApi = window.acquireVsCodeApi();
    } catch (error) {
      console.error('Failed to acquire VS Code API', error);
    }
  }
  return vscodeApi;
}
