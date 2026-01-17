/**
 * Data Explorer Constants
 *
 * Centralized constants for the Data Explorer feature to avoid magic numbers
 * and ensure consistency across the application.
 */

/**
 * Vector Search default configuration values
 */
export const VECTOR_SEARCH_DEFAULTS = {
  /** Default number of results to return */
  LIMIT: 10,
  /** Default distance threshold (0 = identical, higher = more different) */
  DISTANCE: 0.5,
  /** Default certainty threshold (1 = identical, lower = less similar) */
  CERTAINTY: 0.7,
  /** Maximum distance value for filtering */
  MAX_DISTANCE: 2.0,
  /** Default to using distance metric instead of certainty */
  USE_DISTANCE: true,
} as const;

/**
 * Distance metric configuration thresholds
 */
export const DISTANCE_THRESHOLDS = {
  /** Minimum distance value (0 = identical) */
  MIN: 0.0,
  /** Maximum distance value (higher = more different) */
  MAX: 2.0,
  /** Step size for slider adjustments */
  STEP: 0.01,
} as const;

/**
 * Certainty metric configuration thresholds
 */
export const CERTAINTY_THRESHOLDS = {
  /** Minimum certainty value (0 = low confidence) */
  MIN: 0.0,
  /** Maximum certainty value (1 = identical) */
  MAX: 1.0,
  /** Step size for slider adjustments */
  STEP: 0.01,
} as const;

/**
 * Text search validation limits
 */
export const TEXT_SEARCH_LIMITS = {
  /** Minimum length for search text */
  MIN_LENGTH: 3,
  /** Maximum length for search text */
  MAX_LENGTH: 1000,
} as const;

/**
 * Data Explorer UI configuration
 */
export const DATA_EXPLORER_DEFAULTS = {
  /** Number of objects to fetch per page */
  PAGE_SIZE: 20,
} as const;

/**
 * Preview text configuration
 */
export const PREVIEW_CONFIG = {
  /** Default maximum length for preview text */
  DEFAULT_MAX_LENGTH: 150,
  /** Short preview maximum length (for inline display) */
  SHORT_PREVIEW_LENGTH: 100,
  /** Maximum length for property value snippets */
  PROPERTY_SNIPPET_LENGTH: 30,
  /** Maximum number of properties to show in fallback preview */
  MAX_PROPERTIES_IN_PREVIEW: 3,
} as const;

/**
 * Vector generation configuration
 */
export const VECTOR_CONFIG = {
  /** Default vector dimensions if not specified by schema */
  DEFAULT_DIMENSIONS: 384,
} as const;
