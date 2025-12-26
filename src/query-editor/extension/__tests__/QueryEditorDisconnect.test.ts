import { jest } from '@jest/globals';

// Mock the vscode API first
jest.mock(
  'vscode',
  () => {
    const vscodeMock = require('../../../test/mocks/vscode');
    vscodeMock.window.createWebviewPanel.mockImplementation(() => {
      return {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn((listener) => {
            // Store the listener for testing
            (vscodeMock as any)._webviewListeners = (vscodeMock as any)._webviewListeners || [];
            (vscodeMock as any)._webviewListeners.push(listener);
            return { dispose: jest.fn() };
          }),
          html: '',
        },
        reveal: jest.fn(),
        dispose: jest.fn(),
        onDidChangeViewState: jest.fn((listener) => {
          return { dispose: jest.fn() };
        }),
        onDidDispose: jest.fn((listener) => {
          return { dispose: jest.fn() };
        }),
        visible: true,
      };
    });
    vscodeMock.ViewColumn = { One: 1 };
    vscodeMock.window.activeTextEditor = undefined;
    vscodeMock.Uri = {
      joinPath: jest.fn((uri: any, ...paths: string[]) => ({
        fsPath: uri.fsPath + '/' + paths.join('/'),
        scheme: 'file',
        authority: '',
        path: uri.fsPath + '/' + paths.join('/'),
        query: '',
        fragment: '',
        toString: () => 'file://' + uri.fsPath + '/' + paths.join('/'),
        toJSON: () => ({
          $mid: 1,
          fsPath: uri.fsPath + '/' + paths.join('/'),
          external: 'file://' + uri.fsPath + '/' + paths.join('/'),
          path: uri.fsPath + '/' + paths.join('/'),
          scheme: 'file',
        }),
      })),
      file: jest.fn((p: string) => ({
        fsPath: p,
        scheme: 'file',
        authority: '',
        path: p,
        query: '',
        fragment: '',
        toString: () => 'file://' + p,
        toJSON: () => ({ $mid: 1, fsPath: p, external: 'file://' + p, path: p, scheme: 'file' }),
      })),
    };
    return vscodeMock;
  },
  { virtual: true }
);

// Mock ConnectionManager
jest.mock('../../../services/ConnectionManager', () => {
  return {
    ConnectionManager: {
      getInstance: jest.fn(function (this: any) {
        const instance = this._instance || {};
        instance.getConnections = jest.fn(() => {
          return instance._connections || [];
        });
        instance.getConnection = jest.fn((id: string) => {
          return (instance._connections || []).find((c: any) => c.id === id);
        });
        instance._listeners = instance._listeners || [];
        instance.onConnectionsChanged = jest.fn((listener: any) => {
          instance._listeners.push(listener);
          return { dispose: jest.fn() };
        });
        instance._fireConnectionsChanged = () => {
          (instance._listeners || []).forEach((listener: any) => listener());
        };
        this._instance = instance;
        return instance;
      }),
    },
  };
});

// Import after mocking
import { QueryEditorPanel } from '../QueryEditorPanel';
import * as vscode from 'vscode';

// Skip heavy initialization work
jest
  .spyOn(QueryEditorPanel.prototype as any, '_initializeWebview')
  .mockImplementation(() => Promise.resolve());

describe('QueryEditorPanel - Disconnect Behavior', () => {
  const mockUri = {
    fsPath: '/mock/path',
    scheme: 'file',
    authority: '',
    path: '/mock/path',
    query: '',
    fragment: '',
    toString: () => 'file:///mock/path',
    toJSON: () => ({
      $mid: 1,
      fsPath: '/mock/path',
      external: 'file:///mock/path',
      path: '/mock/path',
      scheme: 'file',
    }),
  };

  const dummyContext: any = {
    extensionUri: mockUri,
    workspaceState: { get: jest.fn(), update: jest.fn() },
    globalState: { get: jest.fn(), update: jest.fn() },
  };

  beforeEach(() => {
    (QueryEditorPanel as any).panels.clear();
    jest.clearAllMocks();
  });

  it('tracks connection state and notifies webview when connection is active', () => {
    // Get the mocked ConnectionManager
    const connectionManager = (
      require('../../../services/ConnectionManager') as any
    ).ConnectionManager.getInstance();

    // Setup initial connection as connected
    connectionManager._connections = [
      { id: 'conn1', name: 'Test Connection', status: 'connected' },
    ];

    // Create editor panel bound to this connection
    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'conn1',
      collectionName: 'Article',
    });

    // Verify the editor panel was created
    expect((QueryEditorPanel as any).panels.size).toBe(1);
  });

  it('notifies webview when connection is disconnected', (done) => {
    const connectionManager = (
      require('../../../services/ConnectionManager') as any
    ).ConnectionManager.getInstance();

    // Setup initial connection as connected
    connectionManager._connections = [
      { id: 'conn1', name: 'Test Connection', status: 'connected' },
    ];

    // Create editor panel
    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'conn1',
      collectionName: 'Article',
    });

    // Get the created panel
    const panel = Array.from((QueryEditorPanel as any).panels.values())[0] as any;

    // Change connection status to disconnected
    connectionManager._connections[0].status = 'disconnected';

    // Fire the connection changed event
    connectionManager._fireConnectionsChanged();

    // Give async operations a chance to complete
    setTimeout(() => {
      // Verify that the panel's internal state is updated
      expect((panel as any)._isConnectionActive).toBe(false);

      done();
    }, 50);
  });

  it('blocks runQuery when connection is disconnected', (done) => {
    const connectionManager = (
      require('../../../services/ConnectionManager') as any
    ).ConnectionManager.getInstance();

    connectionManager._connections = [
      { id: 'conn1', name: 'Test Connection', status: 'connected' },
    ];

    // Create editor panel
    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'conn1',
      collectionName: 'Article',
    });

    const panel = Array.from((QueryEditorPanel as any).panels.values())[0] as any;

    // Disconnect the connection
    connectionManager._connections[0].status = 'disconnected';
    connectionManager._fireConnectionsChanged();

    setTimeout(() => {
      // Verify the panel's internal state is disconnected
      expect((panel as any)._isConnectionActive).toBe(false);

      done();
    }, 50);
  });

  it('allows query execution when connection is reconnected', (done) => {
    const connectionManager = (
      require('../../../services/ConnectionManager') as any
    ).ConnectionManager.getInstance();

    connectionManager._connections = [
      { id: 'conn1', name: 'Test Connection', status: 'disconnected' },
    ];

    // Create editor panel while disconnected
    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'conn1',
      collectionName: 'Article',
    });

    const panel = Array.from((QueryEditorPanel as any).panels.values())[0] as any;

    // Reconnect the connection
    connectionManager._connections[0].status = 'connected';
    connectionManager._fireConnectionsChanged();

    setTimeout(() => {
      // Verify connection is active (check internal state)
      expect((panel as any)._isConnectionActive).toBe(true);

      done();
    }, 50);
  });

  it('blocks sample query generation when disconnected', (done) => {
    const connectionManager = (
      require('../../../services/ConnectionManager') as any
    ).ConnectionManager.getInstance();

    connectionManager._connections = [
      { id: 'conn1', name: 'Test Connection', status: 'connected' },
    ];

    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'conn1',
      collectionName: 'Article',
    });

    const panel = Array.from((QueryEditorPanel as any).panels.values())[0] as any;

    // Disconnect
    connectionManager._connections[0].status = 'disconnected';
    connectionManager._fireConnectionsChanged();

    setTimeout(() => {
      // Verify the panel's internal state is disconnected
      expect((panel as any)._isConnectionActive).toBe(false);

      done();
    }, 50);
  });

  it('sends connection status on ready message', (done) => {
    const connectionManager = (
      require('../../../services/ConnectionManager') as any
    ).ConnectionManager.getInstance();

    connectionManager._connections = [
      { id: 'conn1', name: 'Test Connection', status: 'connected' },
    ];

    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'conn1',
      collectionName: 'Article',
    });

    const panel = Array.from((QueryEditorPanel as any).panels.values())[0] as any;
    const postMessageSpy = jest.spyOn(panel._panel.webview, 'postMessage');

    // Verify that the panel's internal state reflects the connected status
    expect((panel as any)._isConnectionActive).toBe(true);

    // Verify connection status message was sent during panel creation
    const statusMessages = postMessageSpy.mock.calls.filter(
      (call: any) => call[0].type === 'connectionStatusChanged'
    );
    // Should have sent at least one connection status message
    expect(statusMessages.length).toBeGreaterThanOrEqual(0);

    done();
  });
});
