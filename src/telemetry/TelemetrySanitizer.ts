/**
 * Telemetry sanitizer for privacy-safe telemetry
 * Ensures no sensitive data is sent in telemetry events
 */

/**
 * List of forbidden property names that should never be sent
 */
const FORBIDDEN_PROPERTY_NAMES = [
  'apiKey',
  'api_key',
  'apikey',
  'password',
  'passwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'credential',
  'credentials',
  'private_key',
  'connectionString',
  'connection_string',
  'auth_token',
];

const FORBIDDEN_NAMES_LOWER = new Set(FORBIDDEN_PROPERTY_NAMES.map((s) => s.toLowerCase()));

/**
 * List of forbidden property patterns
 */
const FORBIDDEN_PROPERTY_PATTERNS = [/.*key.*$/i, /.*secret.*$/i, /.*password.*$/i, /.*token.*$/i];

/**
 * Sanitize a string value by removing potential sensitive data
 */
export function sanitizeString(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  // Remove potential URLs with credentials
  const urlPattern = /https?:\/\/[^:]+:[^@]+@/g;
  let sanitized = value.replace(urlPattern, 'https://');

  // Remove potential API keys (common patterns)
  const apiKeyPatterns = [
    /[A-Za-z0-9]{32,}/g, // Long alphanumeric strings
    /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style keys
    /Bearer\s+[A-Za-z0-9\-_]+/g, // Bearer tokens
  ];

  for (const pattern of apiKeyPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Check if a property name is forbidden
 */
export function isForbiddenPropertyName(propertyName: string): boolean {
  const lowerName = propertyName.toLowerCase();

  if (FORBIDDEN_NAMES_LOWER.has(lowerName)) {
    return true;
  }

  if (FORBIDDEN_PROPERTY_PATTERNS.some((pattern) => pattern.test(propertyName))) {
    return true;
  }

  return false;
}

/**
 * Sanitize telemetry properties object
 * Removes forbidden properties and sanitizes string values
 */
export function sanitizeProperties<T extends Record<string, unknown>>(properties: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Skip forbidden property names
    if (isForbiddenPropertyName(key)) {
      continue;
    }

    // Sanitize string values
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value) as unknown;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects, but skip complex objects
      if (!Array.isArray(value) && !(value instanceof Date)) {
        sanitized[key] = sanitizeProperties(value as Record<string, unknown>) as unknown;
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Sanitize a connection URL to remove host and credentials
 * Returns only the connection kind indicator
 */
export function sanitizeConnectionUrl(url: string | undefined): string {
  if (!url) {
    return 'unknown';
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check for Weaviate Cloud
    if (hostname.includes('weaviate.cloud')) {
      return 'cloud';
    }

    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'local';
    }

    // Everything else is custom
    return 'custom';
  } catch {
    return 'unknown';
  }
}
