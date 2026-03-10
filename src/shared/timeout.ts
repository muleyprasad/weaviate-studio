/**
 * Shared timeout utilities for Weaviate API requests.
 * Used by both RagChatAPI and DataExplorerAPI to avoid code duplication.
 */

/**
 * Fallback default timeout (30 s) used only when no explicit `timeoutMs` argument
 * is passed to `withTimeout` or `createTimeoutError`.
 *
 * Note: the actual RAG query timeout is 120 000 ms, sourced from the VS Code
 * configuration (`weaviate.ragQueryTimeoutMs`). This constant is NOT used there.
 */
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Format milliseconds to human-readable string (e.g., "5m", "30s", "2m 30s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${minutes}m`;
}

/**
 * Wraps a promise with a timeout.
 * Rejects if the promise doesn't resolve within the specified timeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`Request timed out after ${formatDuration(timeoutMs)} (${timeoutMs}ms)`)),
      timeoutMs
    );
  });
  return Promise.race([
    promise.then(
      (val) => {
        clearTimeout(timer);
        return val;
      },
      (err) => {
        clearTimeout(timer);
        throw err;
      }
    ),
    timeout,
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
    `${operation} timed out after ${formatDuration(timeoutMs)} (${timeoutMs}ms) for ${context}. ` +
      'Suggestions: Try again, reduce the limit, or check server connectivity.'
  );
}
