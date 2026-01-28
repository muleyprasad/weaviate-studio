/**
 * Type Renderers - Utility functions for formatting different data types
 * Provides consistent rendering for all Weaviate property types
 */

import type { CellRenderValue } from '../../types';

/**
 * Formats a number with comma separators
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Formats a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 0) {
    return 'In the future';
  }

  if (diff < 60000) {
    return 'Just now';
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }

  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  if (diff < 2592000000) {
    const weeks = Math.floor(diff / 604800000);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date as absolute time
 */
export function formatAbsoluteTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Truncates text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Formats a UUID by truncating it for display
 *
 * Uses 13 characters to show the first two segments of a standard UUID
 * (e.g., "123e4567-e89b..." from "123e4567-e89b-12d3-a456-426614174000")
 *
 * This provides enough context for visual identification while saving space:
 * - First segment (8 chars): Primary identification
 * - Hyphen (1 char): Visual separator
 * - Second segment start (4 chars): Additional context
 *
 * @param uuid - The UUID string to format
 * @returns Truncated UUID with ellipsis if longer than 13 characters
 */
export function formatUuid(uuid: string): string {
  if (uuid.length <= 13) {
    return uuid;
  }
  return uuid.substring(0, 13) + '...';
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Formats geo coordinates
 */
export function formatGeoCoordinates(coords: { latitude?: number; longitude?: number }): string {
  if (
    coords.latitude !== null &&
    coords.latitude !== undefined &&
    coords.longitude !== null &&
    coords.longitude !== undefined
  ) {
    return `📍 ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }
  return '📍 Invalid coordinates';
}

/**
 * Formats phone number
 */
export function formatPhoneNumber(phone: {
  input?: string;
  internationalFormatted?: string;
  countryCode?: number;
  nationalFormatted?: string;
}): string {
  if (phone.internationalFormatted) {
    return phone.internationalFormatted;
  }
  if (phone.nationalFormatted) {
    return phone.nationalFormatted;
  }
  if (phone.input) {
    return phone.input;
  }
  return 'Invalid phone number';
}

/**
 * Gets the data type from a value
 */
export function inferDataType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'array';
    }
    const firstType = inferDataType(value[0]);
    return `${firstType}[]`;
  }

  if (typeof value === 'object') {
    // Check for special object types
    if ('latitude' in value && 'longitude' in value) {
      return 'geoCoordinates';
    }
    if ('input' in value || 'internationalFormatted' in value) {
      return 'phoneNumber';
    }
    return 'object';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'number';
  }

  if (typeof value === 'string') {
    // Check if it's a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
      return 'uuid';
    }

    // Check if it's a date
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
    if (dateRegex.test(value)) {
      return 'date';
    }

    return 'text';
  }

  return 'unknown';
}

/**
 * Gets the count of items/properties in a complex value
 */
export function getItemCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length;
  }
  return 0;
}

/**
 * Renders a value for cell display
 */
export function renderCellValue(value: unknown, dataTypeHint?: string): CellRenderValue {
  if (value === null || value === undefined) {
    return {
      displayValue: '—',
      fullValue: value,
      dataType: 'null',
      isExpandable: false,
    };
  }

  const dataType = dataTypeHint || inferDataType(value);

  // Handle arrays
  if (Array.isArray(value)) {
    const itemCount = value.length;
    return {
      displayValue: `[${itemCount} item${itemCount !== 1 ? 's' : ''}]`,
      fullValue: value,
      dataType,
      isExpandable: true,
      itemCount,
    };
  }

  // Handle objects
  if (typeof value === 'object') {
    // GeoCoordinates
    if ('latitude' in value && 'longitude' in value) {
      return {
        displayValue: formatGeoCoordinates(value as { latitude: number; longitude: number }),
        fullValue: value,
        dataType: 'geoCoordinates',
        isExpandable: false,
      };
    }

    // PhoneNumber
    if ('input' in value || 'internationalFormatted' in value) {
      return {
        displayValue: formatPhoneNumber(
          value as {
            input?: string;
            internationalFormatted?: string;
            countryCode?: number;
            nationalFormatted?: string;
          }
        ),
        fullValue: value,
        dataType: 'phoneNumber',
        isExpandable: false,
      };
    }

    // Generic object
    const propCount = Object.keys(value).length;
    return {
      displayValue: `{${propCount} propert${propCount !== 1 ? 'ies' : 'y'}}`,
      fullValue: value,
      dataType: 'object',
      isExpandable: true,
      itemCount: propCount,
    };
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return {
      displayValue: value ? '✓' : '✗',
      fullValue: value,
      dataType: 'boolean',
      isExpandable: false,
    };
  }

  // Handle numbers
  if (typeof value === 'number') {
    return {
      displayValue: formatNumber(value),
      fullValue: value,
      dataType: Number.isInteger(value) ? 'int' : 'number',
      isExpandable: false,
    };
  }

  // Handle strings
  if (typeof value === 'string') {
    // UUID
    if (
      dataType === 'uuid' ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ) {
      return {
        displayValue: formatUuid(value),
        fullValue: value,
        dataType: 'uuid',
        isExpandable: false,
      };
    }

    // Date
    if (dataType === 'date' || /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      return {
        displayValue: formatRelativeTime(value),
        fullValue: value,
        dataType: 'date',
        isExpandable: false,
      };
    }

    // Regular text
    return {
      displayValue: truncateText(value, 100),
      fullValue: value,
      dataType: 'text',
      isExpandable: value.length > 100,
    };
  }

  // Fallback
  return {
    displayValue: String(value),
    fullValue: value,
    dataType: 'unknown',
    isExpandable: false,
  };
}

/**
 * Renders a vector for display
 */
export function renderVectorValue(vector: number[] | undefined): CellRenderValue {
  if (!vector || vector.length === 0) {
    return {
      displayValue: '—',
      fullValue: null,
      dataType: 'vector',
      isExpandable: false,
    };
  }

  return {
    displayValue: `🔢 [${vector.length} dims]`,
    fullValue: vector,
    dataType: 'vector',
    isExpandable: true,
    itemCount: vector.length,
  };
}

/**
 * Renders a blob for display
 */
export function renderBlobValue(blob: string | undefined): CellRenderValue {
  if (!blob) {
    return {
      displayValue: '—',
      fullValue: null,
      dataType: 'blob',
      isExpandable: false,
    };
  }

  // Base64 encoded blobs - estimate size
  const sizeBytes = Math.ceil((blob.length * 3) / 4);
  return {
    displayValue: `📄 ${formatFileSize(sizeBytes)}`,
    fullValue: blob,
    dataType: 'blob',
    isExpandable: false,
  };
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
