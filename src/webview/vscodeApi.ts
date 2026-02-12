// Shared VS Code API instance - can only be acquired once per webview
let vscodeApi: any = null;

export function getVscodeApi() {
  if (!vscodeApi) {
    try {
      vscodeApi = window.acquireVsCodeApi();
    } catch (error) {
      console.error('Failed to acquire VS Code API', error);
    }
  }
  return vscodeApi;
}
