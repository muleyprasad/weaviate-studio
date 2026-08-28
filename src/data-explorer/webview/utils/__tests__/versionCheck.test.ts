import {
  parseVersion,
  compareVersions,
  isVersionAtLeast,
  supportsQueryProfiling,
  supportsMultiTargetNear,
  supportsMultiTargetHybrid,
  supportsMUVERA,
  supportsMMR,
} from '../versionCheck';

describe('versionCheck', () => {
  describe('parseVersion', () => {
    test('parses standard version', () => {
      expect(parseVersion('1.36.9')).toEqual([1, 36, 9]);
    });

    test('parses version with v prefix', () => {
      expect(parseVersion('v1.37.0')).toEqual([1, 37, 0]);
    });

    test('parses version with pre-release suffix', () => {
      expect(parseVersion('1.38.0-rc1')).toEqual([1, 38, 0]);
    });

    test('throws for invalid version', () => {
      expect(() => parseVersion('invalid')).toThrow();
      expect(() => parseVersion('')).toThrow();
    });
  });

  describe('compareVersions', () => {
    test('equal versions', () => {
      expect(compareVersions([1, 36, 9], [1, 36, 9])).toBe(0);
    });

    test('less than', () => {
      expect(compareVersions([1, 36, 8], [1, 36, 9])).toBe(-1);
      expect(compareVersions([1, 35, 0], [1, 36, 0])).toBe(-1);
    });

    test('greater than', () => {
      expect(compareVersions([1, 37, 0], [1, 36, 9])).toBe(1);
      expect(compareVersions([2, 0, 0], [1, 99, 99])).toBe(1);
    });
  });

  describe('supportsQueryProfiling', () => {
    test('returns true for 1.36.9', () => {
      expect(supportsQueryProfiling('1.36.9')).toBe(true);
    });

    test('returns true for versions above 1.36.9', () => {
      expect(supportsQueryProfiling('1.37.0')).toBe(true);
      expect(supportsQueryProfiling('1.38.0')).toBe(true);
      expect(supportsQueryProfiling('2.0.0')).toBe(true);
    });

    test('returns false for versions below 1.36.9', () => {
      expect(supportsQueryProfiling('1.36.8')).toBe(false);
      expect(supportsQueryProfiling('1.35.0')).toBe(false);
      expect(supportsQueryProfiling('1.30.0')).toBe(false);
    });

    test('returns false for invalid version', () => {
      expect(supportsQueryProfiling('invalid')).toBe(false);
    });
  });

  describe('supportsMMR', () => {
    test('returns true for 1.39.0', () => {
      expect(supportsMMR('1.39.0')).toBe(true);
    });

    test('returns true for versions above 1.39.0', () => {
      expect(supportsMMR('1.39.1')).toBe(true);
      expect(supportsMMR('1.40.0')).toBe(true);
      expect(supportsMMR('2.0.0')).toBe(true);
    });

    test('returns false for versions below 1.39.0', () => {
      expect(supportsMMR('1.38.9')).toBe(false);
      expect(supportsMMR('1.36.9')).toBe(false);
      expect(supportsMMR('1.31.0')).toBe(false);
    });

    test('returns false for invalid version', () => {
      expect(supportsMMR('invalid')).toBe(false);
    });

    test('handles v-prefixed versions', () => {
      expect(supportsMMR('v1.39.0')).toBe(true);
      expect(supportsMMR('v1.38.0')).toBe(false);
    });
  });

  describe('existing version checks still work', () => {
    test('supportsMultiTargetNear', () => {
      expect(supportsMultiTargetNear('1.26.0')).toBe(true);
      expect(supportsMultiTargetNear('1.25.0')).toBe(false);
    });

    test('supportsMultiTargetHybrid', () => {
      expect(supportsMultiTargetHybrid('1.27.0')).toBe(true);
      expect(supportsMultiTargetHybrid('1.26.0')).toBe(false);
    });

    test('supportsMUVERA', () => {
      expect(supportsMUVERA('1.31.0')).toBe(true);
      expect(supportsMUVERA('1.30.0')).toBe(false);
    });
  });
});
