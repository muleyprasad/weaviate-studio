/**
 * Debounce utility for delaying function execution
 *
 * Prevents excessive API calls by waiting for user to stop typing
 */

/**
 * Debounce a function call
 *
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Debounce with immediate execution on first call
 *
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced function
 */
export function debounceImmediate<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let isFirstCall = true;

  return function debounced(...args: Parameters<T>) {
    // Execute immediately on first call
    if (isFirstCall) {
      func(...args);
      isFirstCall = false;
      return;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Cancel a debounced function
 *
 * @param debouncedFunc - Debounced function to cancel
 */
export function cancelDebounce(debouncedFunc: Function): void {
  // Note: This is a simplified version. In practice, you'd need to track timeouts
  // within the debounced function closure. For React hooks, use useRef to store the timeout.
}

/**
 * React hook for debouncing values
 *
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timeout on value change or unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for debounced callback
 *
 * @param callback - Callback to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @param deps - Dependency array
 * @returns Debounced callback
 */
import { useCallback, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, ...deps]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
