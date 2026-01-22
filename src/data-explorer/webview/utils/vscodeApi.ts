/**
 * VS Code API singleton
 * Ensures acquireVsCodeApi() is only called once per webview session
 */

import type { VSCodeAPI } from '../../types';

// Singleton instance - only acquire once
let vscodeApi: VSCodeAPI | null = null;

/**
 * Gets the VS Code API instance
 * Creates it on first call, returns cached instance on subsequent calls
 */
export function getVSCodeAPI(): VSCodeAPI {
  if (!vscodeApi) {
    vscodeApi = window.acquireVsCodeApi();
  }
  return vscodeApi;
}

/**
 * Posts a message to the extension
 */
export function postMessageToExtension(message: unknown): void {
  const vscode = getVSCodeAPI();
  vscode.postMessage(message as any);
}
