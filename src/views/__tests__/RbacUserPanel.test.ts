import * as vscode from 'vscode';
import { RbacUserPanel } from '../RbacUserPanel';

const MOCK_HTML = '<html><head></head><body></body></html>';

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => MOCK_HTML),
}));

describe('RbacUserPanel', () => {
  let mockPanel: any;
  let mockExtensionUri: any;
  let mockOnSave: jest.Mock;
  let fsMock: any;

  const availableRoles = ['admin', 'viewer', 'data-reader'];
  const assignedRoles = ['viewer'];
  const existingUser = { id: 'test-user', active: true, roleNames: ['viewer'] };

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

    mockExtensionUri = { fsPath: '/mock/ext' };
    mockOnSave = jest.fn().mockResolvedValue(undefined);

    (RbacUserPanel as any).panels.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a RbacUserPanel in add mode', () => {
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    expect(panel).toBeInstanceOf(RbacUserPanel);
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'weaviateRbacUser',
      'Add User',
      expect.anything(),
      expect.anything()
    );
  });

  it('should create a panel with edit title', () => {
    RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingUser,
      availableRoles,
      assignedRoles,
      mockOnSave
    );
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'weaviateRbacUser',
      'Edit User: test-user',
      expect.anything(),
      expect.anything()
    );
  });

  it('should reuse existing panel', () => {
    const panel1 = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.reveal.mockClear();
    const panel2 = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    expect(panel1).toBe(panel2);
    expect(mockPanel.reveal).toHaveBeenCalled();
  });

  it('should send initData on ready command', async () => {
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingUser,
      availableRoles,
      assignedRoles,
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({ command: 'ready' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'initData',
      connectionId: 'conn-1',
      mode: 'edit',
      existingUser,
      availableRoles,
      assignedRoles,
    });
  });

  it('should call onSaveCallback and post userSaved on saveUser', async () => {
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    const userData = {
      userId: 'new-user',
      rolesToAssign: ['viewer'],
      rolesToRevoke: [],
      mode: 'add',
    };
    await (panel as any)._handleMessage({ command: 'saveUser', userData });
    expect(mockOnSave).toHaveBeenCalledWith(userData);
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({ command: 'userSaved' });
  });

  it('should post error when onSaveCallback throws', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('user save failed'));
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({
      command: 'saveUser',
      userData: { userId: 'u', rolesToAssign: [], rolesToRevoke: [], mode: 'add' },
    });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'error',
      message: 'user save failed',
    });
  });

  it('should dispose panel on cancel command', async () => {
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    const disposeSpy = jest.spyOn(panel, 'dispose');
    await (panel as any)._handleMessage({ command: 'cancel' });
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('should post rolesUpdated to webview when updateAvailableRoles is called', () => {
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    panel.updateAvailableRoles(['admin', 'new-role', 'viewer']);
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'rolesUpdated',
      availableRoles: ['admin', 'new-role', 'viewer'],
    });
  });

  it('should reflect updated roles in subsequent initData after updateAvailableRoles', async () => {
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingUser,
      availableRoles,
      assignedRoles,
      mockOnSave
    );
    panel.updateAvailableRoles(['admin', 'new-role']);
    mockPanel.webview.postMessage.mockClear();
    await (panel as any)._handleMessage({ command: 'ready' });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ availableRoles: ['admin', 'new-role'] })
    );
  });

  it('should notify all panels for a connection via notifyRolesChanged', () => {
    // Create two panels for conn-1 with distinct keys (add vs edit)
    const panel1 = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    // Second panel needs a separate webview mock so postMessage calls are distinguishable
    const mockPanel2 = { ...mockPanel, webview: { ...mockPanel.webview, postMessage: jest.fn() } };
    jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValueOnce(mockPanel2 as any);
    const panel2 = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingUser,
      availableRoles,
      assignedRoles,
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    mockPanel2.webview.postMessage.mockClear();

    RbacUserPanel.notifyRolesChanged('conn-1', ['updated-role']);

    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'rolesUpdated',
      availableRoles: ['updated-role'],
    });
    expect(mockPanel2.webview.postMessage).toHaveBeenCalledWith({
      command: 'rolesUpdated',
      availableRoles: ['updated-role'],
    });
  });

  it('should not notify panels for a different connection via notifyRolesChanged', () => {
    RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();

    RbacUserPanel.notifyRolesChanged('conn-999', ['updated-role']);

    expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('should return fallback HTML when readFileSync throws', () => {
    fsMock.readFileSync.mockImplementationOnce(() => {
      throw new Error('file not found');
    });
    const panel = RbacUserPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    const html = (panel as any)._getHtmlForWebview(mockPanel.webview);
    expect(html).toMatch(
      /<h1>Error loading User panel<\/h1>|<html><head>[\s\S]*<\/head><body><\/body><\/html>/
    );
  });
});
