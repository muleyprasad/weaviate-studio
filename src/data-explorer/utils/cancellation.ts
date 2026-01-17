/**
 * Query cancellation utilities using AbortController
 *
 * Allows cancelling pending requests when new ones are initiated
 */

import { useRef, useEffect } from 'react';

/**
 * Create an AbortController for cancellable requests
 *
 * @returns AbortController instance
 */
export function createAbortController(): AbortController {
  return new AbortController();
}

/**
 * Check if an error is an abort error
 *
 * @param error - Error to check
 * @returns True if error is from aborted request
 */
export function isAbortError(error: any): boolean {
  return (
    error &&
    (error.name === 'AbortError' ||
      error.message?.includes('abort') ||
      error.message?.includes('cancel'))
  );
}

/**
 * React hook for managing cancellable requests
 *
 * Automatically cancels pending requests when component unmounts
 * or when a new request is initiated
 *
 * @returns Object with abortController and cancel function
 */
export function useCancellableRequest() {
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Cancel current request and create new AbortController
   *
   * @returns New AbortController
   */
  const cancelAndRenew = (): AbortController => {
    // Cancel existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller
    const newController = createAbortController();
    abortControllerRef.current = newController;

    return newController;
  };

  /**
   * Cancel current request without creating new controller
   */
  const cancel = (): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  /**
   * Get current AbortController or create new one
   *
   * @returns Current or new AbortController
   */
  const getController = (): AbortController => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = createAbortController();
    }
    return abortControllerRef.current;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, []);

  return {
    /**
     * Get AbortSignal for fetch requests
     */
    getSignal: () => getController().signal,

    /**
     * Cancel current request and get new controller
     */
    cancelAndRenew,

    /**
     * Cancel current request
     */
    cancel,
  };
}

/**
 * Timeout wrapper for fetch requests
 *
 * @param promise - Promise to timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message
 * @returns Promise that rejects after timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  errorMessage: string = 'Request timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Retry a failed request with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Promise that resolves with result or rejects after max retries
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort errors
      if (isAbortError(error)) {
        throw error;
      }

      // Don't retry after max attempts
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Request failed after retries');
}
