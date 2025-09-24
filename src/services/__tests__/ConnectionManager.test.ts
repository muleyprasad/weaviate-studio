import { ConnectionManager, WeaviateConnection } from '../ConnectionManager';
import * as weaviateClient from 'weaviate-client';
import * as vscode from 'vscode';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

describe('ConnectionManager', () => {
  let mockContext: any;
  let globalState: MockGlobalState;

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
      })
    } as unknown as MockGlobalState;

    mockContext = {
      globalState,
      subscriptions: []
    };
  });

  test('adds a new connection successfully', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    jest.spyOn(Date, 'now').mockReturnValueOnce(1);
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.5); // This will generate 'psw1azlat' substring

    const connection = await mgr.addConnection({
      name: 'Local',
      httpHost: 'localhost',
      apiKey: 'xyz',
      httpPort: 8080,
      grpcHost: 'localhost',
      grpcPort: 50051,
      grpcSecure: false,
      httpSecure: false,
      type: 'custom'
    });

    expect(connection).toMatchObject({
      name: 'Local',
      httpHost: 'localhost',
      apiKey: 'xyz',
      httpPort: 8080,
      grpcHost: 'localhost',
      grpcPort: 50051,
      grpcSecure: false,
      httpSecure: false,
      status: 'disconnected'
    });

    // Check that ID is a string and starts with timestamp
    expect(connection.id).toEqual(expect.stringMatching(/^1/));
    expect(typeof connection.id).toBe('string');
    // Persisted to globalState
    expect(globalState.update).toHaveBeenCalled();
  });

  test('prevents duplicate connection names', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    await mgr.addConnection({
      name: 'Duplicate', httpHost: 'http://a.com', apiKey: '',
      httpPort: 0,
      grpcHost: '',
      grpcPort: 0,
      grpcSecure: false,
      httpSecure: false,
      type: 'custom'
    });

    await expect(
      mgr.addConnection({
        name: 'Duplicate',
        httpHost: 'b.com',
        apiKey: '',
        httpPort: 0,
        grpcHost: '',
        grpcPort: 0,
        grpcSecure: false,
        httpSecure: false,
        type: 'custom'
      })
    ).rejects.toThrow(/already exists/);
  });

  // its ok to have different urls, unless cloud.
  // test('prevents duplicate URLs', async () => {
  //   const mgr = ConnectionManager.getInstance(mockContext);

  //   await mgr.addConnection({
  //     name: 'ConnA', httpHost: 'http://same.com', apiKey: '',
  //     httpPort: 0,
  //     grpcHost: '',
  //     grpcPort: 0,
  //     grpcSecure: false,
  //     httpSecure: false
  //   });

  //   await expect(
  //     mgr.addConnection({ name: 'ConnB', url: 'http://same.com', apiKey: '' })
  //   ).rejects.toThrow(/already exists/);
  // });

  // in order to accomodate custom connections for newer versions, this 
  // dont need to be enforced
  // test('rejects invalid URL format', async () => {
  //   const mgr = ConnectionManager.getInstance(mockContext);

  //   await expect(
  //     mgr.addConnection({ name: 'Bad', url: 'not-a-url', apiKey: '' })
  //   ).rejects.toThrow(/Invalid URL/);
  // });

  test('connects successfully to a connection', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection(
      {
        name: 'Good', httpHost: 'localhost', apiKey: '', httpPort: 8080, grpcHost: 'localhost', grpcPort: 50051, grpcSecure: false, httpSecure: false,
        type: 'custom'
      }
    );

    const updated = await mgr.connect(conn.id);
    expect(updated?.status).toBe('connected');
    expect(mgr.getClient(conn.id)).toBeDefined();
  });

  test('handles connection failure gracefully', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({
      name: 'Fail', httpHost: 'fail', apiKey: '', httpPort: 8080, grpcHost: 'localhost', grpcPort: 50051, grpcSecure: false, httpSecure: false,
      type: 'custom'
    });

    // Force weaviate client to throw for this test
    jest
      .spyOn(weaviateClient, 'connectToCustom')
      .mockRejectedValueOnce(new Error('Cannot connect'));

    const result = await mgr.connect(conn.id);
    expect(result).toBeNull();
    expect(mgr.getClient(conn.id)).toBeUndefined();
  });

  test('disconnects a connection', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({
      name: 'Disc', httpHost: 'localhost', apiKey: '', httpPort: 8080, grpcHost: 'localhost', grpcPort: 50051, grpcSecure: false, httpSecure: false,
      type: 'custom'
    });
    await mgr.connect(conn.id);

    const success = await mgr.disconnect(conn.id);
    expect(success).toBe(true);

    const after = mgr.getConnection(conn.id);
    expect(after?.status).toBe('disconnected');
    expect(mgr.getClient(conn.id)).toBeUndefined();
  });

  describe('Connection Type Tests', () => {
    test('creates custom connection correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const customConn = await mgr.addConnection({
        name: 'Custom Server',
        type: 'custom',
        httpHost: '192.168.1.100',
        httpPort: 8080,
        grpcHost: '192.168.1.100',
        grpcPort: 50051,
        httpSecure: true,
        grpcSecure: true,
        apiKey: 'custom-api-key',
        timeoutInit: 45,
        timeoutQuery: 90,
        timeoutInsert: 180
      });

      expect(customConn.type).toBe('custom');
      expect(customConn.httpHost).toBe('192.168.1.100');
      expect(customConn.httpPort).toBe(8080);
      expect(customConn.grpcHost).toBe('192.168.1.100');
      expect(customConn.grpcPort).toBe(50051);
      expect(customConn.httpSecure).toBe(true);
      expect(customConn.grpcSecure).toBe(true);
      expect(customConn.timeoutInit).toBe(45);
      expect(customConn.timeoutQuery).toBe(90);
      expect(customConn.timeoutInsert).toBe(180);
    });

    test('creates cloud connection correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const cloudConn = await mgr.addConnection({
        name: 'Cloud Instance',
        type: 'cloud',
        cloudUrl: 'https://my-cluster.weaviate.network',
        apiKey: 'cloud-api-key',
        timeoutInit: 30,
        timeoutQuery: 60,
        timeoutInsert: 120
      });

      expect(cloudConn.type).toBe('cloud');
      expect(cloudConn.cloudUrl).toBe('https://my-cluster.weaviate.network');
      expect(cloudConn.apiKey).toBe('cloud-api-key');
      expect(cloudConn.timeoutInit).toBe(30);
      expect(cloudConn.timeoutQuery).toBe(60);
      expect(cloudConn.timeoutInsert).toBe(120);
    });

    test('connects to custom connection with proper configuration', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockConnectToCustom = jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue({
        isReady: jest.fn().mockResolvedValue(true)
      } as any);

      const conn = await mgr.addConnection({
        name: 'Custom Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        apiKey: 'test-key',
        timeoutInit: 30,
        timeoutQuery: 60,
        timeoutInsert: 120
      });

      await mgr.connect(conn.id);

      expect(mockConnectToCustom).toHaveBeenCalledWith({
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        apiKey: 'test-key',
        type: 'custom',
        timeout: {
          init: 30,
          query: 60,
          insert: 120
        }
      });
    });

    test('connects to cloud connection with proper configuration', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockApiKey = jest.fn();
      const mockConnectToWeaviateCloud = jest.spyOn(weaviateClient, 'connectToWeaviateCloud').mockResolvedValue({
        isReady: jest.fn().mockResolvedValue(true)
      } as any);
      
      jest.spyOn(weaviateClient, 'ApiKey').mockImplementation(() => mockApiKey as any);

      const conn = await mgr.addConnection({
        name: 'Cloud Test',
        type: 'cloud',
        cloudUrl: 'https://test.weaviate.network',
        apiKey: 'cloud-key',
        timeoutInit: 45,
        timeoutQuery: 90,
        timeoutInsert: 180
      });

      await mgr.connect(conn.id);

      expect(mockConnectToWeaviateCloud).toHaveBeenCalledWith('https://test.weaviate.network', {
        authCredentials: mockApiKey,
        timeout: {
          init: 45,
          query: 90,
          insert: 180
        }
      });
    });
  });

  describe('Timeout Tests', () => {
    test('applies default timeouts when not specified', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Default Timeouts',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      expect(conn.timeoutInit).toBeUndefined();
      expect(conn.timeoutQuery).toBeUndefined();
      expect(conn.timeoutInsert).toBeUndefined();
    });

    test('applies custom timeouts correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Custom Timeouts',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        timeoutInit: 10,
        timeoutQuery: 20,
        timeoutInsert: 30
      });

      expect(conn.timeoutInit).toBe(10);
      expect(conn.timeoutQuery).toBe(20);
      expect(conn.timeoutInsert).toBe(30);
    });
  });

  describe('Connection Migration Tests', () => {
    test('migrates old cloud connection format', async () => {
      // Setup old format connection in storage
      const oldCloudConnection = {
        id: 'old-cloud',
        name: 'Old Cloud Connection',
        status: 'disconnected',
        url: 'https://my-cluster.weaviate.cloud',
        apiKey: 'old-api-key'
      };

      globalState.storage['weaviate-connections'] = [oldCloudConnection];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const migratedConnection = connections.find(c => c.id === 'old-cloud');
      expect(migratedConnection).toBeDefined();
      expect(migratedConnection?.type).toBe('cloud');
      expect(migratedConnection?.cloudUrl).toBe('https://my-cluster.weaviate.cloud');
      expect(migratedConnection?.connectionVersion).toBe('2');
      expect(migratedConnection?.url).toBeUndefined();
      expect(migratedConnection?.apiKey).toBe('old-api-key');
    });

    test('migrates old custom connection format with http URL', async () => {
      const oldCustomConnection = {
        id: 'old-custom',
        name: 'Old Custom Connection',
        status: 'disconnected',
        url: 'http://localhost:8080',
        apiKey: 'custom-key'
      };

      globalState.storage['weaviate-connections'] = [oldCustomConnection];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const migratedConnection = connections.find(c => c.id === 'old-custom');
      expect(migratedConnection).toBeDefined();
      expect(migratedConnection?.type).toBe('custom');
      expect(migratedConnection?.httpHost).toBe('localhost');
      expect(migratedConnection?.httpPort).toBe(8080);
      expect(migratedConnection?.httpSecure).toBe(false);
      expect(migratedConnection?.grpcHost).toBe('localhost');
      expect(migratedConnection?.grpcPort).toBe(50051);
      expect(migratedConnection?.grpcSecure).toBe(false);
      expect(migratedConnection?.connectionVersion).toBe('2');
      expect(migratedConnection?.url).toBeUndefined();
      expect(migratedConnection?.apiKey).toBe('custom-key');
    });

    test('migrates old custom connection format with https URL', async () => {
      const oldCustomConnection = {
        id: 'old-custom-https',
        name: 'Old HTTPS Custom Connection',
        status: 'disconnected',
        url: 'https://secure-server.com:9000',
        apiKey: 'secure-key'
      };

      globalState.storage['weaviate-connections'] = [oldCustomConnection];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const migratedConnection = connections.find(c => c.id === 'old-custom-https');
      expect(migratedConnection).toBeDefined();
      expect(migratedConnection?.type).toBe('custom');
      expect(migratedConnection?.httpHost).toBe('secure-server.com');
      expect(migratedConnection?.httpPort).toBe(9000);
      expect(migratedConnection?.httpSecure).toBe(true);
      expect(migratedConnection?.grpcHost).toBe('secure-server.com');
      expect(migratedConnection?.grpcPort).toBe(50051);
      expect(migratedConnection?.grpcSecure).toBe(true);
      expect(migratedConnection?.connectionVersion).toBe('2');
    });

    test('detects weaviate.io cloud URLs correctly', async () => {
      const oldCloudConnection = {
        id: 'old-weaviate-io',
        name: 'Old Weaviate.io Connection',
        status: 'disconnected',
        url: 'https://cluster.weaviate.io',
        apiKey: 'weaviate-io-key'
      };

      globalState.storage['weaviate-connections'] = [oldCloudConnection];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const migratedConnection = connections.find(c => c.id === 'old-weaviate-io');
      expect(migratedConnection?.type).toBe('cloud');
      expect(migratedConnection?.cloudUrl).toBe('https://cluster.weaviate.io');
    });

    test('skips migration for invalid connections', async () => {
      const invalidConnection = {
        id: 'invalid',
        name: 'Invalid Connection',
        status: 'disconnected'
        // Missing url field
      };

      globalState.storage['weaviate-connections'] = [invalidConnection];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const connection = connections.find(c => c.id === 'invalid');
      expect(connection).toBeDefined();
      expect(connection?.connectionVersion).toBeUndefined();
      expect(connection?.type).toBeUndefined();
    });

    test('does not migrate connections that are already version 2', async () => {
      const newConnection: WeaviateConnection = {
        id: 'new-format',
        name: 'New Format Connection',
        status: 'disconnected',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        connectionVersion: '2'
      };

      globalState.storage['weaviate-connections'] = [newConnection];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const connection = connections.find(c => c.id === 'new-format');
      expect(connection).toEqual(newConnection);
      expect(globalState.update).not.toHaveBeenCalled(); // Should not save again
    });

    test('saves migrated connections to storage', async () => {
      const oldConnection = {
        id: 'to-migrate',
        name: 'To Migrate',
        status: 'disconnected',
        url: 'http://localhost:8080',
        apiKey: 'key'
      };

      globalState.storage['weaviate-connections'] = [oldConnection];

      ConnectionManager.getInstance(mockContext);

      expect(globalState.update).toHaveBeenCalledWith('weaviate-connections', expect.arrayContaining([
        expect.objectContaining({
          id: 'to-migrate',
          connectionVersion: '2',
          type: 'custom'
        })
      ]));
    });

    test('handles mixed old and new connection formats', async () => {
      const mixedConnections = [
        {
          id: 'old',
          name: 'Old Connection',
          status: 'disconnected',
          url: 'http://old.server.com:8080'
        },
        {
          id: 'new',
          name: 'New Connection',
          status: 'disconnected',
          type: 'custom',
          httpHost: 'new.server.com',
          httpPort: 8080,
          grpcHost: 'new.server.com',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          connectionVersion: '2'
        }
      ];

      globalState.storage['weaviate-connections'] = mixedConnections;

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      const oldConnection = connections.find(c => c.id === 'old');
      const newConnection = connections.find(c => c.id === 'new');

      expect(oldConnection?.connectionVersion).toBe('2');
      expect(oldConnection?.type).toBe('custom');
      expect(newConnection?.connectionVersion).toBe('2');
      expect(newConnection?.type).toBe('custom');
    });
  });

  describe('Error Handling Tests', () => {
    test('handles connection timeout gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      
      jest.spyOn(weaviateClient, 'connectToCustom').mockRejectedValue(new Error('Connection timeout'));

      const conn = await mgr.addConnection({
        name: 'Timeout Test',
        type: 'custom',
        httpHost: 'unreachable-host',
        httpPort: 8080,
        grpcHost: 'unreachable-host',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const result = await mgr.connect(conn.id);
      expect(result).toBeNull();
      expect(mgr.getClient(conn.id)).toBeUndefined();

      const connection = mgr.getConnection(conn.id);
      expect(connection?.status).toBe('disconnected');
    });

    test('handles invalid cloud URL gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      
      jest.spyOn(weaviateClient, 'connectToWeaviateCloud').mockRejectedValue(new Error('Invalid cloud URL'));

      const conn = await mgr.addConnection({
        name: 'Invalid Cloud',
        type: 'cloud',
        cloudUrl: 'https://invalid.url',
        apiKey: 'test-key'
      });

      const result = await mgr.connect(conn.id);
      expect(result).toBeNull();
      expect(mgr.getClient(conn.id)).toBeUndefined();
    });

    test('handles missing required fields for custom connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await expect(mgr.addConnection({
        name: '',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      })).rejects.toThrow();
    });

    test('handles client creation failure', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      
      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(null as any);

      const conn = await mgr.addConnection({
        name: 'Client Creation Fail',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const result = await mgr.connect(conn.id);
      expect(result).toBeNull();
    });

    test('handles isReady check failure', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      
      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue({
        isReady: jest.fn().mockRejectedValue(new Error('Server not ready'))
      } as any);

      const conn = await mgr.addConnection({
        name: 'Not Ready',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const result = await mgr.connect(conn.id);
      expect(result).toBeNull();
    });
  });

  describe('State Management Tests', () => {
    test('maintains singleton pattern', () => {
      const mgr1 = ConnectionManager.getInstance(mockContext);
      const mgr2 = ConnectionManager.getInstance(mockContext);

      expect(mgr1).toBe(mgr2);
      expect(mgr1 === mgr2).toBe(true);
    });

    test('fires connection changed events on add', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const eventListener = jest.fn();

      mgr.onConnectionsChanged(eventListener);

      await mgr.addConnection({
        name: 'Event Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      expect(eventListener).toHaveBeenCalled();
    });

    test('fires connection changed events on update', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const eventListener = jest.fn();

      const conn = await mgr.addConnection({
        name: 'Update Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      eventListener.mockClear();
      mgr.onConnectionsChanged(eventListener);

      await mgr.updateConnection(conn.id, { name: 'Updated Name' });

      expect(eventListener).toHaveBeenCalled();
    });

    test('fires connection changed events on delete', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const eventListener = jest.fn();

      const conn = await mgr.addConnection({
        name: 'Delete Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      eventListener.mockClear();
      mgr.onConnectionsChanged(eventListener);

      await mgr.deleteConnection(conn.id);

      expect(eventListener).toHaveBeenCalled();
    });

    test('persists connections to globalState', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await mgr.addConnection({
        name: 'Persist Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      expect(globalState.update).toHaveBeenCalledWith('weaviate-connections', expect.arrayContaining([
        expect.objectContaining({
          name: 'Persist Test',
          type: 'custom'
        })
      ]));
    });

    test('loads connections from globalState on initialization', () => {
      const existingConnections: WeaviateConnection[] = [
        {
          id: 'existing',
          name: 'Existing Connection',
          status: 'connected', // Should be reset to disconnected
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
          connectionVersion: '2'
        }
      ];

      globalState.storage['weaviate-connections'] = existingConnections;

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      expect(connections).toHaveLength(1);
      expect(connections[0].id).toBe('existing');
      expect(connections[0].name).toBe('Existing Connection');
      expect(connections[0].status).toBe('disconnected'); // Should be reset
    });

    test('sorts connections by lastUsed timestamp', async () => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // First connection
        .mockReturnValueOnce(2000) // Second connection
        .mockReturnValueOnce(3000); // Third connection

      const mgr = ConnectionManager.getInstance(mockContext);

      const conn1 = await mgr.addConnection({
        name: 'First',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const conn2 = await mgr.addConnection({
        name: 'Second',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8081,
        grpcHost: 'localhost',
        grpcPort: 50052,
        httpSecure: false,
        grpcSecure: false
      });

      const conn3 = await mgr.addConnection({
        name: 'Third',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8082,
        grpcHost: 'localhost',
        grpcPort: 50053,
        httpSecure: false,
        grpcSecure: false
      });

      const connections = mgr.getConnections();

      expect(connections[0].name).toBe('Third');  // Most recent
      expect(connections[1].name).toBe('Second');
      expect(connections[2].name).toBe('First');  // Oldest
    });

    test('updates lastUsed timestamp on connection update', async () => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // For addConnection (ID and lastUsed)
        .mockReturnValueOnce(2000); // For updateConnection lastUsed

      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'LastUsed Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      expect(conn.lastUsed).toBe(1000);

      const updated = await mgr.updateConnection(conn.id, { name: 'Updated Name' });

      expect(updated?.lastUsed).toBe(2000);
    });

    test('manages client cache correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };

      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Client Cache Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      // Connect and check client is cached
      await mgr.connect(conn.id);
      expect(mgr.getClient(conn.id)).toBe(mockClient);

      // Disconnect and check client is removed from cache
      await mgr.disconnect(conn.id);
      expect(mgr.getClient(conn.id)).toBeUndefined();
    });

    test('removes client from cache on delete', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };

      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Delete Client Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      await mgr.connect(conn.id);
      expect(mgr.getClient(conn.id)).toBe(mockClient);

      await mgr.deleteConnection(conn.id);
      expect(mgr.getClient(conn.id)).toBeUndefined();
    });
  });

  describe('CRUD Operations Tests', () => {
    test('getConnection returns correct connection by id', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Get Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const retrieved = mgr.getConnection(conn.id);
      expect(retrieved).toEqual(conn);
    });

    test('getConnection returns undefined for non-existent id', () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const retrieved = mgr.getConnection('non-existent');
      expect(retrieved).toBeUndefined();
    });

    test('updateConnection modifies existing connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Original Name',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const updated = await mgr.updateConnection(conn.id, {
        name: 'Updated Name',
        httpPort: 9090
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.httpPort).toBe(9090);
      expect(updated?.httpHost).toBe('localhost'); // Unchanged field
    });

    test('deleteConnection removes connection from list', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'To Delete',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      const initialCount = mgr.getConnections().length;
      const success = await mgr.deleteConnection(conn.id);

      expect(success).toBe(true);
      expect(mgr.getConnections()).toHaveLength(initialCount - 1);
      expect(mgr.getConnection(conn.id)).toBeUndefined();
    });
  });

  describe('Edge Cases Tests', () => {
    test('handles empty name gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await expect(mgr.addConnection({
        name: '   ',  // Just whitespace
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      })).rejects.toThrow();
    });

    test('handles case insensitive name duplicates', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await mgr.addConnection({
        name: 'Test Connection',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      await expect(mgr.addConnection({
        name: 'test connection',  // Different case
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8081,
        grpcHost: 'localhost',
        grpcPort: 50052,
        httpSecure: false,
        grpcSecure: false
      })).rejects.toThrow(/already exists/);
    });

    test('handles zero and negative port numbers', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Zero Port',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 0,
        grpcHost: 'localhost',
        grpcPort: -1,
        httpSecure: false,
        grpcSecure: false
      });

      expect(conn.httpPort).toBe(0);
      expect(conn.grpcPort).toBe(-1);
    });

    test('preserves optional fields when not provided', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Minimal Connection',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
        // No timeouts, no API key
      });

      expect(conn.apiKey).toBeUndefined();
      expect(conn.timeoutInit).toBeUndefined();
      expect(conn.timeoutQuery).toBeUndefined();
      expect(conn.timeoutInsert).toBeUndefined();
    });

    test('handles very long connection names', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const longName = 'A'.repeat(1000);

      const conn = await mgr.addConnection({
        name: longName,
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      expect(conn.name).toBe(longName);
    });

    test('handles special characters in connection names', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const specialName = 'Test Connection 🚀 with émojis & spëcial chârs!';

      const conn = await mgr.addConnection({
        name: specialName,
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      expect(conn.name).toBe(specialName);
    });

    test('handles empty connections list', () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      expect(connections).toEqual([]);
      expect(connections).toHaveLength(0);
    });
  });

  describe('Additional Error Handling', () => {
    test('returns null when updating non-existent connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const result = await mgr.updateConnection('non-existent-id', { name: 'Updated' });

      expect(result).toBeNull();
    });

    test('returns false when deleting non-existent connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const result = await mgr.deleteConnection('non-existent-id');

      expect(result).toBe(false);
    });

    test('returns null when connecting to non-existent connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const result = await mgr.connect('non-existent-id');

      expect(result).toBeNull();
    });

    test('handles disconnect errors gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      
      // Mock console.error to prevent error output during test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const conn = await mgr.addConnection({
        name: 'Disconnect Error Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false
      });

      await mgr.connect(conn.id);

      // Mock updateConnection to throw an error
      jest.spyOn(mgr, 'updateConnection').mockRejectedValue(new Error('Update failed'));

      const result = await mgr.disconnect(conn.id);
      expect(result).toBe(false);

      // Client should still be removed from cache
      expect(mgr.getClient(conn.id)).toBeUndefined();
      
      // Verify that console.error was called
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
}); 