import { ConnectionManager, WeaviateConnection } from '../ConnectionManager';
import weaviate from 'weaviate-client';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

describe('ConnectionManager Validation and Mock Tests', () => {
  let mockContext: any;
  let globalState: MockGlobalState;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset singleton before every test
    (ConnectionManager as any).instance = undefined;

    // Mock console methods to prevent test output noise
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

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

    mockContext = {
      globalState,
      subscriptions: [],
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Validation Tests', () => {
    test('validates required fields for custom connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Test missing name
      await expect(
        mgr.addConnection({
          name: '',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
        } as any)
      ).rejects.toThrow();

      // Test missing httpHost
      await expect(
        mgr.addConnection({
          name: 'Test',
          type: 'custom',
          httpHost: '',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
        } as any)
      ).rejects.toThrow();
    });

    test('validates required fields for cloud connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Test missing cloudUrl
      await expect(
        mgr.addConnection({
          name: 'Test Cloud',
          type: 'cloud',
          cloudUrl: '',
          apiKey: 'test-key',
        } as any)
      ).rejects.toThrow();

      // Test missing apiKey
      await expect(
        mgr.addConnection({
          name: 'Test Cloud',
          type: 'cloud',
          cloudUrl: 'https://test.weaviate.network',
          apiKey: '',
        } as any)
      ).rejects.toThrow();
    });

    test('allows optional fields to be undefined', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Optional Fields Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        // apiKey, timeouts not provided
      });

      expect(conn).toBeDefined();
      expect(conn.apiKey).toBeUndefined();
      expect(conn.timeoutInit).toBeUndefined();
    });

    test('validates connection type values', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Should accept valid types
      const customConn = await mgr.addConnection({
        name: 'Valid Custom',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const cloudConn = await mgr.addConnection({
        name: 'Valid Cloud',
        type: 'cloud',
        cloudUrl: 'https://test.weaviate.network',
        apiKey: 'test-key',
      });

      expect(customConn.type).toBe('custom');
      expect(cloudConn.type).toBe('cloud');
    });
  });

  describe('Client Mock Tests', () => {
    test('mocks weaviate custom client correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = {
        isReady: jest.fn().mockResolvedValue(true),
        collections: {
          list: jest.fn().mockResolvedValue([]),
        },
      };

      const mockConnectToCustom = jest
        .spyOn(weaviate, 'connectToCustom')
        .mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Mock Custom Test',
        type: 'custom',
        httpHost: 'test-host',
        httpPort: 9090,
        grpcHost: 'test-host',
        grpcPort: 50052,
        httpSecure: true,
        grpcSecure: true,
        apiKey: 'mock-key',
        timeoutInit: 25,
        timeoutQuery: 55,
        timeoutInsert: 125,
      });

      await mgr.connect(conn.id);

      expect(mockConnectToCustom).toHaveBeenCalledWith({
        httpHost: 'test-host',
        httpPort: 9090,
        grpcHost: 'test-host',
        grpcPort: 50052,
        httpSecure: true,
        grpcSecure: true,
        authCredentials: { key: 'mock-key' },
        timeout: {
          init: 25,
          query: 55,
          insert: 125,
        },
      });

      expect(mockClient.isReady).toHaveBeenCalled();
      expect(mgr.getClient(conn.id)).toBe(mockClient);
    });

    test('mocks weaviate cloud client correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = {
        isReady: jest.fn().mockResolvedValue(true),
        collections: {
          list: jest.fn().mockResolvedValue([]),
        },
      };

      const mockApiKeyInstance = { key: 'cloud-mock-key' };
      const mockConnectToWeaviateCloud = jest
        .spyOn(weaviate, 'connectToWeaviateCloud')
        .mockResolvedValue(mockClient as any);
      const mockApiKey = jest
        .spyOn(weaviate, 'ApiKey')
        .mockImplementation(() => mockApiKeyInstance as any);

      const conn = await mgr.addConnection({
        name: 'Mock Cloud Test',
        type: 'cloud',
        cloudUrl: 'https://mock-cloud.weaviate.network',
        apiKey: 'cloud-mock-key',
        timeoutInit: 35,
        timeoutQuery: 75,
        timeoutInsert: 155,
      });

      await mgr.connect(conn.id);

      expect(mockApiKey).toHaveBeenCalledWith('cloud-mock-key');
      expect(mockConnectToWeaviateCloud).toHaveBeenCalledWith(
        'https://mock-cloud.weaviate.network',
        {
          authCredentials: mockApiKeyInstance,
          timeout: {
            init: 35,
            query: 75,
            insert: 155,
          },
        }
      );

      expect(mockClient.isReady).toHaveBeenCalled();
      expect(mgr.getClient(conn.id)).toBe(mockClient);
    });

    test('handles client mock failures', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Mock connection failure
      jest
        .spyOn(weaviate, 'connectToCustom')
        .mockRejectedValue(new Error('Mocked connection failure'));

      const conn = await mgr.addConnection({
        name: 'Mock Failure Test',
        type: 'custom',
        httpHost: 'fail-host',
        httpPort: 8080,
        grpcHost: 'fail-host',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const result = await mgr.connect(conn.id);

      expect(result).toBeNull();
      expect(mgr.getClient(conn.id)).toBeUndefined();
    });

    test('handles isReady mock failures', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const mockClient = {
        isReady: jest.fn().mockRejectedValue(new Error('Server not ready')),
      };

      jest.spyOn(weaviate, 'connectToCustom').mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Not Ready Mock Test',
        type: 'custom',
        httpHost: 'not-ready-host',
        httpPort: 8080,
        grpcHost: 'not-ready-host',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const result = await mgr.connect(conn.id);

      expect(result).toBeNull();
      expect(mockClient.isReady).toHaveBeenCalled();
      expect(mgr.getClient(conn.id)).toBeUndefined();
    });
  });

  describe('Storage Mock Tests', () => {
    test('handles storage get failures gracefully', () => {
      // Reset instance before this test
      (ConnectionManager as any).instance = undefined;

      globalState.get.mockImplementation(() => {
        throw new Error('Storage read error');
      });

      expect(() => {
        ConnectionManager.getInstance(mockContext);
      }).not.toThrow();
    });

    test('handles storage update failures gracefully', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      globalState.update.mockRejectedValue(new Error('Storage write error'));

      // Should not throw, but connection might not be persisted
      await expect(
        mgr.addConnection({
          name: 'Storage Failure Test',
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080,
          grpcHost: 'localhost',
          grpcPort: 50051,
          httpSecure: false,
          grpcSecure: false,
        })
      ).resolves.toBeDefined();
    });

    test('handles malformed storage data', () => {
      // Reset instance before this test
      (ConnectionManager as any).instance = undefined;

      globalState.storage['weaviate-connections'] = 'invalid-json-data';

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      expect(connections).toEqual([]);
    });

    test('handles corrupted connection objects in storage', () => {
      // Reset instance before this test
      (ConnectionManager as any).instance = undefined;

      globalState.storage['weaviate-connections'] = [
        { id: '1', name: 'Valid Connection', type: 'custom', httpHost: 'localhost' },
        { id: '2' }, // Missing required fields
        null, // Null value
        'string-instead-of-object',
      ];

      const mgr = ConnectionManager.getInstance(mockContext);
      const connections = mgr.getConnections();

      // Should handle gracefully, possibly filtering out invalid entries
      expect(Array.isArray(connections)).toBe(true);
    });
  });

  describe('Event Mock Tests', () => {
    test('event emitter fires correctly on operations', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const eventListener = jest.fn();

      mgr.onConnectionsChanged(eventListener);

      // Add connection
      await mgr.addConnection({
        name: 'Event Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      expect(eventListener).toHaveBeenCalledTimes(1);

      eventListener.mockClear();

      // Update connection
      const conn = mgr.getConnections()[0];
      await mgr.updateConnection(conn.id, { name: 'Updated Name' });

      expect(eventListener).toHaveBeenCalledTimes(1);

      eventListener.mockClear();

      // Delete connection
      await mgr.deleteConnection(conn.id);

      expect(eventListener).toHaveBeenCalledTimes(1);
    });

    test('multiple event listeners receive events', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      mgr.onConnectionsChanged(listener1);
      mgr.onConnectionsChanged(listener2);
      mgr.onConnectionsChanged(listener3);

      await mgr.addConnection({
        name: 'Multi Listener Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });

  describe('Date Mock Tests', () => {
    test('uses mocked Date.now for timestamps', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const mockTime = 1234567890123;
      jest.spyOn(Date, 'now').mockReturnValue(mockTime);
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Predictable random value

      const conn = await mgr.addConnection({
        name: 'Date Mock Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      expect(conn.id).toEqual(expect.stringMatching(new RegExp(`^${mockTime.toString()}`)));
      expect(conn.lastUsed).toBe(mockTime);
    });

    test('handles date operations correctly with mocked time', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      let mockTime = 1000;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        mockTime += 1000;
        return mockTime;
      });

      const conn1 = await mgr.addConnection({
        name: 'First',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const conn2 = await mgr.addConnection({
        name: 'Second',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8081,
        grpcHost: 'localhost',
        grpcPort: 50052,
        httpSecure: false,
        grpcSecure: false,
      });

      expect(conn1.lastUsed).toBe(2000);
      expect(conn2.lastUsed).toBe(3000);

      const connections = mgr.getConnections();
      expect(connections[0].name).toBe('Second'); // More recent
      expect(connections[1].name).toBe('First');
    });
  });

  describe('Context Mock Tests', () => {
    test('handles missing subscriptions array', () => {
      const contextWithoutSubscriptions = {
        globalState,
        subscriptions: undefined,
        // Missing other properties but with basic structure
      } as any;

      expect(() => {
        ConnectionManager.getInstance(contextWithoutSubscriptions);
      }).not.toThrow();
    });

    test('uses provided context correctly', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      await mgr.addConnection({
        name: 'Context Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      expect(globalState.update).toHaveBeenCalledWith(
        'weaviate-connections',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Context Test',
          }),
        ])
      );
    });
  });
});
