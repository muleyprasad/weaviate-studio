// Shared VS Code API instance - can only be acquired once per webview

/**
 * Represents a Weaviate collection/class schema as returned by the REST API.
 * Note: the `type` field is intentionally absent — it is not present in REST
 * API responses or in the JSON schema format used when creating collections.
 */
export interface WeaviateCollectionSchema {
  class: string;
  description?: string;
  properties?: Array<{ name: string; dataType: string[]; [key: string]: unknown }>;
  vectorizer?: string;
  vectorIndexType?: string;
  moduleConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Available modules map from Weaviate server metadata */
export type AvailableModules = Record<string, Record<string, unknown>>;

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
