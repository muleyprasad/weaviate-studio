import { jest } from '@jest/globals';

// Mock the vscode API first
jest.mock(
  'vscode',
  () => {
    // Use the existing mock but extend panel object with onDidDispose support
    const vscodeMock = require('../../../test/mocks/vscode');
    vscodeMock.window.createWebviewPanel.mockImplementation(() => {
      return {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(),
        },
        reveal: jest.fn(),
        dispose: jest.fn(),
        onDidChangeViewState: jest.fn(),
        onDidDispose: jest.fn(),
        visible: true,
      };
    });
    // Provide minimal ViewColumn enum required by QueryEditorPanel
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

// Import after mocking vscode
import { QueryEditorPanel } from '../QueryEditorPanel';

// Skip heavy initialization work
jest
  .spyOn(QueryEditorPanel.prototype as any, '_initializeWebview')
  .mockImplementation(() => Promise.resolve());

describe('QueryEditorPanel.createOrShow unique key behaviour', () => {
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
    // Clear static panels map
    (QueryEditorPanel as any).panels.clear();
    jest.clearAllMocks();
  });

  it('creates a new panel for each call without explicit tabId', () => {
    QueryEditorPanel.createOrShow(dummyContext, { connectionId: 'c1', collectionName: 'ColA' });
    expect((QueryEditorPanel as any).panels.size).toBe(1);

    QueryEditorPanel.createOrShow(dummyContext, { connectionId: 'c1', collectionName: 'ColA' });
    expect((QueryEditorPanel as any).panels.size).toBe(2); // Different random tabId
  });

  it('reuses existing panel when same tabId is provided', () => {
    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'c1',
      collectionName: 'ColA',
      tabId: 'reuse',
    });
    expect((QueryEditorPanel as any).panels.size).toBe(1);

    // Second call with same explicit tabId should reveal existing panel, not create new
    QueryEditorPanel.createOrShow(dummyContext, {
      connectionId: 'c1',
      collectionName: 'ColA',
      tabId: 'reuse',
    });
    expect((QueryEditorPanel as any).panels.size).toBe(1);
  });
});
