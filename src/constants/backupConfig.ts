export const BACKUP_CONFIG = {
  CPU_PERCENTAGE: {
    MIN: 1,
    MAX: 80,
    DEFAULT: 80,
  },
  CHUNK_SIZE: {
    MIN: 2,
    MAX: 512,
    DEFAULT: 128,
  },
  REFRESH_INTERVAL: {
    MIN: 1,
    MAX: 60,
    DEFAULT: 5,
  },
  COMPRESSION_LEVELS: ['DefaultCompression', 'BestSpeed', 'BestCompression'] as const,
} as const;
