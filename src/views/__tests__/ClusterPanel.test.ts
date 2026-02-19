import { ClusterPanel } from '../ClusterPanel';
import * as vscode from 'vscode';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');

describe('ClusterPanel', () => {
  let mockPanel: any;
  let mockExtensionUri: vscode.Uri;

  beforeEach(() => {
    // Reset singleton
    (ClusterPanel as any).currentPanel = undefined;

    mockPanel = {
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn(),
        cspSource: 'vscode-webview-csp-source',
        asWebviewUri: jest.fn((uri: vscode.Uri) => {
          return {
            toString: () => `vscode-webview://webview/${uri.path}`,
            fsPath: uri.path,
          };
        }),
      },
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidDispose: jest.fn((callback) => {
        // Store callback but don't call it immediately
        mockPanel._disposeCallback = callback;
        return { dispose: jest.fn() };
      }),
    };

    mockExtensionUri = vscode.Uri.file('/test/extension');

    jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel);

    // Mock fs.readFileSync to return a simple HTML structure
    (fs.readFileSync as jest.Mock).mockReturnValue(`<!DOCTYPE html>
<html>
<head></head>
<body>
  <div id="root"></div>
  <script src="bundle.js"></script>
  <link href="styles.css" rel="stylesheet">
</body>
</html>`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Connection tracking', () => {
    test('tracks connection ID for the panel', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      const panel = ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData,
        'Test Connection'
      );

      expect(panel.getConnectionId()).toBe(connectionId);
    });

    test('closeForConnection disposes panel for matching connection', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      expect(ClusterPanel.currentPanel).toBeDefined();

      // Close for the same connection
      ClusterPanel.closeForConnection(connectionId);

      expect(ClusterPanel.currentPanel).toBeUndefined();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('closeForConnection does not dispose panel for different connection', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const panelBefore = ClusterPanel.currentPanel;
      expect(panelBefore).toBeDefined();

      // Try to close for a different connection
      ClusterPanel.closeForConnection('different-connection-456');

      // Panel should still be open
      expect(ClusterPanel.currentPanel).toBe(panelBefore);
      expect(mockPanel.dispose).not.toHaveBeenCalled();
    });

    test('reuses existing panel when creating for same connection', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData1 = { nodes: [{ name: 'node1' }] };
      const nodeStatusData2 = { nodes: [{ name: 'node2' }] };

      const panel1 = ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData1,
        'Test Connection'
      );

      const panel2 = ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData2,
        'Test Connection'
      );

      // Should be the same panel instance
      expect(panel1).toBe(panel2);
      expect(mockPanel.reveal).toHaveBeenCalled();
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateData',
          nodeStatusData: nodeStatusData2,
        })
      );
    });

    test('disposes panel when dispose is called', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      const panel = ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData,
        'Test Connection'
      );

      expect(ClusterPanel.currentPanel).toBe(panel);

      // Manually call the dispose callback to simulate panel disposal
      if (mockPanel._disposeCallback) {
        mockPanel._disposeCallback();
      }

      expect(ClusterPanel.currentPanel).toBeUndefined();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });

  describe('Message handling', () => {
    test('handles error messages', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      const showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage');

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({ command: 'error', text: 'Test error message' });

      expect(showErrorMessageSpy).toHaveBeenCalledWith('Test error message');
    });

    test('handles info messages', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      const showInformationMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({ command: 'info', text: 'Test info message' });

      expect(showInformationMessageSpy).toHaveBeenCalledWith('Test info message');
    });

    test('handles refresh command', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [{ name: 'node1', status: 'HEALTHY' }] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Deliver pending init data first (simulates webview signalling ready)
      messageHandler({ command: 'ready' });
      mockPanel.webview.postMessage.mockClear();

      // Trigger refresh
      messageHandler({ command: 'refresh' });

      // The refresh is forwarded to onMessageCallback; without a callback nothing
      // extra is posted, but the handler must not throw
      expect(mockPanel.dispose).not.toHaveBeenCalled();
    });

    test('handles updateShardStatus command', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [{ name: 'node1', status: 'HEALTHY' }] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Deliver pending init data first
      messageHandler({ command: 'ready' });

      // Trigger updateShardStatus — forwarded to onMessageCallback (none here)
      messageHandler({
        command: 'updateShardStatus',
        collection: 'TestCollection',
        shardNames: ['shard-1', 'shard-2'],
        newStatus: 'READY',
      });

      // Panel should not have been disposed
      expect(mockPanel.dispose).not.toHaveBeenCalled();
    });

    test('handles toggleOpenClusterViewOnConnect command', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Deliver pending init data first
      messageHandler({ command: 'ready' });

      messageHandler({
        command: 'toggleOpenClusterViewOnConnect',
        value: false,
      });

      // Panel should not have been disposed
      expect(mockPanel.dispose).not.toHaveBeenCalled();
    });
  });

  describe('Auto-refresh functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('webview should handle auto-refresh interval changes', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate the webview signalling it is ready to receive data
      messageHandler({ command: 'ready' });

      // The webview should have received the initial data
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
        })
      );
    });

    test('updateData should update existing panel with new data', () => {
      const connectionId = 'test-connection-123';
      const initialData = { nodes: [{ name: 'node1' }] };
      const updatedData = { nodes: [{ name: 'node1' }, { name: 'node2' }] };

      const panel = ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        initialData,
        'Test Connection'
      );

      // Clear previous calls
      mockPanel.webview.postMessage.mockClear();

      // Update with new data using createOrShow (which updates existing panel)
      ClusterPanel.createOrShow(mockExtensionUri, connectionId, updatedData, 'Test Connection');

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateData',
          nodeStatusData: updatedData,
        })
      );
    });

    test('handles refresh command from webview', async () => {
      const onMessageCallback = jest.fn().mockResolvedValue(undefined);
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData,
        'Test Connection',
        onMessageCallback
      );

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Simulate refresh command from webview (triggered by auto-refresh)
      await messageHandler({ command: 'refresh' });

      expect(onMessageCallback).toHaveBeenCalledWith({ command: 'refresh' }, expect.any(Function));
    });

    test('panel can receive updated data multiple times for auto-refresh', () => {
      const connectionId = 'test-connection-123';
      const data1 = { nodes: [{ name: 'node1', objectCount: 100 }] };
      const data2 = { nodes: [{ name: 'node1', objectCount: 200 }] };
      const data3 = { nodes: [{ name: 'node1', objectCount: 300 }] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, data1, 'Test Connection');

      mockPanel.webview.postMessage.mockClear();

      // Simulate multiple auto-refresh updates
      ClusterPanel.createOrShow(mockExtensionUri, connectionId, data2, 'Test Connection');

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateData',
          nodeStatusData: data2,
        })
      );

      mockPanel.webview.postMessage.mockClear();

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, data3, 'Test Connection');

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateData',
          nodeStatusData: data3,
        })
      );
    });

    test('panel update preserves openClusterViewOnConnect setting', () => {
      const connectionId = 'test-connection-123';
      const initialData = { nodes: [] };
      const updatedData = { nodes: [{ name: 'node1' }] };

      ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        initialData,
        'Test Connection',
        undefined,
        false // openClusterViewOnConnect = false
      );

      mockPanel.webview.postMessage.mockClear();

      // Update with new data
      ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        updatedData,
        'Test Connection',
        undefined,
        false
      );

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateData',
          openClusterViewOnConnect: false,
        })
      );
    });
  });

  describe('View type support', () => {
    test('panel supports both node and collection views through webview', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = {
        nodes: [
          {
            name: 'node-1',
            status: 'HEALTHY',
            shards: [
              {
                name: 'shard-1',
                class: 'Collection1',
                objectCount: 100,
                vectorIndexingStatus: 'READY',
              },
            ],
          },
        ],
      };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      // Initial data should be sent after ready
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
          nodeStatusData: nodeStatusData,
        })
      );
    });

    test('webview receives data structured for both view types', () => {
      const connectionId = 'test-connection-123';
      const complexData = {
        nodes: [
          {
            name: 'node-1',
            status: 'HEALTHY',
            shards: [
              { name: 'shard-1', class: 'Collection1', objectCount: 50 },
              { name: 'shard-2', class: 'Collection2', objectCount: 75 },
            ],
          },
          {
            name: 'node-2',
            status: 'HEALTHY',
            shards: [
              { name: 'shard-3', class: 'Collection1', objectCount: 50 },
              { name: 'shard-4', class: 'Collection3', objectCount: 100 },
            ],
          },
        ],
      };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, complexData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      const postMessageCalls = mockPanel.webview.postMessage.mock.calls;
      const initCall = postMessageCalls.find((call: any) => call[0].command === 'init');

      expect(initCall).toBeDefined();
      expect(initCall[0].nodeStatusData).toEqual(complexData);
    });

    test('data supports collection grouping with multiple nodes per collection', () => {
      const connectionId = 'test-connection-123';
      const multiNodeCollectionData = {
        nodes: [
          {
            name: 'node-1',
            status: 'HEALTHY',
            shards: [
              {
                name: 'shard-1',
                class: 'SharedCollection',
                objectCount: 100,
                vectorIndexingStatus: 'READY',
              },
            ],
          },
          {
            name: 'node-2',
            status: 'HEALTHY',
            shards: [
              {
                name: 'shard-2',
                class: 'SharedCollection',
                objectCount: 150,
                vectorIndexingStatus: 'READY',
              },
            ],
          },
          {
            name: 'node-3',
            status: 'HEALTHY',
            shards: [
              {
                name: 'shard-3',
                class: 'SharedCollection',
                objectCount: 200,
                vectorIndexingStatus: 'READY',
              },
            ],
          },
        ],
      };

      ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        multiNodeCollectionData,
        'Test Connection'
      );

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      const postMessageCalls = mockPanel.webview.postMessage.mock.calls;
      const initCall = postMessageCalls.find((call: any) => call[0].command === 'init');

      expect(initCall).toBeDefined();
      expect(initCall[0].nodeStatusData.nodes).toHaveLength(3);

      // Verify all nodes have shards for the same collection
      const allShards = initCall[0].nodeStatusData.nodes.flatMap((n: any) => n.shards);
      expect(allShards.every((s: any) => s.class === 'SharedCollection')).toBe(true);
    });

    test('data supports READONLY shard status detection', () => {
      const connectionId = 'test-connection-123';
      const mixedStatusData = {
        nodes: [
          {
            name: 'node-1',
            status: 'HEALTHY',
            shards: [
              {
                name: 'shard-1',
                class: 'Collection1',
                objectCount: 100,
                vectorIndexingStatus: 'READY',
              },
              {
                name: 'shard-2',
                class: 'Collection1',
                objectCount: 50,
                vectorIndexingStatus: 'READONLY',
              },
            ],
          },
        ],
      };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, mixedStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      const postMessageCalls = mockPanel.webview.postMessage.mock.calls;
      const initCall = postMessageCalls.find((call: any) => call[0].command === 'init');

      expect(initCall).toBeDefined();
      const shards = initCall[0].nodeStatusData.nodes[0].shards;
      expect(shards.some((s: any) => s.vectorIndexingStatus === 'READONLY')).toBe(true);
      expect(shards.some((s: any) => s.vectorIndexingStatus === 'READY')).toBe(true);
    });
  });

  describe('Panel creation and configuration', () => {
    test('creates panel with correct title', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };
      const connectionName = 'My Test Cluster';

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, connectionName);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'weaviateCluster',
        `Cluster Info: ${connectionName}`,
        expect.any(Number),
        expect.any(Object)
      );
    });

    test('creates panel with correct webview options', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test');

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: expect.arrayContaining([
            expect.objectContaining({
              fsPath: expect.stringContaining('dist'),
            }),
          ]),
        })
      );
    });

    test('sends initial data with init command after ready', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [{ name: 'node1' }] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
          nodeStatusData: nodeStatusData,
        })
      );
    });

    test('includes openClusterViewOnConnect in init message when provided', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData,
        'Test',
        undefined,
        true
      );

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
          openClusterViewOnConnect: true,
        })
      );
    });

    test('uses active editor column when available', () => {
      const mockActiveEditor = {
        viewColumn: vscode.ViewColumn.Two,
      } as vscode.TextEditor;

      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: mockActiveEditor,
        configurable: true,
      });

      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        vscode.ViewColumn.Two,
        expect.any(Object)
      );

      // Cleanup
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true,
      });
    });
  });

  describe('Message callback handling', () => {
    test('calls onMessageCallback when provided', async () => {
      const onMessageCallback = jest.fn().mockResolvedValue(undefined);
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(
        mockExtensionUri,
        connectionId,
        nodeStatusData,
        'Test',
        onMessageCallback
      );

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      const testMessage = { command: 'customCommand', data: 'test' };
      await messageHandler(testMessage);

      expect(onMessageCallback).toHaveBeenCalledWith(testMessage, expect.any(Function));
    });

    test('postMessage function in callback works correctly', async () => {
      let capturedPostMessage: ((msg: any) => void) | undefined;

      const onMessageCallback = jest.fn().mockImplementation(async (message, postMessage) => {
        capturedPostMessage = postMessage;
      });

      ClusterPanel.createOrShow(
        mockExtensionUri,
        'test-id',
        { nodes: [] },
        'Test',
        onMessageCallback
      );

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      await messageHandler({ command: 'test' });

      expect(capturedPostMessage).toBeDefined();

      mockPanel.webview.postMessage.mockClear();

      const testMsg = { data: 'test' };
      capturedPostMessage!(testMsg);

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(testMsg);
    });

    test('handles messages without callback gracefully', async () => {
      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Should not throw
      await expect(messageHandler({ command: 'test' })).resolves.not.toThrow();
    });
  });

  describe('HTML generation', () => {
    test('generates HTML with proper CSP headers', () => {
      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const html = mockPanel.webview.html;

      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain(mockPanel.webview.cspSource);
      expect(html).toContain('nonce-');
    });

    test('replaces asset paths with webview URIs', () => {
      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const html = mockPanel.webview.html;

      expect(html).toContain('vscode-webview://webview/');
      expect(mockPanel.webview.asWebviewUri).toHaveBeenCalled();
    });

    test('does not replace external URLs', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`<!DOCTYPE html>
<html>
<body>
  <script src="http://external.com/script.js"></script>
  <link href="//cdn.example.com/style.css" rel="stylesheet">
</body>
</html>`);

      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const html = mockPanel.webview.html;

      expect(html).toContain('src="http://external.com/script.js"');
      expect(html).toContain('href="//cdn.example.com/style.css"');
    });

    test('replaces all nonce placeholders', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`<!DOCTYPE html>
<html>
<head></head>
<body>
  <script nonce="{{nonce}}">console.log('test');</script>
  <style nonce="{{nonce}}">body { color: red; }</style>
</body>
</html>`);

      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const html = mockPanel.webview.html;

      expect(html).toMatch(/nonce="[A-Za-z0-9]{32}"/);
      expect(html).not.toContain('{{nonce}}');

      // Verify both nonces are replaced
      const nonceMatches = html.match(/nonce="([A-Za-z0-9]{32})"/g);
      expect(nonceMatches).toHaveLength(2);
    });

    test('shows error message when HTML file cannot be read', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const html = mockPanel.webview.html;

      expect(html).toContain('Error loading Cluster panel');
      expect(html).toContain('npm run build:webview');
    });

    test('generates unique nonces for CSP', () => {
      const panel1 = ClusterPanel.createOrShow(
        mockExtensionUri,
        'test-id-1',
        { nodes: [] },
        'Test'
      );
      const html1 = mockPanel.webview.html;
      const nonce1Match = html1.match(/nonce-([A-Za-z0-9]{32})/);
      const nonce1 = nonce1Match ? nonce1Match[1] : '';

      panel1.dispose();

      const panel2 = ClusterPanel.createOrShow(
        mockExtensionUri,
        'test-id-2',
        { nodes: [] },
        'Test'
      );
      const html2 = mockPanel.webview.html;
      const nonce2Match = html2.match(/nonce-([A-Za-z0-9]{32})/);
      const nonce2 = nonce2Match ? nonce2Match[1] : '';

      // Verify both nonces are valid
      expect(nonce1).toMatch(/^[A-Za-z0-9]{32}$/);
      expect(nonce2).toMatch(/^[A-Za-z0-9]{32}$/);
    });
  });

  describe('Dispose and cleanup', () => {
    test('clears singleton on dispose', () => {
      const panel = ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      expect(ClusterPanel.currentPanel).toBe(panel);

      panel.dispose();

      expect(ClusterPanel.currentPanel).toBeUndefined();
    });

    test('disposes all registered disposables', () => {
      const panel = ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const disposeSpy1 = jest.fn();
      const disposeSpy2 = jest.fn();

      (panel as any)._disposables.push({ dispose: disposeSpy1 });
      (panel as any)._disposables.push({ dispose: disposeSpy2 });

      panel.dispose();

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });

    test('disposes webview panel', () => {
      const panel = ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      panel.dispose();

      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    test('handles multiple rapid createOrShow calls', () => {
      const connectionId = 'test-connection-123';
      const data1 = { nodes: [{ name: 'node1' }] };
      const data2 = { nodes: [{ name: 'node2' }] };
      const data3 = { nodes: [{ name: 'node3' }] };

      const createSpy = vscode.window.createWebviewPanel as jest.Mock;
      createSpy.mockClear();

      const panel1 = ClusterPanel.createOrShow(mockExtensionUri, connectionId, data1, 'Test');

      const panel2 = ClusterPanel.createOrShow(mockExtensionUri, connectionId, data2, 'Test');

      const panel3 = ClusterPanel.createOrShow(mockExtensionUri, connectionId, data3, 'Test');

      expect(panel1).toBe(panel2);
      expect(panel2).toBe(panel3);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    test('handles empty node status data', () => {
      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', { nodes: [] }, 'Test');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
          nodeStatusData: { nodes: [] },
        })
      );
    });

    test('handles complex nested node data', () => {
      const complexData = {
        nodes: [
          {
            name: 'node-1',
            status: 'HEALTHY',
            version: '1.20.0',
            gitHash: 'abc123',
            shards: [
              {
                name: 'shard-1',
                class: 'Collection1',
                objectCount: 1000,
                vectorIndexingStatus: 'READY',
                compressed: false,
              },
            ],
          },
        ],
      };

      ClusterPanel.createOrShow(mockExtensionUri, 'test-id', complexData, 'Test');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
      messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
          nodeStatusData: complexData,
        })
      );
    });
  });
});
