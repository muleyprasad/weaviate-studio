import { ConnectionManager, WeaviateConnection } from '../ConnectionManager';
import * as vscode from 'vscode';
import * as fs from 'fs';

jest.mock('fs');

// Minimal HTML for mocking the webview bundle (must have <head> tag for CSP injection)
const MOCK_WEBVIEW_HTML =
  '<!DOCTYPE html><html lang="en"><head><title>Connection</title></head><body><div id="root"></div></body></html>';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

interface MockWebviewPanel {
  webview: {
    html: string;
    onDidReceiveMessage: jest.Mock;
    postMessage: jest.Mock;
    cspSource: string;
    asWebviewUri: jest.Mock;
  };
  dispose: jest.Mock;
}

describe('ConnectionManager Webview Tests', () => {
  let mockContext: any;
  let globalState: MockGlobalState;
  let mockPanel: MockWebviewPanel;
  let mockCreateWebviewPanel: jest.Mock;

  beforeEach(() => {
    // Reset singleton before every test
    (ConnectionManager as any).instance = undefined;

    // Mock fs.readFileSync to return minimal HTML
    (fs.readFileSync as jest.Mock).mockReturnValue(MOCK_WEBVIEW_HTML);

    globalState = {
      storage: {},
      get: jest.fn((key: string) => {
        return globalState.storage[key];
      }),
      update: jest.fn((key: string, value: any) => {
        globalState.storage[key] = value;
        return Promise.resolve();
      }),
    } as unknown as MockGlobalState;

    mockContext = {
      globalState,
      subscriptions: [],
      extensionUri: { fsPath: '/test-extension' },
    };

    mockPanel = {
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn(),
        cspSource: 'mock-csp-source',
        asWebviewUri: jest.fn((uri) => uri),
      },
      dispose: jest.fn(),
    };

    mockCreateWebviewPanel = jest.fn().mockReturnValue(mockPanel);

    // Mock vscode.window.createWebviewPanel
    jest.spyOn(vscode.window, 'createWebviewPanel').mockImplementation(mockCreateWebviewPanel);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Add Connection Dialog', () => {
    test('creates webview panel with correct parameters for add dialog', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'weaviateConnection',
        'Add Weaviate Connection',
        vscode.ViewColumn.Active,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );

      // localResourceRoots should now point to the dist/webview folder (not empty)
      const options = mockCreateWebviewPanel.mock.calls[0][3];
      expect(options.localResourceRoots).toHaveLength(1);

      // Clean up the promise to avoid hanging test
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('sends initData when ready message is received for add dialog', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate ready message from the React webview
      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initData',
          isEditMode: false,
          apiKeyPresent: false,
        })
      );

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('saves new custom connection on save command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate saving a custom connection
      messageHandler({
        command: 'save',
        connection: {
          name: 'Test Custom',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          apiKey: 'test-key',
          timeoutInit: 30,
          timeoutQuery: 60,
          timeoutInsert: 120,
        },
      });

      const result = await dialogPromise;

      expect(result).toBeDefined();
      expect(result?.connection.name).toBe('Test Custom');
      expect(result?.connection.type).toBe('custom');
      expect(result?.connection.httpHost).toBe('localhost');
      expect(result?.shouldConnect).toBe(false);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('saves and connects on saveAndConnect command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate saving and connecting a custom connection
      messageHandler({
        command: 'saveAndConnect',
        connection: {
          name: 'Test Custom Connect',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          apiKey: 'test-key',
          timeoutInit: 30,
          timeoutQuery: 60,
          timeoutInsert: 120,
        },
      });

      const result = await dialogPromise;

      expect(result).toBeDefined();
      expect(result?.connection.name).toBe('Test Custom Connect');
      expect(result?.connection.type).toBe('custom');
      expect(result?.connection.httpHost).toBe('localhost');
      expect(result?.shouldConnect).toBe(true);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('saves new cloud connection on save command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate saving a cloud connection
      messageHandler({
        command: 'save',
        connection: {
          name: 'Test Cloud',
          type: 'cloud',
          cloudUrl: 'https://test.weaviate.cloud',
          apiKey: 'cloud-key',
          timeoutInit: 45,
          timeoutQuery: 90,
          timeoutInsert: 180,
        },
      });

      const result = await dialogPromise;

      expect(result).toBeDefined();
      expect(result?.connection.name).toBe('Test Cloud');
      expect(result?.connection.type).toBe('cloud');
      expect(result?.connection.cloudUrl).toBe('https://test.weaviate.cloud');
      expect(result?.shouldConnect).toBe(false);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('saves and connects on saveAndConnect command for cloud connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate saving and connecting a cloud connection
      messageHandler({
        command: 'saveAndConnect',
        connection: {
          name: 'Test Cloud Connect',
          type: 'cloud',
          cloudUrl: 'https://test-connect.weaviate.cloud',
          apiKey: 'cloud-key-connect',
          timeoutInit: 45,
          timeoutQuery: 90,
          timeoutInsert: 180,
        },
      });

      const result = await dialogPromise;

      expect(result).toBeDefined();
      expect(result?.connection.name).toBe('Test Cloud Connect');
      expect(result?.connection.type).toBe('cloud');
      expect(result?.connection.cloudUrl).toBe('https://test-connect.weaviate.cloud');
      expect(result?.shouldConnect).toBe(true);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('handles validation errors for custom connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate saving with missing required fields
      messageHandler({
        command: 'save',
        connection: {
          name: '', // Missing name
          type: 'custom',
          httpHost: '', // Missing httpHost
          httpPort: 8080,
        },
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: 'Name and httpHost are required',
      });

      expect(mockPanel.dispose).not.toHaveBeenCalled();

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('handles validation errors for cloud connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate saving with missing required fields
      messageHandler({
        command: 'save',
        connection: {
          name: 'Test Cloud',
          type: 'cloud',
          cloudUrl: '', // Missing cloudUrl
          apiKey: '', // Missing apiKey
        },
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: 'Name, cloudUrl and apiKey are required',
      });

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('handles cancel command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({ command: 'cancel' });

      const result = await dialogPromise;

      expect(result).toBeNull();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('handles duplicate name error', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Add an existing connection
      await mgr.addConnection({
        name: 'Existing',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Try to save with duplicate name
      messageHandler({
        command: 'save',
        connection: {
          name: 'Existing', // Duplicate name
          type: 'custom',
          httpHost: 'different-host',
          httpPort: 8080,
          grpcHost: 'different-host',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
        },
      });

      // Wait a bit for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: expect.stringContaining('A connection with this name already exists'),
      });

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });
  });

  describe('Edit Connection Dialog', () => {
    test('creates webview panel with correct parameters for edit dialog', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connection = await mgr.addConnection({
        name: 'Edit Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        'weaviateConnection',
        'Edit Weaviate Connection',
        vscode.ViewColumn.Active,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('sends initData with pre-filled connection data on ready', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connection = await mgr.addConnection({
        name: 'Pre-fill Test',
        type: 'custom',
        httpHost: 'existing-host',
        httpPort: 9090,
        grpcHost: 'existing-host',
        grpcPort: 50052,
        httpSecure: true,
        grpcSecure: true,
        apiKey: 'existing-key',
        timeoutInit: 45,
        timeoutQuery: 90,
        timeoutInsert: 180,
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate ready message
      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initData',
          isEditMode: true,
          apiKeyPresent: true, // key exists but value not sent
          connection: expect.objectContaining({
            name: 'Pre-fill Test',
            httpHost: 'existing-host',
            httpPort: 9090,
            grpcPort: 50052,
            httpSecure: true,
          }),
        })
      );

      // The actual API key value should NOT be sent to the webview
      const postMessageCall = mockPanel.webview.postMessage.mock.calls[0][0];
      expect(postMessageCall.connection.apiKey).toBeUndefined();

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('updates existing connection on save command and allows API key change', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connection = await mgr.addConnection({
        name: 'Original Name',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'save',
        connection: {
          name: 'Updated Name',
          type: 'custom',
          httpHost: 'updated-host',
          httpPort: 9090,
          grpcHost: 'updated-host',
          grpcPort: 50052,
          httpSecure: true,
          grpcSecure: true,
          apiKey: 'updated-key',
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.name).toBe('Updated Name');
      expect(result?.connection.httpHost).toBe('updated-host');
      expect(result?.connection.httpPort).toBe(9090);
      expect(result?.connection.httpSecure).toBe(true);
      expect(result?.shouldConnect).toBe(false);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('updates and connects on saveAndConnect command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connection = await mgr.addConnection({
        name: 'Original Name Connect',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'saveAndConnect',
        connection: {
          name: 'Updated Name Connect',
          type: 'custom',
          httpHost: 'updated-host-connect',
          httpPort: 9090,
          grpcHost: 'updated-host-connect',
          grpcPort: 50052,
          httpSecure: true,
          grpcSecure: true,
          apiKey: 'updated-key-connect',
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.name).toBe('Updated Name Connect');
      expect(result?.connection.httpHost).toBe('updated-host-connect');
      expect(result?.connection.httpPort).toBe(9090);
      expect(result?.connection.httpSecure).toBe(true);
      expect(result?.shouldConnect).toBe(true);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('retains existing API key when left blank during edit', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connection = await mgr.addConnection({
        name: 'Keep Key',
        type: 'cloud',
        cloudUrl: 'https://keep.weaviate.cloud',
        apiKey: 'secret-key',
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate save without providing apiKey (apiKeyAction='keep' in React sends no apiKey)
      messageHandler({
        command: 'save',
        connection: {
          name: 'Keep Key',
          type: 'cloud',
          cloudUrl: 'https://keep.weaviate.cloud',
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.apiKey).toBe('secret-key');
      expect(result?.shouldConnect).toBe(false);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('clears API key when removeApiKey flag is sent', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connection = await mgr.addConnection({
        name: 'Remove Key',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        apiKey: 'key-to-remove',
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate save with removeApiKey flag (user clicked REMOVE API KEY)
      messageHandler({
        command: 'save',
        removeApiKey: true,
        connection: {
          name: 'Remove Key',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.apiKey).toBeUndefined();
      expect(result?.shouldConnect).toBe(false);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('throws error for non-existent connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await expect(mgr.showEditConnectionDialog('non-existent-id')).rejects.toThrow(
        'Connection not found'
      );
    });
  });

  describe('Message Handling', () => {
    test('handles unknown message commands gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Send unknown command
      messageHandler({ command: 'unknown-command' });

      // Should not crash or dispose panel
      expect(mockPanel.dispose).not.toHaveBeenCalled();

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('handles malformed message data gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Send malformed data
      messageHandler({ command: 'save' }); // Missing connection data

      // Should handle gracefully and send error
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error',
          message: expect.any(String),
        })
      );

      // Clean up
      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });
  });
});
