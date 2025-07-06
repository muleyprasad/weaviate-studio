import { jest } from '@jest/globals';
import * as vscode from 'vscode';

// Mock ConnectionManager to avoid side-effects
jest.mock('../../services/ConnectionManager', () => ({
  ConnectionManager: { getInstance: () => ({ getConnections: () => [], onConnectionsChanged: () => {} }) }
}));

// Mock ViewRenderer so HTML generation is harmless
jest.mock('../../views/ViewRenderer', () => ({
  ViewRenderer: {
    getInstance: jest.fn(() => ({
      renderDetailedSchema: jest.fn(() => '<html></html>'),
      renderRawConfig: jest.fn(() => '<html></html>')
    }))
  }
}));

// Mock vscode specifics
const vsMock = require('../../test/mocks/vscode');
vsMock.ViewColumn = { One: 1 };
vsMock.window.activeTextEditor = undefined;
vsMock.Uri = { joinPath: jest.fn(() => ({})), file: jest.fn(() => ({})) };
jest.mock('vscode', () => vsMock, { virtual: true });

import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';

describe('Tree panel webview options', () => {
  const ctx: any = { extensionUri: { fsPath: '/' }, subscriptions: [], globalState: { get: () => [], update: jest.fn() } };
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new (require('../WeaviateTreeDataProvider').WeaviateTreeDataProvider)(ctx);
    // Inject mock collection schema data
    (provider as any).collections = {
      c1: [ { label: 'ColA', schema: {} } ]
    };
  });

  const makeItem = (label: string): any => ({
    connectionId: 'c1',
    label,
    itemType: 'collection'
  });

  it('detailed schema panel includes retainContextWhenHidden', async () => {
    const capture = jest.fn(() => ({ webview: { }, reveal: jest.fn(), dispose: jest.fn() }));
    vsMock.window.createWebviewPanel.mockImplementation(capture);

    await provider.handleViewDetailedSchema(makeItem('ColA'));

    expect(capture).toHaveBeenCalled();
    const opts: any = (capture.mock.calls as any)[0][3];
    expect(opts.retainContextWhenHidden).toBe(true);
  });

  // REMOVED raw config panel test as feature is deprecated
}); 