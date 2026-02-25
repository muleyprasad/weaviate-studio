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
    vscodeApi = window.acquireVsCodeApi() as unknown as VSCodeAPI;
  }
  return vscodeApi!;
}

/**
 * Posts a message to the extension
 * Handles cases where the webview has been disposed
 */
export function postMessageToExtension(message: unknown): void {
  try {
    const vscode = getVSCodeAPI();
    vscode.postMessage(message as any);
  } catch (error) {
    console.error('Failed to post message to extension (webview may be disposed):', error);
    // Optional: Show user-friendly error notification
    // In a real implementation, you might want to show a toast notification
  }
}
