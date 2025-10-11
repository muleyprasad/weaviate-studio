const vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createWebviewPanel: jest.fn(() => ({
      webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(),
      },
      reveal: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
    setContext: jest.fn(),
  },
  EventEmitter: class {
    private listeners: Array<(...args: unknown[]) => void> = [];
    fire(...args: unknown[]) {
      this.listeners.forEach((fn) => fn(...args));
    }
    event = (listener: (...args: unknown[]) => void) => {
      this.listeners.push(listener);
    };
  },
  ThemeIcon: class {
    id: string;
    color: any;
    constructor(id: string, color?: any) {
      this.id = id;
      this.color = color;
    }
  },
  ThemeColor: class {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  TreeItem: class {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState = 0) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3,
  },
  Uri: {
    // Minimal joinPath implementation used by tests
    joinPath: jest.fn((base: any, ...paths: string[]) => {
      // If base is a Uri-like object with fsPath, build a simple object
      const basePath = base && base.fsPath ? base.fsPath : String(base || '');
      const fullPath = [basePath, ...paths].join('/').replace(/\\/g, '/');
      return { fsPath: fullPath, toString: () => `file://${fullPath}` };
    }),
    file: (path: string) => ({ fsPath: path, toString: () => `file://${path}` }),
  },
};

module.exports = vscode;
