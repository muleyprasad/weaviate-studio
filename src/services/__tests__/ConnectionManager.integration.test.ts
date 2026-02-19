import { ConnectionManager, WeaviateConnection } from '../ConnectionManager';
import * as weaviateClient from 'weaviate-client';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

describe('ConnectionManager Integration Tests', () => {
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
      }),
    } as unknown as MockGlobalState;

    mockContext = {
      globalState,
      subscriptions: [],
    };
  });

  describe('Performance Tests', () => {
    test('handles large number of connections efficiently', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const startTime = Date.now();

      // Add 100 connections
      const connectionPromises = [];
      for (let i = 0; i < 100; i++) {
        connectionPromises.push(
          mgr.addConnection({
            name: `Connection ${i}`,
            type: 'custom',
            httpHost: `host${i}.example.com`,
            httpPort: 8080 + i,
            grpcHost: `host${i}.example.com`,
            grpcPort: 50051 + i,
            httpSecure: i % 2 === 0,
            grpcSecure: i % 2 === 0,
          })
        );
      }

      await Promise.all(connectionPromises);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(mgr.getConnections()).toHaveLength(100);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('retrieves connections quickly from large list', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Add 50 connections
      const connections = [];
      for (let i = 0; i < 50; i++) {
        const conn = await mgr.addConnection({
          name: `Fast Retrieve ${i}`,
          type: 'custom',
          httpHost: `host${i}.example.com`,
          httpPort: 8080 + i,
          grpcHost: `host${i}.example.com`,
          grpcPort: 50051 + i,
          httpSecure: false,
          grpcSecure: false,
        });
        connections.push(conn);
      }

      const startTime = Date.now();

      // Retrieve random connections
      for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * connections.length);
        const retrieved = mgr.getConnection(connections[randomIndex].id);
        expect(retrieved).toBeDefined();
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(100); // Should be very fast
    });

    test('handles rapid connection status changes', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };

      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Rapid Status Change',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const statusChanges: string[] = [];
      const promises: Promise<any>[] = [];

      // Rapidly connect and disconnect
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          promises.push(mgr.connect(conn.id).then(() => statusChanges.push('connected')));
        } else {
          promises.push(mgr.disconnect(conn.id).then(() => statusChanges.push('disconnected')));
        }
      }

      await Promise.all(promises);

      expect(statusChanges).toHaveLength(10);
      expect(statusChanges.filter((s) => s === 'connected')).toHaveLength(5);
      expect(statusChanges.filter((s) => s === 'disconnected')).toHaveLength(5);
    });
  });

  describe('Concurrent Operations Tests', () => {
    test('handles concurrent connection additions', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const connectionPromises = [];
      for (let i = 0; i < 20; i++) {
        connectionPromises.push(
          mgr.addConnection({
            name: `Concurrent ${i}`,
            type: 'custom',
            httpHost: `concurrent${i}.example.com`,
            httpPort: 8080 + i,
            grpcHost: `concurrent${i}.example.com`,
            grpcPort: 50051 + i,
            httpSecure: false,
            grpcSecure: false,
          })
        );
      }

      const connections = await Promise.all(connectionPromises);

      expect(connections).toHaveLength(20);
      expect(mgr.getConnections()).toHaveLength(20);

      // Check all connections have unique IDs
      const ids = connections.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(20);
    });

    test('handles concurrent updates to same connection', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Concurrent Update Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      const updatePromises = [];
      for (let i = 0; i < 5; i++) {
        updatePromises.push(mgr.updateConnection(conn.id, { name: `Updated ${i}` }));
      }

      const results = await Promise.all(updatePromises);

      // All updates should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result?.id).toBe(conn.id);
      });

      const finalConnection = mgr.getConnection(conn.id);
      expect(finalConnection?.name).toMatch(/Updated \d/);
    });

    test('handles concurrent connect/disconnect operations', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };

      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(mockClient as any);

      const connections = [];
      for (let i = 0; i < 5; i++) {
        const conn = await mgr.addConnection({
          name: `Concurrent Conn ${i}`,
          type: 'custom',
          httpHost: `host${i}.example.com`,
          httpPort: 8080 + i,
          grpcHost: `host${i}.example.com`,
          grpcPort: 50051 + i,
          httpSecure: false,
          grpcSecure: false,
        });
        connections.push(conn);
      }

      const operationPromises: Promise<WeaviateConnection | null>[] = [];

      // Concurrent connect operations
      connections.forEach((conn) => {
        operationPromises.push(mgr.connect(conn.id));
      });

      // Wait for all connections
      await Promise.all(operationPromises);

      // Verify all are connected
      connections.forEach((conn) => {
        expect(mgr.getClient(conn.id)).toBeDefined();
      });

      const disconnectPromises: Promise<boolean>[] = [];

      // Concurrent disconnect operations
      connections.forEach((conn) => {
        disconnectPromises.push(mgr.disconnect(conn.id));
      });

      await Promise.all(disconnectPromises);

      // Verify all are disconnected
      connections.forEach((conn) => {
        expect(mgr.getClient(conn.id)).toBeUndefined();
      });
    });
  });

  describe('Data Integrity Tests', () => {
    test('maintains data consistency after many operations', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      // Add connections
      const connections: WeaviateConnection[] = [];
      for (let i = 0; i < 10; i++) {
        const conn = await mgr.addConnection({
          name: `Data Integrity ${i}`,
          type: i % 2 === 0 ? 'custom' : 'cloud',
          httpHost: i % 2 === 0 ? 'localhost' : undefined,
          httpPort: i % 2 === 0 ? 8080 + i : undefined,
          grpcHost: i % 2 === 0 ? 'localhost' : undefined,
          grpcPort: i % 2 === 0 ? 50051 + i : undefined,
          httpSecure: false,
          grpcSecure: false,
          cloudUrl: i % 2 === 1 ? `https://cloud${i}.weaviate.cloud` : undefined,
          apiKey: `api-key-${i}`,
        });
        connections.push(conn);
      }

      // Update some connections
      for (let i = 0; i < 5; i++) {
        await mgr.updateConnection(connections[i].id, {
          name: `Updated ${connections[i].name}`,
        });
      }

      // Delete some connections
      for (let i = 5; i < 7; i++) {
        await mgr.deleteConnection(connections[i].id);
      }

      const remainingConnections = mgr.getConnections();

      expect(remainingConnections).toHaveLength(8); // 10 - 2 deleted

      // Check updated connections
      for (let i = 0; i < 5; i++) {
        const conn = remainingConnections.find((c) => c.id === connections[i].id);
        expect(conn?.name).toContain('Updated');
      }

      // Check deleted connections are gone
      for (let i = 5; i < 7; i++) {
        const conn = remainingConnections.find((c) => c.id === connections[i].id);
        expect(conn).toBeUndefined();
      }

      // Check remaining connections are intact
      for (let i = 7; i < 10; i++) {
        const conn = remainingConnections.find((c) => c.id === connections[i].id);
        expect(conn).toBeDefined();
        expect(conn?.name).toBe(`Data Integrity ${i}`);
      }
    });

    test('preserves connection order after operations', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(3000)
        .mockReturnValueOnce(4000); // For update operation

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

      const conn3 = await mgr.addConnection({
        name: 'Third',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8082,
        grpcHost: 'localhost',
        grpcPort: 50053,
        httpSecure: false,
        grpcSecure: false,
      });

      let connections = mgr.getConnections();
      expect(connections.map((c) => c.name)).toEqual(['Third', 'Second', 'First']);

      // Update first connection (should move to top)
      await mgr.updateConnection(conn1.id, { name: 'First Updated' });

      connections = mgr.getConnections();
      expect(connections.map((c) => c.name)).toEqual(['First Updated', 'Third', 'Second']);
    });

    test('handles storage persistence correctly', async () => {
      let mgr = ConnectionManager.getInstance(mockContext);

      const conn1 = await mgr.addConnection({
        name: 'Persistent Connection',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      // Verify it's stored
      expect(globalState.storage['weaviate-connections']).toContainEqual(
        expect.objectContaining({
          id: conn1.id,
          name: 'Persistent Connection',
        })
      );

      // Reset singleton and create new instance (simulating restart)
      (ConnectionManager as any).instance = undefined;
      mgr = ConnectionManager.getInstance(mockContext);

      const loadedConnections = mgr.getConnections();
      expect(loadedConnections).toHaveLength(1);
      expect(loadedConnections[0].name).toBe('Persistent Connection');
      expect(loadedConnections[0].status).toBe('disconnected'); // Should be reset
    });
  });

  describe('Memory Management Tests', () => {
    test('properly cleans up clients on disconnect', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };

      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Memory Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      // Connect
      await mgr.connect(conn.id);
      expect(mgr.getClient(conn.id)).toBeDefined();

      // Disconnect
      await mgr.disconnect(conn.id);
      expect(mgr.getClient(conn.id)).toBeUndefined();

      // Reconnect to ensure it works after cleanup
      await mgr.connect(conn.id);
      expect(mgr.getClient(conn.id)).toBeDefined();
    });

    test('cleans up clients on connection deletion', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);
      const mockClient = { isReady: jest.fn().mockResolvedValue(true) };

      jest.spyOn(weaviateClient, 'connectToCustom').mockResolvedValue(mockClient as any);

      const conn = await mgr.addConnection({
        name: 'Delete Memory Test',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
      });

      // Connect
      await mgr.connect(conn.id);
      expect(mgr.getClient(conn.id)).toBeDefined();

      // Delete connection
      await mgr.deleteConnection(conn.id);
      expect(mgr.getClient(conn.id)).toBeUndefined();
      expect(mgr.getConnection(conn.id)).toBeUndefined();
    });
  });

  describe('Edge Case Integration Tests', () => {
    test('handles rapid add/delete operations', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      for (let i = 0; i < 10; i++) {
        const conn = await mgr.addConnection({
          name: `Rapid ${i}`,
          type: 'custom',
          httpHost: 'localhost',
          httpPort: 8080 + i,
          grpcHost: 'localhost',
          grpcPort: 50051 + i,
          httpSecure: false,
          grpcSecure: false,
        });

        // Immediately delete
        const deleted = await mgr.deleteConnection(conn.id);
        expect(deleted).toBe(true);
      }

      expect(mgr.getConnections()).toHaveLength(0);
    });

    test('handles connection with all optional fields undefined', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Minimal Connection',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        // All optional fields omitted
      });

      expect(conn.apiKey).toBeUndefined();
      expect(conn.timeoutInit).toBeUndefined();
      expect(conn.timeoutQuery).toBeUndefined();
      expect(conn.timeoutInsert).toBeUndefined();
      expect(conn.connectionVersion).toBe(ConnectionManager['currentVersion']);
    });

    test('handles connection with extreme timeout values', async () => {
      const mgr = ConnectionManager.getInstance(mockContext);

      const conn = await mgr.addConnection({
        name: 'Extreme Timeouts',
        type: 'custom',
        httpHost: 'localhost',
        httpPort: 8080,
        grpcHost: 'localhost',
        grpcPort: 50051,
        httpSecure: false,
        grpcSecure: false,
        timeoutInit: 0,
        timeoutQuery: 999999,
        timeoutInsert: -1,
      });

      expect(conn.timeoutInit).toBe(0);
      expect(conn.timeoutQuery).toBe(999999);
      expect(conn.timeoutInsert).toBe(-1);
    });
  });
});
