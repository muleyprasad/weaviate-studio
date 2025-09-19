import { ConnectionManager } from '../ConnectionManager';
import * as weaviateClient from 'weaviate-client';

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

    const connection = await mgr.addConnection({
      name: 'Local',
      httpHost: 'localhost',
      apiKey: 'xyz',
      httpPort: 8080,
      grpcHost: 'localhost',
      grpcPort: 50051,
      grpcSecure: false,
      httpSecure: false
    });

    expect(connection).toMatchObject({
      id: '1',
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
      httpSecure: false
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
        httpSecure: false
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
      { name: 'Good', httpHost: 'localhost', apiKey: '', httpPort: 8080, grpcHost: 'localhost', grpcPort: 50051, grpcSecure: false, httpSecure: false }
    );

    const updated = await mgr.connect(conn.id);
    expect(updated?.status).toBe('connected');
    expect(mgr.getClient(conn.id)).toBeDefined();
  });

  test('handles connection failure gracefully', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({ name: 'Fail', httpHost: 'fail', apiKey: '', httpPort: 8080, grpcHost: 'localhost', grpcPort: 50051, grpcSecure: false, httpSecure: false });

    // Force weaviate client to throw for this test
    jest
      .spyOn(weaviateClient as any, 'client')
      .mockImplementationOnce(() => {
        throw new Error('Cannot connect');
      });

    const result = await mgr.connect(conn.id);
    expect(result).toBeNull();
    expect(mgr.getClient(conn.id)).toBeUndefined();
  });

  test('disconnects a connection', async () => {
    const mgr = ConnectionManager.getInstance(mockContext);

    const conn = await mgr.addConnection({ name: 'Disc', httpHost: 'localhost', apiKey: '', httpPort: 8080, grpcHost: 'localhost', grpcPort: 50051, grpcSecure: false, httpSecure: false });
    await mgr.connect(conn.id);

    const success = await mgr.disconnect(conn.id);
    expect(success).toBe(true);

    const after = mgr.getConnection(conn.id);
    expect(after?.status).toBe('disconnected');
    expect(mgr.getClient(conn.id)).toBeUndefined();
  });
}); 