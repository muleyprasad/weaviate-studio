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
          onDidReceiveMessage: jest.fn(),
          cspSource: 'vscode-webview://test',
          asWebviewUri: jest.fn((uri: any) => uri),
        },
        reveal: jest.fn(),
        dispose: jest.fn(),
        onDidChangeViewState: jest.fn(),
        onDidDispose: jest.fn(),
        visible: true,
      };
    });
    vscodeMock.ViewColumn = { One: 1 };
    vscodeMock.window.activeTextEditor = undefined;
    vscodeMock.window.showInformationMessage = jest.fn();
    return vscodeMock;
  },
  { virtual: true }
);

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => '<html><head></head><body></body></html>'),
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: () => 'mock-nonce-12345',
  })),
}));

// Import after mocking
import { DataExplorerPanel } from '../DataExplorerPanel';

/**
 * Tests for DataExplorerPanel write operations (Phase 6):
 * import / update / delete message handling and read-only enforcement.
 */
describe('DataExplorerPanel - Write Operations', () => {
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
    with: jest.fn((change: any) => mockUri),
  } as any;

  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

  let mockClient: any;
  let getClientFn: any;
  let vscode: any;

  beforeEach(() => {
    (DataExplorerPanel as any).panels.clear();
    (DataExplorerPanel as any).currentPanel = undefined;
    jest.clearAllMocks();

    mockClient = { collections: { get: jest.fn() } };
    getClientFn = jest.fn(() => mockClient);
    vscode = jest.requireMock('vscode');
  });

  function createPanel(isReadOnly = false): any {
    return DataExplorerPanel.createOrShow(
      mockUri,
      'conn1',
      'TestCollection',
      getClientFn,
      undefined,
      undefined,
      () => isReadOnly
    );
  }

  function messageHandler(panel: any): (message: any) => Promise<void> {
    return panel._panel.webview.onDidReceiveMessage.mock.calls[0][0];
  }

  function mockApi(panel: any, methods: Record<string, unknown>): void {
    Object.assign(panel._api, methods);
  }

  describe('read-only enforcement', () => {
    test.each([
      [
        'importObjects',
        { importParams: { source: 'paste', format: 'json', payload: '[{"a":1}]' } },
      ],
      ['updateObject', { updateObjectParams: { uuid: VALID_UUID, properties: { a: 1 } } }],
      ['deleteObject', { deleteObjectParams: { uuid: VALID_UUID } }],
    ])('blocks %s on read-only connections', async (command, extra) => {
      const panel = createPanel(true);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      const apiSpy = jest.fn();
      mockApi(panel, { importObjects: apiSpy, updateObject: apiSpy, deleteObject: apiSpy });

      await messageHandler(panel)({ command, requestId: 'req-1', ...extra });

      expect(apiSpy).not.toHaveBeenCalled();
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'error',
        error: expect.stringContaining('read-only'),
        requestId: 'req-1',
      });
    });

    test('allows writes when not read-only', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      mockApi(panel, {
        deleteObject: jest.fn<any>().mockResolvedValue({ uuid: VALID_UUID }),
      });

      await messageHandler(panel)({
        command: 'deleteObject',
        deleteObjectParams: { uuid: VALID_UUID },
        requestId: 'req-2',
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'objectDeleted',
        uuid: VALID_UUID,
        requestId: 'req-2',
      });
    });
  });

  describe('importObjects', () => {
    test('imports paste payload and replies importComplete', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      const importResult = {
        collectionName: 'TestCollection',
        importedCount: 2,
        failedCount: 0,
        errors: [],
      };
      mockApi(panel, {
        importObjects: jest.fn<any>().mockResolvedValue(importResult),
      });

      await messageHandler(panel)({
        command: 'importObjects',
        importParams: { source: 'paste', format: 'json', payload: '[{"a":1}]' },
        requestId: 'imp-1',
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'importComplete',
        importResult,
        requestId: 'imp-1',
      });
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Imported 2 objects')
      );
    });

    test('fetches url payloads through the host', async () => {
      const panel = createPanel(false);
      const importObjects = jest.fn<any>().mockResolvedValue({
        collectionName: 'TestCollection',
        importedCount: 1,
        failedCount: 0,
        errors: [],
      });
      mockApi(panel, { importObjects });
      const originalFetch = (globalThis as any).fetch;
      const fetchMock = jest.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '[{"a":1}]',
      }));
      (globalThis as any).fetch = fetchMock;

      try {
        await messageHandler(panel)({
          command: 'importObjects',
          importParams: { source: 'url', format: 'json', payload: 'https://example.com/data.json' },
          requestId: 'imp-2',
        });
      } finally {
        (globalThis as any).fetch = originalFetch;
      }

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/data.json',
        expect.objectContaining({ signal: expect.anything() })
      );
      expect(importObjects).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'url', payload: '[{"a":1}]' })
      );
    });

    test('rejects non-http urls', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');

      await messageHandler(panel)({
        command: 'importObjects',
        importParams: { source: 'url', format: 'json', payload: 'file:///etc/passwd' },
        requestId: 'imp-3',
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'error',
        error: expect.stringContaining('http'),
        requestId: 'imp-3',
      });
    });

    test('rejects oversized URL payloads before importing', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      const originalFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'x'.repeat(10 * 1024 * 1024 + 1),
      }));

      try {
        await messageHandler(panel)({
          command: 'importObjects',
          importParams: {
            source: 'url',
            format: 'json',
            payload: 'https://example.com/large.json',
          },
          requestId: 'imp-large',
        });
      } finally {
        (globalThis as any).fetch = originalFetch;
      }

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'error',
        error: expect.stringContaining('10 MB'),
        requestId: 'imp-large',
      });
    });

    test('forwards API errors to the webview', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      mockApi(panel, {
        importObjects: jest.fn<any>().mockRejectedValue(new Error('Invalid JSON: nope')),
      });

      await messageHandler(panel)({
        command: 'importObjects',
        importParams: { source: 'paste', format: 'json', payload: '{bad' },
        requestId: 'imp-4',
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'error',
        error: 'Invalid JSON: nope',
        requestId: 'imp-4',
      });
    });
  });

  describe('updateObject / deleteObject', () => {
    test('updateObject replies objectUpdated', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      const updateObject = jest.fn<any>().mockResolvedValue({ uuid: VALID_UUID });
      mockApi(panel, { updateObject });

      await messageHandler(panel)({
        command: 'updateObject',
        updateObjectParams: { uuid: VALID_UUID, properties: { title: 'New' } },
        requestId: 'upd-1',
      });

      expect(updateObject).toHaveBeenCalledWith({
        collectionName: 'TestCollection',
        uuid: VALID_UUID,
        properties: { title: 'New' },
      });
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'objectUpdated',
        uuid: VALID_UUID,
        requestId: 'upd-1',
      });
    });

    test('deleteObject replies objectDeleted', async () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      const deleteObject = jest.fn<any>().mockResolvedValue({ uuid: VALID_UUID });
      mockApi(panel, { deleteObject });

      await messageHandler(panel)({
        command: 'deleteObject',
        deleteObjectParams: { uuid: VALID_UUID },
        requestId: 'del-1',
      });

      expect(deleteObject).toHaveBeenCalledWith({
        collectionName: 'TestCollection',
        uuid: VALID_UUID,
      });
      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'objectDeleted',
        uuid: VALID_UUID,
        requestId: 'del-1',
      });
    });
  });

  describe('schemaLoaded readOnly flag', () => {
    test('includes readOnly state on initialize', async () => {
      const panel = createPanel(true);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');
      mockApi(panel, {
        getCollectionSchema: jest.fn<any>().mockResolvedValue({
          name: 'TestCollection',
          properties: [],
          multiTenancy: { enabled: false },
        }),
        getServerVersion: jest.fn<any>().mockResolvedValue(null),
        fetchObjects: jest.fn<any>().mockResolvedValue({ objects: [], total: 0 }),
      });

      await messageHandler(panel)({ command: 'initialize' });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'schemaLoaded', readOnly: true })
      );
    });

    test('broadcasts read-only changes to open panels for the connection', () => {
      const panel = createPanel(false);
      const postMessageSpy = jest.spyOn(panel, 'postMessage');

      DataExplorerPanel.updateReadOnlyForConnection('conn1', true);

      expect(postMessageSpy).toHaveBeenCalledWith({
        command: 'readOnlyChanged',
        readOnly: true,
      });
    });
  });
});
