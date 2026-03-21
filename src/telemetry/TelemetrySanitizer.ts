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

  // Check exact matches
  if (FORBIDDEN_PROPERTY_NAMES.some((forbidden) => forbidden.toLowerCase() === lowerName)) {
    return true;
  }

  // Check patterns
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

/**
 * Sanitize a collection name to prevent PII leakage
 * Returns only structural metadata
 */
export function sanitizeCollectionName(name: string | undefined): string {
  if (!name) {
    return 'unknown';
  }

  // Return a hash or generic identifier instead of the actual name
  return `[collection_${name.length}]`;
}

/**
 * Sanitize GraphQL query to prevent query text leakage
 * Returns only high-level shape information
 */
export function sanitizeGraphQLQuery(query: string | undefined): {
  hasNearText: boolean;
  hasNearVector: boolean;
  hasHybrid: boolean;
  hasGenerative: boolean;
  hasAggregate: boolean;
  hasGet: boolean;
} {
  if (!query) {
    return {
      hasNearText: false,
      hasNearVector: false,
      hasHybrid: false,
      hasGenerative: false,
      hasAggregate: false,
      hasGet: false,
    };
  }

  return {
    hasNearText: /nearText/i.test(query),
    hasNearVector: /nearVector/i.test(query),
    hasHybrid: /hybrid/i.test(query),
    hasGenerative: /generative/i.test(query),
    hasAggregate: /aggregate/i.test(query),
    hasGet: /\bget\b/i.test(query),
  };
}

/**
 * Sanitize a prompt or user input to prevent content leakage
 */
export function sanitizePrompt(prompt: string | undefined): string | undefined {
  if (!prompt) {
    return undefined;
  }

  // Never send the actual prompt content
  return `[prompt_${prompt.length} chars]`;
}

/**
 * Validate that properties don't contain forbidden fields
 * Returns an array of validation errors
 */
export function validateProperties(
  properties: Record<string, unknown>
): Array<{ key: string; reason: string }> {
  const errors: Array<{ key: string; reason: string }> = [];

  for (const [key, value] of Object.entries(properties)) {
    if (isForbiddenPropertyName(key)) {
      errors.push({ key, reason: 'Forbidden property name' });
    }

    if (typeof value === 'string') {
      // Check for potential API key patterns in values
      if (/[A-Za-z0-9]{32,}/.test(value)) {
        errors.push({ key, reason: 'Potential API key detected in value' });
      }

      // Check for potential URLs with credentials
      if (/https?:\/\/[^:]+:[^@]+@/.test(value)) {
        errors.push({ key, reason: 'URL with credentials detected' });
      }
    }
  }

  return errors;
}

/**
 * Log telemetry validation errors for debugging (internal only, no UI popups)
 */
export function logTelemetryValidation(
  eventName: string,
  errors: Array<{ key: string; reason: string }>
): void {
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => `${e.key}: ${e.reason}`).join(', ');
    // Log to console only - never show UI popups for telemetry validation failures
    console.warn(`[Telemetry] Validation warnings for ${eventName}: ${errorMessages}`);
  }
}
