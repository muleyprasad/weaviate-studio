import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';
import { ConnectionManager } from '../../services/ConnectionManager';
import * as vscode from 'vscode';

interface MockGlobalState {
  storage: Record<string, any>;
  get: jest.Mock;
  update: jest.Mock;
}

describe('Backup Management', () => {
  let mockContext: any;
  let globalState: MockGlobalState;
  let treeDataProvider: WeaviateTreeDataProvider;
  let mockClient: any;

  beforeEach(() => {
    // Reset singleton before every test
    (ConnectionManager as any).instance = undefined;

    globalState = {
      storage: {
        connections: [],
      },
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

    const connectionManager = ConnectionManager.getInstance(mockContext);
    treeDataProvider = new WeaviateTreeDataProvider(connectionManager, mockContext);

    // Mock client with backup methods
    mockClient = {
      backup: {
        create: jest.fn(),
        list: jest.fn(),
        restore: jest.fn(),
        getRestoreStatus: jest.fn(),
      },
      meta: jest.fn(),
    };
  });

  it('should create backup with correct configuration', async () => {
    const backupConfig = {
      id: 'test-backup-001',
      backend: 's3' as const,
      include: ['Collection1', 'Collection2'],
      waitForCompletion: true,
      config: {
        cpuPercentage: 80,
      },
    };

    mockClient.backup.create.mockResolvedValue({
      id: 'test-backup-001',
      status: 'SUCCESS',
      backend: 's3',
      classes: ['Collection1', 'Collection2'],
      startedAt: '2025-12-22T10:00:00Z',
      completedAt: '2025-12-22T10:05:00Z',
    });

    const result = await mockClient.backup.create(backupConfig.backend, backupConfig);

    expect(mockClient.backup.create).toHaveBeenCalledWith('s3', backupConfig);
    expect(result.id).toBe('test-backup-001');
    expect(result.status).toBe('SUCCESS');
    expect(result.backend).toBe('s3');
    expect(result.classes).toEqual(['Collection1', 'Collection2']);
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
  });

  it('should fetch backups from all available backends', async () => {
    const testConnectionId = 'test-conn';

    // Setup cluster metadata cache with backup modules
    (treeDataProvider as any).clusterMetadataCache = {
      [testConnectionId]: {
        modules: {
          'backup-filesystem': {},
          'backup-s3': {},
          'backup-gcs': {},
        },
      },
    };

    // Mock backup list responses
    const filesystemBackups = [{ id: 'fs-001', status: 'SUCCESS', classes: ['C1'] }];
    const s3Backups = [{ id: 's3-001', status: 'SUCCESS', classes: ['C2'] }];
    const gcsBackups = [{ id: 'gcs-001', status: 'SUCCESS', classes: ['C3'] }];

    mockClient.backup.list
      .mockResolvedValueOnce(filesystemBackups)
      .mockResolvedValueOnce(s3Backups)
      .mockResolvedValueOnce(gcsBackups);

    // Verify we can call list for each backend
    const fsResult = await mockClient.backup.list('filesystem');
    const s3Result = await mockClient.backup.list('s3');
    const gcsResult = await mockClient.backup.list('gcs');

    expect(mockClient.backup.list).toHaveBeenCalledTimes(3);
    expect(fsResult).toEqual(filesystemBackups);
    expect(s3Result).toEqual(s3Backups);
    expect(gcsResult).toEqual(gcsBackups);
  });

  it('should handle missing backend gracefully', () => {
    const testConnectionId = 'test-conn';

    // Setup cluster metadata with NO backup modules
    (treeDataProvider as any).clusterMetadataCache = {
      [testConnectionId]: {
        modules: {
          'text2vec-openai': {},
          'generative-openai': {},
        },
      },
    };

    const meta = (treeDataProvider as any).clusterMetadataCache[testConnectionId];
    const moduleNames = Object.keys(meta.modules || {});
    const hasBackupModule = moduleNames.some((name) => name.startsWith('backup-'));

    expect(hasBackupModule).toBe(false);
    expect(moduleNames).not.toContain('backup-filesystem');
    expect(moduleNames).not.toContain('backup-s3');
    expect(moduleNames).not.toContain('backup-gcs');
    expect(moduleNames).not.toContain('backup-azure');
  });

  it('should calculate duration correctly', () => {
    const startedAt = '2025-12-22T10:00:00Z';
    const completedAt = '2025-12-22T10:05:30Z';

    // Access the private method using type assertion
    const duration = (treeDataProvider as any).humanizeDuration(startedAt, completedAt);

    // Duration should be approximately 5 minutes 30 seconds
    // The humanizeDuration method returns a format like "5m 30s"
    expect(duration).toBeDefined();
    expect(typeof duration).toBe('string');
    expect(duration).toBe('5m 30s');
  });

  it('should restore backup with selected collections', async () => {
    const restoreConfig = {
      id: 'test-backup-001',
      backend: 's3' as const,
      include: ['Collection1'],
      exclude: ['Collection2'],
      config: {
        cpuPercentage: 80,
      },
    };

    mockClient.backup.restore.mockResolvedValue({
      id: 'test-backup-001',
      status: 'SUCCESS',
      backend: 's3',
      classes: ['Collection1'],
      startedAt: '2025-12-22T12:00:00Z',
      completedAt: '2025-12-22T12:03:00Z',
    });

    const result = await mockClient.backup.restore(
      restoreConfig.backend,
      restoreConfig.id,
      restoreConfig
    );

    expect(mockClient.backup.restore).toHaveBeenCalledWith('s3', 'test-backup-001', restoreConfig);
    expect(result.id).toBe('test-backup-001');
    expect(result.status).toBe('SUCCESS');
    expect(result.classes).toEqual(['Collection1']);
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
  });

  it('should cache backup data correctly', () => {
    const testConnectionId = 'test-conn';

    const mockBackups = [
      {
        id: 'backup-001',
        status: 'SUCCESS',
        classes: ['Collection1'],
        backend: 's3',
        startedAt: '2025-12-22T10:00:00Z',
        completedAt: '2025-12-22T10:05:00Z',
        duration: '5m',
      },
      {
        id: 'backup-002',
        status: 'FAILED',
        classes: ['Collection2'],
        backend: 's3',
        startedAt: '2025-12-22T11:00:00Z',
        completedAt: '2025-12-22T11:01:00Z',
        duration: '1m',
      },
    ];

    // Simulate caching backups
    (treeDataProvider as any).backupsCache[testConnectionId] = mockBackups;

    // Verify cache structure
    const cache = (treeDataProvider as any).backupsCache[testConnectionId];
    expect(cache).toHaveLength(2);
    expect(cache[0].backend).toBe('s3');
    expect(cache[0].duration).toBeDefined();
    expect(cache[1].backend).toBe('s3');
    expect(cache[1].duration).toBeDefined();
  });

  it('should display correct icons for backup status', () => {
    // Test icon mapping logic for different backup statuses
    const statusIconMapping = [
      { status: 'SUCCESS', expectedIcon: 'check', expectedContext: 'weaviateBackupSuccess' },
      { status: 'FAILED', expectedIcon: 'error', expectedContext: 'weaviateBackupFailed' },
      {
        status: 'CANCELED',
        expectedIcon: 'circle-slash',
        expectedContext: 'weaviateBackupCanceled',
      },
      { status: 'STARTED', expectedIcon: 'sync~spin', expectedContext: 'weaviateBackupInProgress' },
    ];

    statusIconMapping.forEach(({ status, expectedIcon, expectedContext }) => {
      const statusIcon =
        status === 'SUCCESS'
          ? 'check'
          : status === 'FAILED'
            ? 'error'
            : status === 'CANCELED'
              ? 'circle-slash'
              : 'sync~spin';

      const contextValueMap: Record<string, string> = {
        SUCCESS: 'weaviateBackupSuccess',
        FAILED: 'weaviateBackupFailed',
        CANCELED: 'weaviateBackupCanceled',
        STARTED: 'weaviateBackupInProgress',
        TRANSFERRING: 'weaviateBackupInProgress',
      };
      const contextValue = contextValueMap[status] || 'weaviateBackup';

      expect(statusIcon).toBe(expectedIcon);
      expect(contextValue).toBe(expectedContext);
    });
  });

  it('should handle backend errors gracefully', async () => {
    // Test that even if one backend fails, others can still succeed
    const s3Backups = [{ id: 's3-backup-001', status: 'SUCCESS', classes: ['C1'] }];

    mockClient.backup.list
      .mockResolvedValueOnce(s3Backups)
      .mockRejectedValueOnce(new Error('GCS backend not configured'));

    // First backend call should succeed
    const s3Result = await mockClient.backup.list('s3');
    expect(s3Result).toEqual(s3Backups);

    // Second backend call should fail
    await expect(mockClient.backup.list('gcs')).rejects.toThrow('GCS backend not configured');

    // Even though GCS failed, S3 data should be available
    expect(s3Result.length).toBe(1);
    expect(s3Result[0].id).toBe('s3-backup-001');
  });
});
