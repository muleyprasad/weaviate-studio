import { ConnectionManager } from '../ConnectionManager';
import weaviate from 'weaviate-client';
import * as vscode from 'vscode';
import * as fs from 'fs';

jest.mock('fs');

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

function makeMockContext(globalState: MockGlobalState) {
  return {
    globalState,
    subscriptions: [],
    extensionUri: { fsPath: '/test-extension' },
  };
}

function makeMockPanel(): MockWebviewPanel {
  return {
    webview: {
      html: '',
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn(),
      cspSource: 'mock-csp-source',
      asWebviewUri: jest.fn((uri) => uri),
    },
    dispose: jest.fn(),
  };
}

function makeGlobalState(): MockGlobalState {
  const state: MockGlobalState = {
    storage: {},
    get: jest.fn((key: string) => state.storage[key]),
    update: jest.fn((key: string, value: any) => {
      state.storage[key] = value;
      return Promise.resolve();
    }),
  } as unknown as MockGlobalState;
  return state;
}

describe('ConnectionManager — OIDC / clientPassword auth support', () => {
  let mockContext: any;
  let globalState: MockGlobalState;
  let mockPanel: MockWebviewPanel;

  beforeEach(() => {
    jest.clearAllMocks(); // clear call history between tests
    (ConnectionManager as any).instance = undefined;
    (fs.readFileSync as jest.Mock).mockReturnValue(MOCK_WEBVIEW_HTML);
    globalState = makeGlobalState();
    mockContext = makeMockContext(globalState);
    mockPanel = makeMockPanel();
    jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel as any);
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // addConnection — core storage
  // ---------------------------------------------------------------------------

  describe('addConnection with clientPassword auth', () => {
    test('stores authType, username and password', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'OIDC Connection',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'alice',
        password: 'secret123',
      });

      expect(conn.authType).toBe('clientPassword');
      expect(conn.username).toBe('alice');
      expect(conn.password).toBe('secret123');
      expect(conn.apiKey).toBeUndefined();
    });

    test('does not require apiKey when authType is clientPassword', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await expect(
        mgr.addConnection({
          name: 'OIDC No Key',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          authType: 'clientPassword',
          username: 'bob',
        })
      ).resolves.toBeDefined();
    });

    test('username can be updated via updateConnection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Update Username Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'original-user',
        password: 'pass',
      });

      const updated = await mgr.updateConnection(conn.id, { username: 'new-user' });
      expect(updated?.username).toBe('new-user');
      // password should remain untouched
      expect(updated?.password).toBe('pass');
    });

    test('password can be cleared by updating to undefined', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Clear Password Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'user',
        password: 'old-pass',
      });

      const updated = await mgr.updateConnection(conn.id, { password: undefined });
      expect(updated?.password).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // connect() — uses AuthUserPasswordCredentials
  // ---------------------------------------------------------------------------

  describe('connect() with clientPassword auth', () => {
    test('passes AuthUserPasswordCredentials to connectToCustom', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };
      const mockConnectToCustom = jest
        .spyOn(weaviate, 'connectToCustom')
        .mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'OIDC Connect',
        type: 'custom',
        httpHost: 'oidc-host',
        httpPort: 8080,
        grpcHost: 'oidc-host',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'testuser',
        password: 'testpass',
      });

      await mgr.connect(conn.id);

      // Verify the credentials contain the correct username/password structure
      const callArgs = mockConnectToCustom.mock.calls[0][0];
      expect(callArgs.authCredentials).toMatchObject({ username: 'testuser' });
    });

    test('does not set apiKey credentials when authType is clientPassword', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };
      const mockConnectToCustom = jest
        .spyOn(weaviate, 'connectToCustom')
        .mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'OIDC No ApiKey',
        type: 'custom',
        httpHost: 'oidc-host2',
        httpPort: 8080,
        grpcHost: 'oidc-host2',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'user2',
        password: 'pass2',
        apiKey: 'should-be-ignored',
      });

      await mgr.connect(conn.id);

      const callArgs = mockConnectToCustom.mock.calls[0][0];
      // Should use username/password credentials, not ApiKey, because authType takes precedence
      expect(callArgs.authCredentials).toMatchObject({ username: 'user2' });
      expect(callArgs.authCredentials).not.toMatchObject({ key: expect.anything() });
    });

    test('falls back to HTTP-only with AuthUserPasswordCredentials on gRPC error', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };
      const grpcError = new Error('gRPC connection is not supported on Weaviate v1.26.7');
      grpcError.name = 'WeaviateStartUpError';

      const mockConnectToCustom = jest
        .spyOn(weaviate, 'connectToCustom')
        .mockRejectedValueOnce(grpcError) // First call fails (gRPC)
        .mockResolvedValueOnce(mockClient as any); // Second call succeeds (HTTP-only)

      const conn = await mgr.addConnection({
        name: 'OIDC gRPC Fallback',
        type: 'custom',
        httpHost: 'oidc-fallback-host',
        httpPort: 8080,
        grpcHost: 'oidc-fallback-host',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'fallback-user',
        password: 'fallback-pass',
      });

      const result = await mgr.connect(conn.id);

      expect(result).not.toBeNull();
      expect(mockConnectToCustom).toHaveBeenCalledTimes(2);

      // Second call (HTTP-only fallback) should also use username/password credentials
      const fallbackArgs = mockConnectToCustom.mock.calls[1][0];
      expect(fallbackArgs.authCredentials).toMatchObject({ username: 'fallback-user' });
      expect(fallbackArgs.grpcHost).toBeUndefined();
      expect(fallbackArgs.grpcPort).toBeUndefined();
    });

    test('uses apiKey credentials when authType is apiKey (regression)', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };
      const mockConnectToCustom = jest
        .spyOn(weaviate, 'connectToCustom')
        .mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'ApiKey Regression',
        type: 'custom',
        httpHost: 'apikey-host',
        httpPort: 8080,
        grpcHost: 'apikey-host',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'apiKey',
        apiKey: 'my-api-key',
      });

      await mgr.connect(conn.id);

      const callArgs = mockConnectToCustom.mock.calls[0][0];
      // Should use ApiKey credentials, not username/password
      expect(callArgs.authCredentials).toMatchObject({ key: 'my-api-key' });
      expect(callArgs.authCredentials).not.toMatchObject({ username: expect.anything() });
    });
  });

  // ---------------------------------------------------------------------------
  // Webview dialog — add mode
  // ---------------------------------------------------------------------------

  describe('showAddConnectionDialog — clientPassword fields in initData', () => {
    test('initData includes authType, username, and passwordPresent defaults', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initData',
          passwordPresent: false,
          connection: expect.objectContaining({
            authType: 'apiKey',
            username: '',
          }),
        })
      );

      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('saves new connection with clientPassword auth via save command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'save',
        connection: {
          name: 'OIDC New',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          authType: 'clientPassword',
          username: 'newuser',
          password: 'newpass',
        },
      });

      const result = await dialogPromise;

      expect(result).not.toBeNull();
      expect(result?.connection.authType).toBe('clientPassword');
      expect(result?.connection.username).toBe('newuser');
      expect(result?.connection.password).toBe('newpass');
      expect(result?.shouldConnect).toBe(false);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('saves and connects with clientPassword auth via saveAndConnect command', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const dialogPromise = mgr.showAddConnectionDialog();
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'saveAndConnect',
        connection: {
          name: 'OIDC Connect New',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          authType: 'clientPassword',
          username: 'connectuser',
          password: 'connectpass',
        },
      });

      const result = await dialogPromise;

      expect(result).not.toBeNull();
      expect(result?.connection.authType).toBe('clientPassword');
      expect(result?.connection.username).toBe('connectuser');
      expect(result?.connection.password).toBe('connectpass');
      expect(result?.shouldConnect).toBe(true);
      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Webview dialog — edit mode
  // ---------------------------------------------------------------------------

  describe('showEditConnectionDialog — clientPassword fields', () => {
    test('initData includes authType, username, and passwordPresent for existing OIDC connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Edit OIDC',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'existinguser',
        password: 'existingpass',
      });

      const dialogPromise = mgr.showEditConnectionDialog(conn.id);
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initData',
          isEditMode: true,
          passwordPresent: true,
          connection: expect.objectContaining({
            authType: 'clientPassword',
            username: 'existinguser',
          }),
        })
      );

      // Password value itself must NOT be sent to the webview
      const postCall = mockPanel.webview.postMessage.mock.calls[0][0];
      expect(postCall.connection.password).toBeUndefined();

      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });

    test('retains existing password when save command omits password', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Keep Password',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'keepuser',
        password: 'keep-secret',
      });

      const dialogPromise = mgr.showEditConnectionDialog(conn.id);
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Save without providing a new password (passwordAction='keep' in React → no password field)
      messageHandler({
        command: 'save',
        connection: {
          name: 'Keep Password',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          authType: 'clientPassword',
          username: 'keepuser',
          // password omitted
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.password).toBe('keep-secret');
    });

    test('clears password when removePassword flag is sent', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Remove Password',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'rmuser',
        password: 'old-pass',
      });

      const dialogPromise = mgr.showEditConnectionDialog(conn.id);
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'save',
        removePassword: true,
        connection: {
          name: 'Remove Password',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          authType: 'clientPassword',
          username: 'rmuser',
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.password).toBeUndefined();
    });

    test('updates username and password together via saveAndConnect', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Update All OIDC',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'old-user',
        password: 'old-pass',
      });

      const dialogPromise = mgr.showEditConnectionDialog(conn.id);
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'saveAndConnect',
        connection: {
          name: 'Update All OIDC',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          authType: 'clientPassword',
          username: 'new-user',
          password: 'new-pass',
        },
      });

      const result = await dialogPromise;

      expect(result?.connection.username).toBe('new-user');
      expect(result?.connection.password).toBe('new-pass');
      expect(result?.shouldConnect).toBe(true);
    });

    test('passwordPresent is false for connection without password', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'No Password OIDC',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        authType: 'clientPassword',
        username: 'nopassuser',
        // no password
      });

      const dialogPromise = mgr.showEditConnectionDialog(conn.id);
      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordPresent: false,
        })
      );

      messageHandler({ command: 'cancel' });
      await dialogPromise;
    });
  });
});
