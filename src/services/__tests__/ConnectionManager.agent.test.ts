import {
  ConnectionManager,
  WeaviateConnection,
  DEFAULT_AGENT_SYSTEM_PROMPT,
} from '../ConnectionManager';
import * as vscode from 'vscode';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

describe('ConnectionManager - Agent Settings', () => {
  let mockContext: any;
  let globalState: MockGlobalState;
  let secretsStorage: Record<string, string>;

  beforeEach(() => {
    // Reset singleton before every test
    (ConnectionManager as any).instance = undefined;

    globalState = {
      storage: {},
      get: jest.fn((key: string) => {
        return globalState.storage[key];
      }),
      update: jest.fn((key: string, value: any) => {
        globalState.storage[key] = value;
        return Promise.resolve();
      }),
    } as unknown as MockGlobalState;

    secretsStorage = {};
    mockContext = {
      globalState,
      subscriptions: [],
      secrets: {
        get: jest.fn(async (key: string) => secretsStorage[key]),
        store: jest.fn(async (key: string, value: string) => {
          secretsStorage[key] = value;
        }),
        delete: jest.fn(async (key: string) => {
          delete secretsStorage[key];
        }),
        onDidChange: jest.fn(),
      },
    };
  });

  test('getAgentSystemPrompt returns undefined for new connection', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const connection = await mgr.addConnection({
      name: 'Test Connection',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      grpcHost: 'localhost',
      grpcPort: 50051,
    });

    const prompt = mgr.getAgentSystemPrompt(connection.id);
    expect(prompt).toBeUndefined();
  });

  test('setAgentSystemPrompt stores the prompt in globalState', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const connection = await mgr.addConnection({
      name: 'Test Connection',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      grpcHost: 'localhost',
      grpcPort: 50051,
    });

    const testPrompt = 'This is a test system prompt';
    await mgr.setAgentSystemPrompt(connection.id, testPrompt);

    // Check that getAgentSystemPrompt returns the stored value
    const prompt = mgr.getAgentSystemPrompt(connection.id);
    expect(prompt).toBe(testPrompt);
  });

  test('getInferenceProviderApiKey returns undefined for new connection', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const connection = await mgr.addConnection({
      name: 'Test Cloud Connection',
      type: 'cloud',
      cloudUrl: 'https://weaviate.cloud',
      apiKey: 'test-api-key',
    });

    const key = await mgr.getInferenceProviderApiKey(connection.id);
    expect(key).toBeUndefined();
  });

  test('setInferenceProviderApiKey stores key in context.secrets', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const connection = await mgr.addConnection({
      name: 'Test Cloud Connection',
      type: 'cloud',
      cloudUrl: 'https://weaviate.cloud',
      apiKey: 'test-api-key',
    });

    const testKey = 'test-inference-api-key-value';
    await mgr.setInferenceProviderApiKey(connection.id, testKey);

    // Check that it was stored in secrets
    const secretKey = `weaviate-connection-${connection.id}-inferenceProviderApiKey`;
    expect(secretsStorage[secretKey]).toBe(testKey);

    // Check that getInferenceProviderApiKey returns the key
    const key = await mgr.getInferenceProviderApiKey(connection.id);
    expect(key).toBe(testKey);
  });

  test('getInferenceProviderApiKey returns cached value from memory', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const connection = await mgr.addConnection({
      name: 'Test Cloud Connection',
      type: 'cloud',
      cloudUrl: 'https://weaviate.cloud',
      apiKey: 'test-api-key',
    });

    const testKey = 'test-inference-api-key-value';
    await mgr.setInferenceProviderApiKey(connection.id, testKey);

    // Get the key back
    const key = await mgr.getInferenceProviderApiKey(connection.id);
    expect(key).toBe(testKey);
  });

  test('both agentSystemPrompt and inferenceProviderApiKey can be set independently', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const connection = await mgr.addConnection({
      name: 'Test Cloud Connection',
      type: 'cloud',
      cloudUrl: 'https://weaviate.cloud',
      apiKey: 'test-api-key',
    });

    const testPrompt = 'Custom agent prompt';
    const testInferenceKey = 'test-inference-key';

    await mgr.setAgentSystemPrompt(connection.id, testPrompt);
    await mgr.setInferenceProviderApiKey(connection.id, testInferenceKey);

    // Verify both are stored independently
    expect(mgr.getAgentSystemPrompt(connection.id)).toBe(testPrompt);
    expect(await mgr.getInferenceProviderApiKey(connection.id)).toBe(testInferenceKey);
  });

  test('throws error when setting Agent settings for non-existent connection', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    await expect(mgr.setAgentSystemPrompt('nonexistent-id', 'test')).rejects.toThrow(
      'Connection not found'
    );

    await expect(mgr.setInferenceProviderApiKey('nonexistent-id', 'test-key')).rejects.toThrow(
      'Connection not found'
    );
  });

  test('DEFAULT_AGENT_SYSTEM_PROMPT constant is exported', () => {
    expect(DEFAULT_AGENT_SYSTEM_PROMPT).toBeDefined();
    expect(typeof DEFAULT_AGENT_SYSTEM_PROMPT).toBe('string');
    expect(DEFAULT_AGENT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});
