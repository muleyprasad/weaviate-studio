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
  });
});
