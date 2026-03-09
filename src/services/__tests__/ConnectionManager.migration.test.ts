import { ConnectionManager } from '../ConnectionManager';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

describe('ConnectionManager — Secrets migration (v2 → v3)', () => {
  let mockContext: any;
  let globalState: MockGlobalState;

  function makeSecretsAwareContext(initialConnections: any[]) {
    const secretsStorage: Record<string, string> = {};
    const storage: Record<string, any> = { 'weaviate-connections': initialConnections };
    const gs: MockGlobalState = {
      storage,
      get: jest.fn((key: string) => storage[key]),
      update: jest.fn((key: string, value: any) => {
        storage[key] = value;
        return Promise.resolve();
      }),
    } as unknown as MockGlobalState;
    const secrets = {
      get: jest.fn(async (key: string) => secretsStorage[key]),
      store: jest.fn(async (key: string, value: string) => {
        secretsStorage[key] = value;
      }),
      delete: jest.fn(async (key: string) => {
        delete secretsStorage[key];
      }),
      onDidChange: jest.fn(),
    };
    return {
      context: { globalState: gs, subscriptions: [], secrets },
      gs,
      secrets,
      secretsStorage,
    };
  }

  beforeEach(() => {
    (ConnectionManager as any).instance = undefined;

    const secretsStorage: Record<string, string> = {};
    globalState = {
      storage: {},
      get: jest.fn((key: string) => globalState.storage[key]),
      update: jest.fn((key: string, value: any) => {
        globalState.storage[key] = value;
        return Promise.resolve();
      }),
    } as unknown as MockGlobalState;

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

  afterEach(() => {
    (ConnectionManager as any).instance = undefined;
  });

  // ---------------------------------------------------------------------------
  // v2 → v3: plaintext secrets moved to context.secrets
  // ---------------------------------------------------------------------------

  test('migrates apiKey from v2 globalState into context.secrets', async () => {
    const v2Connections = [
      {
        id: 'conn-v2-apikey',
        name: 'V2 ApiKey Connection',
        type: 'cloud',
        cloudUrl: 'https://test.weaviate.cloud',
        apiKey: 'secret-api-key',
        connectionVersion: '2',
        status: 'disconnected',
        autoConnect: false,
      },
    ];

    const { context, secrets, secretsStorage } = makeSecretsAwareContext(v2Connections);
    const mgr = ConnectionManager.getInstance(context as any);
    await (mgr as any).addConnectionMutex;

    expect(secrets.store).toHaveBeenCalledWith(
      'weaviate-connection-conn-v2-apikey-apiKey',
      'secret-api-key'
    );
    expect(secretsStorage['weaviate-connection-conn-v2-apikey-apiKey']).toBe('secret-api-key');

    const conn = mgr.getConnection('conn-v2-apikey');
    expect(conn?.apiKey).toBe('secret-api-key');
    expect(conn?.apiKeyPresent).toBe(true);
  });

  test('migrates password from v2 globalState into context.secrets', async () => {
    const v2Connections = [
      {
        id: 'conn-v2-pass',
        name: 'V2 Password Connection',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        authType: 'clientPassword',
        username: 'alice',
        password: 'secret-password',
        connectionVersion: '2',
        status: 'disconnected',
        autoConnect: false,
      },
    ];

    const { context, secrets, secretsStorage } = makeSecretsAwareContext(v2Connections);
    const mgr = ConnectionManager.getInstance(context as any);
    await (mgr as any).addConnectionMutex;

    expect(secrets.store).toHaveBeenCalledWith(
      'weaviate-connection-conn-v2-pass-password',
      'secret-password'
    );
    expect(secretsStorage['weaviate-connection-conn-v2-pass-password']).toBe('secret-password');

    const conn = mgr.getConnection('conn-v2-pass');
    expect(conn?.password).toBe('secret-password');
    expect(conn?.passwordPresent).toBe(true);
  });

  test('does not persist raw apiKey/password to globalState after v2→v3 migration', async () => {
    const v2Connections = [
      {
        id: 'conn-strip',
        name: 'Strip Secrets',
        type: 'cloud',
        cloudUrl: 'https://test.weaviate.cloud',
        apiKey: 'plaintext-key',
        connectionVersion: '2',
        status: 'disconnected',
        autoConnect: false,
      },
    ];

    const { context, gs } = makeSecretsAwareContext(v2Connections);
    const mgr = ConnectionManager.getInstance(context as any);
    await (mgr as any).addConnectionMutex;

    const updateCalls = gs.update.mock.calls;
    const savedData = updateCalls[updateCalls.length - 1]?.[1] as any[];
    const saved = savedData?.find((c: any) => c.id === 'conn-strip');
    expect(saved).not.toHaveProperty('apiKey');
    expect(saved?.apiKeyPresent).toBe(true);
  });

  test('connection version is bumped to 3 after v2→v3 migration', async () => {
    const v2Connections = [
      {
        id: 'conn-version',
        name: 'Version Check',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        connectionVersion: '2',
        status: 'disconnected',
        autoConnect: false,
      },
    ];

    const { context } = makeSecretsAwareContext(v2Connections);
    const mgr = ConnectionManager.getInstance(context as any);
    await (mgr as any).addConnectionMutex;

    expect(mgr.getConnection('conn-version')?.connectionVersion).toBe('3');
  });

  // ---------------------------------------------------------------------------
  // New connections: secrets go to context.secrets, not globalState
  // ---------------------------------------------------------------------------

  test('new connections store apiKey in secrets, not in globalState', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    await mgr.addConnection({
      name: 'New Secret Connection',
      type: 'cloud',
      cloudUrl: 'https://new.weaviate.cloud',
      apiKey: 'my-new-api-key',
    });

    const lastUpdate = globalState.update.mock.calls[globalState.update.mock.calls.length - 1];
    const savedConnections = lastUpdate[1] as any[];
    const saved = savedConnections.find((c: any) => c.name === 'New Secret Connection');
    expect(saved).not.toHaveProperty('apiKey');
    expect(saved?.apiKeyPresent).toBe(true);

    const conn = mgr.getConnections().find((c) => c.name === 'New Secret Connection');
    expect(conn?.apiKey).toBe('my-new-api-key');
  });

  test('new connections store password in secrets, not in globalState', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    await mgr.addConnection({
      name: 'New Password Connection',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      authType: 'clientPassword',
      username: 'alice',
      password: 'my-new-password',
    });

    const lastUpdate = globalState.update.mock.calls[globalState.update.mock.calls.length - 1];
    const savedConnections = lastUpdate[1] as any[];
    const saved = savedConnections.find((c: any) => c.name === 'New Password Connection');
    expect(saved).not.toHaveProperty('password');
    expect(saved?.passwordPresent).toBe(true);

    const conn = mgr.getConnections().find((c) => c.name === 'New Password Connection');
    expect(conn?.password).toBe('my-new-password');
  });

  // ---------------------------------------------------------------------------
  // deleteConnection cleans up secrets
  // ---------------------------------------------------------------------------

  test('deleteConnection removes apiKey from context.secrets', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({
      name: 'Delete Secret Test',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      apiKey: 'key-to-delete',
    });

    await mgr.deleteConnection(conn.id);

    expect(mockContext.secrets.delete).toHaveBeenCalledWith(
      `weaviate-connection-${conn.id}-apiKey`
    );
  });

  test('deleteConnection removes password from context.secrets', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({
      name: 'Delete Password Test',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      authType: 'clientPassword',
      username: 'user',
      password: 'pass-to-delete',
    });

    await mgr.deleteConnection(conn.id);

    expect(mockContext.secrets.delete).toHaveBeenCalledWith(
      `weaviate-connection-${conn.id}-password`
    );
  });

  // ---------------------------------------------------------------------------
  // updateConnection manages secrets correctly
  // ---------------------------------------------------------------------------

  test('updateConnection stores new apiKey in secrets', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({
      name: 'Update ApiKey Test',
      type: 'cloud',
      cloudUrl: 'https://test.weaviate.cloud',
      apiKey: 'old-key',
    });

    await mgr.updateConnection(conn.id, { apiKey: 'new-key' });

    expect(mockContext.secrets.store).toHaveBeenLastCalledWith(
      `weaviate-connection-${conn.id}-apiKey`,
      'new-key'
    );
    expect(mgr.getConnection(conn.id)?.apiKey).toBe('new-key');
    expect(mgr.getConnection(conn.id)?.apiKeyPresent).toBe(true);
  });

  test('updateConnection with apiKey: undefined deletes secret and clears flag', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({
      name: 'Clear ApiKey Test',
      type: 'custom',
      httpHost: 'localhost',
      httpPort: 8080,
      apiKey: 'to-clear',
    });

    await mgr.updateConnection(conn.id, { apiKey: undefined });

    expect(mockContext.secrets.delete).toHaveBeenCalledWith(
      `weaviate-connection-${conn.id}-apiKey`
    );
    expect(mgr.getConnection(conn.id)?.apiKey).toBeUndefined();
    expect(mgr.getConnection(conn.id)?.apiKeyPresent).toBe(false);
  });
});
