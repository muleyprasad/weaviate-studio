import * as vscode from 'vscode';
import { RbacGroupPanel } from '../RbacGroupPanel';

const MOCK_HTML = '<html><head></head><body></body></html>';

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => MOCK_HTML),
}));

describe('RbacGroupPanel', () => {
  let mockPanel: any;
  let mockExtensionUri: any;
  let mockOnSave: jest.Mock;
  let fsMock: any;

  const availableRoles = ['admin', 'viewer'];
  const assignedRoles = ['viewer'];
  const existingGroup = 'data-team';

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

    (RbacGroupPanel as any).panels.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a RbacGroupPanel in add mode', () => {
    const panel = RbacGroupPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    expect(panel).toBeInstanceOf(RbacGroupPanel);
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'weaviateRbacGroup',
      'Add Group',
      expect.anything(),
      expect.anything()
    );
  });

  it('should create a panel with edit title', () => {
    RbacGroupPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingGroup,
      availableRoles,
      assignedRoles,
      mockOnSave
    );
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'weaviateRbacGroup',
      'Edit Group: data-team',
      expect.anything(),
      expect.anything()
    );
  });

  it('should reuse existing panel', () => {
    const panel1 = RbacGroupPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.reveal.mockClear();
    const panel2 = RbacGroupPanel.createOrShow(
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
    const panel = RbacGroupPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'edit',
      existingGroup,
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
      existingGroup,
      availableRoles,
      assignedRoles,
    });
  });

  it('should call onSaveCallback and post groupSaved on saveGroup', async () => {
    const panel = RbacGroupPanel.createOrShow(
      mockExtensionUri as any,
      'conn-1',
      'add',
      undefined,
      availableRoles,
      [],
      mockOnSave
    );
    mockPanel.webview.postMessage.mockClear();
    const groupData = {
      groupId: 'admins',
      rolesToAssign: ['admin'],
      rolesToRevoke: [],
      mode: 'add',
    };
    await (panel as any)._handleMessage({ command: 'saveGroup', groupData });
    expect(mockOnSave).toHaveBeenCalledWith(groupData);
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({ command: 'groupSaved' });
  });

  it('should post error when onSaveCallback throws', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('group save failed'));
    const panel = RbacGroupPanel.createOrShow(
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
      command: 'saveGroup',
      groupData: { groupId: 'g', rolesToAssign: [], rolesToRevoke: [], mode: 'add' },
    });
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      command: 'error',
      message: 'group save failed',
    });
  });

  it('should dispose panel on cancel command', async () => {
    const panel = RbacGroupPanel.createOrShow(
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

  it('should return fallback HTML when readFileSync throws', () => {
    fsMock.readFileSync.mockImplementationOnce(() => {
      throw new Error('file not found');
    });
    const panel = RbacGroupPanel.createOrShow(
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
      /<h1>Error loading Group panel<\/h1>|<html><head>[\s\S]*<\/head><body><\/body><\/html>/
    );
  });
});
