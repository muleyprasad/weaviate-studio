import { ConnectionManager, WeaviateConnection } from '../ConnectionManager';
import * as vscode from 'vscode';

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
    };

    mockPanel = {
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn(),
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
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      // Clean up the promise to avoid hanging test
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('generates correct HTML content for add dialog', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      expect(mockPanel.webview.html).toContain('Add Weaviate Connection');
      expect(mockPanel.webview.html).toContain('Connection Type');
      expect(mockPanel.webview.html).toContain('Connection Name');
      expect(mockPanel.webview.html).toContain('Save Connection');
      expect(mockPanel.webview.html).toContain('Save and Connect');

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
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
          cloudUrl: 'https://test.weaviate.network',
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
      expect(result?.connection.cloudUrl).toBe('https://test.weaviate.network');
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
          cloudUrl: 'https://test-connect.weaviate.network',
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
      expect(result?.connection.cloudUrl).toBe('https://test-connect.weaviate.network');
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
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('pre-fills form with existing connection data', async () => {
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

      expect(mockPanel.webview.html).toContain('Pre-fill Test');
      expect(mockPanel.webview.html).toContain('existing-host');
      expect(mockPanel.webview.html).toContain('9090');
      expect(mockPanel.webview.html).toContain('50052');
      expect(mockPanel.webview.html).not.toContain('existing-key');
      expect(mockPanel.webview.html).toContain('Leave blank to keep existing key');
      expect(mockPanel.webview.html).toContain('Update Connection');
      expect(mockPanel.webview.html).toContain('Update and Connect');

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
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
        cloudUrl: 'https://keep.weaviate.network',
        apiKey: 'secret-key',
      });

      const dialogPromise = mgr.showEditConnectionDialog(connection.id);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate save without providing apiKey
      messageHandler({
        command: 'save',
        connection: {
          name: 'Keep Key',
          type: 'cloud',
          cloudUrl: 'https://keep.weaviate.network',
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.apiKey).toBe('secret-key');
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

  describe('HTML Content Generation', () => {
    test('generates valid HTML structure', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const html = mockPanel.webview.html;

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('<script>');
      expect(html).toContain('</html>');

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('includes VS Code CSS variables for theming', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const html = mockPanel.webview.html;

      expect(html).toContain('var(--vscode-font-family)');
      expect(html).toContain('var(--vscode-editor-background)');
      expect(html).toContain('var(--vscode-foreground)');
      expect(html).toContain('var(--vscode-input-border)');
      expect(html).toContain('var(--vscode-input-background)');
      expect(html).toContain('var(--vscode-button-background)');

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('includes JavaScript for form interaction', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const html = mockPanel.webview.html;

      expect(html).toContain('acquireVsCodeApi()');
      expect(html).toContain('addEventListener');
      expect(html).toContain('postMessage');
      expect(html).toContain('connectionTypeDropdown');

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
    });

    test('includes form fields for both connection types', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();

      const html = mockPanel.webview.html;

      // Common fields
      expect(html).toContain('connectionName');
      expect(html).toContain('connectionType');

      // Custom fields
      expect(html).toContain('customFields');
      expect(html).toContain('httpHost');
      expect(html).toContain('httpPort');
      expect(html).toContain('grpcHost');
      expect(html).toContain('grpcPort');
      expect(html).toContain('httpSecure');
      expect(html).toContain('grpcSecure');

      // Cloud fields
      expect(html).toContain('cloudFields');
      expect(html).toContain('cloudUrl');
      expect(html).toContain('apiKeyCloud');

      // Advanced settings
      expect(html).toContain('advancedSettings');
      expect(html).toContain('timeoutInit');
      expect(html).toContain('timeoutQuery');
      expect(html).toContain('timeoutInsert');

      // Clean up
      mockPanel.webview.onDidReceiveMessage.mock.calls[0][0]({ command: 'cancel' });
      await dialogPromise;
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
