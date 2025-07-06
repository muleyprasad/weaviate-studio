import { jest } from '@jest/globals';

// Mock vscode API
jest.mock('vscode', () => {
  const vscodeMock = require('../../../test/mocks/vscode');
  vscodeMock.ViewColumn = { One: 1 };
  vscodeMock.window.activeTextEditor = undefined;
  vscodeMock.Uri = { joinPath: jest.fn(() => ({})), file: jest.fn(() => ({})) };
  return vscodeMock;
}, { virtual: true });

import { QueryEditorPanel } from '../QueryEditorPanel';

// Skip heavy initialization
jest.spyOn(QueryEditorPanel.prototype as any, '_initializeWebview').mockImplementation(() => Promise.resolve());

describe('Sample query flow', () => {
  const dummyContext: any = {
    extensionUri: { fsPath: '/' },
    workspaceState: { get: jest.fn(), update: jest.fn() },
    globalState: { get: jest.fn(), update: jest.fn() }
  };

  beforeEach(() => {
    (QueryEditorPanel as any).panels.clear();
    jest.clearAllMocks();
  });

  it('posts sampleQuery message to webview', async () => {
    const vscode = require('vscode');
    const webviewPost = jest.fn();
    vscode.window.createWebviewPanel.mockImplementation(() => ({
      webview: { postMessage: webviewPost, onDidReceiveMessage: jest.fn() },
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      onDidDispose: jest.fn(),
      visible: true
    }));

    QueryEditorPanel.createOrShow(dummyContext, { connectionId: 'c1', collectionName: 'ColA' });
    const panelInstance: any = Array.from((QueryEditorPanel as any).panels.values())[0];

    // Stub weaviate client with minimal schema getter
    panelInstance._weaviateClient = {
      schema: {
        // @ts-ignore
        getter: () => ({ do: jest.fn().mockResolvedValue({}) })
      }
    };

    await panelInstance._sendSampleQuery('ColA');

    expect(webviewPost).toHaveBeenCalled();
    const msg: any = webviewPost.mock.calls[0][0];
    expect(msg.type).toBe('sampleQuery');
    expect(msg.data.sampleQuery).toContain('ColA');
  });
}); 