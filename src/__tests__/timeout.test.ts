import {
  formatDuration,
  withTimeout,
  isTimeoutError,
  createTimeoutError,
  DEFAULT_TIMEOUT_MS,
} from '../shared/timeout';

describe('timeout utilities', () => {
  describe('formatDuration', () => {
    it('formats milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('formats exact seconds correctly', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(30000)).toBe('30s');
      expect(formatDuration(59000)).toBe('59s');
    });

    it('formats exact minutes correctly', () => {
      expect(formatDuration(60000)).toBe('1m');
      expect(formatDuration(120000)).toBe('2m');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(90000)).toBe('1m 30s');
    });
  });

  describe('withTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves if the promise completes before the timeout', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 100);
      });

      const wrapper = withTimeout(promise, 500);
      jest.advanceTimersByTime(100);

      await expect(wrapper).resolves.toBe('success');
    });

    it('rejects if the timeout is reached', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 1000);
      });

      const wrapper = withTimeout(promise, 500);
      jest.advanceTimersByTime(500);

      await expect(wrapper).rejects.toThrow('Request timed out after 500ms (500ms)');
    });
  });

  describe('isTimeoutError', () => {
    it('returns true for timeout errors', () => {
      expect(isTimeoutError(new Error('Request timed out'))).toBe(true);
      expect(isTimeoutError('socket timeout')).toBe(true);
      expect(isTimeoutError('CONNECTION_TIMEOUT')).toBe(true);
    });

    it('returns false for non-timeout errors', () => {
      expect(isTimeoutError(new Error('Network error'))).toBe(false);
      expect(isTimeoutError('Not connected')).toBe(false);
      expect(isTimeoutError({ code: 500 })).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
    });
  });

  describe('createTimeoutError', () => {
    it('creates an error with expected formatting', () => {
      const error = createTimeoutError('RAG query', 'collection "test"', 60000);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('RAG query timed out');
      expect(error.message).toContain('1m (60000ms)');
      expect(error.message).toContain('collection "test"');
      expect(error.message).toContain('Suggestions: Try again');
    });

    it('uses default timeout if not provided', () => {
      const error = createTimeoutError('Test operation', 'test context');
      expect(error.message).toContain(`${formatDuration(DEFAULT_TIMEOUT_MS)}`);
    });
  });
});
