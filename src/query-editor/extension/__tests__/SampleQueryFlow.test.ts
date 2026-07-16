import { jest } from '@jest/globals';

// Mock vscode API
jest.mock(
  'vscode',
  () => {
    const vscodeMock = require('../../../test/mocks/vscode');
    vscodeMock.ViewColumn = { One: 1 };
    vscodeMock.window.activeTextEditor = undefined;
    vscodeMock.Uri = { joinPath: jest.fn(() => ({})), file: jest.fn(() => ({})) };
    return vscodeMock;
  },
  { virtual: true }
);

import { QueryEditorPanel } from '../QueryEditorPanel';

// Skip heavy initialization
jest
  .spyOn(QueryEditorPanel.prototype as any, '_initializeWebview')
  .mockImplementation(() => Promise.resolve());

describe('Sample query flow', () => {
  const dummyContext: any = {
    extensionUri: { fsPath: '/' },
    workspaceState: { get: jest.fn(), update: jest.fn() },
    globalState: { get: jest.fn(), update: jest.fn() },
  };

  beforeEach(() => {
    (QueryEditorPanel as any).panels.clear();
    jest.clearAllMocks();
  });

  function createPanelWithClient(client: any) {
    const vscode = require('vscode');
    const webviewPost = jest.fn();
    vscode.window.createWebviewPanel.mockImplementation(() => ({
      webview: { postMessage: webviewPost, onDidReceiveMessage: jest.fn() },
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      onDidDispose: jest.fn(),
      visible: true,
    }));

    QueryEditorPanel.createOrShow(dummyContext, { connectionId: 'c1', collectionName: 'ColA' });
    const panelInstance: any = Array.from((QueryEditorPanel as any).panels.values())[0];

    panelInstance._connectionManager = {
      getConnections: jest.fn().mockReturnValue([{ id: 'c1', status: 'connected', name: 'test' }]),
      getConnection: jest.fn().mockReturnValue({ id: 'c1', status: 'connected', name: 'test' }),
      onConnectionsChanged: {
        subscribe: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      },
    };
    panelInstance._weaviateClient = client;
    panelInstance._isConnectionActive = true;

    return { panelInstance, webviewPost };
  }

  it('posts a schema-aware sampleQuery using collections.listAll()', async () => {
    const listAll = jest.fn().mockResolvedValue([
      {
        name: 'ColA',
        properties: [
          { name: 'name', dataType: ['text'] },
          { name: 'aliases', dataType: ['text[]'] },
          { name: 'image', dataType: ['blob'] },
        ],
        multiTenancy: { enabled: false },
      },
    ]);

    const { panelInstance, webviewPost } = createPanelWithClient({
      collections: { listAll },
    });

    await panelInstance._sendSampleQuery('ColA');

    expect(listAll).toHaveBeenCalled();
    const sampleQueryMsg = webviewPost.mock.calls.find(
      (call: any[]) => call[0].type === 'sampleQuery'
    );
    expect(sampleQueryMsg).toBeDefined();
    const q: string = sampleQueryMsg![0].data.sampleQuery;
    expect(q).toContain('ColA');
    expect(q).toContain('name');
    expect(q).toContain('aliases');
    expect(q).not.toMatch(/\.\.\.\s*on\s+text\[\]/);
    // blobs excluded by default
    expect(q).not.toMatch(/^\s*image\s*$/m);
  });

  it('includes tenant placeholder when multi-tenancy is enabled', async () => {
    const listAll = jest.fn().mockResolvedValue([
      {
        name: 'TenantCol',
        properties: [{ name: 'title', dataType: ['text'] }],
        multiTenancy: { enabled: true },
      },
    ]);

    const { panelInstance, webviewPost } = createPanelWithClient({
      collections: {
        listAll,
        get: jest.fn().mockReturnValue({
          config: {
            get: jest.fn().mockResolvedValue({
              multiTenancy: { enabled: true },
              properties: [{ name: 'title', dataType: ['text'] }],
            }),
          },
        }),
      },
    });

    await panelInstance._sendSampleQuery('TenantCol');

    const sampleQueryMsg = webviewPost.mock.calls.find(
      (call: any[]) => call[0].type === 'sampleQuery'
    );
    expect(sampleQueryMsg).toBeDefined();
    const q: string = sampleQueryMsg![0].data.sampleQuery;
    expect(q).toContain('tenant:');
    expect(q).toContain('YOUR_TENANT_ID');
  });

  it('falls back to a minimal query when schema fetch fails', async () => {
    const listAll = jest.fn().mockRejectedValue(new Error('network down'));

    const { panelInstance, webviewPost } = createPanelWithClient({
      collections: { listAll },
    });

    await panelInstance._sendSampleQuery('ColA');

    const sampleQueryMsg = webviewPost.mock.calls.find(
      (call: any[]) => call[0].type === 'sampleQuery'
    );
    expect(sampleQueryMsg).toBeDefined();
    const q: string = sampleQueryMsg![0].data.sampleQuery;
    expect(q).toContain('ColA');
    expect(q).toContain('_additional');
  });
});
