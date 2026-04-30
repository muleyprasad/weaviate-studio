/**
 * Version checking utilities for feature gating multi-target vector search
 * Multi-target support was introduced incrementally across Weaviate releases
 */

// Minimum version requirements for multi-target features
export const MULTI_TARGET_NEAR_MIN = '1.26.0';
export const MULTI_TARGET_HYBRID_MIN = '1.27.0';
export const MUVERA_MIN = '1.31.0';

/**
 * Parse a semantic version string into [major, minor, patch]
 * @param versionStr - Version string like "1.26.0" or "v1.26.0-rc1"
 * @returns [major, minor, patch] tuple
 * @throws If version string is invalid
 */
export function parseVersion(versionStr: string): [number, number, number] {
  // Remove leading 'v' if present
  const cleaned = versionStr.startsWith('v') ? versionStr.slice(1) : versionStr;

  // Extract major.minor.patch (ignore pre-release/build metadata)
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version string: ${versionStr}`);
  }

  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Compare two semantic versions
 * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
export function compareVersions(
  version1: [number, number, number],
  version2: [number, number, number]
): -1 | 0 | 1 {
  for (let i = 0; i < 3; i++) {
    if (version1[i] < version2[i]) {
      return -1;
    }
    if (version1[i] > version2[i]) {
      return 1;
    }
  }
  return 0;
}

/**
 * Check if a version is at least the required version
 * @param versionStr - Version string (e.g., "1.26.0")
 * @param major - Required major version
 * @param minor - Required minor version
 * @param patch - Required patch version (optional, defaults to 0)
 */
export function isVersionAtLeast(
  versionStr: string,
  major: number,
  minor: number,
  patch: number = 0
): boolean {
  try {
    const parsed = parseVersion(versionStr);
    const required: [number, number, number] = [major, minor, patch];
    return compareVersions(parsed, required) >= 0;
  } catch {
    // If version parsing fails, assume it's not compatible
    return false;
  }
}

/**
 * Check if multi-target vector search is supported for near_xxx queries
 * Requires Weaviate v1.26.0+
 */
export function supportsMultiTargetNear(serverVersion: string): boolean {
  return isVersionAtLeast(serverVersion, 1, 26, 0);
}

/**
 * Check if multi-target vector search is supported for hybrid queries
 * Requires Weaviate v1.27.0+
 */
export function supportsMultiTargetHybrid(serverVersion: string): boolean {
  return isVersionAtLeast(serverVersion, 1, 27, 0);
}

/**
 * Check if MUVERA encoding is supported
 * Introduced in Weaviate v1.31.0+
 */
export function supportsMUVERA(serverVersion: string): boolean {
  return isVersionAtLeast(serverVersion, 1, 31, 0);
}
