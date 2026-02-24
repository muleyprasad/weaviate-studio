import * as vscode from 'vscode';
import { RbacRolePanel } from '../RbacRolePanel';

const MOCK_HTML = '<html><head></head><body></body></html>';

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => MOCK_HTML),
}));

describe('RbacRolePanel', () => {
  let mockPanel: any;
  let mockExtensionUri: any;
  let mockOnSave: jest.Mock;
  let fsMock: any;

  beforeEach(() => {
    jest.resetModules();
    fsMock = require('fs');
    fsMock.readFileSync.mockClear();
    fsMock.readFileSync.mockReturnValue(MOCK_HTML);

    mockPanel = {
      webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn((cb) => {
          mockPanel._onMessage = cb;
          return { dispose: jest.fn() };
        }),
        cspSource: 'vscode-resource:',
        asWebviewUri: jest.fn((uri: any) => uri),
      },
      onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
      reveal: jest.fn(),
      dispose: jest.fn(),
      viewColumn: 1,
      title: '',
    };

    jest.spyOn(vscode.window, 'createWebviewPanel').mockImplementation((_viewType, title) => {
      mockPanel.title = title;
      return mockPanel;
    });

    mockExtensionUri = {
      fsPath: '/mock/ext',
      with: jest.fn((change: any) => ({ ...mockExtensionUri, ...change })),
    };

    mockOnSave = jest.fn().mockResolvedValue(undefined);

    // Clear panels map between tests
    (RbacRolePanel as any).panels.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a new RbacRolePanel in add mode', () => {
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    expect(panel).toBeInstanceOf(RbacRolePanel);
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'weaviateRbacRole',
      'Add Role',
      expect.anything(),
      expect.anything()
    );
  });

  it('should create a panel with edit title', () => {
    const existingRole = { name: 'data-reader' };
    RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingRole,
      [],
      mockOnSave
    );
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'weaviateRbacRole',
      'Edit Role: data-reader',
      expect.anything(),
      expect.anything()
    );
  });

  it('should reuse existing panel', () => {
    const panel1 = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    mockPanel.reveal.mockClear();
    const panel2 = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    expect(panel1).toBe(panel2);
    expect(mockPanel.reveal).toHaveBeenCalled();
  });

  it('should send initData on ready command (no groups)', async () => {
    const existingRole = { name: 'my-role' };
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingRole,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({ command: 'ready' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'initData',
      connectionId: 'conn-1',
      mode: 'edit',
      existingRole,
      groupAssignments: [],
    });
  });

  it('should send initData with groupAssignments when provided', async () => {
    const existingRole = { name: 'my-role' };
    const groups = [{ groupID: 'group-a', groupType: 'oidc' }];
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingRole,
      groups,
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({ command: 'ready' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'initData',
      connectionId: 'conn-1',
      mode: 'edit',
      existingRole,
      groupAssignments: groups,
    });
  });

  it('should call onSaveCallback and post roleSaved on saveRole', async () => {
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({
      command: 'saveRole',
      roleData: { name: 'new-role', permissions: {} },
    });
    expect(mockOnSave).toHaveBeenCalledWith({ name: 'new-role', permissions: {} });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({ command: 'roleSaved' });
  });

  it('should post error when onSaveCallback throws', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('save failed'));
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({
      command: 'saveRole',
      roleData: { name: 'bad', permissions: {} },
    });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'error',
      message: 'save failed',
    });
  });

  it('should dispose panel on cancel command', async () => {
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    const disposeSpy = jest.spyOn(panel, 'dispose');
    await (panel as any)._handleMessage({ command: 'cancel' });
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should dispose panel and clean up', () => {
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    panel.dispose();
    expect(mockPanel.dispose).toHaveBeenCalled();
  });

  it('should post message via postMessage', () => {
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    panel.postMessage({ foo: 'bar' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('should return fallback HTML when readFileSync throws', () => {
    fsMock.readFileSync.mockImplementationOnce(() => {
      throw new Error('file not found');
    });
    const panel = RbacRolePanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      [],
      mockOnSave
    );
    const html = (panel as any)._getHtmlForWebview(mockPanel.webview);
    expect(html).toMatch(
      /<h1>Error loading Role panel<\/h1>|<html><head>[\s\S]*<\/head><body><\/body><\/html>/
    );
  });
});
