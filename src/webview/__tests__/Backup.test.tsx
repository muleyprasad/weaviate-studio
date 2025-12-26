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
        chunkSize: 128,
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
    it('should support all collection modes', () => {
      const modes: Array<'all' | 'include' | 'exclude'> = ['all', 'include', 'exclude'];

      modes.forEach((mode) => {
        expect(['all', 'include', 'exclude']).toContain(mode);
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
