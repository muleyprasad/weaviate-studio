import { jest } from '@jest/globals';

// Mock vscode
jest.mock(
  'vscode',
  () => {
    const mock = require('../../../test/mocks/vscode');
    mock.ViewColumn = { One: 1 };
    mock.window.activeTextEditor = undefined;
    mock.Uri = { joinPath: jest.fn(() => ({})), file: jest.fn(() => ({})) };
    // Provide workspaceState mock with in-memory store
    const store: Record<string, any> = {};
    mock.workspaceState = {
      get: (k: string) => store[k],
      update: (k: string, v: any) => {
        store[k] = v;
        return Promise.resolve();
      },
    };
    return mock;
  },
  { virtual: true }
);

import { QueryEditorPanel } from '../QueryEditorPanel';

jest
  .spyOn(QueryEditorPanel.prototype as any, '_initializeWebview')
  .mockImplementation(() => Promise.resolve());

describe('State preservation', () => {
  const dummyContext: any = {
    extensionUri: { fsPath: '/' },
    workspaceState: (require('vscode') as any).workspaceState,
    globalState: { get: jest.fn(), update: jest.fn() },
  };

  beforeEach(() => {
    (QueryEditorPanel as any).panels.clear();
    jest.clearAllMocks();
  });

  it('saves and retrieves webview state via workspaceState', async () => {
    const vscode = require('vscode');
    vscode.window.createWebviewPanel.mockImplementation(() => ({
      webview: { postMessage: jest.fn(), onDidReceiveMessage: jest.fn() },
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      onDidDispose: jest.fn(),
      visible: true,
    }));

    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'c1',
      collectionName: 'ColA',
      tabId: 't1',
    });
    const instance: any = Array.from((QueryEditorPanel as any).panels.values())[0];

    const sampleState = { queryText: 'query', timestamp: Date.now() };
    instance._saveWebviewState(sampleState);
    const restored = instance._getSavedWebviewState();
    expect(restored.queryText).toBe('query');
  });

  it('sends ping in _restoreWebviewState and does not reinitialize when webview alive', async () => {
    const vscode = require('vscode');
    const postMsg = jest.fn();
    vscode.window.createWebviewPanel.mockImplementation(() => ({
      webview: { postMessage: postMsg, onDidReceiveMessage: jest.fn() },
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      onDidDispose: jest.fn(),
      visible: true,
    }));

    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'c1',
      collectionName: 'ColA',
      tabId: 't2',
    });
    const instance: any = Array.from((QueryEditorPanel as any).panels.values())[0];

    const initSpy = jest.spyOn(instance as any, '_initializeWebview');
    initSpy.mockClear();
    await instance._restoreWebviewState();
    expect(postMsg).toHaveBeenCalledWith({ type: 'ping' });
    expect(initSpy).not.toHaveBeenCalled();
  });
});
