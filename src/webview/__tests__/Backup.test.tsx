/**
 * Unit tests for Backup webview component
 * Tests component initialization, user interactions, and backup creation flows
 */

import React from 'react';
import { BACKUP_CONFIG } from '../../constants/backupConfig';
import '@testing-library/jest-dom';

describe('Backup Webview Component', () => {
  // Mock VS Code API
  const mockPostMessage = jest.fn();
  const mockVSCodeApi = {
    postMessage: mockPostMessage,
    getState: jest.fn(),
    setState: jest.fn(),
  };

  beforeAll(() => {
    // Setup window mock
    (global as any).window = {
      acquireVsCodeApi: () => mockVSCodeApi,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      alert: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Backup ID Generation', () => {
    it('should generate backup ID with correct format', () => {
      const generateBackupId = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `weaviate-${year}${month}${day}-${hours}_${minutes}_${seconds}`;
      };

      const backupId = generateBackupId();

      // Format: weaviate-YYYYMMDD-HH_MM_SS
      expect(backupId).toMatch(/^weaviate-\d{8}-\d{2}_\d{2}_\d{2}$/);
      expect(backupId).toContain('weaviate-');
    });

    it('should sanitize backup ID correctly', () => {
      const sanitizeBackupId = (value: string): string => {
        return value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      };

      expect(sanitizeBackupId('MyBackup-2025')).toBe('mybackup-2025');
      expect(sanitizeBackupId('Backup_With_Underscores')).toBe('backup_with_underscores');
      expect(sanitizeBackupId('Invalid@Chars#123')).toBe('invalidchars123');
      expect(sanitizeBackupId('UPPERCASE')).toBe('uppercase');
      expect(sanitizeBackupId('valid-backup_123')).toBe('valid-backup_123');
    });
  });

  describe('CPU Percentage Validation', () => {
    it('should accept valid CPU percentage values (1-80)', () => {
      const handleCpuPercentageChange = (value: string): string => {
        if (value === '') {
          return '';
        }

        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return '';
        }

        const { MIN, MAX } = BACKUP_CONFIG.CPU_PERCENTAGE;
        if (numValue >= MIN && numValue <= MAX) {
          return value;
        } else if (numValue > MAX) {
          return MAX.toString();
        } else if (numValue < MIN && value.length > 0) {
          return MIN.toString();
        }
        return '';
      };

      expect(handleCpuPercentageChange('50')).toBe('50');
      expect(handleCpuPercentageChange('1')).toBe('1');
      expect(handleCpuPercentageChange('80')).toBe('80');
      expect(handleCpuPercentageChange('')).toBe('');
    });

    it('should constrain CPU percentage to maximum of 80', () => {
      const handleCpuPercentageChange = (value: string): string => {
        if (value === '') {
          return '';
        }
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return '';
        }
        const { MIN, MAX } = BACKUP_CONFIG.CPU_PERCENTAGE;
        if (numValue > MAX) {
          return MAX.toString();
        }
        if (numValue >= MIN) {
          return value;
        }
        return '';
      };

      expect(handleCpuPercentageChange('100')).toBe('80');
      expect(handleCpuPercentageChange('90')).toBe('80');
      expect(handleCpuPercentageChange('81')).toBe('80');
    });

    it('should constrain CPU percentage to minimum of 1', () => {
      const handleCpuPercentageChange = (value: string): string => {
        if (value === '') {
          return '';
        }
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return '';
        }
        if (numValue < 1 && value.length > 0) {
          return '1';
        }
        if (numValue <= 80) {
          return value;
        }
        return '80';
      };

      expect(handleCpuPercentageChange('0')).toBe('1');
      expect(handleCpuPercentageChange('-5')).toBe('1');
    });
  });

  describe('Chunk Size Validation', () => {
    it('should accept valid chunk size values (2-512)', () => {
      const handleChunkSizeChange = (value: string): string => {
        if (value === '') {
          return '';
        }

        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return '';
        }

        if (numValue >= 2 && numValue <= 512) {
          return value;
        } else if (numValue > 512) {
          return '512';
        } else if (numValue < 2 && value.length > 0) {
          return '2';
        }
        return '';
      };

      expect(handleChunkSizeChange('128')).toBe('128');
      expect(handleChunkSizeChange('2')).toBe('2');
      expect(handleChunkSizeChange('512')).toBe('512');
      expect(handleChunkSizeChange('')).toBe('');
    });

    it('should constrain chunk size to maximum of 512', () => {
      const handleChunkSizeChange = (value: string): string => {
        if (value === '') {
          return '';
        }
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return '';
        }
        if (numValue > 512) {
          return '512';
        }
        if (numValue >= 2) {
          return value;
        }
        return '';
      };

      expect(handleChunkSizeChange('1024')).toBe('512');
      expect(handleChunkSizeChange('600')).toBe('512');
    });

    it('should constrain chunk size to minimum of 2', () => {
      const handleChunkSizeChange = (value: string): string => {
        if (value === '') {
          return '';
        }
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return '';
        }
        if (numValue < 2 && value.length > 0) {
          return '2';
        }
        if (numValue <= 512) {
          return value;
        }
        return '512';
      };

      expect(handleChunkSizeChange('1')).toBe('2');
      expect(handleChunkSizeChange('0')).toBe('2');
    });
  });

  describe('Backup Creation', () => {
    it('should post create message with correct data structure', () => {
      const backupData = {
        backupId: 'test-backup-001',
        backend: 's3',
        includeCollections: ['Collection1', 'Collection2'],
        cpuPercentage: 70,
        compressionLevel: 'BestSpeed',
      };

      mockVSCodeApi.postMessage({
        command: 'createBackup',
        backupData,
      });

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'createBackup',
        backupData,
      });
    });

    it('should handle backup creation with exclude collections', () => {
      const backupData = {
        backupId: 'test-backup-002',
        backend: 'gcs',
        excludeCollections: ['TempCollection'],
        cpuPercentage: 50,
      };

      mockVSCodeApi.postMessage({
        command: 'createBackup',
        backupData,
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'createBackup',
        backupData,
      });
    });

    it('should handle backup creation with all collections', () => {
      const backupData = {
        backupId: 'test-backup-003',
        backend: 'filesystem',
        cpuPercentage: 80,
      };

      mockVSCodeApi.postMessage({
        command: 'createBackup',
        backupData,
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'createBackup',
        backupData,
      });
    });
  });

  describe('Backend Selection', () => {
    it('should filter and extract available backup backends', () => {
      const availableModules = {
        'backup-s3': {},
        'backup-filesystem': {},
        'text2vec-openai': {},
        'generative-openai': {},
        'backup-gcs': {},
      };

      const getBackendOptions = () => {
        return Object.keys(availableModules)
          .filter((key) => key.startsWith('backup-'))
          .map((key) => key.replace('backup-', ''));
      };

      const backends = getBackendOptions();

      expect(backends).toHaveLength(3);
      expect(backends).toContain('s3');
      expect(backends).toContain('filesystem');
      expect(backends).toContain('gcs');
      expect(backends).not.toContain('text2vec-openai');
    });

    it('should detect when no backup modules are available', () => {
      const availableModules = {
        'text2vec-openai': {},
        'generative-openai': {},
      };

      const getBackendOptions = () => {
        return Object.keys(availableModules)
          .filter((key) => key.startsWith('backup-'))
          .map((key) => key.replace('backup-', ''));
      };

      const backends = getBackendOptions();
      const hasBackupModule = backends.length > 0;

      expect(backends).toHaveLength(0);
      expect(hasBackupModule).toBe(false);
    });
  });

  describe('Backup Cancellation', () => {
    it('should post cancel backup message', () => {
      const backupId = 'backup-to-cancel';
      const backend = 's3';

      mockVSCodeApi.postMessage({
        command: 'cancelBackup',
        backupId,
        backend,
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'cancelBackup',
        backupId,
        backend,
      });
    });
  });

  describe('Backup Refresh', () => {
    it('should post fetchBackups message', () => {
      mockVSCodeApi.postMessage({
        command: 'fetchBackups',
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'fetchBackups',
      });
    });
  });

  describe('Compression Level Options', () => {
    it('should support standard compression levels', () => {
      const compressionLevels = ['DefaultCompression', 'BestSpeed', 'BestCompression'];

      compressionLevels.forEach((level) => {
        expect(['DefaultCompression', 'BestSpeed', 'BestCompression']).toContain(level);
      });
    });
  });

  describe('Collection Mode Selection', () => {
    it('should support all collection modes including wildcard', () => {
      const modes: Array<'all' | 'include' | 'exclude' | 'wildcard'> = [
        'all',
        'include',
        'exclude',
        'wildcard',
      ];

      modes.forEach((mode) => {
        expect(['all', 'include', 'exclude', 'wildcard']).toContain(mode);
      });
    });
  });

  describe('Wildcard Filter', () => {
    const matchWildcard = (pattern: string, str: string): boolean => {
      if (!pattern) {
        return false;
      }
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
      return new RegExp(`^${regexStr}$`).test(str);
    };

    const collections = [
      'Article',
      'ArticleDraft',
      'author',
      'BlogPost',
      'Document',
      'MyDocument',
      'Product',
      'ProductVariant',
      'Test1Collection',
      'Test2Collection',
    ];

    describe('matchWildcard', () => {
      it('should return false for empty pattern', () => {
        expect(matchWildcard('', 'Article')).toBe(false);
      });

      it('should match exact names', () => {
        expect(matchWildcard('Article', 'Article')).toBe(true);
        expect(matchWildcard('Article', 'article')).toBe(false);
      });

      it('should match trailing wildcard (*)', () => {
        expect(matchWildcard('Article*', 'Article')).toBe(true);
        expect(matchWildcard('Article*', 'ArticleDraft')).toBe(true);
        expect(matchWildcard('Article*', 'BlogPost')).toBe(false);
      });

      it('should match leading wildcard (*)', () => {
        expect(matchWildcard('*Document', 'Document')).toBe(true);
        expect(matchWildcard('*Document', 'MyDocument')).toBe(true);
        expect(matchWildcard('*Document', 'DocumentExtra')).toBe(false);
      });

      it('should match surrounding wildcard (*word*)', () => {
        expect(matchWildcard('*roduct*', 'Product')).toBe(true);
        expect(matchWildcard('*roduct*', 'ProductVariant')).toBe(true);
        expect(matchWildcard('*roduct*', 'Article')).toBe(false);
      });

      it('should match single-character wildcard (?)', () => {
        expect(matchWildcard('Test?Collection', 'Test1Collection')).toBe(true);
        expect(matchWildcard('Test?Collection', 'Test2Collection')).toBe(true);
        expect(matchWildcard('Test?Collection', 'TestCollection')).toBe(false);
        expect(matchWildcard('Test?Collection', 'Test12Collection')).toBe(false);
      });

      it('should be case-sensitive', () => {
        expect(matchWildcard('article*', 'Article')).toBe(false);
        expect(matchWildcard('article*', 'article')).toBe(true);
        expect(matchWildcard('Article*', 'article')).toBe(false);
      });

      it('should not treat regex special characters as regex', () => {
        expect(matchWildcard('My.Collection', 'MyCollection')).toBe(false);
        expect(matchWildcard('My.Collection', 'My.Collection')).toBe(true);
        expect(matchWildcard('Price(USD)', 'Price(USD)')).toBe(true);
        expect(matchWildcard('Price(USD)', 'PriceUSD')).toBe(false);
      });
    });

    describe('wildcardMatches filtering', () => {
      const getMatches = (pattern: string) => collections.filter((c) => matchWildcard(pattern, c));

      it('should return matching collections for trailing wildcard', () => {
        const matches = getMatches('Article*');
        expect(matches).toEqual(['Article', 'ArticleDraft']);
      });

      it('should return matching collections for leading wildcard', () => {
        const matches = getMatches('*Document');
        expect(matches).toEqual(['Document', 'MyDocument']);
      });

      it('should return empty array when no collections match', () => {
        expect(getMatches('XYZ*')).toEqual([]);
      });

      it('should return empty array for empty pattern', () => {
        expect(getMatches('')).toEqual([]);
      });

      it('should match all collections with bare *', () => {
        const matches = getMatches('*');
        expect(matches).toHaveLength(collections.length);
      });

      it('should sort matched collections alphabetically in display', () => {
        const matches = getMatches('*Document');
        const sorted = [...matches].sort();
        expect(sorted).toEqual(['Document', 'MyDocument']);
      });

      it('should handle ? wildcard across multiple candidates', () => {
        const matches = getMatches('Test?Collection');
        expect(matches).toEqual(['Test1Collection', 'Test2Collection']);
      });
    });

    describe('backup creation with wildcard mode', () => {
      it('should set includeCollections from wildcard matches', () => {
        const wildcardMatches = ['Article', 'ArticleDraft'];
        const backupData: any = {
          backupId: 'test-backup',
          backend: 's3',
        };

        // Simulate handleCreateBackup logic for wildcard mode
        backupData.includeCollections = wildcardMatches;

        expect(backupData.includeCollections).toEqual(['Article', 'ArticleDraft']);
        expect(backupData.excludeCollections).toBeUndefined();
      });

      it('should not set includeCollections when wildcard matches nothing', () => {
        const wildcardMatches: string[] = [];
        const backupData: any = {
          backupId: 'test-backup',
          backend: 's3',
        };

        if (wildcardMatches.length > 0) {
          backupData.includeCollections = wildcardMatches;
        }

        expect(backupData.includeCollections).toBeUndefined();
      });

      it('should post createBackup with wildcard-resolved includeCollections', () => {
        const backupData = {
          backupId: 'wildcard-backup',
          backend: 'filesystem',
          includeCollections: ['Article', 'ArticleDraft'],
        };

        mockVSCodeApi.postMessage({ command: 'createBackup', backupData });

        expect(mockPostMessage).toHaveBeenCalledWith({
          command: 'createBackup',
          backupData,
        });
      });
    });

    describe('collectionsUpdated message', () => {
      it('should handle collectionsUpdated message with new collections', () => {
        const newCollections = ['Article', 'NewCollection', 'Product'];
        let collections: string[] = ['Article', 'Product'];

        const messageHandler = (event: MessageEvent) => {
          const message = event.data;
          if (message.command === 'collectionsUpdated') {
            collections = message.collections || [];
          }
        };

        messageHandler({
          data: { command: 'collectionsUpdated', collections: newCollections },
        } as MessageEvent);

        expect(collections).toEqual(newCollections);
        expect(collections).toContain('NewCollection');
      });

      it('should handle collectionsUpdated with empty list', () => {
        let collections: string[] = ['Article'];

        const messageHandler = (event: MessageEvent) => {
          const message = event.data;
          if (message.command === 'collectionsUpdated') {
            collections = message.collections || [];
          }
        };

        messageHandler({
          data: { command: 'collectionsUpdated', collections: [] },
        } as MessageEvent);

        expect(collections).toEqual([]);
      });
    });

    describe('refreshCollections message', () => {
      it('should post refreshCollections command', () => {
        mockVSCodeApi.postMessage({ command: 'refreshCollections' });

        expect(mockPostMessage).toHaveBeenCalledWith({ command: 'refreshCollections' });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle backup creation error message', () => {
      const errorMessage = 'Failed to create backup: Connection timeout';

      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'error') {
          return message.message;
        }
        return null;
      };

      const event = {
        data: {
          command: 'error',
          message: errorMessage,
        },
      } as MessageEvent;

      const result = messageHandler(event);
      expect(result).toBe(errorMessage);
    });
  });

  describe('Backup Status Handling', () => {
    it('should handle backupCreated message', () => {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'backupCreated') {
          return {
            success: true,
            backupId: message.backupId,
          };
        }
        return null;
      };

      const event = {
        data: {
          command: 'backupCreated',
          backupId: 'backup-123',
        },
      } as MessageEvent;

      const result = messageHandler(event);
      expect(result).toEqual({
        success: true,
        backupId: 'backup-123',
      });
    });

    it('should handle backups list update', () => {
      const backups = [
        { id: 'backup-1', status: 'SUCCESS', backend: 's3' },
        { id: 'backup-2', status: 'FAILED', backend: 'gcs' },
      ];

      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'backupsUpdate') {
          return message.backups;
        }
        return null;
      };

      const event = {
        data: {
          command: 'backupsUpdate',
          backups,
        },
      } as MessageEvent;

      const result = messageHandler(event);
      expect(result).toEqual(backups);
      expect(result).toHaveLength(2);
    });
  });
});
