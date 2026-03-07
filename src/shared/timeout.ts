/**
 * Shared timeout utilities for Weaviate API requests.
 * Used by both RagChatAPI and DataExplorerAPI to avoid code duplication.
 */

// Default timeout for API requests (30 seconds)
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Wraps a promise with a timeout.
 * Rejects if the promise doesn't resolve within the specified timeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Checks if an error is a timeout error.
 */
export function isTimeoutError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('timeout') || message.includes('timed out');
}

/**
 * Creates a user-friendly timeout error message with actionable suggestions.
 */
export function createTimeoutError(
  operation: string,
  context: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Error {
  return new Error(
    `${operation} timed out after ${timeoutMs}ms for ${context}. ` +
      'Suggestions: Try again, reduce the limit, or check server connectivity.'
  );
}
