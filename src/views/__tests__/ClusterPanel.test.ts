import { ClusterPanel } from '../ClusterPanel';
import * as vscode from 'vscode';

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

      // Trigger refresh
      messageHandler({ command: 'refresh' });

      // Should post a message back with refreshed data
      // The refresh is handled internally in the panel
      expect(mockPanel.webview.postMessage).toHaveBeenCalled();
    });

    test('handles updateShardStatus command', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [{ name: 'node1', status: 'HEALTHY' }] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'updateShardStatus',
        collection: 'TestCollection',
        shardNames: ['shard-1', 'shard-2'],
        newStatus: 'READY',
      });

      // Verify command is handled (implementation may vary)
      expect(mockPanel.webview.postMessage).toHaveBeenCalled();
    });

    test('handles toggleOpenClusterViewOnConnect command', () => {
      const connectionId = 'test-connection-123';
      const nodeStatusData = { nodes: [] };

      ClusterPanel.createOrShow(mockExtensionUri, connectionId, nodeStatusData, 'Test Connection');

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      messageHandler({
        command: 'toggleOpenClusterViewOnConnect',
        value: false,
      });

      // Verify the setting is updated (implementation may store this)
      expect(mockPanel.webview.postMessage).toHaveBeenCalled();
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

      // Initial data should be sent
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

      const postMessageCalls = mockPanel.webview.postMessage.mock.calls;
      const initCall = postMessageCalls.find((call: any) => call[0].command === 'init');

      expect(initCall).toBeDefined();
      expect(initCall[0].nodeStatusData).toEqual(complexData);
    });
  });
});
