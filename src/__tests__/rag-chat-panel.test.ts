/**
 * Tests for RagChatPanel constructor behaviour, openInDataExplorer command dispatch,
 * and nonce injection in _getHtmlForWebview.
 *
 * These tests use a fully mocked vscode / fs / crypto environment so they run
 * without a real VS Code extension host.
 */

// ─── Mocks ────────────────────────────────────────────────────────────

const mockPostMessage = jest.fn();
const mockReveal = jest.fn();
const mockDispose = jest.fn();
const mockOnDidDispose = jest.fn();
const mockOnDidReceiveMessage = jest.fn();
const mockOnDidChangeViewState = jest.fn();
const mockExecuteCommand = jest.fn();

function makeMockPanel() {
  return {
    webview: {
      postMessage: mockPostMessage,
      onDidReceiveMessage: mockOnDidReceiveMessage,
      cspSource: 'https://mock-csp-source',
      asWebviewUri: jest.fn().mockImplementation((uri: any) => `vscode-webview://${uri.fsPath}`),
      html: '',
    },
    onDidDispose: mockOnDidDispose,
    onDidChangeViewState: mockOnDidChangeViewState,
    reveal: mockReveal,
    dispose: mockDispose,
    iconPath: undefined as any,
  };
}

jest.mock('vscode', () => ({
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: jest.fn().mockImplementation(() => makeMockPanel()),
    activeTextEditor: undefined,
  },
  Uri: {
    joinPath: jest.fn().mockImplementation((_base: any, ...parts: string[]) => ({
      fsPath: '/' + parts.join('/'),
    })),
  },
  commands: {
    executeCommand: (...args: any[]) => mockExecuteCommand(...args),
  },
}));

// Provide a minimal HTML with nonce placeholders so _getHtmlForWebview can run
const MOCK_HTML = `<!DOCTYPE html>
<html>
<head>
<meta nonce="{{nonce}}">
<script nonce="{{nonce}}">/* bundle */</script>
</head>
<body></body>
</html>`;

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(MOCK_HTML),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('deadbeefdeadbeef', 'hex')),
}));

// Mock RagChatAPI so the constructor doesn't try to call a real Weaviate instance
jest.mock('../rag-chat/extension/RagChatAPI', () => ({
  RagChatAPI: jest.fn().mockImplementation(() => ({
    getCollections: jest.fn().mockResolvedValue([]),
    executeRagQuery: jest.fn().mockResolvedValue({ answer: '', contextObjects: [] }),
  })),
}));

// ─── Import under test ────────────────────────────────────────────────
import { RagChatPanel } from '../rag-chat/extension/RagChatPanel';
import type { FilterCondition } from '../data-explorer/types';

// ─── Helpers ──────────────────────────────────────────────────────────

function baseArgs() {
  return {
    extensionUri: { fsPath: '/ext' } as any,
    connectionId: 'conn-1',
    connectionName: 'Local Weaviate',
    getClient: () => undefined,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('RagChatPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // After clearAllMocks, restore the disposable-returning defaults that the
    // RagChatPanel constructor needs when registering event handlers.
    const disposable = { dispose: jest.fn() };
    mockOnDidDispose.mockReturnValue(disposable);
    mockOnDidReceiveMessage.mockReturnValue(disposable);
    mockOnDidChangeViewState.mockReturnValue(disposable);
  });

  // ── Bug 1 regression: inherited filters in window.initialData ──────

  describe('constructor — inherited filters in window.initialData', () => {
    it('includes inheritedFilters in initialData when passed on creation', () => {
      const filters: FilterCondition[] = [
        { property: 'status', operator: 'Equal', valueText: 'active' },
      ] as any;

      const args = baseArgs();
      RagChatPanel.createOrShow(
        args.extensionUri,
        {} as any,
        args.connectionId,
        args.connectionName,
        args.getClient,
        undefined, // initialCollectionName
        true, // forceNew — always create a fresh panel
        filters,
        'AND'
      );

      const vscode = require('vscode');
      const panel = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;
      const html: string = panel.webview.html;

      // The JSON must contain the filter data, not null
      expect(html).toContain('"inheritedFilters"');
      expect(html).toContain('"status"');
      expect(html).not.toMatch(/"inheritedFilters":null/);
      expect(html).toContain('"inheritedFilterMatchMode":"AND"');
    });

    it('sets inheritedFilters to null in initialData when not provided', () => {
      const args = baseArgs();
      RagChatPanel.createOrShow(
        { ...args.extensionUri, fsPath: '/ext2' } as any,
        {} as any,
        'conn-2',
        args.connectionName,
        args.getClient,
        undefined,
        true
      );

      const vscode = require('vscode');
      const calls = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
      const panel = calls[calls.length - 1].value;
      const html: string = panel.webview.html;

      expect(html).toMatch(/"inheritedFilters":null/);
      expect(html).toMatch(/"inheritedFilterMatchMode":null/);
    });
  });

  // ── Bug 2 regression: XSS via unescaped JSON in <script> ──────────

  describe('_getHtmlForWebview — safeJsonStringify (XSS prevention)', () => {
    it('escapes < and > characters in connectionName so </script> cannot break out', () => {
      RagChatPanel.createOrShow(
        { fsPath: '/ext3' } as any,
        {} as any,
        'conn-xss',
        'x</script><img src=x onerror=alert(1)>', // malicious connection name
        () => undefined,
        undefined,
        true
      );

      const vscode = require('vscode');
      const calls = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
      const panel = calls[calls.length - 1].value;
      const html: string = panel.webview.html;

      // The literal </script> must not appear inside the injected <script> block
      // (it may appear as the closing tag for the initScript, but not as raw user data)
      expect(html).not.toContain('</script><img');
      // The < should be unicode-escaped
      expect(html).toContain('\\u003c/script\\u003e');
    });

    it('escapes & characters in connectionName', () => {
      RagChatPanel.createOrShow(
        { fsPath: '/ext4' } as any,
        {} as any,
        'conn-amp',
        'Foo & Bar',
        () => undefined,
        undefined,
        true
      );

      const vscode = require('vscode');
      const calls = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
      const panel = calls[calls.length - 1].value;
      const html: string = panel.webview.html;

      expect(html).not.toContain('"Foo & Bar"');
      expect(html).toContain('Foo \\u0026 Bar');
    });
  });

  // ── Nonce injection ────────────────────────────────────────────────

  describe('_getHtmlForWebview — nonce injection', () => {
    it('replaces all {{nonce}} placeholders in the HTML', () => {
      RagChatPanel.createOrShow(
        { fsPath: '/ext5' } as any,
        {} as any,
        'conn-nonce',
        'My Connection',
        () => undefined,
        undefined,
        true
      );

      const vscode = require('vscode');
      const calls = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
      const panel = calls[calls.length - 1].value;
      const html: string = panel.webview.html;

      // No unreplaced placeholders should remain
      expect(html).not.toContain('{{nonce}}');
      // The mocked nonce value should appear (deadbeefdeadbeef base64 = '3q2+7w==...', but
      // randomBytes mock returns a fixed buffer)
      const expectedNonce = Buffer.from('deadbeefdeadbeef', 'hex').toString('base64');
      expect(html).toContain(`nonce="${expectedNonce}"`);
    });

    it('includes nonce attribute on the injected initialData <script> tag', () => {
      RagChatPanel.createOrShow(
        { fsPath: '/ext6' } as any,
        {} as any,
        'conn-nonce2',
        'My Connection',
        () => undefined,
        undefined,
        true
      );

      const vscode = require('vscode');
      const calls = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
      const panel = calls[calls.length - 1].value;
      const html: string = panel.webview.html;

      const expectedNonce = Buffer.from('deadbeefdeadbeef', 'hex').toString('base64');
      // The initScript wrapping window.initialData must carry a nonce
      const initScriptMatch = html.match(/<script nonce="([^"]+)">\s*window\.initialData/);
      expect(initScriptMatch).not.toBeNull();
      expect(initScriptMatch![1]).toBe(expectedNonce);
    });
  });

  // ── openInDataExplorer command dispatch ────────────────────────────

  describe('openInDataExplorer message handling', () => {
    it('executes weaviate.openDataExplorer command with correct args', async () => {
      // Capture the message handler registered in the constructor
      let registeredHandler: ((msg: any) => Promise<void>) | undefined;
      mockOnDidReceiveMessage.mockImplementation((handler: any) => {
        registeredHandler = handler;
        return { dispose: jest.fn() };
      });
      mockOnDidDispose.mockImplementation(() => ({ dispose: jest.fn() }));
      mockOnDidChangeViewState.mockImplementation(() => ({ dispose: jest.fn() }));

      // Provide a stub client so _api is initialised and _handleMessage can
      // reach the openInDataExplorer case (without a client it short-circuits with ragError).
      const stubClient = {} as any;
      RagChatPanel.createOrShow(
        { fsPath: '/ext7' } as any,
        {} as any,
        'conn-3',
        'Test Connection',
        () => stubClient,
        'MyCollection',
        true
      );

      expect(registeredHandler).toBeDefined();

      await registeredHandler!({
        command: 'openInDataExplorer',
        collectionName: 'MyCollection',
        uuid: 'aaaa-bbbb-cccc-dddd',
        requestId: 'req-001',
      });

      expect(mockExecuteCommand).toHaveBeenCalledWith('weaviate.openDataExplorer', {
        connectionId: 'conn-3',
        collectionName: 'MyCollection',
        targetUuid: 'aaaa-bbbb-cccc-dddd',
      });
    });

    it('does not execute command when collectionName is missing', async () => {
      let registeredHandler: ((msg: any) => Promise<void>) | undefined;
      mockOnDidReceiveMessage.mockImplementation((handler: any) => {
        registeredHandler = handler;
        return { dispose: jest.fn() };
      });
      mockOnDidDispose.mockImplementation(() => ({ dispose: jest.fn() }));
      mockOnDidChangeViewState.mockImplementation(() => ({ dispose: jest.fn() }));

      const stubClient = {} as any;
      RagChatPanel.createOrShow(
        { fsPath: '/ext8' } as any,
        {} as any,
        'conn-4',
        'Test Connection',
        () => stubClient,
        undefined,
        true
      );

      await registeredHandler!({
        command: 'openInDataExplorer',
        // collectionName intentionally omitted
        uuid: 'aaaa-bbbb-cccc-dddd',
        requestId: 'req-002',
      });

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });
});
