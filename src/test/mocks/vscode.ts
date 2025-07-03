const vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createWebviewPanel: jest.fn(() => ({
      webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn()
      },
      reveal: jest.fn(),
      dispose: jest.fn()
    }))
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
    setContext: jest.fn()
  },
  EventEmitter: class {
    private listeners: Array<(...args: unknown[]) => void> = [];
    fire(...args: unknown[]) {
      this.listeners.forEach(fn => fn(...args));
    }
    event = (listener: (...args: unknown[]) => void) => {
      this.listeners.push(listener);
    };
  },
  ThemeIcon: class {},
  ThemeColor: class {}
};

module.exports = vscode; 