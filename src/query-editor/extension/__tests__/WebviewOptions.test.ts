import { jest } from '@jest/globals';

// Mock vscode
jest.mock(
  'vscode',
  () => {
    const vscodeMock = require('../../../test/mocks/vscode');
    // placeholder for overwrite in specific tests
    return vscodeMock;
  },
  { virtual: true }
);

import { QueryEditorPanel } from '../QueryEditorPanel';

jest
  .spyOn(QueryEditorPanel.prototype as any, '_initializeWebview')
  .mockImplementation(() => Promise.resolve());

describe('Webview options', () => {
  const dummyContext: any = {
    extensionUri: { fsPath: '/' },
    workspaceState: { get: jest.fn(), update: jest.fn() },
    globalState: { get: jest.fn(), update: jest.fn() },
  };

  beforeEach(() => {
    (QueryEditorPanel as any).panels.clear();
    jest.clearAllMocks();
  });

  it('sets retainContextWhenHidden to true', () => {
    const vscode = require('vscode');
    vscode.ViewColumn = { One: 1 };
    vscode.window.activeTextEditor = undefined;
    vscode.Uri = {
      joinPath: jest.fn(() => ({})),
    };
    const capture = jest.fn((viewType: string, title: string, column: number, options: any) => {
      // return minimal panel stub
      return {
        webview: { postMessage: jest.fn(), onDidReceiveMessage: jest.fn() },
        reveal: jest.fn(),
        dispose: jest.fn(),
        onDidChangeViewState: jest.fn(),
        onDidDispose: jest.fn(),
        visible: true,
      };
    });
    vscode.window.createWebviewPanel.mockImplementation(capture);

    QueryEditorPanel.createOrShow(dummyContext, { connectionId: 'c1', collectionName: 'ColA' });

    expect(capture).toHaveBeenCalled();
    const optionsArg = capture.mock.calls[0][3];
    expect(optionsArg.retainContextWhenHidden).toBe(true);
  });
});
