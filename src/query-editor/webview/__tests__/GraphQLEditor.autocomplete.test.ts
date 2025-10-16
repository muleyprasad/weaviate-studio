// Minimal DOM container for the editor
function createContainer(): HTMLDivElement {
  const el = document.createElement('div');
  // Give the container some size so monaco doesn't complain when mocked
  el.style.width = '800px';
  el.style.height = '600px';
  document.body.appendChild(el);
  return el;
}

// Mock monaco-editor module
const setSchemaConfigMock = jest.fn();
const setCompletionSettingsMock = jest.fn();
const createModelMock = jest.fn();
const editorCreateMock = jest.fn(() => ({
  onDidChangeModelContent: jest.fn(() => ({ dispose: jest.fn() })),
  getModel: jest.fn(),
  getValue: jest.fn(() => ''),
  setValue: jest.fn(),
  focus: jest.fn(),
  dispose: jest.fn(),
  getSelection: jest.fn(),
  getPosition: jest.fn(),
  setSelection: jest.fn(),
  setPosition: jest.fn(),
  addCommand: jest.fn(),
  trigger: jest.fn(),
}));

jest.mock('monaco-editor', () => ({
  editor: {
    create: editorCreateMock,
    createModel: createModelMock,
    setModelMarkers: jest.fn(),
  },
  languages: {
    graphql: {
      api: {
        setSchemaConfig: setSchemaConfigMock,
        setCompletionSettings: setCompletionSettingsMock,
      },
    },
  },
  Uri: {
    parse: (s: string) => ({ toString: () => s }),
  },
  KeyCode: { Enter: 3 },
  MarkerSeverity: { Warning: 1, Error: 8 },
  Range: class Range {},
}));

// Avoid loading real ESM from node_modules in Jest
jest.mock('monaco-graphql/esm/monaco.contribution.js', () => ({}));

// Import after mocking

const { GraphQLEditor } = require('../GraphQLEditor');

describe('GraphQLEditor monaco-graphql integration', () => {
  beforeEach(() => {
    setSchemaConfigMock.mockClear();
    setCompletionSettingsMock.mockClear();
    createModelMock.mockClear();
    editorCreateMock.mockClear();
  });

  it('creates a GraphQL model with a stable weaviate:// URI', () => {
    const container = createContainer();
    new GraphQLEditor(container, '');
    expect(createModelMock).toHaveBeenCalled();
    const args = createModelMock.mock.calls[0];
    // args: [value, language, uri]
    expect(args[1]).toBe('graphql');
    expect(args[2].toString()).toBe('weaviate://graphql/operation.graphql');
  });

  it('applies introspection to monaco-graphql via setSchemaConfig', async () => {
    const container = createContainer();
    const editor = new GraphQLEditor(container, '');

    await editor.configureGraphQLLanguage({
      uri: 'weaviate://graphql',
      fileMatch: ['weaviate://graphql/**'],
      introspectionJSON: { __schema: { types: [] } },
    } as any);

    expect(setSchemaConfigMock).toHaveBeenCalledTimes(1);
    const configArg = setSchemaConfigMock.mock.calls[0][0][0];
    expect(configArg.uri).toBe('weaviate://graphql');
    expect(configArg.fileMatch).toContain('weaviate://graphql/**');
    expect(configArg.introspectionJSON).toEqual({ __schema: { types: [] } });

    expect(setCompletionSettingsMock).toHaveBeenCalledWith({
      __experimental__fillLeafsOnComplete: false,
    });
  });
});
