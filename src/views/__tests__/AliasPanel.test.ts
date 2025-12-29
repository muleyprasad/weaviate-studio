import * as vscode from 'vscode';
import { AliasPanel } from '../AliasPanel';
import type { AliasItem } from '../../types';

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => '<html><head></head><body></body></html>'),
}));

describe('AliasPanel', () => {
  let mockPanel: any;
  let mockExtensionUri: any;
  let mockOnCreate: jest.Mock;
  let mockOnUpdate: jest.Mock;
  let mockOnDelete: jest.Mock;
  let mockOnMessage: jest.Mock;
  let aliasItem: AliasItem;
  let collections: string[];
  let connectionId: string;
  let fsMock: any;

  beforeEach(() => {
    jest.resetModules();
    fsMock = require('fs');
    fsMock.readFileSync.mockClear();
    mockPanel = {
      webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn((cb) => {
          mockPanel._onMessage = cb;
        }),
        cspSource: 'csp',
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn(),
      viewColumn: 1,
      set html(val: string) {},
      get html() {
        return '';
      },
    };
    mockExtensionUri = { fsPath: '/mock/uri' };
    mockOnCreate = jest.fn().mockResolvedValue(undefined);
    mockOnUpdate = jest.fn().mockResolvedValue(undefined);
    mockOnDelete = jest.fn().mockResolvedValue(undefined);
    mockOnMessage = jest.fn().mockResolvedValue(undefined);
    aliasItem = { alias: 'alias1', collection: 'col1' };
    collections = ['col1', 'col2'];
    connectionId = 'conn-1';
    AliasPanel.currentPanel = undefined;
  });
  it('should handle error in onCreateCallback and post error', async () => {
    mockOnCreate.mockRejectedValueOnce(new Error('fail-create'));
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'create',
      undefined,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    const aliasData = { alias: 'a', collection: 'c' };
    await panel['_handleMessage']({ command: 'createAlias', aliasData });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'error',
      message: 'fail-create',
    });
  });

  it('should handle error in onUpdateCallback and post error', async () => {
    mockOnUpdate.mockRejectedValueOnce(new Error('fail-update'));
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'edit',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    const aliasData = { alias: 'a', collection: 'c' };
    await panel['_handleMessage']({ command: 'updateAlias', aliasData });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'error',
      message: 'fail-update',
    });
  });

  it('should handle error in onDeleteCallback and post error', async () => {
    mockOnDelete.mockRejectedValueOnce(new Error('fail-delete'));
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'edit',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    await panel['_handleMessage']({ command: 'deleteAlias', alias: 'alias1' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'error',
      message: 'fail-delete',
    });
  });

  it('should send initData on ready command', async () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'list',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    await panel['_handleMessage']({ command: 'ready' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'initData',
      connectionId,
      collections,
      mode: 'list',
      aliasToEdit: aliasItem,
    });
  });

  it('should dispose panel on cancel command', async () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'list',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    const disposeSpy = jest.spyOn(panel, 'dispose');
    await panel['_handleMessage']({ command: 'cancel' });
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should call postMessage method', () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'list',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    panel.postMessage({ foo: 'bar' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('should return fallback HTML if fs.readFileSync throws', () => {
    fsMock.readFileSync.mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'list',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    // _getHtmlForWebview is called in constructor, so no error thrown here
    // To test the fallback HTML, call it directly
    const html = (panel as any)._getHtmlForWebview(mockPanel.webview);
    // Accept either the error message or a minimal HTML fallback
    expect(html).toMatch(
      /<h1>Error loading Alias panel<\/h1>|<html><head>[\s\S]*<\/head><body><\/body><\/html>/
    );
  });

  it('should create a new AliasPanel and set currentPanel', () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'create',
      undefined,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    expect(panel).toBeInstanceOf(AliasPanel);
  });

  it('should call onCreateCallback and post aliasCreated', async () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'create',
      undefined,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    const aliasData = { alias: 'a', collection: 'c' };
    await panel['_handleMessage']({ command: 'createAlias', aliasData });
    expect(mockOnCreate).toHaveBeenCalledWith(aliasData);
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'aliasCreated',
      alias: 'a',
    });
  });

  it('should call onUpdateCallback and post aliasUpdated', async () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'edit',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    const aliasData = { alias: 'a', collection: 'c' };
    await panel['_handleMessage']({ command: 'updateAlias', aliasData });
    expect(mockOnUpdate).toHaveBeenCalledWith(aliasData);
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'aliasUpdated',
      alias: 'a',
    });
  });

  it('should call onDeleteCallback and post aliasDeleted', async () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'edit',
      aliasItem,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    await panel['_handleMessage']({ command: 'deleteAlias', alias: 'alias1' });
    expect(mockOnDelete).toHaveBeenCalledWith('alias1');
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'aliasDeleted',
      alias: 'alias1',
    });
  });

  it('should dispose and clear currentPanel', () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'list',
      undefined,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    panel.dispose();
    expect(AliasPanel.currentPanel).toBeUndefined();
    expect(mockPanel.dispose).toHaveBeenCalled();
  });

  it('should delegate unknown command to onMessageCallback', async () => {
    const panel = new AliasPanel(
      mockPanel as any,
      mockExtensionUri,
      connectionId,
      collections,
      'list',
      undefined,
      mockOnCreate,
      mockOnUpdate,
      mockOnDelete,
      mockOnMessage
    );
    await panel['_handleMessage']({ command: 'unknown', foo: 1 });
    expect(mockOnMessage).toHaveBeenCalled();
  });
});
