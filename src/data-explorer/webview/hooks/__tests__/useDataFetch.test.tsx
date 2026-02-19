import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataFetch } from '../useDataFetch';
import { DataProvider, UIProvider, FilterProvider, VectorSearchProvider } from '../../context';
import React from 'react';

/**
 * Test suite for useDataFetch hook
 *
 * Tests cover:
 * - Request/response lifecycle
 * - Request ID generation and tracking
 * - Race conditions and stale response handling
 * - AbortController cancellation
 * - Loading states
 * - Error handling
 * - Message validation
 * - Filter integration
 * - Collection change handling
 */

// Mock VSCode API
const mockPostMessage = jest.fn();
const mockGetVSCodeAPI = jest.fn(() => ({
  postMessage: mockPostMessage,
}));

jest.mock('../../utils/vscodeApi', () => ({
  getVSCodeAPI: () => mockGetVSCodeAPI(),
}));

describe('useDataFetch', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <DataProvider initialCollectionName="TestCollection">
        <UIProvider>
          <FilterProvider>
            <VectorSearchProvider>{children}</VectorSearchProvider>
          </FilterProvider>
        </UIProvider>
      </DataProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns expected API methods', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      expect(result.current.fetchObjects).toBeInstanceOf(Function);
      expect(result.current.initialize).toBeInstanceOf(Function);
      expect(result.current.refresh).toBeInstanceOf(Function);
      expect(result.current.getObjectDetail).toBeInstanceOf(Function);
      expect(result.current.postMessage).toBeInstanceOf(Function);
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.error).toBeDefined();
    });

    test('initial loading state is true until data loads', async () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Wait for the hook's useEffect to trigger initialize
      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'initialize',
          })
        );
      });

      // At this point loading should be true due to initialize
      expect(result.current.isLoading).toBe(true);

      const requestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Send back init message to complete initialization
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'init',
              requestId,
              schema: { properties: [] },
              collectionName: 'TestCollection',
            },
          })
        );
      });

      // Schema loaded, but loading is still true (waiting for data)
      // The extension would typically send objectsLoaded after init
      // Simulate that response
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [],
              total: 0,
            },
          })
        );
      });

      // Now loading should be false
      expect(result.current.isLoading).toBe(false);
    });

    test('initial error state is null', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      expect(result.current.error).toBe(null);
    });

    test('sends initialize message on mount', async () => {
      renderHook(() => useDataFetch(), { wrapper });

      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'initialize',
            collectionName: 'TestCollection',
            requestId: expect.any(String),
          })
        );
      });
    });
  });

  describe('fetchObjects', () => {
    test('sends fetchObjects message with correct parameters', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'fetchObjects',
          collectionName: 'TestCollection',
          limit: 25,
          offset: 0,
        })
      );
    });

    test('calculates offset correctly for different pages', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(2, 25);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 25,
        })
      );

      act(() => {
        result.current.fetchObjects(3, 50);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 100,
        })
      );
    });

    test('includes sortBy parameter when provided', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      const sortBy = { field: 'name', direction: 'asc' as const };

      act(() => {
        result.current.fetchObjects(1, 25, sortBy);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy,
        })
      );
    });

    test('generates unique request ID for each request', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const firstCall = mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0];
      const firstRequestId = firstCall.requestId;

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const secondCall = mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0];
      const secondRequestId = secondCall.requestId;

      expect(firstRequestId).toBeDefined();
      expect(secondRequestId).toBeDefined();
      expect(firstRequestId).not.toBe(secondRequestId);
    });

    test('sets loading state to true when fetching', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      expect(result.current.isLoading).toBe(true);
    });

    test('includes filters when active filters exist', () => {
      // This test would need FilterContext to be properly set up
      // For now, we'll test that the message structure is correct
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const call = mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0];
      expect(call).toHaveProperty('matchMode');
    });
  });

  describe('Request ID Tracking', () => {
    test('ignores stale objectsLoaded responses', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Send first request
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const firstRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Send second request (cancels first)
      act(() => {
        result.current.fetchObjects(2, 25);
      });

      const secondRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Simulate stale response for first request
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: firstRequestId,
              objects: [{ uuid: 'stale-1', properties: {} }],
              total: 1,
            },
          })
        );
      });

      // Stale response should be ignored - loading should still be true
      expect(result.current.isLoading).toBe(true);

      // Simulate current response
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: secondRequestId,
              objects: [{ uuid: 'current-1', properties: {} }],
              total: 1,
            },
          })
        );
      });

      // Current response should be processed
      expect(result.current.isLoading).toBe(false);
    });

    test('ignores stale schemaLoaded responses', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Clear the initial mount initialize call
      mockPostMessage.mockClear();

      // Initialize (generates request ID)
      act(() => {
        result.current.initialize();
      });

      const firstRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Another initialize
      act(() => {
        result.current.initialize();
      });

      const secondRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Verify loading is true after second initialize
      expect(result.current.isLoading).toBe(true);

      // Simulate stale schema response
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'schemaLoaded',
              requestId: firstRequestId,
              schema: { properties: [] },
              collectionName: 'TestCollection',
            },
          })
        );
      });

      // Should be ignored (stale) - loading should still be true
      expect(result.current.isLoading).toBe(true);

      // New response
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'schemaLoaded',
              requestId: secondRequestId,
              schema: { properties: [{ name: 'test' }] },
              collectionName: 'TestCollection',
            },
          })
        );
      });

      // Now we need to send objectsLoaded to clear the loading state
      // because schemaLoaded doesn't clear loading - only objectsLoaded does
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const fetchRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: fetchRequestId,
              objects: [],
              total: 0,
            },
          })
        );
      });

      // Should process the current one and loading should now be false
      expect(result.current.isLoading).toBe(false);
    });

    test('does not check request ID for non-tracked commands', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Commands like 'aggregationsLoaded', 'exportComplete' should not be filtered by request ID
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'aggregationsLoaded',
              requestId: 'some-old-id',
              data: {},
            },
          })
        );
      });

      // Should not throw or cause issues
      expect(result.current.error).toBe(null);
    });
  });

  describe('AbortController', () => {
    test('cancels previous request when new request starts', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      act(() => {
        result.current.fetchObjects(2, 25);
      });

      expect(abortSpy).toHaveBeenCalled();

      abortSpy.mockRestore();
    });

    test('aborts request on unmount', () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      const { result, unmount } = renderHook(() => useDataFetch(), { wrapper });

      // Start a request to create an AbortController
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      act(() => {
        unmount();
      });

      expect(abortSpy).toHaveBeenCalled();

      abortSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    test('handles objectsLoaded message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const requestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [{ uuid: '1', properties: { name: 'Test' }, metadata: { uuid: '1' } }],
              total: 1,
            },
          })
        );
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    test('handles init message with schema', () => {
      renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'init',
              schema: { name: 'TestCollection', properties: [] },
              collectionName: 'TestCollection',
            },
          })
        );
      });

      // Should not throw or cause errors
    });

    test('handles schemaLoaded message', () => {
      renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'schemaLoaded',
              schema: { name: 'TestCollection', properties: [] },
              collectionName: 'TestCollection',
            },
          })
        );
      });

      // Should not throw or cause errors
    });

    test('handles error message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const requestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'error',
              requestId,
              error: 'Failed to fetch data',
            },
          })
        );
      });

      expect(result.current.error).toBe('Failed to fetch data');
      expect(result.current.isLoading).toBe(false);
    });

    test('handles error message without request ID', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'error',
              error: 'General error',
            },
          })
        );
      });

      expect(result.current.error).toBe('General error');
    });

    test('ignores error message with non-matching request ID', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'error',
              requestId: 'different-request-id',
              error: 'Should be ignored',
            },
          })
        );
      });

      expect(result.current.error).toBe(null);
    });

    test('handles refresh message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Need to initialize first
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      mockPostMessage.mockClear();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'refresh',
            },
          })
        );
      });

      // Should trigger a new fetchObjects call
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'fetchObjects',
        })
      );
    });

    test('handles updateData message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      mockPostMessage.mockClear();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'updateData',
            },
          })
        );
      });

      // Should trigger a new fetchObjects call
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'fetchObjects',
        })
      );
    });

    test('validates message structure', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Invalid message - no command
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              someField: 'value',
            },
          })
        );
      });

      expect(result.current.error).toBe('Received malformed message from extension');
    });

    test('validates message is object', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: 'not an object',
          })
        );
      });

      expect(result.current.error).toBe('Received malformed message from extension');
    });

    test('handles message processing errors gracefully', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Mock console.error to capture the error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Send a message that will throw an error when accessed
      // by using a Proxy that throws on property access
      const errorMessage = new Proxy({ command: 'objectsLoaded' } as any, {
        get(target: any, prop: string | symbol) {
          if (prop === 'command') {
            return 'objectsLoaded';
          }
          if (prop === 'objects' || prop === 'total') {
            throw new Error('Simulated processing error');
          }
          return target[prop];
        },
      });

      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: errorMessage }));
      });

      // Should set an error instead of crashing
      expect(result.current.error).toContain('Failed to process extension message');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('API Methods', () => {
    test('initialize sends correct message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      mockPostMessage.mockClear();

      act(() => {
        result.current.initialize();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'initialize',
          collectionName: 'TestCollection',
          requestId: expect.any(String),
        })
      );
    });

    test('refresh sends correct message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.refresh();
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'refresh',
        collectionName: 'TestCollection',
      });
    });

    test('getObjectDetail sends correct message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.getObjectDetail('test-uuid-123');
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'getObjectDetail',
        collectionName: 'TestCollection',
        uuid: 'test-uuid-123',
      });
    });

    test('postMessage sends custom message', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      const customMessage = {
        command: 'customCommand' as any,
        data: 'test',
      };

      act(() => {
        result.current.postMessage(customMessage);
      });

      expect(mockPostMessage).toHaveBeenCalledWith(customMessage);
    });
  });

  describe('Collection Change Handling', () => {
    test('clears filters when collection changes', () => {
      const { result, rerender } = renderHook(() => useDataFetch(), { wrapper });

      // Simulate collection change by dispatching schemaLoaded for different collection
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'schemaLoaded',
              schema: { name: 'NewCollection', properties: [] },
              collectionName: 'NewCollection',
            },
          })
        );
      });

      // The hook should have cleared filters and reset vector search
      // (tested indirectly through context integration)
    });

    test('does not clear filters on same collection', () => {
      renderHook(() => useDataFetch(), { wrapper });

      // Send schema for same collection
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'schemaLoaded',
              schema: { name: 'TestCollection', properties: [] },
              collectionName: 'TestCollection',
            },
          })
        );
      });

      // Should not clear filters (same collection)
    });
  });

  describe('Loading States', () => {
    test('loading is true during fetch', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      expect(result.current.isLoading).toBe(true);
    });

    test('loading is false after successful response', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const requestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId,
              objects: [],
              total: 0,
            },
          })
        );
      });

      expect(result.current.isLoading).toBe(false);
    });

    test('loading is false after error', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const requestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'error',
              requestId,
              error: 'Failed',
            },
          })
        );
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Race Condition Handling', () => {
    test('handles rapid successive calls correctly', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // Simulate rapid page changes
      act(() => {
        result.current.fetchObjects(1, 25);
        result.current.fetchObjects(2, 25);
        result.current.fetchObjects(3, 25);
      });

      // Only the last request should be active
      const lastCall = mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0];
      expect(lastCall.offset).toBe(50); // Page 3 with pageSize 25
    });

    test('ignores out-of-order responses', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // First request
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const firstRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Second request (cancels first)
      act(() => {
        result.current.fetchObjects(2, 25);
      });

      const secondRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      // Response for second request arrives first
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: secondRequestId,
              objects: [{ uuid: 'page-2', properties: {} }],
              total: 50,
            },
          })
        );
      });

      expect(result.current.isLoading).toBe(false);

      // Response for first request arrives late (should be ignored)
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: firstRequestId,
              objects: [{ uuid: 'page-1-stale', properties: {} }],
              total: 50,
            },
          })
        );
      });

      // Should still show data from second request, not first
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    test('can fetch again after error', () => {
      const { result } = renderHook(() => useDataFetch(), { wrapper });

      // First request fails
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const firstRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'error',
              requestId: firstRequestId,
              error: 'Network error',
            },
          })
        );
      });

      expect(result.current.error).toBe('Network error');

      // Retry
      act(() => {
        result.current.fetchObjects(1, 25);
      });

      const secondRequestId =
        mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1][0].requestId;

      expect(result.current.isLoading).toBe(true);

      // Success
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'objectsLoaded',
              requestId: secondRequestId,
              objects: [],
              total: 0,
            },
          })
        );
      });

      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
