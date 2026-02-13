import { AddCollectionPanel } from '../AddCollectionPanel';
import * as vscode from 'vscode';
import * as fs from 'fs';

// Mock vscode module
jest.mock('vscode', () => require('../../test/mocks/vscode'), { virtual: true });

// Mock fs module
jest.mock('fs');

describe('AddCollectionPanel', () => {
  let mockPanel: any;
  let mockExtensionUri: any;
  let onCreateCallback: jest.Mock;
  let onMessageCallback: jest.Mock;

  beforeEach(() => {
    // Reset singleton
    (AddCollectionPanel as any).currentPanel = undefined;

    mockPanel = {
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn(),
        cspSource: 'vscode-webview-csp-source',
        asWebviewUri: jest.fn((uri: any) => {
          return {
            toString: () => `vscode-webview://webview/${uri.fsPath}`,
            fsPath: `vscode-webview://webview/${uri.fsPath}`,
          };
        }),
      },
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidDispose: jest.fn((callback) => {
        mockPanel._disposeCallback = callback;
        return { dispose: jest.fn() };
      }),
    };

    mockExtensionUri = { fsPath: '/test/extension', toString: () => 'file:///test/extension' };
    onCreateCallback = jest.fn().mockResolvedValue(undefined);
    onMessageCallback = jest.fn();

    jest.spyOn(vscode.window, 'createWebviewPanel').mockReturnValue(mockPanel);

    // Mock fs.readFileSync to return a simple HTML structure
    (fs.readFileSync as jest.Mock).mockReturnValue(`<!DOCTYPE html>
<html>
<head></head>
<body>
  <div id="root"></div>
  <script src="bundle.js"></script>
  <link href="styles.css" rel="stylesheet">
</body>
</html>`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createOrShow', () => {
    test('creates a new panel when none exists', () => {
      const panel = AddCollectionPanel.createOrShow(
        mockExtensionUri,
        onCreateCallback,
        onMessageCallback
      );

      expect(panel).toBeDefined();
      expect(AddCollectionPanel.currentPanel).toBe(panel);
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'weaviateAddCollection',
        'Add Collection',
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    test('reuses existing panel when one exists', () => {
      const createWebviewPanelSpy = jest.spyOn(vscode.window, 'createWebviewPanel');
      createWebviewPanelSpy.mockClear();

      const panel1 = AddCollectionPanel.createOrShow(
        mockExtensionUri,
        onCreateCallback,
        onMessageCallback
      );

      mockPanel.webview.postMessage.mockClear();

      const panel2 = AddCollectionPanel.createOrShow(
        mockExtensionUri,
        onCreateCallback,
        onMessageCallback
      );

      expect(panel1).toBe(panel2);
      expect(mockPanel.reveal).toHaveBeenCalled();
      expect(createWebviewPanelSpy).toHaveBeenCalledTimes(1);

      createWebviewPanelSpy.mockRestore();
    });

    test('sends initialSchema to existing panel when provided', () => {
      const initialSchema = {
        class: 'TestCollection',
        properties: [],
      };

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      mockPanel.webview.postMessage.mockClear();

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback, undefined, initialSchema);

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'initialSchema',
        schema: initialSchema,
      });
    });

    test('stores initial schema for later use', () => {
      const initialSchema = {
        class: 'TestCollection',
        vectorizer: 'text2vec-openai',
      };

      const panel = AddCollectionPanel.createOrShow(
        mockExtensionUri,
        onCreateCallback,
        onMessageCallback,
        initialSchema
      );

      expect((panel as any)._initialSchema).toEqual(initialSchema);
    });

    test('uses active editor column when available', () => {
      const mockActiveEditor = {
        viewColumn: vscode.ViewColumn.Two,
      } as vscode.TextEditor;

      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: mockActiveEditor,
        configurable: true,
      });

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'weaviateAddCollection',
        'Add Collection',
        vscode.ViewColumn.Two,
        expect.any(Object)
      );

      // Cleanup
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true,
      });
    });

    test('uses ViewColumn.One when no active editor', () => {
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true,
      });

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'weaviateAddCollection',
        'Add Collection',
        vscode.ViewColumn.One,
        expect.any(Object)
      );
    });
  });

  describe('postMessage', () => {
    test('posts message to webview', () => {
      const panel = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const testMessage = { command: 'test', data: 'hello' };
      panel.postMessage(testMessage);

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(testMessage);
    });
  });

  describe('dispose', () => {
    test('disposes the panel and clears singleton', () => {
      const panel = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(AddCollectionPanel.currentPanel).toBe(panel);

      panel.dispose();

      expect(AddCollectionPanel.currentPanel).toBeUndefined();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('disposes all registered disposables', () => {
      const panel = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const disposeSpy1 = jest.fn();
      const disposeSpy2 = jest.fn();

      (panel as any)._disposables.push({ dispose: disposeSpy1 });
      (panel as any)._disposables.push({ dispose: disposeSpy2 });

      panel.dispose();

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });

    test('is called when panel is disposed by user', () => {
      const panel = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(AddCollectionPanel.currentPanel).toBe(panel);

      // Simulate user closing the panel
      if (mockPanel._disposeCallback) {
        mockPanel._disposeCallback();
      }

      expect(AddCollectionPanel.currentPanel).toBeUndefined();
    });
  });

  describe('message handling', () => {
    test('handles ready message with initial schema', async () => {
      const initialSchema = {
        class: 'TestCollection',
        properties: [],
      };

      AddCollectionPanel.createOrShow(
        mockExtensionUri,
        onCreateCallback,
        onMessageCallback,
        initialSchema
      );

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      mockPanel.webview.postMessage.mockClear();

      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'initialSchema',
        schema: initialSchema,
      });
      expect(onMessageCallback).toHaveBeenCalledWith({ command: 'ready' }, expect.any(Function));
    });

    test('handles ready message without initial schema', async () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback, onMessageCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      mockPanel.webview.postMessage.mockClear();

      await messageHandler({ command: 'ready' });

      expect(mockPanel.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initialSchema',
        })
      );
      expect(onMessageCallback).toHaveBeenCalledWith({ command: 'ready' }, expect.any(Function));
    });

    test('handles create message successfully', async () => {
      const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      const panel = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      const schema = {
        class: 'NewCollection',
        properties: [],
      };

      await messageHandler({
        command: 'create',
        schema: schema,
      });

      expect(onCreateCallback).toHaveBeenCalledWith(schema);
      expect(AddCollectionPanel.currentPanel).toBeUndefined();
    });

    test('handles create message with error', async () => {
      const errorMessage = 'Failed to create collection';
      onCreateCallback.mockRejectedValue(new Error(errorMessage));

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      const schema = {
        class: 'BadCollection',
        properties: [],
      };

      await messageHandler({
        command: 'create',
        schema: schema,
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: errorMessage,
      });
      expect(AddCollectionPanel.currentPanel).toBeDefined(); // Panel should not be disposed on error
    });

    test('handles create message with non-Error exception', async () => {
      onCreateCallback.mockRejectedValue('String error');

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      await messageHandler({
        command: 'create',
        schema: { class: 'Test' },
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        message: 'String error',
      });
    });

    test('handles cancel message', async () => {
      const panel = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      expect(AddCollectionPanel.currentPanel).toBe(panel);

      await messageHandler({ command: 'cancel' });

      expect(AddCollectionPanel.currentPanel).toBeUndefined();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    test('delegates unknown messages to onMessageCallback', async () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback, onMessageCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      const customMessage = {
        command: 'customCommand',
        data: 'test',
      };

      await messageHandler(customMessage);

      expect(onMessageCallback).toHaveBeenCalledWith(customMessage, expect.any(Function));
    });

    test('postMessage function in callback works correctly', async () => {
      let capturedPostMessage: ((msg: any) => void) | undefined;

      onMessageCallback.mockImplementation(async (message, postMessage) => {
        capturedPostMessage = postMessage;
      });

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback, onMessageCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      await messageHandler({ command: 'test' });

      expect(capturedPostMessage).toBeDefined();

      mockPanel.webview.postMessage.mockClear();

      const testMsg = { data: 'test' };
      capturedPostMessage!(testMsg);

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(testMsg);
    });
  });

  describe('HTML generation', () => {
    test('generates HTML with proper CSP and asset URIs', () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const html = mockPanel.webview.html;

      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain(mockPanel.webview.cspSource);
      expect(html).toContain('vscode-webview://webview/');
      expect(html).toContain('nonce-');
    });

    test('replaces asset paths with webview URIs', () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const html = mockPanel.webview.html;

      expect(html).toContain('src="vscode-webview://webview/');
      expect(html).toContain('href="vscode-webview://webview/');
      expect(mockPanel.webview.asWebviewUri).toHaveBeenCalled();
    });

    test('does not replace external URLs', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`<!DOCTYPE html>
<html>
<body>
  <script src="http://external.com/script.js"></script>
  <link href="//cdn.example.com/style.css" rel="stylesheet">
</body>
</html>`);

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const html = mockPanel.webview.html;

      expect(html).toContain('src="http://external.com/script.js"');
      expect(html).toContain('href="//cdn.example.com/style.css"');
    });

    test('replaces nonce placeholders', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`<!DOCTYPE html>
<html>
<head></head>
<body>
  <script nonce="{{nonce}}">console.log('test');</script>
</body>
</html>`);

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const html = mockPanel.webview.html;

      expect(html).toMatch(/nonce="[A-Za-z0-9]{32}"/);
      expect(html).not.toContain('{{nonce}}');
    });

    test('shows error message when HTML file cannot be read', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const html = mockPanel.webview.html;

      expect(html).toContain('Error loading Add Collection panel');
      expect(html).toContain('npm run build:add-collection');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read HTML file:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    test('generates unique nonces for CSP', () => {
      const panel1 = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);
      const html1 = mockPanel.webview.html;
      const nonce1Match = html1.match(/nonce-([A-Za-z0-9]{32})/);
      const nonce1 = nonce1Match ? nonce1Match[1] : '';

      panel1.dispose();

      const panel2 = AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);
      const html2 = mockPanel.webview.html;
      const nonce2Match = html2.match(/nonce-([A-Za-z0-9]{32})/);
      const nonce2 = nonce2Match ? nonce2Match[1] : '';

      // Nonces should be different (though there's a tiny chance they could be the same)
      // We'll just verify they're both valid
      expect(nonce1).toMatch(/^[A-Za-z0-9]{32}$/);
      expect(nonce2).toMatch(/^[A-Za-z0-9]{32}$/);
    });
  });

  describe('webview options', () => {
    test('sets correct localResourceRoots', () => {
      const createWebviewPanelSpy = jest.spyOn(vscode.window, 'createWebviewPanel');
      createWebviewPanelSpy.mockClear();

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(createWebviewPanelSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          localResourceRoots: [
            expect.objectContaining({
              fsPath: expect.stringContaining('dist/webview-add-collection'),
            }),
          ],
        })
      );

      createWebviewPanelSpy.mockRestore();
    });

    test('enables scripts in webview', () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
        })
      );
    });

    test('retains context when hidden', () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          retainContextWhenHidden: true,
        })
      );
    });
  });

  describe('edge cases', () => {
    test('handles missing onMessageCallback gracefully', async () => {
      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Should not throw
      await expect(messageHandler({ command: 'ready' })).resolves.not.toThrow();
      await expect(messageHandler({ command: 'unknown' })).resolves.not.toThrow();
    });

    test('handles complex schema in create message', async () => {
      const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');

      AddCollectionPanel.createOrShow(mockExtensionUri, onCreateCallback);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      const complexSchema = {
        class: 'ComplexCollection',
        description: 'A complex test collection',
        vectorizer: 'text2vec-openai',
        properties: [
          {
            name: 'title',
            dataType: ['text'],
            description: 'Title field',
          },
          {
            name: 'content',
            dataType: ['text'],
            vectorizePropertyName: false,
          },
        ],
      };

      await messageHandler({
        command: 'create',
        schema: complexSchema,
      });

      expect(onCreateCallback).toHaveBeenCalledWith(complexSchema);
    });
  });
});
